// 题库管理：列表、增删改、导入（.md/.txt / 粘贴）、模板下载
window.Views = window.Views || {};

// ===== 新建/编辑题目弹窗（供题库页与仪表盘共用） =====
function openQuestionModal(q, onSaved) {
  const isEdit = !!q;
  q = q || { subject: '刑法', title: '', stem: '', answer: '', rubric: [], tags: [], source: '手动' };
  const rubricText = Rubric.format(q.rubric && q.rubric.length ? q.rubric : Rubric.derive(q.answer));
  const overlay = UI.openModal(
    '<div class="modal-head"><h3>' + (isEdit ? '编辑题目' : '新建题目') + '</h3><button class="modal-close">×</button></div>' +
    '<div class="modal-body"><div class="form-grid">' +
      '<label>科目</label><div><select class="select" id="qe-subject" style="width:200px">' +
        UI.SUBJECTS.map(function (s) { return '<option' + (s === q.subject ? ' selected' : '') + '>' + s + '</option>'; }).join('') +
      '</select></div>' +
      '<label>题目名称</label><div><input class="input" id="qe-title" placeholder="如：正当防卫的成立条件" value="' + h(q.title) + '"></div>' +
      '<label>题干</label><div><textarea class="textarea" id="qe-stem" rows="3" placeholder="如：【默写】请完整默写正当防卫的成立条件。">' + h(q.stem) + '</textarea></div>' +
      '<label>标准答案</label><div>' +
        '<textarea class="textarea" id="qe-answer" rows="12" placeholder="判分依据，建议按采分点分条书写（判分 AI 将严格以这里的内容为依据）">' + h(q.answer) + '</textarea>' +
        '<div class="muted small mt8">提示：标准答案写得越结构化（分条列出采分点），判分越准确。</div>' +
      '</div>' +
      '<label>结构化采分点</label><div><textarea class="textarea" id="qe-rubric" rows="7" placeholder="分值 | 采分点 | 标准表述">' + h(rubricText) + '</textarea>' +
        '<div class="row mt8"><button class="btn small" id="qe-rubric-auto" type="button">↻ 根据答案重新生成</button><span class="muted small">每行：分值 | 名称 | 标准表述；系统会自动归一为100分。</span></div></div>' +
      '<label>标签</label><div><input class="input" id="qe-tags" value="' + h((q.tags || []).join('、')) + '" placeholder="如：高频、总论、冲刺（用顿号或逗号分隔）"></div>' +
      '<label>资料信息</label><div class="row"><input class="input" id="qe-source" value="' + h(q.source || '') + '" placeholder="来源" style="max-width:220px"><input class="input" id="qe-year" value="' + h(q.materialYear || '') + '" placeholder="资料年份" style="max-width:110px"><input class="input" id="qe-law-version" value="' + h(q.lawVersion || '') + '" placeholder="法条/司法解释版本" style="flex:1;min-width:180px"></div></div>' +
      '<label>校对状态</label><div class="row"><input class="input" id="qe-reviewed" type="date" value="' + h(q.reviewedAt ? String(q.reviewedAt).slice(0, 10) : '') + '" style="max-width:180px"><label class="small"><input type="checkbox" id="qe-starred"' + (q.starred ? ' checked' : '') + '> 重点收藏</label><span class="muted small">填写最近人工核对日期</span></div></div>' +
    '</div></div>' +
    '<div class="modal-foot"><button class="btn" id="qe-cancel">取消</button><button class="btn primary" id="qe-save">保存</button></div>'
  , { wide: true });
  overlay.querySelector('.modal-close').addEventListener('click', function () { UI.closeModal(overlay); });
  overlay.querySelector('#qe-cancel').addEventListener('click', function () { UI.closeModal(overlay); });
  overlay.querySelector('#qe-rubric-auto').addEventListener('click', function () {
    overlay.querySelector('#qe-rubric').value = Rubric.format(Rubric.derive(overlay.querySelector('#qe-answer').value));
    UI.toast('已根据当前答案重新生成采分点，请核对分值与表述');
  });
  overlay.querySelector('#qe-save').addEventListener('click', function () {
    const tags = overlay.querySelector('#qe-tags').value.split(/[、,，]/).map(function (x) { return x.trim(); }).filter(Boolean);
    const answerValue = overlay.querySelector('#qe-answer').value.trim();
    const rubricValue = overlay.querySelector('#qe-rubric').value;
    const data = {
      subject: overlay.querySelector('#qe-subject').value,
      title: overlay.querySelector('#qe-title').value.trim(),
      stem: overlay.querySelector('#qe-stem').value.trim(),
      answer: answerValue,
      rubric: isEdit && answerValue !== String(q.answer || '').trim() && rubricValue === rubricText ? Rubric.derive(answerValue) : Rubric.parse(rubricValue),
      tags: tags,
      source: overlay.querySelector('#qe-source').value.trim() || (isEdit ? q.source : '手动'),
      materialYear: overlay.querySelector('#qe-year').value.trim(),
      lawVersion: overlay.querySelector('#qe-law-version').value.trim(),
      reviewedAt: overlay.querySelector('#qe-reviewed').value || '',
      starred: overlay.querySelector('#qe-starred').checked
    };
    if (!data.title) { UI.toast('请填写题目名称', 'warn'); return; }
    if (!data.answer) { UI.toast('请填写标准答案，否则无法判分', 'warn'); return; }
    if (!data.rubric.length) data.rubric = Rubric.derive(data.answer);
    if (!data.stem) data.stem = '【默写】' + data.title;
    const p = isEdit ? Store.updateQuestion(q.id, data) : Store.addQuestion(data);
    p.then(function () {
      UI.closeModal(overlay);
      UI.toast(isEdit ? '已保存' : '题目已添加');
      if (onSaved) onSaved();
    });
  });
}

// ===== 导入文本解析：标记模式 → 问/答模式 → 兜底段落 =====
function cleanTitle(s) {
  return String(s || '').replace(/^\s*(?:【[^】]{0,8}】|（?\d{1,3}[）)]|[一二三四五六七八九十]{1,3}[、.]|\d{1,3}[、.．]|第\s*[一二三四五六七八九十\d]{1,3}\s*题\s*[:：、]?)\s*/, '').trim();
}

function splitSepBlocks(text) {
  const blocks = [];
  let cur = [];
  text.split('\n').forEach(function (line) {
    if (/^\s*(?:-{3,}|={3,}|\*{3,}|—{3,})\s*$/.test(line)) { blocks.push(cur.join('\n')); cur = []; }
    else cur.push(line);
  });
  blocks.push(cur.join('\n'));
  return blocks;
}

function extractSubject(block) {
  const m = block.match(/【科目】\s*([^\n]+)/) || block.match(/(?:^|\n)\s*科目\s*[:：]\s*([^\n]+)/);
  return m ? m[1].trim() : '';
}

function fixSubject(subject) {
  const s = String(subject || '').trim();
  const aliases = {
    '刑诉': '刑事诉讼法', '刑诉法': '刑事诉讼法',
    '民诉': '民事诉讼法', '民诉法': '民事诉讼法',
    '商法': '商经知', '经济法': '商经知', '知识产权法': '商经知',
    '宪法': '理论法', '法理学': '理论法', '中国特色社会主义法治理论': '理论法'
  };
  const normalized = aliases[s] || s;
  return UI.SUBJECTS.indexOf(normalized) >= 0 ? normalized : '未分类';
}

