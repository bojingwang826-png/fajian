// 设置：判分宽容度、AI 快捷链接、数据备份与恢复、关于
window.Views = window.Views || {};

Views.settings = function (view) {
  const db = Store.db;

  const LLM_PRESETS = {
    zhipu: { name: '智谱 GLM', url: 'https://open.bigmodel.cn/api/paas/v4/chat/completions', model: 'glm-4-flash', help: 'Key 申请：open.bigmodel.cn → 控制台 → API Keys。请以服务商当前的模型可用性和计费为准。' },
    deepseek: { name: 'DeepSeek', url: 'https://api.deepseek.com/chat/completions', model: 'deepseek-flash', help: 'Key 申请：platform.deepseek.com → API Keys；API 账户需有可用余额。deepseek-chat 已停用，请使用 deepseek-flash。' },
    kimi: { name: 'Kimi（月之暗面）', url: 'https://api.moonshot.cn/v1/chat/completions', model: 'moonshot-v1-8k', help: 'Key 申请：platform.moonshot.cn → API Key 管理' },
    custom: { name: '自定义（任意 OpenAI 兼容接口）', url: '', model: '', help: '填写任意 OpenAI 兼容的 chat/completions 完整接口地址与模型名' }
  };
  const llmSaved = db.settings.llm || {};
  if (/api\.deepseek\.com/i.test(llmSaved.baseUrl || '') && /^(?:deepseek-chat|deepseek-reasoner)$/i.test(llmSaved.model || '')) {
    llmSaved.model = 'deepseek-flash';
  }
  const llmPreset = LLM_PRESETS[llmSaved.preset] ? llmSaved.preset : 'zhipu';

  view.innerHTML =
    '<div class="card">' +
      '<h2>自动判分与文档识别</h2>' +
      '<p class="muted small">配置一次 API Key 后，复杂 Word 识别、作答判分、请求提示和 AI 挖空可在网站内完成。本地服务模式由 Node 转发 AI 请求。</p>' +
      '<div class="form-grid">' +
        '<label>服务商</label><div><select class="select" id="llm-preset" style="width:100%;max-width:420px">' +
          Object.keys(LLM_PRESETS).map(function (k) {
            return '<option value="' + k + '"' + (k === llmPreset ? ' selected' : '') + '>' + LLM_PRESETS[k].name + '</option>';
          }).join('') +
        '</select></div>' +
        '<label>接口地址</label><div><input class="input" id="llm-url" value="' + h(llmSaved.baseUrl || LLM_PRESETS[llmPreset].url) + '" placeholder="https://…/chat/completions"></div>' +
        '<label>模型</label><div><input class="input" id="llm-model" value="' + h(llmSaved.model || LLM_PRESETS[llmPreset].model) + '"></div>' +
        '<label>API Key</label><div><input class="input" id="llm-key" type="password" value="' + h(llmSaved.key || '') + '" placeholder="粘贴你的 API Key"></div>' +
      '</div>' +
      '<div class="row mt8">' +
        '<button class="btn primary" id="llm-save">保存配置</button>' +
        '<button class="btn" id="llm-test">测试连接</button>' +
        '<span id="llm-status" class="small"></span>' +
      '</div>' +
      '<div class="muted small mt8" id="llm-help">' + LLM_PRESETS[llmPreset].help + '</div>' +
    '</div>' +

    '<div class="card">' +
      '<h2>默认判分宽容度</h2>' +
      '<div class="row" id="st-strict">' +
        ['严格', '标准', '宽松'].map(function (s) {
          const cur = db.settings.strictness || '标准';
          return '<label class="small" style="cursor:pointer"><input type="radio" name="st-strict" value="' + s + '"' + (s === cur ? ' checked' : '') + '> ' + s +
            '<span class="muted"> — ' + (s === '严格' ? '术语和限定词错误一律扣分' : s === '标准' ? '关键术语准确即可（推荐）' : '含义接近即给分') + '</span></label>';
        }).join('') +
      '</div>' +
      '<div class="muted small mt8">练习页可临时切换；此处为默认值。</div>' +
    '</div>' +

    '<div class="card">' +
      '<h2>AI 快捷链接</h2>' +
      '<p class="muted small">判分弹窗中「复制后打开」的站点列表。</p>' +
      '<div id="st-links"></div>' +
      '<div class="row mt8"><button class="btn small" id="st-addlink">＋ 添加链接</button><button class="btn small primary" id="st-savelinks">保存链接</button></div>' +
    '</div>' +

    '<div class="card">' +
      '<h2>数据管理</h2>' +
      '<p class="muted small">' + (Store.localMode
        ? '当前为浏览器存储模式：数据保存在本浏览器的 localStorage 中，请定期「导出备份」；运行 node server.js 后可改为文件存储。'
        : '全部数据保存在本地 data/db.json 文件中。') + '</p>' +
      '<div class="row mt8">' +
        '<button class="btn" id="st-export">⬇ 导出备份</button>' +
        '<button class="btn" id="st-import">⬆ 导入恢复</button>' +
        '<input type="file" id="st-import-file" accept=".json" hidden>' +
        '<button class="btn" id="st-reset">♻️ 恢复出厂（重新播种示范题）</button>' +
        '<button class="btn danger" id="st-clearall">🗑 清空全部数据</button>' +
      '</div>' +
    '</div>' +

    '<div class="card">' +
      '<h2>使用流程</h2>' +
      '<ol style="padding-left:20px;line-height:2">' +
        '<li>在<b>题库</b>添加或导入题目（内置 6 道示范题可直接练）；</li>' +
        '<li>进入<b>练习</b>，选择默写 / 填空模式作答，卡住可请求分级提示；</li>' +
        '<li>提交后点击<b>开始判分</b>；若尚未配置 AI 接口，可使用手动复制粘贴方式；</li>' +
        '<li>网站自动解析总分并渲染判分结果，失分点进入<b>错题本</b>，并按得分<b>自动排期复默</b>。</li>' +
      '</ol>' +
      '<details class="mt16"><summary style="cursor:pointer;color:var(--primary)">查看内置的判分系统设定（阅卷教练 prompt 原文）</summary>' +
        '<pre style="white-space:pre-wrap;font-size:12.5px;background:var(--surface-muted);padding:12px;border:1px solid var(--border);border-radius:8px;margin-top:8px;max-height:400px;overflow:auto">' + h(Prompt.SYSTEM) + '</pre>' +
      '</details>' +
    '</div>';

  // ===== LLM 配置 =====
  function llmStatusText() {
    const el = view.querySelector('#llm-status');
    if (!el) return;
    if (LLM.configured()) {
      el.innerHTML = '<span style="color:var(--green)">● 已配置：' + h(Store.db.settings.llm.model) + '</span>';
    } else {
      el.innerHTML = '<span class="muted">● 未配置（当前使用手动复制粘贴模式）</span>';
    }
  }
  llmStatusText();

  view.querySelector('#llm-preset').addEventListener('change', function (e) {
    const p = LLM_PRESETS[e.target.value];
    view.querySelector('#llm-url').value = p.url;
    view.querySelector('#llm-model').value = p.model;
    view.querySelector('#llm-help').textContent = p.help;
  });

  function saveLlmConfig() {
    const preset = view.querySelector('#llm-preset').value;
    const baseUrl = view.querySelector('#llm-url').value.trim();
    const model = view.querySelector('#llm-model').value.trim();
    const key = view.querySelector('#llm-key').value.trim();
    if (!baseUrl || !model || !key) { UI.toast('接口地址、模型、API Key 都需要填写', 'warn'); return null; }
    db.settings.llm = { preset: preset, baseUrl: baseUrl, model: model, key: key };
    return Store.save().then(function () {
      UI.toast('AI 接口已配置');
      llmStatusText();
    });
  }
  view.querySelector('#llm-save').addEventListener('click', function () {
    const task = saveLlmConfig();
    if (task) task.catch(function (e) { UI.toast('配置保存失败：' + e.message, 'err'); });
  });

  view.querySelector('#llm-test').addEventListener('click', async function () {
    const status = view.querySelector('#llm-status');
    const task = saveLlmConfig();
    if (!task) return;
    status.innerHTML = '<span class="spin">⏳</span> 正在测试连接…';
    try {
      await task;
      await LLM.test();
      status.innerHTML = '<span style="color:var(--green)">✅ 连接成功，可以开始一键判分了</span>';
    } catch (e) {
      status.innerHTML = '<span style="color:var(--red)">❌ ' + h(e.message) + '</span>';
    }
  });

  // 宽容度
  view.querySelectorAll('#st-strict input').forEach(function (r) {
    r.addEventListener('change', function () {
      db.settings.strictness = r.value;
      Store.save().then(function () { UI.toast('默认宽容度已设为「' + r.value + '」'); });
    });
  });

  // AI 链接
  function renderLinks() {
    const box = view.querySelector('#st-links');
    box.innerHTML = db.settings.aiLinks.map(function (l, i) {
      return '<div class="row mb8" data-li="' + i + '">' +
        '<input class="input" data-f="name" value="' + h(l.name) + '" placeholder="名称" style="max-width:140px">' +
        '<input class="input" data-f="url" value="' + h(l.url) + '" placeholder="https://…" style="flex:1;min-width:220px">' +
        '<button class="btn small danger" data-rm="' + i + '">删除</button>' +
        '</div>';
    }).join('');
    box.querySelectorAll('[data-rm]').forEach(function (b) {
      b.addEventListener('click', function () {
        db.settings.aiLinks.splice(Number(b.dataset.rm), 1);
        renderLinks();
      });
    });
  }
  renderLinks();
  view.querySelector('#st-addlink').addEventListener('click', function () {
    db.settings.aiLinks.push({ name: '新 AI', url: 'https://' });
    renderLinks();
  });
  view.querySelector('#st-savelinks').addEventListener('click', function () {
    const links = [];
    view.querySelectorAll('#st-links [data-li]').forEach(function (row) {
      const name = row.querySelector('[data-f="name"]').value.trim();
      const url = row.querySelector('[data-f="url"]').value.trim();
      if (name && url) links.push({ name: name, url: url });
    });
    db.settings.aiLinks = links;
    Store.save().then(function () { UI.toast('链接已保存'); });
  });

  // 数据管理
  view.querySelector('#st-export').addEventListener('click', function () {
    const backup = JSON.parse(JSON.stringify(db));
    if (backup.settings && backup.settings.llm) backup.settings.llm.key = '';
    UI.download('法笺-备份-' + UI.todayStr() + '.json', JSON.stringify(backup, null, 2), 'application/json');
    UI.toast('备份已导出，不包含 API Key；恢复后需重新配置接口');
  });
  const fileInput = view.querySelector('#st-import-file');
  view.querySelector('#st-import').addEventListener('click', function () { fileInput.click(); });
  fileInput.addEventListener('change', function (e) {
    const f = e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = function () {
      try {
        const data = JSON.parse(reader.result);
        if (!data || !Array.isArray(data.questions)) throw new Error('格式不正确');
        UI.confirmBox('导入恢复', '将用备份文件覆盖当前全部数据，确定继续吗？', true).then(function (ok) {
          if (!ok) return;
          Store.db = data;
          if (!Store.db.drafts) Store.db.drafts = {};
          Store.save().then(function () { UI.toast('数据已恢复'); route(); });
        });
      } catch (err) {
        UI.toast('导入失败：' + err.message, 'err');
      }
    };
    reader.readAsText(f, 'utf-8');
  });
  view.querySelector('#st-reset').addEventListener('click', function () {
    UI.confirmBox('恢复出厂', '将清空全部数据并重新播种 6 道内置示范题，确定继续吗？', true).then(function (ok) {
      if (!ok) return;
      if (Store.localMode) {
        Store.db = freshSeedDb();
        Store.save().then(function () { UI.toast('已恢复出厂'); route(); });
        return;
      }
      fetch('/api/reset', { method: 'POST' }).then(function (r) { return r.json(); }).then(function (data) {
        Store.db = data;
        UI.toast('已恢复出厂');
        route();
      });
    });
  });
  view.querySelector('#st-clearall').addEventListener('click', function () {
    UI.confirmBox('清空全部数据', '将删除<b>所有题目、历史、错题与排期</b>（保留设置），且不可恢复，确定继续吗？', true).then(function (ok) {
      if (!ok) return;
      Store.db.questions = [];
      Store.db.history = [];
      Store.db.wrongbook = [];
      Store.db.reviewQueue = [];
      Store.db.drafts = {};
      Store.save().then(function () { UI.toast('已清空全部数据'); route(); });
    });
  });
};
