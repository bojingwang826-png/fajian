// 判分结果页：按判分 prompt 定义的输出格式渲染 AI 回复
window.Views = window.Views || {};

Views.result = function (view, params) {
  const entry = Store.db.history.find(function (x) { return x.id === params.id; });
  if (!entry) {
    view.innerHTML = '<div class="card empty-state"><div class="big-ico">🤔</div>记录不存在<br><a class="btn primary mt16" href="#/history">返回历史记录</a></div>';
    return;
  }

  const q = Store.getQuestion(entry.questionId);
  const standardAnswer = entry.standardAnswer || (q && q.answer) || '';
  const parsed = entry.raw ? Prompt.parseResult(entry.raw) : null;
  const s = entry.score == null ? null : Number(entry.score);

  const suggestion = s == null ? '' : Number(entry.intervalDays) === 0
    ? '未掌握，建议今天再背一遍后重新默写'
    : '结合近期成绩与提示使用情况，建议 ' + Number(entry.intervalDays || 1) + ' 天后复默';

  const queueItem = Store.db.reviewQueue.find(function (i) { return i.questionId === entry.questionId; });

  const points = Array.isArray(entry.gradingPoints) && entry.gradingPoints.length
    ? entry.gradingPoints
    : (entry.rubricSnapshot || []).map(function (p) { return { name: p.name, full: p.full, score: null, correct: p.correct, status: '未记录', candidate: '' }; });
  const compareHtml = points.length ? '<div class="card"><h2>逐采分点对照</h2>' +
    '<div class="table-scroll"><table class="table compare-table"><thead><tr><th>采分点</th><th>标准表述</th><th>我的对应表述</th><th>判定</th><th>置信度</th><th class="num">得分</th></tr></thead><tbody>' +
    points.map(function (p) {
      const status = p.status || (Number(p.score) >= Number(p.full) ? '命中' : Number(p.score) > 0 ? '不完整' : '遗漏');
      const cls = /命中|正确/.test(status) ? 'green' : /不完整|部分/.test(status) ? 'orange' : 'red';
      return '<tr><td><b>' + h(p.name || '采分点') + '</b></td><td>' + h(p.correct || '') + '</td><td>' + h(p.candidate || '—') + '</td>' +
        '<td><span class="badge ' + cls + '">' + h(status) + '</span></td><td>' + (p.confidence == null ? '—' : '<span class="badge ' + (p.confidence >= 80 ? 'green' : p.confidence >= 65 ? 'orange' : 'red') + '">' + h(p.confidence) + '%</span>') + '</td><td class="num"><b>' + (p.score == null ? '—' : h(p.score)) + '</b> / ' + h(p.full == null ? '—' : p.full) + '</td></tr>';
    }).join('') + '</tbody></table></div></div>' : '';

  const lostHtml = (entry.lostPoints || []).length
    ? '<div class="chips mt8">' + entry.lostPoints.slice(0, 8).map(function (p) { return '<span class="chip hot">' + h(p) + '</span>'; }).join('') + '</div>'
    : (s != null && s >= 90 ? '<div class="mt8"><span class="badge green">全部采分点命中 🎉</span></div>' : '');

  const dueHtml = queueItem
    ? '<div class="mt8 small">📅 已自动排期：<b>' + UI.fmtDate(queueItem.dueDate) + '</b> 复默' +
      (queueItem.dueDate === UI.todayStr() && s < 60 ? '（今天就背！）' : '') + '</div>'
    : '';

  view.innerHTML =
    '<div class="card" style="border-left:4px solid ' + (s == null ? '#8a8f88' : s >= 90 ? '#35675a' : s >= 70 ? '#52738a' : s >= 60 ? '#a3692f' : '#a9473b') + '">' +
      '<div class="row">' +
        UI.subjectTag(entry.subject) +
        '<h2 style="margin:0">' + h(entry.questionTitle) + '</h2>' +
        '<div class="spacer"></div>' +
        '<span style="font-size:30px;font-weight:800">' + UI.scoreBadge(s == null ? null : s) + '</span>' +
      '</div>' +
      '<div class="row mt8 muted small">' +
        '<span>🕘 ' + UI.fmtDateTime(entry.date) + '</span>' +
        '<span>· ' + h(entry.mode) + '模式</span>' +
        '<span>· 宽容度：' + h(entry.strictness || '标准') + '</span>' +
        (entry.model ? '<span>· 判分方式：' + h(entry.model) + '</span>' : '') +
        (suggestion ? '<span>· 📌 ' + h(suggestion) + '</span>' : '') +
      '</div>' +
      lostHtml +
      dueHtml +
      (entry.confidence != null ? '<div class="grading-trust mt16"><div><b>判分置信度 ' + h(entry.confidence) + '%</b><span>依据逐采分点证据、关键词边界与模型一致性计算</span></div>' + (entry.needsReview ? '<span class="badge orange">建议人工复核</span>' : '<span class="badge green">结果稳定</span>') + '</div>' : '') +
      '<div class="row mt16">' +
        (q ? '<a class="btn primary" href="#/practice/' + q.id + '">再练一次</a>' : '') +
        (standardAnswer ? '<button class="btn" id="rs-toggle-answer">📖 查看 / 收起判分依据</button>' : '') +
        (entry.raw ? '<button class="btn ghost" id="rs-raw">查看 AI 原始回复</button>' : '') +
        '<div class="spacer"></div>' +
        '<button class="btn danger" id="rs-del">删除本记录</button>' +
      '</div>' +
    '</div>' +

    (entry.candidateAnswer ? '<div class="card"><h2>✍️ 本次作答</h2><div class="md">' + MD.render(entry.candidateAnswer) + '</div></div>' : '') +
    compareHtml +
    (standardAnswer ? '<div class="card" id="rs-answer" hidden><h2>📖 本次判分依据</h2><div class="md">' + MD.render(standardAnswer) + '</div></div>' : '') +

    (parsed
      ? '<div class="card"><h2>判分结果</h2><div class="md">' + MD.render(parsed.display || entry.raw) + '</div></div>'
      : '<div class="card"><div class="empty-state">本记录为手动存档，未保存 AI 判分明细<br><span class="small">下次判分时把 AI 回复完整粘贴回网站，即可自动保存明细。</span></div></div>');

  const toggle = view.querySelector('#rs-toggle-answer');
  if (toggle) toggle.addEventListener('click', function () {
    const el = view.querySelector('#rs-answer');
    if (el) el.hidden = !el.hidden;
  });
  const rawBtn = view.querySelector('#rs-raw');
  if (rawBtn) rawBtn.addEventListener('click', function () {
    const overlay = UI.openModal(
      '<div class="modal-head"><h3>AI 原始回复</h3><button class="modal-close">×</button></div>' +
      '<div class="modal-body"><pre style="white-space:pre-wrap;font-size:13px;max-height:60vh;overflow:auto">' + h(entry.raw) + '</pre></div>',
      { wide: true }
    );
    overlay.querySelector('.modal-close').addEventListener('click', function () { UI.closeModal(overlay); });
  });
  view.querySelector('#rs-del').addEventListener('click', function () {
    UI.confirmBox('删除记录', '确定删除这条判分记录吗？', true).then(function (ok) {
      if (!ok) return;
      Store.deleteHistory(entry.id).then(function () {
        UI.toast('已删除');
        location.hash = '#/history';
      });
    });
  });
};
