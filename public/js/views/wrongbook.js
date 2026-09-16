// 错题本：跨场次汇总失分采分点
window.Views = window.Views || {};

Views.wrongbook = function (view) {
  let showMastered = false;

  function render() {
    const rows = Store.db.wrongbook.filter(function (w) { return showMastered ? true : !w.mastered; });
    if (!rows.length) {
      view.innerHTML = '<div class="card empty-state"><div class="big-ico">错</div>' +
        (Store.db.wrongbook.length ? '错题全部已掌握，太棒了！' : '还没有错题记录<br><span class="small">判分后失分的采分点会自动汇总到这里</span>') + '</div>';
      return;
    }

    // 按科目 → 题目分组
    const bySubject = {};
    rows.forEach(function (w) {
      const q = Store.getQuestion(w.questionId);
      const subject = (q && q.subject) || '其他';
      (bySubject[subject] = bySubject[subject] || []).push({ w: w, q: q });
    });

    let html = '<div class="card"><div class="row mb8">' +
      '<h2 style="margin:0">错题本（' + rows.length + ' 个失分点）</h2>' +
      '<div class="spacer"></div>' +
      '<label class="small muted"><input type="checkbox" id="wb-mastered"' + (showMastered ? ' checked' : '') + '> 显示已掌握</label>' +
      '</div>';

    Object.keys(bySubject).sort().forEach(function (subject) {
      html += '<div class="wrong-group mt16">' +
        '<div class="mb8">' + UI.subjectTag(subject) + '</div>';
      // 再按题目分组
      const byQ = {};
      bySubject[subject].forEach(function (it) {
        const key = it.w.questionId;
        (byQ[key] = byQ[key] || { q: it.q, items: [] }).items.push(it.w);
      });
      Object.keys(byQ).forEach(function (qid) {
        const g = byQ[qid];
        html += '<div class="mb8"><div style="font-weight:700;margin-bottom:4px">📖 ' +
          (g.q ? '<a href="#/practice/' + qid + '" style="text-decoration:none;color:inherit">' + h(g.q.title) + '</a>' : '<span class="muted">题目已删除</span>') +
          '</div>';
        g.items.forEach(function (w) {
          html += '<div class="wrong-item">' +
            '<div style="flex:1;min-width:0">' +
              '<div class="wrong-point">' + h(w.point) + ' <span class="badge red" style="font-size:11px">错 ' + (w.count || 1) + ' 次</span></div>' +
              (w.correct ? '<div class="wrong-correct">✅ ' + h(w.correct) + '</div>' : '') +
              '<div class="muted small">最近失分：' + UI.fmtDateTime(w.lastDate) + '</div>' +
            '</div>' +
            (g.q && !w.mastered ? '<a class="btn small primary" href="#/practice/' + qid + '?focus=' + encodeURIComponent(w.point) + '">专项速练</a>' : '') +
            (w.mastered
              ? '<span class="badge green">已掌握</span>'
              : '<button class="btn small" data-master="' + w.id + '">✓ 标记已掌握</button>') +
            '</div>';
        });
        html += '</div>';
      });
      html += '</div>';
    });
    html += '</div>';

    view.innerHTML = html;
    view.querySelector('#wb-mastered').addEventListener('change', function (e) {
      showMastered = e.target.checked;
      render();
    });
    view.querySelectorAll('[data-master]').forEach(function (b) {
      b.addEventListener('click', function () {
        const w = Store.db.wrongbook.find(function (x) { return x.id === b.dataset.master; });
        if (!w) return;
        w.mastered = true;
        Store.save().then(function () { UI.toast('已标记为掌握'); render(); });
      });
    });
  }

  render();
};
