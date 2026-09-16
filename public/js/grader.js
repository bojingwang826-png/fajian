// 可复现的结构化判分引擎。固定题目采分点与分值；AI 仅作后台语义复核。
(function () {
  function clean(s) { return String(s || '').replace(/[\s\p{P}\p{S}]/gu, '').toLowerCase(); }
  function grams(s) {
    const x = clean(s); const set = new Set();
    if (x.length < 2) { if (x) set.add(x); return set; }
    for (let i = 0; i < x.length - 1; i++) set.add(x.slice(i, i + 2));
    return set;
  }
  function similarity(correct, candidate) {
    const a = grams(correct), b = grams(candidate);
    if (!a.size || !b.size) return 0;
    let hit = 0; a.forEach(function (g) { if (b.has(g)) hit++; });
    return hit / a.size;
  }
  function bestEvidence(correct, answer) {
    const parts = String(answer || '').split(/[\n。；;]+/).map(function (x) { return x.trim(); }).filter(Boolean);
    let best = '', value = 0;
    parts.forEach(function (p) { const s = similarity(correct, p); if (s > value) { value = s; best = p; } });
    return { text: best, similarity: value };
  }
  const CONFLICTS = [
    ['应当', '可以'], ['必须', '可以'], ['不得', '可以'], ['有权', '无权'],
    ['成立', '不成立'], ['有效', '无效'], ['承担责任', '不承担责任'], ['减轻', '从轻']
  ];
  function conflict(correct, evidence) {
    const c = clean(correct), e = clean(evidence);
    return CONFLICTS.some(function (pair) {
      return (c.includes(pair[0]) && !c.includes(pair[1]) && e.includes(pair[1]) && !e.includes(pair[0])) ||
        (c.includes(pair[1]) && !c.includes(pair[0]) && e.includes(pair[0]) && !e.includes(pair[1]));
    });
  }
  function roundHalf(n) { return Math.round(Number(n || 0) * 2) / 2; }
  function clamp(n, min, max) { return Math.max(min, Math.min(max, Math.round(Number(n) || 0))); }
  function pointConfidence(ratio, factor, hasEvidence, hasConflict) {
    if (hasConflict) return 96;
    if (!hasEvidence) return 92;
    const boundaries = [0.16, 0.30, 0.48, 0.68];
    const distance = Math.min.apply(null, boundaries.map(function (x) { return Math.abs(ratio - x); }));
    // 越靠近分档边界，系统越不确定；明确命中或明确遗漏时置信度更高。
    return clamp(58 + Math.min(35, distance * 180) + (factor === 1 || factor === 0 ? 5 : 0), 55, 96);
  }

  function localGrade(q, answer, strictness) {
    const points = Rubric.normalize(q.rubric && q.rubric.length ? q.rubric : Rubric.derive(q.answer));
    const strict = strictness === '严格' ? 0.06 : strictness === '宽松' ? -0.06 : 0;
    const result = points.map(function (p) {
      const evidence = bestEvidence(p.correct, answer);
      const allRecall = similarity(p.correct, answer);
      const ratio = Math.max(evidence.similarity, allRecall);
      let factor = ratio >= 0.68 + strict ? 1 : ratio >= 0.48 + strict ? 0.8 : ratio >= 0.30 + strict ? 0.55 : ratio >= 0.16 + strict ? 0.3 : 0;
      const hasConflict = conflict(p.correct, evidence.text);
      if (hasConflict) factor = 0;
      const score = factor === 1 ? p.full : roundHalf(p.full * factor);
      return {
        name: p.name, full: p.full, score: score,
        status: factor >= 0.95 ? '命中' : factor >= 0.5 ? '不完整' : factor > 0 ? '少量命中' : (evidence.text ? '错误' : '遗漏'),
        candidate: evidence.text, correct: p.correct,
        similarity: Math.round(ratio * 100), conflict: hasConflict,
        confidence: pointConfidence(ratio, factor, !!evidence.text, hasConflict)
      };
    });
    const total = roundHalf(result.reduce(function (n, p) { return n + Number(p.score); }, 0));
    return { score: total, points: result };
  }

  function normalizeAi(q, answer, parsed, local) {
    const rubric = Rubric.normalize(q.rubric && q.rubric.length ? q.rubric : Rubric.derive(q.answer));
    const source = parsed && parsed.summary && Array.isArray(parsed.summary.points) ? parsed.summary.points : [];
    if (!source.length) throw new Error('AI 未返回逐采分点结果');
    const used = new Set();
    const points = rubric.map(function (p, i) {
      let ai = source.find(function (x, j) { if (used.has(j)) return false; return clean(x.name) === clean(p.name); });
      let idx = ai ? source.indexOf(ai) : -1;
      if (!ai && source[i]) { ai = source[i]; idx = i; }
      if (idx >= 0) used.add(idx);
      const lp = local.points[i];
      let evidence = String(ai && ai.candidate || '').trim();
      const evidenceValid = evidence && clean(answer).includes(clean(evidence));
      if (!evidenceValid) evidence = lp.candidate;
      let aiScore = Math.max(0, Math.min(Number(p.full), Number(ai && ai.score)));
      if (!isFinite(aiScore)) aiScore = lp.score;
      // 无原文证据却给分，或关键限定词相反时，从严回退。
      if (!evidence) aiScore = 0;
      if (conflict(p.correct, evidence)) aiScore = 0;
      // 语义复核占主要权重，本地可复现结果负责限制异常漂移。
      let score = aiScore >= p.full && lp.score >= p.full ? p.full : roundHalf(aiScore * 0.75 + lp.score * 0.25);
      if (Math.abs(aiScore - lp.score) > p.full * 0.65) score = roundHalf(Math.min(aiScore, lp.score + p.full * 0.35));
      const rate = p.full ? score / p.full : 0;
      const disagreement = p.full ? Math.abs(aiScore - lp.score) / p.full : 0;
      return { name: p.name, full: p.full, score: score, status: rate >= 0.95 ? '命中' : rate >= 0.5 ? '不完整' : rate > 0 ? '少量命中' : (evidence ? '错误' : '遗漏'), candidate: evidence, correct: p.correct,
        similarity: lp.similarity, conflict: conflict(p.correct, evidence),
        confidence: clamp(94 - disagreement * 52 - (!evidenceValid ? 14 : 0), 48, 96) };
    });
    return { score: roundHalf(points.reduce(function (n, p) { return n + p.score; }, 0)), points: points };
  }

  function markdown(result, method) {
    const lost = result.points.filter(function (p) { return Number(p.score) < Number(p.full); });
    let out = '## 总分\n\n**' + result.score + ' / 100**　' + (method === 'ai' ? '结构化采分点 + AI语义复核' : '本地结构化采分点判分') + '\n\n';
    out += '## 采分点明细\n\n| 采分点 | 满分 | 得分 | 判定 | 作答证据 |\n|---|---:|---:|---|---|\n';
    result.points.forEach(function (p) {
      out += '| ' + String(p.name).replace(/\|/g, '｜') + ' | ' + p.full + ' | ' + p.score + ' | ' + p.status + ' | ' + String(p.candidate || '未找到对应表述').replace(/\|/g, '｜').slice(0, 100) + ' |\n';
    });
    out += '\n## 复习建议\n\n' + (lost.length ? '重点补充：' + lost.map(function (p) { return '**' + p.name + '**'; }).join('、') + '。' : '全部采分点均已命中。');
    return out;
  }

  async function grade(q, answer, strictness, onStage) {
    if (!String(answer || '').trim()) {
      const empty = localGrade(q, '', strictness); return finish(empty, 'local');
    }
    const local = localGrade(q, answer, strictness);
    if (!LLM.configured()) return finish(local, 'local');
    try {
      if (onStage) onStage('正在进行语义复核并校验证据…');
      const reply = await LLM.chat(Prompt.gradingJsonPrompt(q, answer, strictness), { temperature: 0, json: true });
      const checked = normalizeAi(q, answer, Prompt.parseResult(reply), local);
      return finish(checked, 'ai');
    } catch (e) {
      const fallback = finish(local, 'local'); fallback.warning = '语义复核未完成，已使用本地结构化结果：' + e.message; return fallback;
    }
  }
  function gradeFill(answers, expected, scores) {
    const points = (expected || []).map(function (correct, i) {
      const answer = String((answers || [])[i] || '').trim();
      const full = Number((scores || [])[i] || 0);
      const sim = similarity(correct, answer);
      const exact = clean(correct) === clean(answer);
      const factor = exact ? 1 : sim >= 0.72 ? 0.7 : 0;
      return { name: '空' + (i + 1), full: full, score: roundHalf(full * factor), status: exact ? '命中' : factor ? '不完整' : (answer ? '错误' : '遗漏'), candidate: answer, correct: correct, similarity: Math.round(sim * 100), confidence: exact || !answer ? 96 : (factor ? 68 : 82) };
    });
    return finish({ score: roundHalf(points.reduce(function (n, p) { return n + p.score; }, 0)), points: points }, 'local');
  }
  function finish(result, method) {
    const weight = result.points.reduce(function (n, p) { return n + Math.max(1, Number(p.full) || 1); }, 0) || 1;
    const confidence = Math.round(result.points.reduce(function (n, p) { return n + Number(p.confidence == null ? 60 : p.confidence) * Math.max(1, Number(p.full) || 1); }, 0) / weight);
    const needsReview = confidence < 70 || result.points.some(function (p) { return p.conflict || Number(p.confidence) < 60; });
    const summary = {
      totalScore: result.score,
      confidence: confidence, needsReview: needsReview,
      points: result.points.map(function (p) { return { name: p.name, full: p.full, score: p.score, status: p.status, candidate: p.candidate, correct: p.correct, similarity: p.similarity, conflict: !!p.conflict, confidence: p.confidence }; }),
      lostPoints: result.points.filter(function (p) { return p.score < p.full; }).map(function (p) { return p.name; })
    };
    return { score: result.score, summary: summary, display: markdown(result, method), method: method, confidence: confidence, needsReview: needsReview };
  }

  window.GradeEngine = { localGrade: localGrade, grade: grade, gradeFill: gradeFill };
})();
