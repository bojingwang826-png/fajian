// PDF 与图片资料读取。文字型 PDF 本地提取；扫描页和图片在已配置 AI 时使用视觉 OCR。
(function () {
  let pdfPromise = null;
  function ensurePdfJs() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    if (pdfPromise) return pdfPromise;
    pdfPromise = new Promise(function (resolve, reject) {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      s.onload = function () {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        resolve(window.pdfjsLib);
      };
      s.onerror = function () { reject(new Error('PDF 组件加载失败，请检查网络后重试')); };
      document.head.appendChild(s);
    });
    return pdfPromise;
  }

  function fileDataUrl(file) {
    return new Promise(function (resolve, reject) {
      const r = new FileReader();
      r.onload = function () { resolve(r.result); };
      r.onerror = function () { reject(r.error); };
      r.readAsDataURL(file);
    });
  }

  async function ocrImage(file) {
    if (!LLM.configured()) throw new Error('图片文字识别需要先配置支持图片的 AI 模型');
    if (file.size > 10 * 1024 * 1024) throw new Error('图片不能超过 10MB');
    return LLM.vision('请准确识别图片中的全部中文文字，保持原有标题、编号、题目和答案的换行层级。只输出识别文字，不要解释。', await fileDataUrl(file));
  }

  // PDF.js 的 textContent 默认是零散文字块。直接 join 会把整页压成一行，
  // 使“专题 1 / 是什么 / 为什么”等标题结构全部丢失。这里按基线坐标
  // 重新分行，再根据字号恢复 Markdown 标题，供通用题目解析器使用。
  function textItemsToLines(items) {
    const rows = [];
    (items || []).forEach(function (item) {
      const raw = String(item && item.str || '').replace(/\uF0B7/g, '•').trim();
      if (!raw) return;
      const t = item.transform || [1, 0, 0, 1, 0, 0];
      const x = Number(t[4]) || 0;
      const y = Number(t[5]) || 0;
      const height = Math.max(1, Number(item.height) || Math.abs(Number(t[3])) || Math.abs(Number(t[0])) || 10);
      const width = Math.max(0, Number(item.width) || 0);
      let row = null;
      for (let i = 0; i < rows.length; i++) {
        const tolerance = Math.max(2.2, Math.min(rows[i].height, height) * 0.34);
        if (Math.abs(rows[i].y - y) <= tolerance) { row = rows[i]; break; }
      }
      if (!row) {
        row = { y: y, height: height, items: [] };
        rows.push(row);
      }
      row.items.push({ text: raw, x: x, width: width, height: height });
      row.height = Math.max(row.height, height);
    });

    rows.sort(function (a, b) { return b.y - a.y; });
    let lines = rows.map(function (row) {
      row.items.sort(function (a, b) { return a.x - b.x; });
      let text = '';
      let previous = null;
      row.items.forEach(function (item) {
        let separator = '';
        if (previous) {
          const gap = item.x - (previous.x + previous.width);
          const threshold = Math.max(1.2, Math.min(previous.height, item.height) * 0.14);
          if (gap > threshold && !/^[，。；：、！？）】》,.!?;:)]/.test(item.text) && !/[（【《(]$/.test(text)) separator = ' ';
        }
        text += separator + item.text;
        previous = item;
      });
      return { text: text.replace(/[ \t]+/g, ' ').trim(), size: row.height };
    }).filter(function (line) { return line.text; });

    // 页脚通常是单独的页码，不能混进最后一道题的答案。
    while (lines.length && /^\d{1,3}$/.test(lines[lines.length - 1].text)) lines.pop();

    // 少数 PDF 中专题号与标题使用不同字体，基线会相差 2-4px。
    // 若因此被拆成相邻两行，在这里重新组合。
    const merged = [];
    for (let i = 0; i < lines.length; i++) {
      const current = lines[i];
      if (/^专题/.test(current.text) && i + 1 < lines.length && /^[0-9一二三四五六七八九十]{1,3}$/.test(lines[i + 1].text)) {
        const rest = current.text.replace(/^专题\s*/, '').trim();
        current.text = '专题 ' + lines[i + 1].text + (rest ? ' ' + rest : '');
        current.size = Math.max(current.size, lines[i + 1].size);
        i++;
      }
      merged.push(current);
    }
    lines = merged;

    const sizes = lines.map(function (line) { return line.size; }).sort(function (a, b) { return a - b; });
    const bodySize = sizes.length ? sizes[Math.floor(sizes.length / 2)] : 10;
    return lines.map(function (line) {
      let prefix = '';
      if (line.text.length <= 80 && line.size >= bodySize * 1.38) prefix = '# ';
      else if (line.text.length <= 40 && line.size >= bodySize * 1.12) prefix = '## ';
      return prefix + line.text;
    }).join('\n');
  }

  async function extractPdf(file, onProgress) {
    const pdfjs = await ensurePdfJs();
    const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    if (pdf.numPages > 100) throw new Error('PDF 页数过多，请拆分为不超过100页的文件');
    const pages = [];
    for (let n = 1; n <= pdf.numPages; n++) {
      if (onProgress) onProgress(n, pdf.numPages);
      const page = await pdf.getPage(n);
      const content = await page.getTextContent();
      let text = textItemsToLines(content.items).trim();
      if (text.length < 20) {
        if (!LLM.configured()) throw new Error('第' + n + '页是扫描图片，请配置支持图片的 AI 模型进行 OCR');
        const viewport = page.getViewport({ scale: 1.6 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width; canvas.height = viewport.height;
        await page.render({ canvasContext: canvas.getContext('2d'), viewport: viewport }).promise;
        text = await LLM.vision('这是法考资料第' + n + '页。请逐字识别全部中文文字，保持标题、编号和段落换行。只输出识别文字。', canvas.toDataURL('image/jpeg', 0.88));
      }
      pages.push('<!--PDF_PAGE:' + n + '-->\n' + text);
    }
    return pages.join('\n\n');
  }

  async function extract(file, onProgress) {
    if (/\.docx$/i.test(file.name)) return DOCX.extractText(await file.arrayBuffer());
    if (/\.pdf$/i.test(file.name)) return extractPdf(file, onProgress);
    if (/\.(?:png|jpe?g|webp|bmp)$/i.test(file.name)) return ocrImage(file);
    if (/\.doc$/i.test(file.name)) throw new Error('老版 .doc 暂不支持，请先另存为 .docx');
    return file.text();
  }

  window.Documents = { extract: extract, extractPdf: extractPdf, ocrImage: ocrImage, textItemsToLines: textItemsToLines };
})();
