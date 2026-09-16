// 最小 docx 文本提取器（零依赖）：
// 解析 zip 中央目录 → 解压 word/document.xml → 提取正文并保留标题/列表层级
window.DOCX = (function () {
  function u16(b, o) { return b[o] | (b[o + 1] << 8); }
  function u32(b, o) { return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0; }

  function findEOCD(b) {
    const min = Math.max(0, b.length - 22 - 65535);
    for (let i = b.length - 22; i >= min; i--) {
      if (b[i] === 0x50 && b[i + 1] === 0x4B && b[i + 2] === 0x05 && b[i + 3] === 0x06) return i;
    }
    return -1;
  }

  async function inflateRaw(data) {
    if (typeof DecompressionStream === 'undefined') {
      throw new Error('当前浏览器版本过低，无法解压 docx，请更新 Edge/Chrome');
    }
    const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  async function extractText(arrayBuffer) {
    const b = new Uint8Array(arrayBuffer);
    if (b.length > 50 * 1024 * 1024) throw new Error('Word 文件超过 50 MB，请拆分后导入');
    const eocd = findEOCD(b);
    if (eocd < 0) throw new Error('不是有效的 docx 文件（缺少 zip 结构）');

    let p = u32(b, eocd + 16); // 中央目录偏移
    const count = u16(b, eocd + 10);
    const dec = new TextDecoder('utf-8');
    let xml = null;
    let stylesXml = null;

    for (let n = 0; n < count && p + 46 <= b.length; n++) {
      if (!(b[p] === 0x50 && b[p + 1] === 0x4B && b[p + 2] === 0x01 && b[p + 3] === 0x02)) break;
      const method = u16(b, p + 10);
      const compSize = u32(b, p + 20);
      const plainSize = u32(b, p + 24);
      const nameLen = u16(b, p + 28);
      const extraLen = u16(b, p + 30);
      const commentLen = u16(b, p + 32);
      const localOff = u32(b, p + 42);
      const name = dec.decode(b.subarray(p + 46, p + 46 + nameLen)).replace(/\\/g, '/');

      if (name === 'word/document.xml' || name === 'word/styles.xml') {
        if (method !== 0 && method !== 8) throw new Error('Word 正文使用了不支持的压缩方式');
        if (plainSize > 10 * 1024 * 1024) throw new Error('Word 正文过大，请拆分后导入');
        if (localOff + 30 > b.length) throw new Error('Word 文件结构不完整');
        const nameLen2 = u16(b, localOff + 26);
        const extraLen2 = u16(b, localOff + 28);
        const dataStart = localOff + 30 + nameLen2 + extraLen2;
        if (dataStart + compSize > b.length) throw new Error('Word 文件结构不完整');
        const data = b.subarray(dataStart, dataStart + compSize);
        const raw = method === 0 ? data : await inflateRaw(data);
        const content = new TextDecoder('utf-8').decode(raw);
        if (name === 'word/document.xml') xml = content;
        else stylesXml = content;
      }
      p += 46 + nameLen + extraLen + commentLen;
    }
    if (!xml) throw new Error('docx 中找不到正文（word/document.xml），可能不是标准 Word 文档');

    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) throw new Error('docx 正文 XML 解析失败');
    let ns = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
    let paras = doc.getElementsByTagNameNS(ns, 'p');
    if (!paras.length) {
      ns = 'http://purl.oclc.org/ooxml/wordprocessingml/main';
      paras = doc.getElementsByTagNameNS(ns, 'p');
    }

    // 解析自定义段落样式的大纲级别，并沿 basedOn 继承链解析。
    const styleInfo = {};
    if (stylesXml) {
      const stylesDoc = new DOMParser().parseFromString(stylesXml, 'application/xml');
      if (!stylesDoc.getElementsByTagName('parsererror').length) {
        const styleNodes = stylesDoc.getElementsByTagNameNS(ns, 'style');
        for (let i = 0; i < styleNodes.length; i++) {
          const node = styleNodes[i];
          const id = node.getAttributeNS(ns, 'styleId') || node.getAttribute('w:styleId') || node.getAttribute('styleId');
          if (!id) continue;
          const info = { level: 0, basedOn: '', name: '', size: 0, bold: null, isDefault: false };
          const defaultAttr = node.getAttributeNS(ns, 'default') || node.getAttribute('w:default') || node.getAttribute('default');
          info.isDefault = defaultAttr === '1' || defaultAttr === 'true';
          const outline = node.getElementsByTagNameNS(ns, 'outlineLvl');
          if (outline.length) {
            const v = outline[0].getAttributeNS(ns, 'val') || outline[0].getAttribute('w:val') || outline[0].getAttribute('val');
            if (v !== '' && v != null && Number(v) >= 0 && Number(v) <= 5) info.level = Number(v) + 1;
          }
          const based = node.getElementsByTagNameNS(ns, 'basedOn');
          if (based.length) info.basedOn = based[0].getAttributeNS(ns, 'val') || based[0].getAttribute('w:val') || based[0].getAttribute('val') || '';
          const names = node.getElementsByTagNameNS(ns, 'name');
          if (names.length) info.name = names[0].getAttributeNS(ns, 'val') || names[0].getAttribute('w:val') || names[0].getAttribute('val') || '';
          const namedHeading = info.name.match(/(?:heading|标题)\s*([1-6])/i);
          if (!info.level && namedHeading) info.level = Number(namedHeading[1]);
          const sizes = node.getElementsByTagNameNS(ns, 'sz');
          if (sizes.length) {
            const v = sizes[0].getAttributeNS(ns, 'val') || sizes[0].getAttribute('w:val') || sizes[0].getAttribute('val');
            if (v && Number(v) > 0) info.size = Number(v); // OOXML 为半磅值
          }
          const bolds = node.getElementsByTagNameNS(ns, 'b');
          if (bolds.length) {
            const v = bolds[0].getAttributeNS(ns, 'val') || bolds[0].getAttribute('w:val') || bolds[0].getAttribute('val');
            info.bold = !/^(?:0|false|off)$/i.test(v || 'true');
          }
          styleInfo[id] = info;
        }
      }
    }
    function styleLevel(styleId, seen) {
      if (!styleId || !styleInfo[styleId]) return 0;
      const visited = seen || {};
      if (visited[styleId]) return 0;
      visited[styleId] = true;
      return styleInfo[styleId].level || styleLevel(styleInfo[styleId].basedOn, visited);
    }
    function styleProp(styleId, prop, seen) {
      if (!styleId || !styleInfo[styleId]) return prop === 'bold' ? null : 0;
      const visited = seen || {};
      if (visited[styleId]) return prop === 'bold' ? null : 0;
      visited[styleId] = true;
      const own = styleInfo[styleId][prop];
      if (own !== null && own !== 0 && own !== '') return own;
      return styleProp(styleInfo[styleId].basedOn, prop, visited);
    }

    // 一些资料只用“加粗 + 大字号”的自定义样式而没有设置大纲级别。
    // 仅在字号明显大于正文时推断标题，避免把正文中的加粗金句误判为章节。
    const usedStyles = {};
    for (let i = 0; i < paras.length; i++) {
      const nodes = paras[i].getElementsByTagNameNS(ns, 'pStyle');
      if (!nodes.length) continue;
      const id = nodes[0].getAttributeNS(ns, 'val') || nodes[0].getAttribute('w:val') || nodes[0].getAttribute('val') || '';
      if (id) usedStyles[id] = (usedStyles[id] || 0) + 1;
    }
    let normalStyle = 'Normal';
    Object.keys(styleInfo).forEach(function (id) { if (styleInfo[id].isDefault) normalStyle = id; });
    const normalSize = styleProp(normalStyle, 'size') || 21;
    const inferredStyleLevels = {};
    const largeStyles = Object.keys(usedStyles).filter(function (id) {
      return !styleLevel(id) && styleProp(id, 'bold') === true && styleProp(id, 'size') >= normalSize + 4;
    }).sort(function (a, b) { return styleProp(b, 'size') - styleProp(a, 'size'); });
    const distinctSizes = [];
    largeStyles.forEach(function (id) {
      const size = styleProp(id, 'size');
      if (distinctSizes.indexOf(size) < 0) distinctSizes.push(size);
      inferredStyleLevels[id] = Math.min(6, distinctSizes.indexOf(size) + 1);
    });

    // 最后处理完全不用样式、只手动设置“加粗 + 大字号”的标题。
    const directCandidates = [];
    for (let i = 0; i < paras.length; i++) {
      const textNodes = paras[i].getElementsByTagNameNS(ns, 't');
      let textLength = 0;
      for (let j = 0; j < textNodes.length; j++) textLength += (textNodes[j].textContent || '').trim().length;
      if (textLength < 2 || textLength > 80 || paras[i].getElementsByTagNameNS(ns, 'numPr').length) continue;
      const runs = paras[i].getElementsByTagNameNS(ns, 'r');
      let textRuns = 0, boldRuns = 0, minSize = Infinity;
      for (let j = 0; j < runs.length; j++) {
        const runText = runs[j].getElementsByTagNameNS(ns, 't');
        let hasText = false;
        for (let k = 0; k < runText.length; k++) if ((runText[k].textContent || '').trim()) hasText = true;
        if (!hasText) continue;
        textRuns++;
        const bolds = runs[j].getElementsByTagNameNS(ns, 'b');
        if (bolds.length) {
          const v = bolds[0].getAttributeNS(ns, 'val') || bolds[0].getAttribute('w:val') || bolds[0].getAttribute('val');
          if (!/^(?:0|false|off)$/i.test(v || 'true')) boldRuns++;
        }
        const sizes = runs[j].getElementsByTagNameNS(ns, 'sz');
        if (sizes.length) {
          const v = sizes[0].getAttributeNS(ns, 'val') || sizes[0].getAttribute('w:val') || sizes[0].getAttribute('val');
          if (v && Number(v) > 0) minSize = Math.min(minSize, Number(v));
        }
      }
      if (!textRuns || !Number.isFinite(minSize)) continue;
      if (minSize >= normalSize + 4 && (boldRuns === textRuns || minSize >= normalSize + 8)) {
        directCandidates.push({ index: i, size: minSize });
      }
    }
    const directSizes = [];
    const directHeadingLevels = {};
    directCandidates.sort(function (a, b) { return b.size - a.size; }).forEach(function (item) {
      if (directSizes.indexOf(item.size) < 0) directSizes.push(item.size);
      directHeadingLevels[item.index] = Math.min(6, directSizes.indexOf(item.size) + 1);
    });
    const out = [];
    for (let i = 0; i < paras.length; i++) {
      let line = '';
      const nodes = paras[i].getElementsByTagNameNS(ns, 't');
      for (let j = 0; j < nodes.length; j++) line += nodes[j].textContent;
      if (!line.trim()) { out.push(''); continue; }

      // Word 样式是识别长篇资料章节边界最可靠的信号。转换为轻量 Markdown，
      // 后续解析器既能保留结构，也能兼容用户直接粘贴的普通文本。
      const styleNodes = paras[i].getElementsByTagNameNS(ns, 'pStyle');
      let style = '';
      if (styleNodes.length) {
        style = styleNodes[0].getAttributeNS(ns, 'val') ||
          styleNodes[0].getAttribute('w:val') || styleNodes[0].getAttribute('val') || '';
      }
      let headingLevel = 0;
      const styleHeading = style.match(/^(?:Heading|heading)\s*([1-6])$/) || style.match(/^([1-6])$/);
      if (styleHeading) headingLevel = Number(styleHeading[1]);
      if (!headingLevel) headingLevel = styleLevel(style);
      if (!headingLevel) headingLevel = inferredStyleLevels[style] || 0;
      if (!headingLevel) headingLevel = directHeadingLevels[i] || 0;
      // 自定义标题样式通常通过 outlineLvl 指定大纲级别，也应保留下来。
      if (!headingLevel) {
        const outlineNodes = paras[i].getElementsByTagNameNS(ns, 'outlineLvl');
        if (outlineNodes.length) {
          const v = outlineNodes[0].getAttributeNS(ns, 'val') ||
            outlineNodes[0].getAttribute('w:val') || outlineNodes[0].getAttribute('val');
          if (v !== '' && v != null && Number(v) >= 0 && Number(v) <= 5) headingLevel = Number(v) + 1;
        }
      }
      if (headingLevel) line = '#'.repeat(headingLevel) + ' ' + line;
      else if (/List(?:Bullet|Paragraph)|Bullet/i.test(style) || paras[i].getElementsByTagNameNS(ns, 'numPr').length) line = '- ' + line;
      out.push(line);
    }
    return out.join('\n');
  }

  return { extractText: extractText };
})();
