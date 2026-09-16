// LLM 接口层：OpenAI 兼容 chat/completions 直连（浏览器 fetch）
window.LLM = (function () {
  function conf() {
    return (Store.db.settings.llm || {});
  }
  function configured() {
    const c = conf();
    return !!(c.key && c.baseUrl && c.model);
  }

  async function chat(prompt, opts) {
    const c = conf();
    if (!configured()) throw new Error('尚未配置 AI 接口，请到「设置」填写 API Key');

    // 服务器模式由本地 Node 转发，浏览器不必受第三方接口的 CORS 限制。
    if (!Store.localMode) {
      let response;
      try {
        response = await fetch('/api/llm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: prompt, temperature: opts && opts.temperature != null ? opts.temperature : 0.2, jsonMode: !!(opts && opts.json) })
        });
      } catch (e) {
        throw new Error('无法连接本地 AI 转发服务，请确认 node server.js 正在运行');
      }
      const data = await response.json();
      if (!response.ok) throw new Error('AI 请求失败（' + response.status + '）：' + (data.error || '未知错误'));
      if (!data.text) throw new Error('AI 接口未返回内容');
      return String(data.text).trim();
    }

    const ctrl = new AbortController();
    const timer = setTimeout(function () { ctrl.abort(); }, 120000);
    let res;
    try {
      res = await fetch(c.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + c.key
        },
        body: JSON.stringify({
          model: c.model,
          messages: [{ role: 'user', content: prompt }],
          temperature: opts && opts.temperature != null ? opts.temperature : 0.2,
          response_format: opts && opts.json ? { type: 'json_object' } : undefined
        }),
        signal: ctrl.signal
      });
    } catch (e) {
      clearTimeout(timer);
      if (e && e.name === 'AbortError') throw new Error('请求超时（120 秒），请重试');
      throw new Error('网络请求失败：该接口可能不允许浏览器直接调用（CORS 限制）。建议使用智谱 GLM 接口，或运行 node server.js 服务器模式');
    }
    clearTimeout(timer);

    if (!res.ok) {
      let detail = '';
      try {
        const j = await res.json();
        detail = (j.error && (j.error.message || j.error.code)) || JSON.stringify(j).slice(0, 160);
      } catch (e) { }
      if (res.status === 401) throw new Error('API Key 无效（401）：' + detail);
      if (res.status === 429) throw new Error('请求过于频繁或额度不足（429）：' + detail);
      throw new Error('接口返回 ' + res.status + (detail ? '：' + detail : ''));
    }

    const data = await res.json();
    const text = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (!text) throw new Error('接口未返回内容');
    return String(text).trim();
  }

  async function vision(prompt, imageDataUrl) {
    const c = conf();
    if (!configured()) throw new Error('请先在设置中配置支持图片的 AI 接口');
    if (!/^data:image\/(?:png|jpeg|webp|bmp);base64,/.test(String(imageDataUrl || ''))) throw new Error('图片格式不支持');
    const messages = [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: imageDataUrl } }] }];
    if (!Store.localMode) {
      const r = await fetch('/api/llm', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt, imageDataUrl: imageDataUrl, temperature: 0 })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || '图片识别失败');
      if (!data.text) throw new Error('AI 接口未返回识别文字');
      return String(data.text).trim();
    }
    const r = await fetch(c.baseUrl, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + c.key },
      body: JSON.stringify({ model: c.model, messages: messages, temperature: 0 })
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error && data.error.message || '图片识别失败');
    const text = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (!text) throw new Error('AI 接口未返回识别文字');
    return String(text).trim();
  }

  function test() {
    return chat('请只回复四个字：连接成功', { temperature: 0 });
  }

  return { configured: configured, chat: chat, vision: vision, test: test };
})();
