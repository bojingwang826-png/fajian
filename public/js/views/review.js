// 复习计划：按判分得分自动排期（≥90→7天后，70-89→3天后，60-69→明天，<60→今天）
window.Views = window.Views || {};

Views.review = function (view) {
  const today = UI.todayStr();
  // 清理指向已删题目的排期
  const stale = Store.db.reviewQueue.filter(function (i) { return !Store.getQuestion(i.questionId); });
  if (stale.length) {
    Store.db.reviewQueue = Store.db.reviewQueue.filter(function (i) { return !!Store.getQuestion(i.questionId); });
    Store.save();
  }

  function itemHtml(it) {
    const q = Store.getQuestion(it.questionId);
    const overdue = UI.daysBetween(today, it.dueDate) < 0;
    const lost = (it.lostPoints || []).slice(0, 4).map(function (p) { return '<span class="chip hot">' + h(p) + '</span>'; }).join('');
    return '<div class="review-item">' +
      UI.subjectTag(q && q.subject) +
      '<span class="ttl" data-qid="' + it.questionId + '">' + h(q.title) + '</span>' +
      '<span class="due-chip ' + (it.dueDate === today ? 'today' : '') + '">' + (overdue ? '逾期' : '') + UI.fmtDate(it.dueDate) + '</span>' +
      UI.scoreBadge(it.fromScore) +
      (lost ? '<div class="chips">' + lost + '</div>' : '') +
      '<div class="spacer"></div>' +
      '<a class="btn small primary" href="#/practice/' + it.questionId + '">开始复默</a>' +
      '<select class="select small" data-postpone="' + it.questionId + '" style="font-size:12px;padding:4px 6px">' +
        '<option value="">推迟…</option><option value="1">1 天</option><option value="3">3 天</option><option value="7">7 天</option>' +
      '</select>' +
      '<button class="btn small" data-master="' + it.questionId + '">✓ 已掌握</button>' +
      '</div>';
  }

  const due = Store.dueItems();
  const upcoming = Store.db.reviewQueue.filter(function (i) { return i.dueDate > today; })
    .sort(function (a, b) { return a.dueDate < b.dueDate ? -1 : 1; })
    .slice(0, 20);

  let upcomingHtml = '';
  if (upcoming.length) {
    const byDate = {};
    upcoming.forEach(function (i) { (byDate[i.dueDate] = byDate[i.dueDate] || []).push(i); });
    upcomingHtml = Object.keys(byDate).sort().map(function (d) {
      return '<div class="mb8"><span class="badge gray">' + UI.fmtDate(d) + '（' + byDate[d].length + ' 题）</span> ' +
        byDate[d].map(function (i) {
          const q = Store.getQuestion(i.questionId);
          return '<a href="#/practice/' + i.questionId + '" style="text-decoration:none;color:inherit">' + h(q ? q.title : '（已删除）') + '</a>';
        }).join('、') + '</div>';
    }).join('');
  } else {
    upcomingHtml = '<div class="empty-state" style="padding:20px">未来没有排期，完成默写判分后会自动生成。</div>';
  }

  view.innerHTML =
    '<div class="card q-head-card">' +
      '<h2>📅 智能排期（判分后自动生成）</h2>' +
      '<div class="row small">' +
        '<span class="badge green">连续掌握 → 7 / 14 / 30 天</span>' +
        '<span class="badge blue">70-89 分 → 2-4 天</span>' +
        '<span class="badge orange">60-69 分 → 明天</span>' +
        '<span class="badge red">&lt;60 分 → 今天重背</span>' +
        '<span class="muted">使用提示会自动缩短间隔</span>' +
      '</div>' +
    '</div>' +

    '<div class="card">' +
      '<h2>🔥 今日待复默（' + due.length + '）</h2>' +
      (due.length ? due.map(itemHtml).join('') :
        '<div class="empty-state" style="padding:28px"><div class="big-ico">🎉</div>今日待复默已清空，保持节奏！</div>') +
    '</div>' +

    '<div class="card"><h2>📆 即将到来</h2>' + upcomingHtml + '</div>';

  view.querySelectorAll('.ttl').forEach(function (el) {
    el.addEventListener('click', function () {
      const q = Store.getQuestion(el.dataset.qid);
      if (q) location.hash = '#/practice/' + q.id;
    });
  });
  view.querySelectorAll('[data-postpone]').forEach(function (sel) {
    sel.addEventListener('change', function () {
      const n = Number(sel.value);
      if (!n) return;
      const it = Store.db.reviewQueue.find(function (i) { return i.questionId === sel.dataset.postpone; });
      if (!it) return;
      it.dueDate = UI.addDaysStr(UI.todayStr(), n);
      Store.save().then(function () { UI.toast('已推迟 ' + n + ' 天'); route(); });
    });
  });
  view.querySelectorAll('[data-master]').forEach(function (b) {
    b.addEventListener('click', function () {
      Store.removeReview(b.dataset.master);
      Store.save().then(function () { UI.toast('已从排期中移除，继续保持！'); route(); });
    });
  });
};
