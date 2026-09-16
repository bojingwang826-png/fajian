// 历史与统计：得分趋势折线图 + 各科平均分柱状图 + 判分历史表
window.Views = window.Views || {};

Views.history = function (view) {
  let subjectFilter = '';
  let modeFilter = '';

  function filtered() {
    return Store.db.history.filter(function (e) {
      if (subjectFilter && e.subject !== subjectFilter) return false;
      if (modeFilter && e.mode !== modeFilter) return false;
      return true;
    });
  }

  function render() {
    const db = Store.db;
    const scored = db.history.filter(function (e) { return e.score != null; });
    const avg = scored.length ? Math.round(scored.reduce(function (a, e) { return a + Number(e.score); }, 0) / scored.length * 10) / 10 : null;
    const maxScore = scored.length ? Math.max.apply(null, scored.map(function (e) { return Number(e.score); })) : null;
    const byQuestion = {};
    scored.slice().reverse().forEach(function (e) { (byQuestion[e.questionId] = byQuestion[e.questionId] || []).push(Number(e.score)); });
    const gains = Object.keys(byQuestion).filter(function (id) { return byQuestion[id].length >= 2; }).map(function (id) { const a = byQuestion[id]; return a[a.length - 1] - a[0]; });
    const avgGain = gains.length ? Math.round(gains.reduce(function (a, b) { return a + b; }, 0) / gains.length * 10) / 10 : null;
    const weakPoints = (db.wrongbook || []).filter(function (w) { return !w.mastered; }).sort(function (a, b) { return Number(b.count || 1) - Number(a.count || 1); }).slice(0, 6);

    // 各科平均分
    const bySubj = {};
    scored.forEach(function (e) {
      (bySubj[e.subject || '其他'] = bySubj[e.subject || '其他'] || []).push(Number(e.score));
    });
    const subjLabels = Object.keys(bySubj);
    const subjValues = subjLabels.map(function (s) {
      return Math.round(bySubj[s].reduce(function (a, b) { return a + b; }, 0) / bySubj[s].length);
    });

    const list = filtered();
    const rows = list.length ? list.map(function (e) {
      return '<tr>' +
        '<td class="muted small" style="white-space:nowrap">' + UI.fmtDateTime(e.date) + '</td>' +
        '<td>' + UI.subjectTag(e.subject) + '</td>' +
        '<td style="max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + h(e.questionTitle) + '</td>' +
        '<td class="muted">' + h(e.mode) + '</td>' +
        '<td class="muted small">' + h(e.strictness || '标准') + '</td>' +
        '<td class="num">' + UI.scoreBadge(e.score) + '</td>' +
        '<td class="num">' +
          (e.raw ? '<a class="btn small" href="#/result/' + e.id + '">查看</a> ' : '<span class="muted small">手动存档</span> ') +
          '<button class="btn small danger" data-del="' + e.id + '">删</button>' +
        '</td>' +
        '</tr>';
    }).join('') : '<tr><td colspan="7"><div class="empty-state">暂无记录</div></td></tr>';

    view.innerHTML =
      '<div class="grid-cards">' +
        '<div class="stat-card"><div class="num">' + db.history.length + '</div><div class="lbl">累计判分</div></div>' +
        '<div class="stat-card"><div class="num">' + (avg == null ? '—' : avg) + '</div><div class="lbl">平均分</div></div>' +
        '<div class="stat-card"><div class="num">' + (maxScore == null ? '—' : maxScore) + '</div><div class="lbl">最高分</div></div>' +
        '<div class="stat-card"><div class="num">' + Store.masteredIds().length + '</div><div class="lbl">已掌握题数</div></div>' +
        '<div class="stat-card"><div class="num">' + (avgGain == null ? '—' : (avgGain > 0 ? '+' : '') + avgGain) + '</div><div class="lbl">重复练习平均提升</div></div>' +
      '</div>' +

      '<div class="card"><div class="row"><h2>高频失分点</h2><div class="spacer"></div><a class="btn small" href="#/wrongbook">进入错题本</a></div>' + (weakPoints.length ? '<div class="chips">' + weakPoints.map(function (w) { return '<span class="chip hot">' + h(w.point) + ' · ' + Number(w.count || 1) + ' 次</span>'; }).join('') + '</div>' : '<p class="muted">暂无未掌握失分点，完成判分后会自动汇总。</p>') + '</div>' +

      '<div class="card"><h2>得分趋势' + (subjectFilter ? '（' + h(subjectFilter) + '）' : '') + '</h2><canvas class="chart" id="c-trend"></canvas></div>' +
      '<div class="card"><h2>各科平均分</h2><canvas class="chart" id="c-subj"></canvas></div>' +

      '<div class="card">' +
        '<div class="row mb8">' +
          '<h2 style="margin:0">判分历史</h2>' +
          '<div class="spacer"></div>' +
          '<select class="select" id="hs-subject"><option value="">全部科目</option>' +
            UI.SUBJECTS.map(function (s) { return '<option' + (s === subjectFilter ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select>' +
          '<select class="select" id="hs-mode"><option value="">全部模式</option>' +
            ['默写', '填空', '弱点', '模考'].map(function (m) { return '<option' + (m === modeFilter ? ' selected' : '') + '>' + m + '</option>'; }).join('') + '</select>' +
        '</div>' +
        '<table class="table"><thead><tr><th>时间</th><th>科目</th><th>题目</th><th>模式</th><th>宽容度</th><th class="num">得分</th><th class="num">操作</th></tr></thead>' +
        '<tbody>' + rows + '</tbody></table>' +
      '</div>';

    // 趋势图：最近 50 次，按时间正序
    const trend = list.filter(function (e) { return e.score != null; }).slice(0, 50).reverse();
    Charts.line(
      view.querySelector('#c-trend'),
      trend.map(function (e) { return UI.fmtDateTime(e.date).slice(5, 10); }),
      trend.map(function (e) { return Number(e.score); })
    );
    Charts.bars(view.querySelector('#c-subj'), subjLabels, subjValues);

    view.querySelector('#hs-subject').addEventListener('change', function (e) {
      subjectFilter = e.target.value; render();
    });
    view.querySelector('#hs-mode').addEventListener('change', function (e) {
      modeFilter = e.target.value; render();
    });
    view.querySelectorAll('[data-del]').forEach(function (b) {
      b.addEventListener('click', function () {
        UI.confirmBox('删除记录', '确定删除这条判分记录吗？', true).then(function (ok) {
          if (!ok) return;
          Store.deleteHistory(b.dataset.del).then(function () { UI.toast('已删除'); render(); });
        });
      });
    });
  }

  render();
};
