// 独立进入页：用简短叙事说明产品定位和训练闭环。
window.Views = window.Views || {};

Views.welcome = function (view) {
  const first = Store.db.questions && Store.db.questions[0];
  view.innerHTML =
    '<div class="welcome-shell">' +
      '<header class="welcome-nav">' +
        '<a class="welcome-brand" href="#/welcome" aria-label="法笺首页">' +
          '<span class="welcome-mark"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 3v17M7 6h10M5 20h14"/><path d="M7 6 3.5 12h7L7 6Z"/><path d="m17 6-3.5 6h7L17 6Z"/></svg></span>' +
          '<span><b>法笺</b><small>法考主观题智能训练与评测平台</small></span>' +
        '</a>' +
        '<a class="welcome-login" href="#/dashboard">进入工作台 <span>→</span></a>' +
      '</header>' +

      '<main class="welcome-main">' +
        '<section class="welcome-hero">' +
          '<div class="welcome-copy">' +
            '<span class="welcome-kicker">为法考主观题而做</span>' +
            '<h1>把资料读进去，<br><em>把答案练出来。</em></h1>' +
            '<p>从 Word、PDF 题目整理，到逐采分点评测与复习排期，法笺把主观题训练收进一条清晰、可追溯的学习路径。</p>' +
            '<div class="welcome-actions"><a class="btn primary welcome-primary" href="#/dashboard">进入法笺</a>' +
              (first ? '<a class="btn welcome-secondary" href="#/practice/' + first.id + '">体验一次判分</a>' : '<a class="btn welcome-secondary" href="#/bank">导入第一份资料</a>') +
            '</div>' +
            '<div class="welcome-proof"><span>支持 Word / PDF</span><i></i><span>逐采分点证据</span><i></i><span>本地数据存储</span></div>' +
          '</div>' +
          '<div class="welcome-paper" aria-label="产品流程示意">' +
            '<div class="paper-head"><span>今日训练笺</span><small>' + UI.todayStr().replace(/-/g, ' / ') + '</small></div>' +
            '<div class="paper-question"><span>主观题 · 01</span><h2>读懂标准答案，形成可落笔的答题结构</h2></div>' +
            '<div class="paper-points"><div><b>一</b><span>识别题目与答案</span><em>已完成</em></div><div><b>二</b><span>提取标准采分点</span><em>已完成</em></div><div class="current"><b>三</b><span>作答、判分与复习</span><em>进行中</em></div></div>' +
            '<div class="paper-score"><span>判分依据</span><strong>证据可查</strong><small>每一分都对应原文表述</small></div>' +
          '</div>' +
        '</section>' +

        '<section class="welcome-features">' +
          '<div class="feature-lead"><span class="welcome-kicker">训练闭环</span><h2>少做整理，多做真正有效的练习</h2></div>' +
          '<div class="feature-grid">' +
            '<article><span class="feature-no">01</span><h3>资料自动成题</h3><p>直接导入 Word 或 PDF，自动提取题目、答案与来源页码，导入前可校对和处理重复题。</p></article>' +
            '<article><span class="feature-no">02</span><h3>判分有据可查</h3><p>按固定采分点对照作答，展示命中证据、得分和置信度，低置信结果主动提示复核。</p></article>' +
            '<article><span class="feature-no">03</span><h3>错题形成计划</h3><p>失分点自动进入错题本，并根据成绩、提示次数和掌握程度安排下一次复习。</p></article>' +
            '<article><span class="feature-no">04</span><h3>进步清晰可见</h3><p>记录练习趋势、重复练习提升和高频失分点，随时看见自己的掌握变化。</p></article>' +
          '</div>' +
        '</section>' +
      '</main>' +
      '<footer class="welcome-footer"><span>法笺 · 让每次落笔都有依据</span><a href="#/dashboard">开始训练 →</a></footer>' +
    '</div>';
};
