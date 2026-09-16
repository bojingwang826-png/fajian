// 路由与应用入口
window.Views = window.Views || {};

window.App = {
  cleanups: [],
  onCleanup(fn) { this.cleanups.push(fn); },
  runCleanups() {
    this.cleanups.forEach(function (f) { try { f(); } catch (e) { } });
    this.cleanups = [];
  },
  setActions(html) {
    document.getElementById('topbar-actions').innerHTML = html || '';
  }
};

const ROUTES = {
  welcome: { title: '法笺', render: Views.welcome },
  dashboard: { title: '仪表盘', render: Views.dashboard },
  bank: { title: '题库管理', render: Views.bank },
  practice: { title: '练习', render: Views.practice },
  exam: { title: '模拟考试', render: Views.exam },
  result: { title: '判分结果', render: Views.result },
  review: { title: '复习计划', render: Views.review },
  wrongbook: { title: '错题本', render: Views.wrongbook },
  history: { title: '历史与统计', render: Views.history },
  settings: { title: '设置', render: Views.settings }
};

function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [pathPart, queryPart] = raw.split('?');
  const parts = pathPart.split('/');
  const params = {};
  (queryPart || '').split('&').forEach(function (kv) {
    const [k, v] = kv.split('=');
    if (k) params[k] = decodeURIComponent(v || '');
  });
  return { name: parts[0] || 'welcome', id: parts[1] || '', params: params };
}

function updateReviewBadge() {
  const b = document.getElementById('nav-review-badge');
  if (!b || !Store.db) return;
  const n = Store.dueItems().length;
  b.hidden = n === 0;
  b.textContent = n;
}

function route() {
  App.runCleanups();
  App.setActions('');
  const info = parseHash();
  const r = ROUTES[info.name] || ROUTES.dashboard;
  document.body.classList.toggle('welcome-page', info.name === 'welcome');
  document.getElementById('page-title').textContent = r.title;
  document.querySelectorAll('#nav a').forEach(function (a) {
    a.classList.toggle('active', a.dataset.route === info.name);
  });
  updateReviewBadge();
  const view = document.getElementById('view');
  view.innerHTML = '';
  r.render(view, Object.assign({ id: info.id }, info.params));
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', route);

(async function boot() {
  const conn = document.getElementById('conn-status');
  const tip = document.querySelector('.conn-tip');
  try {
    await Store.init();
  } catch (e) {
    conn.className = 'conn bad';
    conn.textContent = '● 未连接本地服务';
    document.getElementById('view').innerHTML =
      '<div class="card empty-state"><div class="big-ico">🔌</div>' +
      '<h2 style="justify-content:center">无法加载本地数据</h2>' +
      '<p>' + h(e.message) + '</p><p>请检查本地数据文件或备份，再刷新页面。</p></div>';
    return;
  }
  if (Store.localMode) {
    conn.textContent = '● 浏览器存储模式';
    if (tip) tip.textContent = '数据保存在本浏览器中';
  } else if (tip) {
    tip.textContent = 'node server.js 运行中';
  }
  if (!location.hash) location.hash = '#/welcome';
  route();
})();
