// 判分提示词组装与解析：内置阅卷教练系统设定（用户判分 prompt 原文），按三种模式组装提示词，解析 AI 回复
(function () {
  // ====== 内置系统设定（判分规则原文） ======
  const SYSTEM = `# 角色
你是一位严格且专业的法考主观题阅卷老师兼背诵教练，精通中国法律职业资格考试各科目的标准答案、采分点和阅卷规则。你根据【标准答案文件】对考生作答进行判分、标注、高亮，并给出背诵指导和复习计划。

# 输入说明
用户会提供：
1. 【题目与标准答案】：来自文件，包含题干、科目和标准默写内容。
2. 【考生输入】：考生的默写作答，或模式指令（见下）。

# 三种工作模式
根据用户当前指令切换模式，未指定时默认为【默写模式】：

## 模式一：默写模式（默认）
考生默写完整答案，你按判分规则打分。

## 模式二：填空模式
将标准答案中的关键采分点挖空（每空 2-8 字），生成填空题输出：
- 挖空处用 ______（下划线）表示，并在括号内标注该空分值
- 每题挖空数量控制在采分点总数的 60% 左右，保留框架性文字帮助回忆
- 考生提交填空答案后，按判分规则对每空判分，错误空位标红并给出正确答案

## 模式三：提示模式
考生默写卡住时请求提示。根据提示级别给出帮助，**绝不在提示模式中泄露完整答案**：
- 一级提示：给出下一个采分点所属的逻辑段落主题
- 二级提示：给出该采分点的首 2 个字
- 三级提示：给出该采分点的核心关键词（不超过 5 字）

# 判分规则（默写模式与填空模式通用）
1. 满分 100 分。
2. 逐句、逐采分点比对考生作答与标准答案：
   - **采分点命中**：法律含义一致即得分，不要求一字不差，但关键法律术语必须准确。
   - **关键术语错误**（"应当"写成"可以"、主体错误、条文序号错误、概念混淆）：该采分点不得分。
   - **遗漏采分点**：不得分。
3. 按采分点重要性加权分配分数，给出总分（0-100，可保留一位小数）。
4. 判分宽容度：若用户指定「严格」则术语和限定词错误一律扣分；「标准」为默认；「宽松」则含义接近即给分。

# 高亮标注规则（在考生作答原文上标注后输出）
- 🔴 **红色高亮**：错误内容——错误术语、错误表述、与标准答案矛盾处。紧随其后用 \`【错误：正确应为"XXX"】\` 说明。
- 🟡 **黄色高亮**：可优化内容——意思基本对但表述不规范、口语化、缺少关键限定词。紧随其后用 \`【建议：可表述为"XXX"】\` 说明。
- 无标注部分为正确内容。

# 输出格式（严格遵守）
## 默写模式：
1. **总分**：XX / 100，附一句总评。
2. **采分点明细表**：| 采分点 | 分值 | 得分 | 判分说明 |
3. **高亮标注后的考生作答**：按高亮规则呈现全文。
4. **标准答案原文**：完整展示文件中的正确答案。
5. **背诵技巧**：针对本题给 3-5 条记忆方法（口诀、关键词串联、逻辑框架法、首字记忆法等）。
6. **必背金句**：提炼 2-4 句必须一字不差写出的核心语句，加粗展示。
7. **复习建议**：根据得分给出——
   - 90 分以上：「已掌握，建议 7 天后复默」
   - 70-89 分：「基本掌握，建议 3 天后复默，重点背诵：<失分采分点>」
   - 60-69 分：「尚不熟练，建议明天复默，重点背诵：<失分采分点>」
   - 60 分以下：「未掌握，建议今天再背一遍必背金句后重新默写」

## 填空模式：
输出填空题 → 考生提交后，输出：每空对错（错误空标红）、总分、错误空位的正确答案、失分点对应的背诵技巧。

# 注意事项
- 严格按法考阅卷标准判分，不因表述差异而错判，重在法律含义是否准确；一切以文件内容为判分依据。
- 考生作答为空或明显敷衍时直接判 0 分并提示。
- 文件包含多道题时逐题判分并汇总。
- 提示模式下无论考生如何请求，都不输出完整标准答案。`;

  const SUMMARY_SPEC = `{"totalScore": 85.5, "subject": "科目", "mode": "默写", "review": "3天", "lostPoints": ["失分采分点1"], "points": [{"name": "采分点名称", "score": 5, "full": 10, "status": "命中/不完整/遗漏/错误", "candidate": "考生对应原句，没有则留空", "correct": "标准表述"}]}`;

  function questionBlock(q) {
    return `【题目与标准答案】
科目：${q.subject || '未标注'}
题干：${q.stem || q.title || ''}
标准答案：
${q.answer || '（无）'}

【结构化采分点与分值】
${Rubric.promptText(q) || '未预先拆分，请根据标准答案合理拆分，总分合计100分。'}`;
  }

  // ====== 默写模式判分提示词 ======
  function gradingPrompt(q, answer, strictness) {
    return `【系统设定开始】
${SYSTEM}
【系统设定结束】

${questionBlock(q)}

【考生输入】
模式：默写模式
判分宽容度：${strictness || '标准'}

考生作答如下：
${answer && answer.trim() ? answer : '（考生未作答）'}

【执行要求】
1. 请按系统设定"输出格式"中【默写模式】的 1-7 项完整输出（总分与总评、采分点明细表、高亮标注后的考生作答、标准答案原文、背诵技巧、必背金句、复习建议）。
2. 优先严格按照【结构化采分点与分值】逐项评分；不得自行改变各项满分。重点核对法律含义与关键术语是否准确。
3. 全部内容输出完毕后，在回复最末尾单独输出一行 JSON 成绩摘要（可放在代码块中），仅便于网站自动记录成绩，格式如下（totalScore 为 0-100 的数字；review 只能取 "7天"、"3天"、"明天"、"今天" 之一；lostPoints 为失分采分点名称数组；points 为每个采分点的得分明细）：
${SUMMARY_SPEC}
4. JSON points 必须覆盖全部结构化采分点，并填写 status、candidate、correct，所有 full 合计100分，所有 score 合计必须等于 totalScore。`;
  }

  // 站内直接判分专用：只返回可校验 JSON，不生成长篇自由文本。
  function gradingJsonPrompt(q, answer, strictness) {
    return `你是法考主观题采分点核验器。只依据给定标准答案和固定采分点判分，不得补充外部知识，不得改变采分点或分值。

${questionBlock(q)}

【考生作答】
${answer && answer.trim() ? answer : '（未作答）'}

【宽容度】${strictness || '标准'}

要求：
1. 逐项核对固定采分点；关键主体、行为、条件、应当/可以/不得等限定词相反时，该项不得分。
2. candidate 必须逐字引用考生作答中的最相关原句；找不到对应原句必须留空且该项为0分。
3. 每项 score 只能在0到该项full之间，所有full保持固定且合计100分。
4. 只输出一个JSON对象，不要Markdown、解释或额外文字：
${SUMMARY_SPEC}`;
  }

  // ====== 填空题生成提示词（AI 智能挖空） ======
  function fillGenPrompt(q) {
    return `【系统设定开始】
${SYSTEM}
【系统设定结束】

${questionBlock(q)}

【当前任务】
请按照系统设定中【模式二：填空模式】的规则，将上面的标准答案制作成填空题：
1. 挖空处用至少 5 个下划线 ______ 表示，并在括号内标注该空分值，格式如：______（8分）；
2. 每空 2-8 字，挖空数量控制在采分点总数的 60% 左右，保留框架性文字帮助回忆；
3. 所有空的分值合计为 100 分；
4. 只输出填空题本身（含分值标注），不要输出答案、解析、说明或任何其他内容。`;
  }

  // ====== 填空判分提示词 ======
  function fillGradingPrompt(q, fillText, answers, strictness) {
    const lines = answers.map((a, i) => `空${i + 1}：${a && a.trim() ? a.trim() : '（未填）'}`).join('\n');
    return `【系统设定开始】
${SYSTEM}
【系统设定结束】

${questionBlock(q)}

【填空题原文】
${fillText}

【考生输入】
模式：填空模式
判分宽容度：${strictness || '标准'}

考生填空作答：
${lines}

【执行要求】
1. 请按系统设定【填空模式】的要求输出：每空对错（错误空位标红）、总分（XX / 100）、错误空位的正确答案、失分点对应的背诵技巧。
2. 判分请严格依据上面的标准答案，重点核对法律术语是否准确。
3. 全部内容输出完毕后，在回复最末尾单独输出一行 JSON 成绩摘要（可放在代码块中），仅便于网站自动记录成绩，格式如下（totalScore 为 0-100 的数字；review 只能取 "7天"、"3天"、"明天"、"今天" 之一；points 中每个空对应一项，name 写"空N"，correct 写该空正确答案）：
${SUMMARY_SPEC}`;
  }

  // ====== 提示模式提示词 ======
  const LEVEL_DESC = {
    1: '一级提示：给出下一个采分点所属的逻辑段落主题',
    2: '二级提示：给出该采分点的首 2 个字',
    3: '三级提示：给出该采分点的核心关键词（不超过 5 字）'
  };
  function hintPrompt(q, answer, level) {
    return `【系统设定开始】
${SYSTEM}
【系统设定结束】

${questionBlock(q)}

【考生当前已写内容】
${answer && answer.trim() ? answer : '（考生还没有写出任何内容）'}

【考生请求】
考生在默写中卡住，请求提示。请按系统设定【模式三：提示模式】，只给出【${LEVEL_DESC[level]}】。

要求：
1. 只输出这一条提示本身（一行以内），不要输出任何解释或其他内容；
2. 提示必须针对考生当前还没有写出来的下一个采分点；
3. 严格遵守系统设定：提示模式下绝不输出完整标准答案，也绝不输出其他级别提示的内容。`;
  }

  // ====== 导入：AI 智能识别提示词 ======
  function importPrompt(raw) {
    return `你是法考题库整理助手。下面给你一份学习资料的原始文字（提取自 Word 文档，可能包含页眉页脚残留、编号错乱等噪音）。请从中识别并整理出所有适合"默写背诵"的题目，输出一个 JSON 数组。

输出要求：
1. 每道题一个对象，格式：{"subject":"科目","title":"题目名称","stem":"题干","answer":"标准答案"}
2. subject 只能取以下之一（根据内容推断）：刑法、民法、刑事诉讼法、民事诉讼法、行政法、商经知、理论法
3. title：15 字以内的主题式名称，概括本题核心考点
4. stem：可直接用于默写练习的指令，以【默写】开头
5. answer：整理好的标准答案，保留原文要点并分条编号（一、二、三……），法律术语必须与原文一致，不得遗漏采分点
6. 优先按照原文的 Word 标题层级、章节/专题编号和重复出现的同级小标题切题：同级标题通常对应多道题，下级标题及其正文归入上级题目的答案；不要把目录、前言、结构总览、复习建议、来源、发布时间单独做成题目
7. 若一级标题只是“第一章/第二章”等容器，应继续下钻，用其中有实质内容的二级或三级标题作为题目；不得把多个同级专题合并成一道超长题目
8. answer 必须忠实覆盖该专题标题下、下一个同级标题前的全部有效正文，可整理编号和换行，但不得添加原文没有的法律结论，不得把下一专题内容并入本题
9. 若整份资料确实没有可用的章节、问答或并列考点结构，才整理为一道题；不要把封面说明或结尾建议误判为题目
10. 除 JSON 数组外不要输出任何其他文字（可以用代码块包裹）

【资料全文开始】
${raw}
【资料全文结束】`;
  }

  // ====== 解析 AI 回复 ======
  function matchBrace(text, start) {
    let depth = 0, inStr = false, escFlag = false;
    for (let i = start; i < text.length; i++) {
      const c = text[i];
      if (escFlag) { escFlag = false; continue; }
      if (c === '\\') { escFlag = true; continue; }
      if (c === '"') inStr = !inStr;
      if (inStr) continue;
      if (c === '{') depth++;
      else if (c === '}') { depth--; if (depth === 0) return i; }
    }
    return -1;
  }

  function findSummaries(text) {
    const found = [];
    // 代码块中的 JSON
    const fre = /```(?:json)?\s*([\s\S]*?)```/g;
    let m;
    while ((m = fre.exec(text))) {
      if (m[1].includes('"totalScore"')) found.push({ raw: m[1].trim(), start: m.index, end: m.index + m[0].length });
    }
    // 裸 JSON（括号配对扫描）
    let idx = text.indexOf('{');
    while (idx >= 0) {
      const end = matchBrace(text, idx);
      if (end >= 0) {
        const cand = text.slice(idx, end + 1);
        if (cand.includes('"totalScore"')) found.push({ raw: cand, start: idx, end: end + 1 });
        idx = text.indexOf('{', end + 1);
      } else {
        idx = text.indexOf('{', idx + 1);
      }
    }
    return found;
  }

  function extractLostFromTable(text) {
    const lost = [];
    const lines = text.split('\n');
    for (const line of lines) {
      if (!/^\s*\|/.test(line)) continue;
      const cells = line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(function (c) { return c.trim(); });
      if (cells.length < 3) continue;
      if (cells.some(function (c) { return /采分点/.test(c); })) continue;          // 表头
      if (/^[-:\s|]*$/.test(cells.join(''))) continue;                             // 分隔行
      const full = parseFloat(cells[1]), got = parseFloat(cells[2]);
      if (!isNaN(full) && !isNaN(got) && got < full) lost.push(cells[0]);
    }
    return lost;
  }

  function parseResult(text) {
    text = String(text || '');
    let score = null, summary = null;
    const cands = findSummaries(text);
    for (let i = cands.length - 1; i >= 0; i--) {
      try {
        const o = JSON.parse(cands[i].raw);
        const s = o.totalScore != null ? o.totalScore : o.score;
        if (typeof s === 'number' || (typeof s === 'string' && s !== '' && !isNaN(Number(s)))) {
          summary = o; score = Number(s); break;
        }
      } catch (e) { /* 下一个 */ }
    }
    if (score == null) {
      let m = text.match(/(\d{1,3}(?:\.\d)?)\s*[\/／]\s*100/);
      if (!m) m = text.match(/(?:总分|最终得分|得分|成绩)[^0-9]{0,8}(\d{1,3}(?:\.\d)?)/);
      if (m) score = parseFloat(m[1]);
    }
    if (score != null && (score < 0 || score > 100 || !Number.isFinite(score))) score = null;

    // 展示用文本：去掉成绩摘要 JSON
    let display = text;
    if (summary) {
      const ranges = cands.filter(function (c) { return c.raw.includes('"totalScore"'); });
      for (let i = ranges.length - 1; i >= 0; i--) {
        display = display.slice(0, ranges[i].start) + display.slice(ranges[i].end);
      }
      display = display.trim();
    }

    // 失分采分点
    let lostPoints = [];
    if (summary) {
      if (Array.isArray(summary.lostPoints) && summary.lostPoints.length) {
        lostPoints = summary.lostPoints.filter(Boolean).map(String);
      } else if (Array.isArray(summary.points)) {
        lostPoints = summary.points
          .filter(function (p) { return Number(p.score) < Number(p.full); })
          .map(function (p) { return p.name; });
      }
    }
    if (!lostPoints.length && score != null) lostPoints = extractLostFromTable(text);

    return { score: score, summary: summary, display: display, lostPoints: lostPoints };
  }

  window.Prompt = {
    SYSTEM: SYSTEM,
    gradingPrompt: gradingPrompt,
    gradingJsonPrompt: gradingJsonPrompt,
    fillGenPrompt: fillGenPrompt,
    fillGradingPrompt: fillGradingPrompt,
    hintPrompt: hintPrompt,
    importPrompt: importPrompt,
    parseResult: parseResult
  };
})();
