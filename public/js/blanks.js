// 挖空引擎：解析 AI 生成的填空题文本 / 本地规则快速挖空
(function () {
  let lastExpected = [];
  // 解析含 ______（N分） 的文本 → parts: [{type:'text',text}| {type:'blank',idx,score}]
  function parseToParts(text) {
    text = String(text || '').trim();
    if (!/_{3,}/.test(text)) return null;
    const parts = [];
    const scores = [];
    const re = /_{3,}(\s*[（(]\s*(\d+(?:\.\d+)?)\s*分?\s*[）)])?/g;
    let m, last = 0;
    while ((m = re.exec(text))) {
      if (m.index > last) parts.push({ type: 'text', text: text.slice(last, m.index) });
      parts.push({ type: 'blank' });
      scores.push(m[2] != null ? parseFloat(m[2]) : null);
      last = re.lastIndex;
    }
    if (last < text.length) parts.push({ type: 'text', text: text.slice(last) });

    const n = scores.length;
    if (!n) return null;
    const unknownIdx = [];
    let known = 0;
    scores.forEach(function (s, i) { if (s == null) unknownIdx.push(i); else known += s; });
    if (known > 100) known = 100;
    const rest = 100 - known;
    const each = unknownIdx.length ? Math.floor(rest / unknownIdx.length) : 0;
    let rem = unknownIdx.length ? rest - each * unknownIdx.length : 0;
    unknownIdx.forEach(function (i) {
      let v = each + (rem > 0 ? 1 : 0);
      if (rem > 0) rem--;
      scores[i] = Math.max(1, v);
    });

    let bi = 0;
    parts.forEach(function (p) {
      if (p.type === 'blank') { p.idx = bi; p.score = scores[bi]; bi++; }
    });
    const total = parts.reduce(function (a, p) { return a + (p.type === 'blank' ? p.score : 0); }, 0);
    return { parts: parts, count: bi, total: total };
  }

  // ====== 本地快速挖空（无需 AI，近似规则） ======
  function isCJK(ch) { return /[\u4e00-\u9fa5]/.test(ch); }
  function tokenLen(t) { return Array.from(t).length; }

  function splitSentences(text) {
    const out = [];
    text.split('\n').forEach(function (line) {
      if (!line.trim()) { out.push('\n'); return; }
      const pieces = line.match(/[^。；;！!？]*[。；;！!？]+|[^。；;！!？]+$/g) || [line];
      pieces.forEach(function (p) { out.push(p); });
    });
    return out;
  }

  function candidatesOf(sentence) {
    const tokens = sentence.split(/[，、：:；""''（）()《》\[\]【】\s,.，;；!！?？。]+/);
    return tokens.filter(function (t) {
      const len = tokenLen(t);
      if (len < 2 || len > 8) return false;
      let cjk = 0;
      for (const ch of t) { if (isCJK(ch)) cjk++; }
      return cjk >= Math.max(2, Math.floor(len / 2)); // 以中文为主的词才算术语候选
    });
  }

  function generateLocal(answer) {
    lastExpected = [];
    const text = String(answer || '').replace(/\r/g, '').trim();
    if (!text) return '';
    const sentences = splitSentences(text);
    const withCand = [];
    sentences.forEach(function (s, i) {
      const cands = candidatesOf(s);
      if (cands.length) withCand.push(i);
    });
    if (!withCand.length) return '';
    // 打乱后取约 60% 的句挖空
    for (let i = withCand.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = withCand[i]; withCand[i] = withCand[j]; withCand[j] = t;
    }
    const target = Math.max(1, Math.round(withCand.length * 0.6));
    const chosen = new Set(withCand.slice(0, target));

    const result = sentences.map(function (s, i) {
      if (i === 0) return s; // 第一句保留原文，帮助回忆框架
      if (!chosen.has(i)) return s;
      const cands = candidatesOf(s).sort(function (a, b) { return tokenLen(b) - tokenLen(a); });
      if (!cands.length) return s;
      const pick = cands[Math.floor(Math.random() * Math.min(3, cands.length))];
      const out = s.replace(pick, '______');
      if (out === s) return s; // 未替换成功（重复词取首个失败时极少见）
      lastExpected.push(pick);
      return out;
    });
    return result.join('').replace(/\n /g, '\n');
  }

  window.Blanks = {
    parseToParts: parseToParts,
    generateLocal: generateLocal,
    lastExpected: function () { return lastExpected.slice(); }
  };
})();