function inferSubject(text) {
  const s = String(text || '');
  if (/理论法|法治思想|全面依法治国/.test(s)) return '理论法';
  if (/刑事诉讼法|刑诉法|刑事诉讼/.test(s)) return '刑事诉讼法';
  if (/民事诉讼法|民诉法|民事诉讼/.test(s)) return '民事诉讼法';
  if (/行政法|行政诉讼|行政处罚|行政许可/.test(s)) return '行政法';
  if (/商经知|公司法|证券法|破产法|知识产权/.test(s)) return '商经知';
  if (/刑法|犯罪构成|正当防卫|共同犯罪/.test(s)) return '刑法';
  if (/民法|民法典|合同|物权|侵权责任/.test(s)) return '民法';
  return '';
}

function chineseOrdinal(n) {
  const digits = '一二三四五六七八九';
  if (n <= 9) return digits[n - 1];
  if (n === 10) return '十';
  if (n < 20) return '十' + digits[n - 11];
  return String(n);
}

function sourcePageBefore(lines, index) {
  for (let i = index; i >= 0; i--) {
    const m = String(lines[i] || '').match(/^<!--PDF_PAGE:(\d+)-->$/);
    if (m) return Number(m[1]);
  }
  return null;
}

// 长篇讲义常用“专题 1 标题”作为每道背诵题边界。Word 一级/二级标题
// 会由 DOCX 提取器保留为 # / ##，直接粘贴的纯文本也可识别。
function parseNumberedTopics(text) {
  const lines = String(text || '').replace(/\r/g, '').split('\n');
  // 编号后必须有空格或标点，避免把“专题一至四搭建框架”误当成一道题。
  const topicRe = /^\s*(#\s*)?专题\s*([0-9]{1,2}|[一二三四五六七八九十]{1,3})(?:\s*[：:、.．\-—]\s*|\s*)(.+?)\s*$/;
  const markedTopics = [];
  const plainTopics = [];
  lines.forEach(function (line, i) {
    const m = line.match(topicRe);
    if (!m || !m[3].trim() || /^至\s*[0-9一二三四五六七八九十]/.test(m[3].trim())) return;
    const item = { index: i, title: cleanTitle(m[3]).replace(/^[-—:：、\s]+/, '').trim() };
    (m[1] ? markedTopics : plainTopics).push(item);
  });
  // 有 Word 一级标题时只信任标题样式，正文中的“专题 1 至 4”等说明不参与切题。
  const topics = markedTopics.length ? markedTopics : plainTopics;
  if (!topics.length) return [];

  const subject = fixSubject(inferSubject(text) || extractSubject(text));
  const out = [];
  topics.forEach(function (topic, i) {
    const end = i + 1 < topics.length ? topics[i + 1].index : lines.length;
    const answerLines = [];
    let sectionNo = 0;
    for (let j = topic.index + 1; j < end; j++) {
      let line = lines[j].trim();
      if (!line) continue;
      if (/^<!--PDF_PAGE:\d+-->$/.test(line)) continue;
      if (/^(?:发布|原帖发布时间|重点程度|查看.*原帖|来源|整理时间)(?:\s|[:：]|$)/.test(line)) continue;
      // 下一个非专题一级标题（如“复习建议”）代表专题正文已经结束。
      if (/^#\s+/.test(line)) break;
      if (/^##\s+/.test(line)) {
        const heading = line.replace(/^##\s+/, '').trim();
        if (!heading) continue;
        sectionNo++;
        answerLines.push(chineseOrdinal(sectionNo) + '、' + heading);
        continue;
      }
      answerLines.push(line);
    }
    const answer = answerLines.join('\n').trim();
    if (!topic.title || !answer) return;
    out.push({
      subject: subject,
      title: topic.title.slice(0, 60),
      stem: '【默写】请完整默写' + topic.title + '。',
      answer: answer
      , sourcePage: sourcePageBefore(lines, topic.index)
    });
  });
  return out;
}

function isMetaHeading(title) {
  return /^(?:目录|总目录|前言|序言|说明|使用说明|资料说明|整理说明|导读|结构总览|总体结构|内容总览|专题目录|复习建议|学习建议|使用建议|后记|附录|参考资料|资料来源|来源)$/i.test(String(title || '').replace(/\s/g, ''));
}

function isContainerHeading(title) {
  const s = String(title || '').trim();
  return /^第\s*[一二三四五六七八九十百\d]+\s*(?:篇|编|章|部分|单元)(?:\s|[:：、]|$)/.test(s) ||
    /^(?:上|中|下)篇(?:\s|[:：、]|$)/.test(s) || /^(?:总论|分论|概论|基础篇|专题篇)$/.test(s);
}

function cleanSectionTitle(title) {
  return cleanTitle(String(title || ''))
    .replace(/^第\s*[一二三四五六七八九十百\d]+\s*(?:篇|编|章|节|部分|单元|题)\s*[：:、.．\-—]?\s*/, '')
    .replace(/^专题\s*[一二三四五六七八九十百\d]+\s*[：:、.．\-—]?\s*/, '')
    .trim();
}

// 通用 Word 大纲解析：没有“专题 N”时，根据标题层级选择合适的切题层。
// 若一级标题只是“第一章/第二章”等容器，则自动下钻到二级标题。
function parseHeadingSections(text) {
  const lines = String(text || '').replace(/\r/g, '').split('\n');
  const headings = [];
  lines.forEach(function (line, index) {
    const m = line.match(/^\s*(#{1,6})\s+(.+?)\s*$/);
    if (m) headings.push({ index: index, level: m[1].length, rawTitle: m[2].trim() });
  });
  if (headings.length < 2) return [];

  const subject = fixSubject(inferSubject(text) || extractSubject(text));
  const byLevel = {};
  function build(level) {
    if (byLevel[level]) return byLevel[level];
    const boundaries = headings.filter(function (h) { return h.level === level && !isMetaHeading(h.rawTitle); });
    const items = [];
    boundaries.forEach(function (heading) {
      let end = lines.length;
      for (let k = 0; k < headings.length; k++) {
        if (headings[k].index > heading.index && headings[k].level <= level) { end = headings[k].index; break; }
      }
      const answerLines = [];
      let subNo = 0;
      for (let j = heading.index + 1; j < end; j++) {
        let line = lines[j].trim();
        if (!line) continue;
        if (/^<!--PDF_PAGE:\d+-->$/.test(line)) continue;
        if (/^(?:发布|原帖发布时间|重点程度|查看.*原帖|来源|整理时间)(?:\s|[:：]|$)/.test(line)) continue;
        const hm = line.match(/^\s*(#{1,6})\s+(.+?)\s*$/);
        if (hm) {
          if (hm[1].length <= level) break;
          if (isMetaHeading(hm[2])) continue;
          subNo++;
          answerLines.push(chineseOrdinal(subNo) + '、' + hm[2].trim());
        } else {
          answerLines.push(line);
        }
      }
      const title = cleanSectionTitle(heading.rawTitle).slice(0, 60);
      const answer = answerLines.join('\n').trim();
      if (title.length >= 2 && answer.length >= 20) {
        items.push({ subject: subject, title: title, stem: '【默写】请完整默写' + title + '。', answer: answer, sourcePage: sourcePageBefore(lines, heading.index), _container: isContainerHeading(heading.rawTitle) });
      }
    });
    byLevel[level] = items;
    return items;
  }

  const levels = Array.from(new Set(headings.map(function (h) { return h.level; }))).sort(function (a, b) { return a - b; });
  let chosen = [];
  for (let i = 0; i < levels.length; i++) {
    const items = build(levels[i]);
    if (items.length < 2) continue;
    const containerRatio = items.filter(function (x) { return x._container; }).length / items.length;
    const deeper = i + 1 < levels.length ? build(levels[i + 1]) : [];
    if ((items.length === 1 || containerRatio >= 0.5) && deeper.length >= 2) continue;
    chosen = items;
    break;
  }
  if (!chosen.length) {
    for (let i = 0; i < levels.length; i++) {
      const items = build(levels[i]);
      if (items.length >= 2) { chosen = items; break; }
    }
  }
  return chosen.map(function (x) {
    return { subject: x.subject, title: x.title, stem: x.stem, answer: x.answer, sourcePage: x.sourcePage };
  });
}

// 兜底：按空行分段，每段 = 一道题（首行为题名，其余为答案）
function parseLooseBlocks(text) {
  const out = [];
  String(text || '').split(/\n\s*\n+/).forEach(function (block) {
    if (!block.trim()) return;
    const subject = extractSubject(block);
    const lines = block.split('\n').filter(function (l) { return l.trim() && !/^\s*(?:【科目】|科目\s*[:：]|<!--PDF_PAGE:\d+-->)/.test(l); });
    if (lines.length < 2) return;
    const title = cleanTitle(lines[0]).slice(0, 60);
    if (!title) return;
    const answer = lines.slice(1).join('\n').trim();
    if (!answer) return;
    out.push({ subject: fixSubject(subject), title: title, stem: '【默写】' + title, answer: answer });
  });
  return out;
}

// 问/答成对结构：问：…答：…（支持多题）
function parseQAPairs(text) {
  const lines = text.split('\n');
  const isQ = function (l) {
    return /^\s*[【\[]?\s*(?:问|问题)\s*[】\]]?\s*[:：]/.test(l) || /^\s*(?:题目|题干)\s*[:：]/.test(l) || /^\s*【(?:题目|题干|问题)】/.test(l);
  };
  const isA = function (l) {
    return /^\s*[【\[]?\s*答\s*案?\s*[】\]]?\s*[:：]/.test(l) || /^\s*(?:标准|参考)答案\s*[:：]/.test(l) || /^\s*【(?:标准|参考)?答案】/.test(l);
  };
  const qIdx = [];
  lines.forEach(function (l, i) { if (isQ(l)) qIdx.push(i); });
  if (!qIdx.length) return [];

  const out = [];
  let currentSubject = extractSubject(lines.slice(0, qIdx[0]).join('\n'));
  qIdx.forEach(function (qi, k) {
    const qEnd = k + 1 < qIdx.length ? qIdx[k + 1] : lines.length;
    let aStart = -1;
    for (let i = qi + 1; i < qEnd; i++) {
      if (isA(lines[i])) { aStart = i; break; }
    }
    if (aStart < 0) return; // 没有答案的题跳过
    let answerEnd = qEnd;
    let nextSubject = '';
    for (let i = aStart + 1; i < qEnd; i++) {
      const s = extractSubject('\n' + lines[i]);
      if (s) { answerEnd = i; nextSubject = s; break; }
    }
    let stem = lines.slice(qi, aStart).join('\n').replace(/^\s*(?:【(?:问|问题|题目|题干)】|[【\[]?\s*(?:问|问题|题目|题干)\s*[】\]]?\s*[:：])\s*/, '').trim();
    const answer = lines.slice(aStart, answerEnd).join('\n').replace(/^\s*(?:【(?:标准|参考)?答案】|[【\[]?\s*(?:标准|参考)?答\s*案?\s*[】\]]?\s*[:：])\s*/, '').trim();
    // 答案行内首行的前缀
    if (!stem || !answer) return;
    const localSubject = extractSubject(lines.slice(qi, qEnd).join('\n'));
    if (localSubject) currentSubject = localSubject;
    const subject = currentSubject;
    const title = cleanTitle(stem.split('\n')[0]).slice(0, 60) || stem.slice(0, 30);
    out.push({ subject: fixSubject(subject), title: title, stem: /^\s*【默写】/.test(stem) ? stem : '【默写】' + stem, answer: answer });
    if (nextSubject) currentSubject = nextSubject;
  });
  return out;
}

// 带标记的解析（【科目】/【题目】/【标准答案】）
function parseMarkerBlocks(text) {
  const out = [];
  splitSepBlocks(text).forEach(function (block) {
    if (!block.trim()) return;
    const subject = extractSubject(block);
    let title = '';
    let stem = '';
    let answer = '';
    let m = block.match(/【题目】\s*([\s\S]*?)(?=\n【标准答案】|\n【答案】|$)/) || block.match(/【题干】\s*([\s\S]*?)(?=\n【标准答案】|\n【答案】|$)/) ||
        block.match(/(?:^|\n)\s*(?:题目|题干)\s*[:：]\s*([\s\S]*?)(?=\n\s*(?:标准)?答案\s*[:：]|\n【标准答案】|$)/);
    if (m) {
      title = m[1].trim().split('\n')[0].replace(/^#+\s*/, '').trim();
      stem = m[1].trim();
    }
    m = block.match(/【标准答案】\s*([\s\S]*)$/) || block.match(/【答案】\s*([\s\S]*)$/) ||
        block.match(/(?:^|\n)\s*(?:标准)?答案\s*[:：]\s*([\s\S]*)$/);
    if (m) answer = m[1].trim();
    if (title && answer) {
      if (!stem) stem = title;
      out.push({ subject: fixSubject(subject), title: title.slice(0, 60), stem: stem, answer: answer });
    } else {
      // 块内缺标记 → 整块兜底
      out.push.apply(out, parseLooseBlocks(block));
    }
  });
  return out;
}

function parseImport(text) {
  text = String(text || '').replace(/\r/g, '').trim();
  if (!text) return [];
  // Word 常把多道题连续排版，优先按题目/答案成对切分，避免第一题吞掉后续答案。
  const qa = parseQAPairs(text);
  if (qa.length) return qa;
  const topics = parseNumberedTopics(text);
  if (topics.length) return topics;
  const sections = parseHeadingSections(text);
  if (sections.length) return sections;
  const hasMarker = /【标准答案】|【答案】|【题目】|【题干】|(^|\n)\s*(?:标准)?答案\s*[:：]/.test(text);
  if (hasMarker) {
    const marked = parseMarkerBlocks(text);
    if (marked.length) return marked;
  }
  return parseLooseBlocks(text);
}

// 解析 AI 识别返回的 JSON 数组
function parseAIJson(text) {
  let s = String(text || '').trim();
  if (!s) throw new Error('AI 没有返回识别结果');
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) s = fence[1].trim();
  const candidates = [s];
  for (const pair of [['[', ']'], ['{', '}']]) {
    const start = s.indexOf(pair[0]);
    const end = s.lastIndexOf(pair[1]);
    if (start >= 0 && end > start) candidates.push(s.slice(start, end + 1));
  }
  let data = null;
  for (const candidate of candidates) {
    try { data = JSON.parse(candidate); break; } catch (e) { /* 尝试下一个片段 */ }
  }
  if (!data) throw new Error('AI 返回内容无法解析为题目列表，请重试');
  const arr = Array.isArray(data) ? data : (data.questions || []);
  if (!Array.isArray(arr)) throw new Error('AI 返回的题目列表格式不正确');
  const out = [];
  arr.forEach(function (o) {
    if (!o || !o.title || !o.answer) return;
    out.push({
      subject: fixSubject(o.subject),
      title: String(o.title).trim().slice(0, 60),
      stem: String(o.stem || ('【默写】' + o.title)).trim(),
      answer: String(o.answer).trim()
    });
  });
  if (!out.length) throw new Error('AI 没有返回同时包含题目和答案的内容');
  return out;
}

function splitImportForAI(raw, maxChars) {
  const limit = maxChars || 14000;
  const lines = String(raw || '').split('\n');
  const chunks = [];
  let current = [];
  let size = 0;
  lines.forEach(function (line) {
    const next = line.length + 1;
    const isBoundary = /^\s*(?:#{1,6}\s+|专题\s*[一二三四五六七八九十百\d]+(?:\s|[:：、])|第\s*[一二三四五六七八九十百\d]+\s*(?:篇|编|章|节|题|部分|单元))/.test(line);
    if (current.length && ((isBoundary && size > limit * 0.55) || size + next > limit)) {
      chunks.push(current.join('\n').trim());
      current = [];
      size = 0;
    }
    current.push(line);
    size += next;
  });
  if (current.length) chunks.push(current.join('\n').trim());
  return chunks.filter(Boolean);
}

async function recognizeImportWithAI(raw, onProgress) {
  const chunks = splitImportForAI(raw);
  const all = [];
  for (let i = 0; i < chunks.length; i++) {
    if (onProgress) onProgress(i + 1, chunks.length);
    const reply = await LLM.chat(Prompt.importPrompt(chunks[i]), { temperature: 0.1 });
    all.push.apply(all, parseAIJson(reply));
  }
  const byKey = {};
  all.forEach(function (item) {
    const key = item.subject + '|' + item.title;
    if (!byKey[key] || item.answer.length > byKey[key].answer.length) byKey[key] = item;
  });
  const result = Object.keys(byKey).map(function (key) { return byKey[key]; });
  if (!result.length) throw new Error('AI 没有识别出可导入的题目');
  return result;
}

// ===== 导入弹窗（本地格式化解析 / AI 智能识别） =====
function openImportModal(onDone) {
  let parsed = [];
  let mode = 'local'; // Word 上传后先在本机解析；复杂资料可切换 AI 识别
  let rawText = '';
  let recognitionToken = 0;

  const overlay = UI.openModal(
    '<div class="modal-head"><h3>导入题目</h3><button class="modal-close">×</button></div>' +
    '<div class="modal-body" id="im-body"></div>' +
    '<div class="modal-foot"><label class="small muted">重复题处理</label><select class="select" id="im-duplicate-mode" style="width:auto"><option value="skip">跳过已有题（推荐）</option><option value="overwrite">用本次内容更新已有题</option><option value="keep">保留两份</option></select><div class="spacer"></div><button class="btn" id="im-cancel">取消</button><button class="btn primary" id="im-import" disabled>确认导入</button></div>',
    { wide: true }
  );
  const imImport = overlay.querySelector('#im-import');
  overlay.querySelector('.modal-close').addEventListener('click', function () { UI.closeModal(overlay); });
  overlay.querySelector('#im-cancel').addEventListener('click', function () { UI.closeModal(overlay); });

  function aiLinksHtml() {
    return (Store.db.settings.aiLinks || []).map(function (l) {
      return '<a class="btn small" target="_blank" rel="noopener" href="' + h(l.url) + '">' + h(l.name) + ' ↗</a>';
    }).join('');
  }

  function bindFileInput(fileId, targetId, afterRead) {
    overlay.querySelector('#' + fileId).addEventListener('change', async function (e) {
      const f = e.target.files[0];
      if (!f) return;
      const status = overlay.querySelector('#im-status') || overlay.querySelector('#ai-status');
      try {
        if (/\.json$/i.test(f.name)) {
          const data = JSON.parse(await f.text());
          const items = Array.isArray(data) ? data : data.questions;
          if (!Array.isArray(items)) throw new Error('JSON 中没有 questions 数组');
          parsed = items.filter(function (x) { return x && x.title && x.answer; }).map(function (x) {
            return { subject: fixSubject(x.subject), title: String(x.title), stem: String(x.stem || ('【默写】' + x.title)), answer: String(x.answer), rubric: Rubric.normalize(x.rubric || Rubric.derive(x.answer)), tags: x.tags || [], source: x.source || '题库文件', materialYear: x.materialYear || '', lawVersion: x.lawVersion || '', reviewedAt: x.reviewedAt || '' };
          });
          rawText = ''; renderPreview(); UI.toast('题库文件已读取'); return;
        }
        if (status) status.innerHTML = '<span class="spin">⏳</span> 正在读取 ' + h(f.name) + '…';
        const text = await Documents.extract(f, function (page, total) { if (status) status.textContent = '正在读取 PDF 第 ' + page + ' / ' + total + ' 页…'; });
        const target = overlay.querySelector('#' + targetId);
        if (!target) return;
        const displayText = text.replace(/^<!--PDF_PAGE:\d+-->\s*$/gm, '').replace(/^#{1,6}\s+/gm, '');
        target.value = displayText; rawText = text;
        if (afterRead) {
          await afterRead(text);
          const year = (f.name.match(/20\d{2}/) || [])[0] || '';
          parsed.forEach(function (q) { q.source = f.name; if (!q.materialYear) q.materialYear = year; });
          renderPreview();
        }
        if (status) status.textContent = '';
        UI.toast('文件已读取，请核对解析结果');
      } catch (err) {
        if (status) status.innerHTML = '<span style="color:var(--red)">❌ ' + h(err.message) + '</span>';
        UI.toast('读取文件失败：' + err.message, 'err');
      }
    });
  }

  function normalizedSnippet(s) {
    return String(s || '').replace(/[#\s\p{P}\p{S}]/gu, '').toLowerCase();
  }

  function importCoverage() {
    const paragraphs = String(rawText || '').split(/\n+/).map(function (x) { return x.trim(); })
      .filter(function (x) { return x.length >= 12 && !/^(?:<!--PDF_PAGE|目录|前言|结构总览|复习建议|来源)/.test(x); });
    if (!paragraphs.length) return null;
    const combined = normalizedSnippet(parsed.map(function (x) { return x.title + '\n' + x.answer; }).join('\n'));
    const matched = paragraphs.filter(function (p) {
      const n = normalizedSnippet(p);
      return n.length >= 8 && combined.indexOf(n.slice(0, Math.min(40, n.length))) >= 0;
    }).length;
    return Math.round(matched / paragraphs.length * 100);
  }

  function editParsed(index) {
    const it = parsed[index];
    if (!it) return;
    const ed = UI.openModal(
      '<div class="modal-head"><h3>校对解析结果</h3><button class="modal-close">×</button></div>' +
      '<div class="modal-body"><div class="form-grid">' +
        '<label>科目</label><select class="select" id="ip-subject">' + UI.SUBJECTS.map(function (s) { return '<option' + (s === it.subject ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select>' +
        '<label>题目</label><input class="input" id="ip-title" value="' + h(it.title) + '">' +
        '<label>题干</label><textarea class="textarea" id="ip-stem" rows="3">' + h(it.stem || '') + '</textarea>' +
        '<label>标准答案</label><textarea class="textarea" id="ip-answer" rows="16">' + h(it.answer || '') + '</textarea>' +
      '</div></div><div class="modal-foot"><button class="btn" id="ip-cancel">取消</button><button class="btn primary" id="ip-save">保存修改</button></div>',
      { wide: true }
    );
    function close() { UI.closeModal(ed); }
    ed.querySelector('.modal-close').addEventListener('click', close);
    ed.querySelector('#ip-cancel').addEventListener('click', close);
    ed.querySelector('#ip-save').addEventListener('click', function () {
      it.subject = ed.querySelector('#ip-subject').value;
      it.title = ed.querySelector('#ip-title').value.trim();
      it.stem = ed.querySelector('#ip-stem').value.trim() || ('【默写】' + it.title);
      it.answer = ed.querySelector('#ip-answer').value.trim();
      it.rubric = Rubric.derive(it.answer);
      close(); renderPreview();
    });
  }

  function splitParsed(index) {
    const it = parsed[index];
    if (!it) return;
    const paras = String(it.answer || '').split('\n');
    paras.splice(Math.max(1, Math.floor(paras.length / 2)), 0, '---拆分---');
    const ed = UI.openModal(
      '<div class="modal-head"><h3>拆分题目</h3><button class="modal-close">×</button></div>' +
      '<div class="modal-body"><p class="muted small mb8">移动“---拆分---”到第二道题答案开始的位置，并填写第二道题名称。</p>' +
      '<input class="input mb8" id="sp-title" value="' + h(it.title + '（二）') + '">' +
      '<textarea class="textarea" id="sp-answer" rows="18">' + h(paras.join('\n')) + '</textarea></div>' +
      '<div class="modal-foot"><button class="btn" id="sp-cancel">取消</button><button class="btn primary" id="sp-save">确认拆分</button></div>', { wide: true }
    );
    function close() { UI.closeModal(ed); }
    ed.querySelector('.modal-close').addEventListener('click', close);
    ed.querySelector('#sp-cancel').addEventListener('click', close);
    ed.querySelector('#sp-save').addEventListener('click', function () {
      const parts = ed.querySelector('#sp-answer').value.split(/\n\s*---拆分---\s*\n/);
      if (parts.length !== 2 || !parts[0].trim() || !parts[1].trim()) { UI.toast('请保留一条“---拆分---”并确保两边都有答案', 'warn'); return; }
      it.answer = parts[0].trim(); it.rubric = Rubric.derive(it.answer);
      const title = ed.querySelector('#sp-title').value.trim() || (it.title + '（二）');
      parsed.splice(index + 1, 0, { subject: it.subject, title: title, stem: '【默写】请完整默写' + title + '。', answer: parts[1].trim(), rubric: Rubric.derive(parts[1]), source: it.source, sourcePage: it.sourcePage, materialYear: it.materialYear });
      close(); renderPreview();
    });
  }

  function renderPreview() {
    const pv = overlay.querySelector('#im-preview');
    if (!parsed.length) {
      pv.innerHTML = '<div class="empty-state" style="padding:16px">没有解析出题目。</div>';
      imImport.disabled = true;
      imImport.textContent = '确认导入';
      return;
    }
    imImport.disabled = false;
    imImport.textContent = '确认导入（' + parsed.length + ' 道）';
    const coverage = importCoverage();
    const existingKeys = new Set(Store.db.questions.map(function (q) { return Store.questionKey(q); }));
    const duplicateCount = parsed.filter(function (q) { return existingKeys.has(Store.questionKey(q)); }).length;
    const pageCount = parsed.filter(function (q) { return q.sourcePage; }).length;
    const cleanCount = parsed.filter(function (q, i) { return !Rubric.quality(q, Store.db.questions.concat(parsed.filter(function (_, j) { return j !== i; }))).length; }).length;
    pv.innerHTML = '<div class="import-quality"><div><b>' + parsed.length + '</b><span>识别题目</span></div><div><b>' + cleanCount + '</b><span>结构通过</span></div><div><b>' + duplicateCount + '</b><span>已有重复</span></div><div><b>' + pageCount + '</b><span>可追溯页码</span></div></div>' +
      '<div class="row mb8"><h3 style="font-size:15px;margin:0">解析结果预览（' + parsed.length + ' 道）</h3><div class="spacer"></div>' +
      (coverage == null ? '' : '<span class="badge ' + (coverage >= 85 ? 'green' : coverage >= 65 ? 'orange' : 'red') + '">原文覆盖约 ' + coverage + '%</span>') +
      '<span class="muted small">导入前可编辑、拆分或合并</span></div>' + parsed.map(function (it, i) {
      const warnings = Rubric.quality(it, Store.db.questions.concat(parsed.filter(function (_, j) { return j !== i; })));
      return '<div class="list-row">' +
        UI.subjectTag(it.subject) +
        '<div style="flex:1;min-width:0"><div style="font-weight:600">' + h(it.title) + '</div>' +
        '<div class="muted small" style="max-height:44px;overflow:hidden">' + h((it.answer || '').slice(0, 160)) + ((it.answer || '').length > 160 ? '…' : '') + '</div>' +
        (warnings.length ? '<div class="chips mt8">' + warnings.map(function (w) { return '<span class="chip hot">⚠ ' + h(w) + '</span>'; }).join('') + '</div>' : '<div class="small" style="color:var(--green)">✓ 结构检查通过 · ' + Rubric.derive(it.answer).length + ' 个采分点</div>') + '</div>' +
        '<div class="muted small">' + (it.sourcePage ? '第 ' + it.sourcePage + ' 页 · ' : '') + (it.answer || '').length + ' 字</div>' +
        '<button class="btn small" data-edit-preview="' + i + '">编辑</button>' +
        '<button class="btn small" data-split="' + i + '">拆分</button>' +
        (i < parsed.length - 1 ? '<button class="btn small" data-merge="' + i + '">合并下题</button>' : '') +
        '<button class="btn small" data-rm="' + i + '">移除</button>' +
        '</div>';
    }).join('');
    pv.querySelectorAll('[data-edit-preview]').forEach(function (b) { b.addEventListener('click', function () { editParsed(Number(b.dataset.editPreview)); }); });
    pv.querySelectorAll('[data-split]').forEach(function (b) { b.addEventListener('click', function () { splitParsed(Number(b.dataset.split)); }); });
    pv.querySelectorAll('[data-merge]').forEach(function (b) {
      b.addEventListener('click', function () {
        const i = Number(b.dataset.merge); const next = parsed[i + 1];
        if (!next) return;
        parsed[i].answer = (parsed[i].answer + '\n\n' + next.title + '\n' + next.answer).trim();
        parsed[i].rubric = Rubric.derive(parsed[i].answer);
        parsed.splice(i + 1, 1); renderPreview();
      });
    });
    pv.querySelectorAll('[data-rm]').forEach(function (b) {
      b.addEventListener('click', function () {
        parsed.splice(Number(b.dataset.rm), 1);
        renderPreview();
      });
    });
  }

  function renderMode() {
    const oldText = overlay.querySelector('#im-text') || overlay.querySelector('#ai-raw');
    if (oldText) rawText = oldText.value;
    recognitionToken++;
    const body = overlay.querySelector('#im-body');
    body.innerHTML =
      '<div class="row mb16" style="gap:0">' +
        '<div class="tabs">' +
          '<button class="tab ' + (mode === 'local' ? 'active' : '') + '" data-im-mode="local">📄 Word / 文本直接导入</button>' +
          '<button class="tab ' + (mode === 'ai' ? 'active' : '') + '" data-im-mode="ai">🤖 复杂资料 AI 识别</button>' +
        '</div>' +
      '</div>' +
      '<div id="im-mode"></div>' +
      '<div id="im-preview" class="mt16"></div>';
    body.querySelectorAll('[data-im-mode]').forEach(function (t) {
      t.addEventListener('click', function () {
        mode = t.dataset.imMode;
        renderMode();
      });
    });
    if (mode === 'ai') renderAI(); else renderLocal();
    const newText = overlay.querySelector('#im-text') || overlay.querySelector('#ai-raw');
    if (newText) newText.value = rawText;
    renderPreview();
  }

  function renderAI() {
    const box = overlay.querySelector('#im-mode');
    box.innerHTML =
      (LLM.configured()
        ? '<div class="row mb8 small" style="background:var(--green-bg);padding:8px 12px;border-radius:8px">' +
            '<span>⚡ 已配置 AI 接口（' + h(Store.db.settings.llm.model) + '），选好文件后一键识别即可。</span>' +
            '<div class="spacer"></div><a class="btn small ghost" href="#/settings">接口设置</a>' +
          '</div>'
        : '<div class="row mb8 small" style="background:var(--primary-bg);padding:8px 12px;border-radius:8px">' +
            '<span>💡 在「设置」配置可用的 AI 接口后，这里可以在站内一键识别，无需复制粘贴。</span>' +
            '<div class="spacer"></div><a class="btn small" href="#/settings">去配置 →</a>' +
          '</div>') +
      '<div class="row mb8"><input type="file" id="ai-file" accept=".md,.txt,.markdown,.docx,.pdf,.png,.jpg,.jpeg,.webp,.bmp,.json" class="input" style="max-width:360px"><span class="muted small">支持 Word、PDF、扫描件、图片和题库 JSON</span></div>' +
      '<textarea class="textarea" id="ai-raw" rows="7" placeholder="资料原文：选择 .docx / .txt 文件会自动读入，也可以直接把 Word 内容粘贴到这里…"></textarea>' +
      (LLM.configured()
        ? '<div class="row mt8">' +
            '<button class="btn primary" id="ai-auto">⚡ 一键 AI 识别</button>' +
            '<span id="ai-status" class="muted small"></span>' +
          '</div>' +
          '<details class="mt8"><summary class="small" style="cursor:pointer;color:var(--primary)">手动方式（复制提示词给 AI）</summary>' +
            '<div class="mt8" id="ai-manual"></div>' +
          '</details>'
        : '<div class="row mt8">' +
            '<button class="btn primary" id="ai-copy">📋 复制识别提示词</button>' +
            '<span class="muted small">复制后打开：</span>' + aiLinksHtml() +
          '</div>' +
          '<div class="muted small mt8">AI 会自动判断科目、拆分题目、整理答案，无需任何固定格式。</div>' +
          '<hr class="divider">' +
          '<textarea class="textarea" id="ai-reply" rows="7" placeholder="把 AI 的完整识别回复粘贴到这里，网站会自行提取题目…"></textarea>' +
          '<div class="row mt8"><button class="btn primary" id="ai-parse">✅ 解析识别结果</button></div>');

    bindFileInput('ai-file', 'ai-raw');

    function bindManual() {
      const manual = box.querySelector('#ai-manual');
      manual.innerHTML =
        '<textarea class="prompt-box" readonly id="ai-prompt" style="height:120px"></textarea>' +
        '<div class="row mt8">' +
          '<button class="btn primary small" id="ai-copy">📋 复制识别提示词</button>' +
          '<span class="muted small">复制后打开：</span>' + aiLinksHtml() +
        '</div>' +
        '<textarea class="textarea mt8" id="ai-reply" rows="5" placeholder="把 AI 的完整识别回复粘贴到这里…"></textarea>' +
        '<div class="row mt8"><button class="btn small primary" id="ai-parse">✅ 解析识别结果</button></div>';
      manual.querySelector('#ai-prompt').value = Prompt.importPrompt(box.querySelector('#ai-raw').value);
      manual.querySelector('#ai-copy').addEventListener('click', function () {
        const raw = box.querySelector('#ai-raw').value.trim();
        if (!raw) { UI.toast('请先选择文件或粘贴资料原文', 'warn'); return; }
        UI.copyText(Prompt.importPrompt(raw)).then(function () { UI.toast('识别提示词已复制，去粘贴给 AI 吧'); });
      });
      manual.querySelector('#ai-parse').addEventListener('click', function () {
        try {
          parsed = parseAIJson(manual.querySelector('#ai-reply').value);
          renderPreview();
        } catch (e) {
          parsed = [];
          renderPreview();
          overlay.querySelector('#im-preview').innerHTML =
            '<div class="empty-state" style="padding:16px">AI 回复解析失败：' + h(e.message) + '</div>';
        }
      });
    }

    if (LLM.configured()) {
      bindManual();
      box.querySelector('#ai-auto').addEventListener('click', async function () {
        const raw = box.querySelector('#ai-raw').value.trim();
        if (!raw) { UI.toast('请先选择文件或粘贴资料原文', 'warn'); return; }
        const status = box.querySelector('#ai-status');
        const btn = box.querySelector('#ai-auto');
        btn.disabled = true;
        status.innerHTML = '<span class="spin">⏳</span> AI 正在识别题目与答案，约需 10-40 秒…';
        try {
          parsed = await recognizeImportWithAI(raw, function (part, total) {
            if (total > 1) status.innerHTML = '<span class="spin">⏳</span> 正在识别第 ' + part + ' / ' + total + ' 段…';
          });
          status.innerHTML = '';
          btn.disabled = false;
          renderPreview();
        } catch (e) {
          status.innerHTML = '<span style="color:var(--red)">❌ ' + h(e.message) + '</span>';
          btn.disabled = false;
        }
      });
    } else {
      box.querySelector('#ai-copy').addEventListener('click', function () {
        const raw = box.querySelector('#ai-raw').value.trim();
        if (!raw) { UI.toast('请先选择文件或粘贴资料原文', 'warn'); return; }
        UI.copyText(Prompt.importPrompt(raw)).then(function () { UI.toast('识别提示词已复制，去粘贴给 AI 吧'); });
      });
      box.querySelector('#ai-parse').addEventListener('click', function () {
        try {
          parsed = parseAIJson(box.querySelector('#ai-reply').value);
          renderPreview();
        } catch (e) {
          parsed = [];
          renderPreview();
          overlay.querySelector('#im-preview').innerHTML =
            '<div class="empty-state" style="padding:16px">AI 回复解析失败：' + h(e.message) +
            '<br><span class="small">请粘贴 AI 的完整回复后重试；复杂资料建议配置站内 AI 接口。</span></div>';
        }
      });
    }
  }

  function renderLocal() {
    const box = overlay.querySelector('#im-mode');
    box.innerHTML =
      '<div class="row mb8"><input type="file" id="im-file" accept=".md,.txt,.markdown,.docx,.pdf,.png,.jpg,.jpeg,.webp,.bmp,.json" class="input" style="max-width:360px">' +
      '<button class="btn small primary" id="im-parse">重新解析预览</button><span id="im-status" class="muted small"></span></div>' +
      '<div class="muted small mb8">选择 Word、PDF 或文本后自动提取题目与答案并预览；请核对每道题的答案。扫描版 PDF 或排版复杂时可切换上方 AI 识别。</div>' +
      '<textarea class="textarea" id="im-text" rows="9" placeholder="按格式书写可精准解析：&#10;【科目】刑法&#10;【题目】请默写：正当防卫的成立条件&#10;【标准答案】&#10;一、起因条件：……&#10;&#10;多题之间用一行 ------------ 分隔。&#10;也支持「问：/答：」结构，或直接粘贴普通文本兜底导入。"></textarea>' +
      '<details class="mt8"><summary class="small" style="cursor:pointer;color:var(--primary)">格式说明</summary>' +
        '<pre class="small" style="white-space:pre-wrap;background:var(--surface-muted);padding:10px;border:1px solid var(--border);border-radius:8px;margin-top:6px">【科目】刑法\n【题目】请默写：正当防卫的成立条件\n【标准答案】\n一、起因条件：存在现实的不法侵害；\n二、时间条件：不法侵害正在进行；\n\n------------\n（下一道题，格式相同）\n\n支持的写法：\n· 【科目】/ 科目：  【题目】/【题干】/ 题目：\n· 【标准答案】/【答案】/ 标准答案：\n· 问：… / 答：… 结构（自动识别多题）\n· 多题之间用一行 ------ 或 ====== 分隔\n· 任意普通文本也能兜底导入（首行为题名）\n· 支持 .docx；老版 .doc 请先另存为 .docx</pre>' +
      '</details>';
    bindFileInput('im-file', 'im-text', async function (text) {
      const token = ++recognitionToken;
      const status = box.querySelector('#im-status');
      const qaStructured = /【(?:题目|题干|问|问题)】|(?:^|\n)\s*(?:题目|题干|问|问题)\s*[:：]/.test(text) &&
        /【(?:标准|参考)?答案】|(?:^|\n)\s*(?:标准|参考)?答(?:案)?\s*[:：]/.test(text);
      const localResult = parseImport(text);
      const topicResult = parseNumberedTopics(text);
      const headingResult = topicResult.length ? [] : parseHeadingSections(text);
      const structured = qaStructured || topicResult.length > 0 || headingResult.length > 0;
      if (!structured && LLM.configured()) {
        status.innerHTML = '<span class="spin">⏳</span> 排版没有明确题目/答案标记，正在用站内 AI 识别…';
        parsed = [];
        renderPreview();
        try {
          const found = await recognizeImportWithAI(text, function (part, total) {
            if (total > 1) status.innerHTML = '<span class="spin">⏳</span> 正在识别第 ' + part + ' / ' + total + ' 段…';
          });
          if (token !== recognitionToken) return;
          parsed = found;
          status.textContent = 'AI 已识别，请核对后导入';
        } catch (err) {
          if (token !== recognitionToken) return;
          parsed = localResult;
          status.textContent = 'AI 识别失败，已显示本地解析结果：' + err.message;
        }
      } else {
        parsed = topicResult.length ? topicResult : (headingResult.length ? headingResult : localResult);
        status.textContent = topicResult.length
          ? '已按文档标题层级识别 ' + topicResult.length + ' 个专题'
          : (headingResult.length
              ? '已按文档大纲层级识别 ' + headingResult.length + ' 道题目'
              : (qaStructured ? '已按题目/答案标记解析' : '未找到明确章节边界，请仔细核对预览'));
      }
      renderPreview();
    });
    box.querySelector('#im-parse').addEventListener('click', function () {
      parsed = parseImport(box.querySelector('#im-text').value);
      renderPreview();
    });
  }

  renderMode();

  imImport.addEventListener('click', function () {
    if (!parsed.length) return;
    const items = parsed.slice();
    const duplicateMode = overlay.querySelector('#im-duplicate-mode').value;
    Store.importQuestions(items, duplicateMode)
      .then(function (stats) {
        UI.closeModal(overlay);
        UI.toast('导入完成：新增 ' + stats.added + ' 道，更新 ' + stats.updated + ' 道，跳过 ' + stats.skipped + ' 道');
        if (onDone) onDone();
      }).catch(function (e) { UI.toast('导入保存失败：' + e.message, 'err'); });
  });
}

function downloadTemplate() {
  const tpl = '【科目】刑法\n【题目】请默写：正当防卫的成立条件\n【标准答案】\n一、起因条件：存在现实的不法侵害；\n二、时间条件：不法侵害正在进行；\n三、对象条件：针对不法侵害人本人；\n四、主观条件：具有防卫意图；\n五、限度条件：未明显超过必要限度造成重大损害。\n\n------------\n\n【科目】民法\n【题目】请默写：善意取得的构成要件\n【标准答案】\n一、受让人受让时是善意的；\n二、以合理的价格转让；\n三、转让的财产依法应当登记的已经登记，不需要登记的已经交付。\n\n------------\n\n（把上面的示例换成你自己的题目，多道题之间用一行 ------------ 分隔）\n';
  UI.download('法笺-题目导入模板.txt', tpl);
  UI.toast('模板已下载');
}

// ===== 题库页渲染 =====
Views.bank = function (view) {
  let keyword = '';
  let subjectFilter = '';
  let statusFilter = '';
  const selected = new Set();

  App.setActions('<button class="btn primary" id="ta-newq">＋ 新建题目</button><button class="btn" id="ta-import">导入题目</button>');

  function listHtml() {
    const db = Store.db;
    const kw = keyword.trim().toLowerCase();
    const qs = db.questions.filter(function (q) {
      if (subjectFilter && q.subject !== subjectFilter) return false;
      const last = Store.latestScoreByQuestion()[q.id];
      if (statusFilter === 'unpracticed' && last) return false;
      if (statusFilter === 'weak' && (!last || Number(last.score) >= 70)) return false;
      if (statusFilter === 'starred' && !q.starred) return false;
      if (statusFilter === 'unreviewed' && q.reviewedAt) return false;
      if (kw) {
        const t = (q.title + ' ' + q.stem + ' ' + (q.answer || '')).toLowerCase();
        if (t.indexOf(kw) < 0) return false;
      }
      return true;
    });
    if (!qs.length) {
      return '<div class="empty-state"><div class="big-ico">题</div>' +
        (db.questions.length ? '没有符合筛选条件的题目' : '题库还是空的<br>点击右上角「新建题目」或「导入题目」开始') + '</div>';
    }
    const latest = Store.latestScoreByQuestion();
    return '<table class="table"><thead><tr><th><input type="checkbox" id="bk-all"></th><th>题目</th><th>科目</th><th>来源/版本</th><th class="num">练习</th><th class="num">最近得分</th><th style="width:230px">操作</th></tr></thead><tbody>' +
      qs.map(function (q) {
        const hist = Store.questionHistory(q.id);
        const m = latest[q.id];
        return '<tr>' +
          '<td><input type="checkbox" data-select="' + q.id + '"' + (selected.has(q.id) ? ' checked' : '') + '></td>' +
          '<td><div style="font-weight:600">' + (q.starred ? '⭐ ' : '') + h(q.title) + '</div><div class="muted small" style="max-width:420px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + h(q.stem || '') + '</div>' +
          ((q.tags || []).length ? '<div class="chips mt8">' + q.tags.slice(0, 4).map(function (t) { return '<span class="chip">' + h(t) + '</span>'; }).join('') + '</div>' : '') + '</td>' +
          '<td>' + UI.subjectTag(q.subject) + '</td>' +
          '<td class="muted small">' + h(q.source || '手动') + (q.sourcePage ? '<br>第 ' + h(q.sourcePage) + ' 页' : '') + (q.materialYear ? '<br>' + h(q.materialYear) + '年' : '') + (q.lawVersion ? ' · ' + h(q.lawVersion) : '') + (!q.reviewedAt ? '<br><span style="color:var(--orange)">待人工校对</span>' : '') + '</td>' +
          '<td class="num muted">' + hist.length + '</td>' +
          '<td class="num">' + (m ? UI.scoreBadge(m.score) : '<span class="muted small">未练习</span>') + '</td>' +
          '<td><div class="row" style="gap:6px;flex-wrap:nowrap">' +
            '<a class="btn small primary" href="#/practice/' + q.id + '">默写</a>' +
            '<a class="btn small" href="#/practice/' + q.id + '?mode=fill">填空</a>' +
            '<button class="btn small" data-edit="' + q.id + '">编辑</button>' +
            '<button class="btn small danger" data-del="' + q.id + '">删除</button>' +
          '</div></td>' +
        '</tr>';
      }).join('') + '</tbody></table>';
  }

  function bindList() {
    const all = view.querySelector('#bk-all');
    if (all) all.addEventListener('change', function () {
      view.querySelectorAll('[data-select]').forEach(function (x) { x.checked = all.checked; if (all.checked) selected.add(x.dataset.select); else selected.delete(x.dataset.select); });
      updateBulk();
    });
    view.querySelectorAll('[data-select]').forEach(function (x) { x.addEventListener('change', function () { if (x.checked) selected.add(x.dataset.select); else selected.delete(x.dataset.select); updateBulk(); }); });
    view.querySelectorAll('[data-edit]').forEach(function (b) {
      b.addEventListener('click', function () {
        openQuestionModal(Store.getQuestion(b.dataset.edit), render);
      });
    });
    view.querySelectorAll('[data-del]').forEach(function (b) {
      b.addEventListener('click', function () {
        const q = Store.getQuestion(b.dataset.del);
        if (!q) return;
        UI.confirmBox('删除题目', '确定删除「<b>' + h(q.title) + '</b>」吗？<br><span class="muted small">该题的复习排期和错题记录会一并删除，判分历史保留。</span>', true)
          .then(function (ok) {
            if (!ok) return;
            Store.deleteQuestion(q.id).then(function () {
              UI.toast('已删除');
              render();
            });
          });
      });
    });
  }

  function updateBulk() {
    const n = view.querySelector('#bk-selected-count');
    if (n) n.textContent = selected.size ? ('已选 ' + selected.size + ' 道') : '批量操作';
  }

  function render() {
    view.innerHTML =
      '<div class="card">' +
        '<div class="row mb16">' +
          '<input class="input" id="bk-search" value="' + h(keyword) + '" placeholder="搜索题目 / 答案关键词…" style="max-width:260px">' +
          '<select class="select" id="bk-subject"><option value="">全部科目</option>' +
            UI.SUBJECTS.map(function (s) { return '<option' + (s === subjectFilter ? ' selected' : '') + '>' + s + '</option>'; }).join('') +
          '</select>' +
          '<select class="select" id="bk-status"><option value="">全部状态</option><option value="unpracticed">未练习</option><option value="weak">低于70分</option><option value="starred">重点收藏</option><option value="unreviewed">待人工校对</option></select>' +
          '<div class="spacer"></div>' +
          '<button class="btn" id="bk-template">下载导入模板</button>' +
        '</div>' +
        '<div class="row mb16" style="background:var(--surface-muted);padding:8px 10px;border:1px solid var(--border);border-radius:8px"><b class="small" id="bk-selected-count">批量操作</b>' +
          '<select class="select small" id="bk-bulk-subject"><option value="">修改科目…</option>' + UI.SUBJECTS.map(function (s) { return '<option>' + s + '</option>'; }).join('') + '</select>' +
          '<button class="btn small" id="bk-export">导出所选</button><button class="btn small danger" id="bk-delete-selected">删除所选</button></div>' +
        '<div id="bk-list">' + listHtml() + '</div>' +
      '</div>';

    view.querySelector('#bk-search').addEventListener('input', function (e) {
      keyword = e.target.value;
      view.querySelector('#bk-list').innerHTML = listHtml();
      bindList();
    });
    view.querySelector('#bk-subject').addEventListener('change', function (e) {
      subjectFilter = e.target.value;
      view.querySelector('#bk-list').innerHTML = listHtml();
      bindList();
    });
    view.querySelector('#bk-status').value = statusFilter;
    view.querySelector('#bk-status').addEventListener('change', function (e) { statusFilter = e.target.value; view.querySelector('#bk-list').innerHTML = listHtml(); bindList(); });
    view.querySelector('#bk-bulk-subject').addEventListener('change', function (e) {
      const subject = e.target.value; if (!subject || !selected.size) { if (!selected.size) UI.toast('请先勾选题目', 'warn'); return; }
      Store.db.questions.forEach(function (q) { if (selected.has(q.id)) q.subject = subject; });
      Store.save().then(function () { UI.toast('已批量修改科目'); render(); });
    });
    view.querySelector('#bk-export').addEventListener('click', function () {
      const items = Store.db.questions.filter(function (q) { return selected.has(q.id); });
      if (!items.length) { UI.toast('请先勾选题目', 'warn'); return; }
      UI.download('法考题库-' + UI.todayStr() + '.json', JSON.stringify({ version: 2, questions: items }, null, 2), 'application/json');
    });
    view.querySelector('#bk-delete-selected').addEventListener('click', function () {
      if (!selected.size) { UI.toast('请先勾选题目', 'warn'); return; }
      UI.confirmBox('批量删除', '确定删除选中的 ' + selected.size + ' 道题吗？', true).then(function (ok) {
        if (!ok) return;
        const ids = new Set(selected); Store.db.questions = Store.db.questions.filter(function (q) { return !ids.has(q.id); });
        Store.db.reviewQueue = Store.db.reviewQueue.filter(function (x) { return !ids.has(x.questionId); });
        Store.db.wrongbook = Store.db.wrongbook.filter(function (x) { return !ids.has(x.questionId); });
        ids.forEach(function (id) { delete Store.db.drafts[id]; }); selected.clear();
        Store.save().then(function () { UI.toast('已批量删除'); render(); });
      });
    });
    view.querySelector('#bk-template').addEventListener('click', downloadTemplate);
    document.querySelector('#ta-newq').addEventListener('click', function () { openQuestionModal(null, render); });
    document.querySelector('#ta-import').addEventListener('click', function () { openImportModal(render); });
    bindList();
    updateBulk();
  }

  render();
};

Views.bank.openQuestionModal = openQuestionModal;
Views.bank.openImportModal = openImportModal;
