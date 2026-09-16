// 仪表盘
window.Views = window.Views || {};
Views.dashboard = function (view) {
  const db = Store.db;
  const scored = db.history.filter(function (h) { return h.score != null; });
  const avg = scored.length ? Math.round(scored.reduce(function (a, h) { return a + Number(h.score); }, 0) / scored.length * 10) / 10 : null;
  const mastered = Store.masteredIds().length;
  const due = Store.dueItems();
  const recent = db.history.slice(0, 5);
  const showGuide = !(db.settings && db.settings.onboardingDismissed);

  const dueListHtml = due.length ? due.map(function (it) {
    const q = Store.getQuestion(it.questionId);
    const title = q ? q.title : '（题目已删除）';
    const lost = (it.lostPoints || []).slice(0, 4).map(function (p) { return '<span class="chip hot">' + h(p) + '</span>'; }).join('');
    return '<div class="review-item">' +
      UI.subjectTag(q && q.subject) +
      '<span class="ttl" data-go="practice" data-id="' + it.questionId + '">' + h(title) + '</span>' +
      '<span class="due-chip ' + (it.dueDate === UI.todayStr() ? 'today' : '') + '">' + UI.fmtDate(it.dueDate) + '</span>' +
      UI.scoreBadge(it.fromScore) +
      (lost ? '<div class="chips">' + lost + '</div>' : '') +
      '<div class="spacer"></div>' +
      (q ? '<a class="btn small primary" href="#/practice/' + it.questionId + '">开始复默</a>' : '') +
      '</div>';
  }).join('') : '<div class="empty-state" style="padding:24px"><div class="big-ico">安</div>今日没有待复默的题目<br><span class="small">完成默写判分后会自动生成复习排期</span></div>';

  const recentHtml = recent.length ? recent.map(function (h1) {
    const q = Store.getQuestion(h1.questionId);
    return '<div class="list-row">' +
      '<span class="muted small" style="min-width:120px">' + UI.fmtDateTime(h1.date) + '</span>' +
      UI.subjectTag(h1.subject) +
      '<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' +
      (h1.raw ? '<a href="#/result/' + h1.id + '" style="text-decoration:none;color:inherit;font-weight:600">' + h(h1.questionTitle) + '</a>' : h(h1.questionTitle)) +
      '</span>' +
      '<span class="muted small">' + h(h1.mode) + '模式</span>' +
      UI.scoreBadge(h1.score) +
      '</div>';
  }).join('') : '<div class="empty-state" style="padding:24px">还没有判分记录，先去做一道题吧</div>';

  view.innerHTML =
    (showGuide ? '<div class="card start-guide"><div><span class="eyebrow">QUICK START</span><h2>三步建立你的训练闭环</h2><p class="muted">导入资料并核对题目 → 完成一次默写判分 → 根据失分记录安排复习。</p></div><div class="guide-steps"><a href="#/bank"><b>01</b><span>导入题库</span></a><a href="#/practice/' + (db.questions[0] ? db.questions[0].id : '') + '"><b>02</b><span>体验判分</span></a><a href="#/history"><b>03</b><span>查看学习趋势</span></a></div><button class="btn ghost small" id="guide-dismiss">我知道了</button></div>' : '') +
    '<div class="grid-cards">' +
      '<div class="stat-card"><div class="num">' + db.history.length + '</div><div class="lbl">累计判分</div></div>' +
      '<div class="stat-card"><div class="num">' + (avg == null ? '—' : avg) + '</div><div class="lbl">平均分</div></div>' +
      '<div class="stat-card"><div class="num">' + mastered + '</div><div class="lbl">已掌握题数（≥90分）</div></div>' +
      '<div class="stat-card"><div class="num" style="color:var(' + (due.length ? '--red' : '--green') + ')">' + due.length + '</div><div class="lbl">今日待复默</div></div>' +
    '</div>' +

    '<div class="card q-head-card">' +
      '<h2>快速开始</h2>' +
      '<div class="row">' +
        '<button class="btn primary big" id="btn-random">随机抽题默写</button>' +
        '<a class="btn big" href="#/bank">去题库选题</a>' +
        '<button class="btn big" id="btn-newq">＋ 新建题目</button>' +
      '</div>' +
      (db.questions.length ? '' : '<p class="muted mt16">题库还是空的：可以先导入你的题目文件，或在题库页手动创建。</p>') +
    '</div>' +

    '<div class="card">' +
      '<h2>今日待复默 <span class="h2-side"><a class="small" href="#/review">查看全部排期 →</a></span></h2>' +
      dueListHtml +
    '</div>' +

    '<div class="card">' +
      '<h2>最近判分 <span class="h2-side"><a class="small" href="#/history">全部记录 →</a></span></h2>' +
      recentHtml +
    '</div>';

  view.querySelector('#btn-random').addEventListener('click', function () {
    const latest = Store.latestScoreByQuestion();
    const pool = db.questions.filter(function (q) {
      const m = latest[q.id];
      return !m || m.score < 90;
    });
    if (!pool.length) { UI.toast('所有题目都已掌握，去题库添加新题吧！', 'warn'); return; }
    const q = pool[Math.floor(Math.random() * pool.length)];
    location.hash = '#/practice/' + q.id;
  });
  const dismiss = view.querySelector('#guide-dismiss');
  if (dismiss) dismiss.addEventListener('click', function () { db.settings.onboardingDismissed = true; Store.save().then(function () { Views.dashboard(view); }); });
  view.querySelector('#btn-newq').addEventListener('click', function () {
    Views.bank.openQuestionModal(null, function () { route(); });
  });
  view.querySelectorAll('[data-go="practice"]').forEach(function (el) {
    el.addEventListener('click', function () {
      const q = Store.getQuestion(el.dataset.id);
      if (q) location.hash = '#/practice/' + q.id;
    });
  });
};
