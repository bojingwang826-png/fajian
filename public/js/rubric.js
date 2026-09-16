// 结构化采分点：从答案生成、编辑、校验，并为 AI 判分提供稳定口径。
(function () {
  const ORDINAL = /^[\s#]*(?:第?[一二三四五六七八九十百]+|\d+)[、.．)）]\s*/;

  function clean(value) { return String(value || '').replace(/\r/g, '').trim(); }

  function derive(answer) {
    const lines = clean(answer).split('\n').map(function (x) { return x.trim(); }).filter(Boolean);
    const groups = [];
    let current = null;
    lines.forEach(function (line) {
      if (ORDINAL.test(line) || /^【[^】]{2,20}】/.test(line)) {
        if (current) groups.push(current);
        const body = line.replace(ORDINAL, '').trim();
        const colon = body.search(/[:：]/);
        current = {
          name: (body.match(/^【([^】]+)】/) || [])[1] || (colon > 0 ? body.slice(0, colon) : body).trim().slice(0, 40) || '采分点',
          correct: line
        };
      } else if (current) {
        current.correct += '\n' + line;
      }
    });
    if (current) groups.push(current);
    if (groups.length < 2) {
      const sentences = clean(answer).split(/(?<=[。；;])\s*/).map(function (x) { return x.trim(); })
        .filter(function (x) { return x.length >= 8; }).slice(0, 12);
      if (sentences.length >= 2) {
        groups.length = 0;
        sentences.forEach(function (s, i) {
          const plain = s.replace(ORDINAL, '').replace(/[。；;]+$/, '');
          const colon = plain.search(/[:：]/);
          groups.push({ name: (colon > 0 ? plain.slice(0, colon) : plain).slice(0, 30) || ('采分点' + (i + 1)), correct: s });
        });
      }
    }
    if (!groups.length && clean(answer)) groups.push({ name: '完整表述', correct: clean(answer) });
    return normalize(groups);
  }

  function normalize(points) {
    const list = (Array.isArray(points) ? points : []).map(function (p, i) {
      return {
        name: clean(p && p.name) || ('采分点' + (i + 1)),
        full: Number(p && p.full) > 0 ? Number(p.full) : 0,
        correct: clean(p && p.correct),
        keywords: Array.isArray(p && p.keywords) ? p.keywords.map(clean).filter(Boolean) : []
      };
    }).filter(function (p) { return p.correct || p.name; });
    if (!list.length) return [];
    const supplied = list.reduce(function (n, p) { return n + p.full; }, 0);
    if (supplied <= 0) {
      const base = Math.floor(1000 / list.length) / 10;
      list.forEach(function (p) { p.full = base; });
      list[list.length - 1].full = Math.round((100 - base * (list.length - 1)) * 10) / 10;
    } else if (Math.abs(supplied - 100) > 0.01) {
      let used = 0;
      list.forEach(function (p, i) {
        p.full = i === list.length - 1 ? Math.round((100 - used) * 10) / 10 : Math.round(p.full / supplied * 1000) / 10;
        used += p.full;
      });
    }
    return list;
  }

  function format(points) {
    return normalize(points).map(function (p) {
      return [p.full, p.name, p.correct.replace(/\n/g, ' ')].join(' | ');
    }).join('\n');
  }

  function parse(text) {
    const points = clean(text).split('\n').map(function (line) {
      const parts = line.split('|').map(function (x) { return x.trim(); });
      if (parts.length < 3) return null;
      return { full: Number(parts[0]), name: parts[1], correct: parts.slice(2).join(' | ') };
    }).filter(Boolean);
    return normalize(points);
  }

  function promptText(q) {
    const points = normalize((q && q.rubric) || derive(q && q.answer));
    if (!points.length) return '';
    return points.map(function (p, i) {
      return (i + 1) + '. [' + p.full + '分] ' + p.name + '：' + p.correct;
    }).join('\n');
  }

  function quality(q, existing) {
    const warnings = [];
    const answer = clean(q && q.answer);
    if (!q || !clean(q.title)) warnings.push('缺少题目名称');
    if (answer.length < 40) warnings.push('答案过短');
    if (answer.length > 5000) warnings.push('答案异常长，可能合并了多个专题');
    if (!q.subject || q.subject === '未分类') warnings.push('科目待确认');
    const n = normalize(q.rubric || derive(answer)).length;
    if (n < 2) warnings.push('采分点结构较弱');
    const key = clean(q.title).replace(/[\s【】《》：:，,。.、]/g, '').toLowerCase();
    if (key && (existing || []).some(function (x) {
      return clean(x.title).replace(/[\s【】《》：:，,。.、]/g, '').toLowerCase() === key && x !== q;
    })) warnings.push('题库中已有同名题目');
    return warnings;
  }

  window.Rubric = { derive: derive, normalize: normalize, format: format, parse: parse, promptText: promptText, quality: quality };
})();
