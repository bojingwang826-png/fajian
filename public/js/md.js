// 迷你 Markdown 渲染器：针对判分结果的输出格式定制（标题/表格/列表/加粗/引用/代码/🔴🟡高亮）
(function () {
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // 行内：加粗、行内代码、🔴🟡高亮段、裸【错误/建议】标注
  function inline(line) {
    let s = esc(line);
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    // 🔴/🟡 开头的段落：覆盖到紧随的【错误：…】/【建议：…】结尾，或行尾/下一个emoji
    s = s.replace(/[🔴🟡][^\n🔴🟡]*/gu, function (seg) {
      const isErr = seg.startsWith('🔴');
      const key = isErr ? '【错误' : '【建议';
      let stop = seg.length;
      const a = seg.indexOf(key);
      if (a >= 0) {
        const close = seg.indexOf('】', a);
        if (close >= 0) stop = close + 1;
      }
      return '<mark class="' + (isErr ? 'mk-red' : 'mk-yel') + '">' + seg.slice(0, stop) + '</mark>' + seg.slice(stop);
    });
    // 裸标注（前面没有emoji的）——只处理不在 <mark> 内的部分
    s = s.split(/(<mark[^>]*>[\s\S]*?<\/mark>)/g).map(function (part) {
      if (part.startsWith('<mark')) return part;
      return part.replace(/【(错误|建议)：[^】]*】/g, function (m) {
        return '<mark class="' + (m.startsWith('【错误') ? 'mk-red' : 'mk-yel') + '">' + m + '</mark>';
      });
    }).join('');
    return s;
  }

  function isTableRow(line) { return /^\s*\|.*\|\s*$/.test(line); }
  function isTableSep(line) { return /^\s*\|[\s:|-]+\|\s*$/.test(line); }
  function splitRow(line) {
    return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(function (c) { return c.trim(); });
  }

  function render(src) {
    const lines = String(src || '').replace(/\r\n/g, '\n').split('\n');
    const out = [];
    let i = 0;
    while (i < lines.length) {
      let line = lines[i];

      if (/^\s*$/.test(line)) { i++; continue; }

      // 代码块
      if (/^\s*```/.test(line)) {
        const buf = [];
        i++;
        while (i < lines.length && !/^\s*```/.test(lines[i])) { buf.push(lines[i]); i++; }
        i++;
        out.push('<pre><code>' + esc(buf.join('\n')) + '</code></pre>');
        continue;
      }

      // 表格
      if (isTableRow(line) && i + 1 < lines.length && isTableSep(lines[i + 1])) {
        const head = splitRow(line);
        i += 2;
        const rows = [];
        while (i < lines.length && isTableRow(lines[i])) { rows.push(splitRow(lines[i])); i++; }
        let h = '<table><thead><tr>' + head.map(function (c) { return '<th>' + inline(c) + '</th>'; }).join('') + '</tr></thead><tbody>';
        rows.forEach(function (r) {
          h += '<tr>' + head.map(function (_, k) { return '<td>' + inline(r[k] == null ? '' : r[k]) + '</td>'; }).join('') + '</tr>';
        });
        h += '</tbody></table>';
        out.push(h);
        continue;
      }

      // 标题
      const hm = line.match(/^\s*(#{1,6})\s+(.*)$/);
      if (hm) {
        const lv = Math.min(hm[1].length, 3);
        out.push('<h' + lv + '>' + inline(hm[2]) + '</h' + lv + '>');
        i++;
        continue;
      }

      // 引用
      if (/^\s*>/.test(line)) {
        const buf = [];
        while (i < lines.length && /^\s*>/.test(lines[i])) { buf.push(lines[i].replace(/^\s*>\s?/, '')); i++; }
        out.push('<blockquote>' + buf.map(inline).join('<br>') + '</blockquote>');
        continue;
      }

      // 列表（无序/有序，支持连续行）
      const lm = line.match(/^\s*([-*•]|\d{1,2}[.)])\s+(.*)$/);
      if (lm) {
        const ordered = /\d/.test(lm[1]);
        const buf = [];
        while (i < lines.length) {
          const m2 = lines[i].match(/^\s*([-*•]|\d{1,2}[.)])\s+(.*)$/);
          if (m2 && (/\d/.test(m2[1]) === ordered)) { buf.push('<li>' + inline(m2[2]) + '</li>'); i++; }
          else if (/^\s*$/.test(lines[i]) && i + 1 < lines.length && /^\s*([-*•]|\d{1,2}[.)])\s+/.test(lines[i + 1])) { i++; }
          else break;
        }
        out.push(ordered ? '<ol>' + buf.join('') + '</ol>' : '<ul>' + buf.join('') + '</ul>');
        continue;
      }

      // 普通段落（连续非空、非结构行合并）
      const buf = [line];
      i++;
      while (i < lines.length && !/^\s*$/.test(lines[i]) && !/^\s*(#{1,6}\s|>|```|[-*•]\s|\d{1,2}[.)]\s)/.test(lines[i]) && !isTableRow(lines[i])) {
        buf.push(lines[i]); i++;
      }
      out.push('<p>' + buf.map(inline).join('<br>') + '</p>');
    }
    return out.join('\n');
  }

  window.MD = { render: render, esc: esc };
})();
