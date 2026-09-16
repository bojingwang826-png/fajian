// 模拟考试：随机组卷、限时作答、逐题 AI 判分和综合报告。
window.Views = window.Views || {};
Views.exam = function (view) {
  let questions = [];
  let startedAt = 0;
  let deadline = 0;
  let timer = null;

  function setup() {
    App.setActions('');
    view.innerHTML = '<div class="card q-head-card"><h2>模拟考试</h2><p class="muted">按科目随机组卷，统一限时，交卷后逐题判分并生成总成绩。建议先完成每科专题题库的人工校对。</p></div>' +
      '<div class="card"><div class="form-grid">' +
        '<label>考试科目</label><select class="select" id="ex-subject"><option value="">全部科目</option>' + UI.SUBJECTS.map(function (s) { return '<option>' + s + '</option>'; }).join('') + '</select>' +
        '<label>题目数量</label><input class="input" id="ex-count" type="number" min="1" max="10" value="3" style="max-width:120px">' +
        '<label>考试时间</label><div class="row"><input class="input" id="ex-minutes" type="number" min="5" max="360" value="60" style="max-width:120px"><span class="muted">分钟</span></div>' +
      '</div><div class="row mt16"><button class="btn primary big" id="ex-start">开始考试</button>' +
      (!LLM.configured() ? '<span class="badge orange">批量判分需要先配置 AI 接口</span>' : '') + '</div></div>';
    view.querySelector('#ex-start').addEventListener('click', function () {
      const subject = view.querySelector('#ex-subject').value;
      const count = Math.max(1, Math.min(10, Number(view.querySelector('#ex-count').value) || 3));
      const mins = Math.max(5, Math.min(360, Number(view.querySelector('#ex-minutes').value) || 60));
      const pool = Store.db.questions.filter(function (q) { return !subject || q.subject === subject; });
      if (!pool.length) { UI.toast('该科目还没有题目', 'warn'); return; }
      questions = pool.slice().sort(function () { return Math.random() - 0.5; }).slice(0, Math.min(count, pool.length));
      startedAt = Date.now(); deadline = startedAt + mins * 60000; exam();
    });
  }

  function exam() {
    view.innerHTML = '<div class="card q-head-card"><div class="row"><h2 style="margin:0">模拟考试 · ' + questions.length + ' 题</h2><div class="spacer"></div><span class="badge orange">剩余 <b id="ex-time">--:--</b></span></div><p class="muted small mt8">考试期间不显示提示和标准答案；作答会自动保留在本页面。</p></div>' +
      questions.map(function (q, i) { return '<div class="card"><div class="row"><span class="badge blue">第 ' + (i + 1) + ' 题</span>' + UI.subjectTag(q.subject) + '<b>' + h(q.title) + '</b></div><div class="q-stem">' + h(q.stem || q.title) + '</div><textarea class="textarea answer-area mt16" data-answer="' + q.id + '" placeholder="请在此作答……"></textarea></div>'; }).join('') +
      '<div class="card"><div class="row"><span class="muted">交卷后将逐题 AI 判分，耗时取决于题目数量。</span><div class="spacer"></div><button class="btn primary big" id="ex-submit">提交试卷</button></div><div id="ex-status" class="small muted mt8"></div></div>';
    function tick() {
      const sec = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      const el = view.querySelector('#ex-time');
      if (el) el.textContent = String(Math.floor(sec / 60)).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0');
      if (sec === 0) { clearInterval(timer); submit(); }
    }
    tick(); timer = setInterval(tick, 1000); App.onCleanup(function () { clearInterval(timer); });
    view.querySelector('#ex-submit').addEventListener('click', function () {
      UI.confirmBox('确认交卷', '交卷后不能继续修改答案，确定提交吗？').then(function (ok) { if (ok) submit(); });
    });
  }

  async function submit() {
    if (timer) clearInterval(timer);
    const btn = view.querySelector('#ex-submit'); if (btn) btn.disabled = true;
    const status = view.querySelector('#ex-status');
    const results = [];
    try {
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        const input = view.querySelector('[data-answer="' + q.id + '"]');
        const answer = input ? input.value.trim() : '';
        if (status) status.innerHTML = '<span class="spin">⏳</span> 正在判第 ' + (i + 1) + ' / ' + questions.length + ' 题：' + h(q.title);
        const graded = await GradeEngine.grade(q, answer, '标准');
        const parsed = graded; const raw = graded.display || '';
        const study = Store.nextReview(q.id, parsed.score, { hintsUsed: 0, durationSeconds: Math.round((Date.now() - startedAt) / 1000) });
        const sum = parsed.summary || {};
        const lost = Array.isArray(sum.lostPoints) ? sum.lostPoints : [];
        const entry = Store.makeHistory({ questionId: q.id, questionTitle: q.title, subject: q.subject, mode: '模考', score: parsed.score, strictness: '标准', lostPoints: lost, candidateAnswer: answer, standardAnswer: q.answer, raw: raw, gradingPoints: sum.points || [], confidence: sum.confidence, needsReview: !!sum.needsReview, rubricSnapshot: Rubric.normalize(q.rubric), model: parsed.method === 'ai' ? Store.db.settings.llm.model : '本地结构化', promptVersion: 3, hintsUsed: 0, durationSeconds: Math.round((Date.now() - startedAt) / 1000), intervalDays: study.intervalDays, masteryStreak: study.streak });
        if (Array.isArray(sum.points)) {
          Store.recordWrong(q.id, sum.points.filter(function (p) { return Number(p.score) < Number(p.full); }).map(function (p) { return { name: p.name, correct: p.correct }; }));
          Store.reconcileWrongPoints(q.id, sum.points);
        }
        Store.upsertReview(q.id, study.dueDate, parsed.score, lost);
        results.push({ q: q, entry: entry, score: Number(parsed.score) });
      }
      const avg = Math.round(results.reduce(function (n, x) { return n + x.score; }, 0) / results.length * 10) / 10;
      const session = { id: UI.uid(), date: new Date().toISOString(), durationSeconds: Math.round((Date.now() - startedAt) / 1000), score: avg, historyIds: results.map(function (x) { return x.entry.id; }) };
      Store.db.examSessions.unshift(session); await Store.save();
      view.innerHTML = '<div class="card q-head-card"><h2>考试完成 · 平均分 ' + avg + '</h2><p class="muted">用时 ' + Math.ceil(session.durationSeconds / 60) + ' 分钟，所有题目已进入历史记录和智能复习排期。</p></div>' + results.map(function (x, i) { return '<div class="list-row card"><b>第' + (i + 1) + '题 · ' + h(x.q.title) + '</b><div class="spacer"></div>' + UI.scoreBadge(x.score) + '<a class="btn small" href="#/result/' + x.entry.id + '">查看逐项判分</a></div>'; }).join('') + '<div class="row"><button class="btn" id="ex-again">再组一套</button><a class="btn primary" href="#/review">查看复习计划</a></div>';
      view.querySelector('#ex-again').addEventListener('click', setup);
    } catch (e) {
      if (status) status.innerHTML = '<span style="color:var(--red)">❌ ' + h(e.message) + '</span>';
      if (btn) btn.disabled = false;
    }
  }

  setup();
};
