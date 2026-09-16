// 法笺｜法考主观题智能训练与评测平台 - 零依赖本地服务器
// 启动：node server.js   访问：http://localhost:3737
const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { makeSeedDb } = require('./seed');

const PORT = process.env.PORT ? Number(process.env.PORT) : 3737;
const HOST = process.env.HOST || '0.0.0.0';
const ROOT = __dirname;
const PUB = path.join(ROOT, 'public');
const DATA_DIR = process.env.POCKETBAY_DATA_DIR
  ? path.resolve(process.env.POCKETBAY_DATA_DIR)
  : (process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(ROOT, 'data'));
const DB_FILE = path.join(DATA_DIR, 'db.json');
const BACKUP_FILE = path.join(DATA_DIR, 'db.backup.json');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

function persist(db) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  try {
    if (fs.existsSync(DB_FILE)) fs.copyFileSync(DB_FILE, BACKUP_FILE);
  } catch (e) { /* 备份失败不阻断保存 */ }
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2), 'utf8');
  fs.renameSync(tmp, DB_FILE);
}

function loadDb() {
  if (!fs.existsSync(DB_FILE)) {
    const db = makeSeedDb();
    persist(db);
    return db;
  }
  function parseDb(file) {
    const db = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!db || !Array.isArray(db.questions) || !Array.isArray(db.history)) throw new Error('bad db');
    return db;
  }
  try {
    return parseDb(DB_FILE);
  } catch (e) {
    if (fs.existsSync(BACKUP_FILE)) {
      try {
        const backup = parseDb(BACKUP_FILE);
        fs.copyFileSync(BACKUP_FILE, DB_FILE);
        return backup;
      } catch (backupError) { /* 保留损坏文件，等待手动恢复 */ }
    }
    throw new Error('题库数据文件损坏，且备份不可用；请检查 data/db.json，不会自动清空题库');
  }
}

function sendJson(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}

function readBody(req, limit = 20 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', c => {
      size += c.length;
      if (size > limit) { reject(new Error('body too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function serveStatic(req, res, urlPath) {
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.normalize(path.join(PUB, urlPath));
  const relativePath = path.relative(PUB, filePath);
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      // 未知路径回退到 index.html（前端 hash 路由）
      if (!path.extname(urlPath)) {
        fs.readFile(path.join(PUB, 'index.html'), (e2, d2) => {
          if (e2) { res.writeHead(404); res.end('Not Found'); return; }
          res.writeHead(200, { 'Content-Type': MIME['.html'] });
          res.end(d2);
        });
        return;
      }
      res.writeHead(404); res.end('Not Found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = decodeURIComponent(u.pathname);

  try {
    if (pathname === '/api/db' && req.method === 'GET') {
      return sendJson(res, 200, loadDb());
    }
    if (pathname === '/api/db' && req.method === 'PUT') {
      const raw = await readBody(req);
      const db = JSON.parse(raw);
      if (!db || !Array.isArray(db.questions) || !Array.isArray(db.history)) {
        return sendJson(res, 400, { error: '数据格式不正确' });
      }
      persist(db);
      return sendJson(res, 200, { ok: true });
    }
    if (pathname === '/api/reset' && req.method === 'POST') {
      const db = makeSeedDb();
      persist(db);
      return sendJson(res, 200, db);
    }
    if (pathname === '/api/llm' && req.method === 'POST') {
      const db = loadDb();
      const conf = db.settings && db.settings.llm || {};
      if (!conf.key || !conf.model || !conf.baseUrl) {
        return sendJson(res, 400, { error: '请先在设置中配置 AI 接口' });
      }
      let endpoint;
      try { endpoint = new URL(conf.baseUrl); } catch (e) {
        return sendJson(res, 400, { error: 'AI 接口地址无效' });
      }
      if (endpoint.protocol !== 'https:') {
        return sendJson(res, 400, { error: 'AI 接口必须使用 HTTPS' });
      }
      const payload = JSON.parse(await readBody(req, 15 * 1024 * 1024));
      if (!payload || typeof payload.prompt !== 'string' || !payload.prompt.trim()) {
        return sendJson(res, 400, { error: '判分或识别内容为空' });
      }
      if (payload.imageDataUrl && !/^data:image\/(?:png|jpeg|webp|bmp);base64,[A-Za-z0-9+/=]+$/.test(payload.imageDataUrl)) {
        return sendJson(res, 400, { error: '图片数据格式不正确' });
      }
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 120000);
      try {
        const remoteBody = {
          model: conf.model,
          messages: [{ role: 'user', content: payload.imageDataUrl
            ? [{ type: 'text', text: payload.prompt }, { type: 'image_url', image_url: { url: payload.imageDataUrl } }]
            : payload.prompt }],
          temperature: payload.temperature == null ? 0.2 : payload.temperature
        };
        if (payload.jsonMode) remoteBody.response_format = { type: 'json_object' };
        if (/api\.deepseek\.com$/i.test(endpoint.hostname)) remoteBody.thinking = { type: 'disabled' };
        const remote = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + conf.key },
          body: JSON.stringify(remoteBody),
          signal: controller.signal
        });
        const data = await remote.json();
        if (!remote.ok) {
          const detail = data.error && (data.error.message || data.error.code);
          return sendJson(res, remote.status, { error: detail || 'AI 接口返回错误' });
        }
        const answer = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
        if (!answer) return sendJson(res, 502, { error: 'AI 接口未返回内容' });
        return sendJson(res, 200, { text: String(answer).trim() });
      } finally {
        clearTimeout(timer);
      }
    }
    if (pathname.startsWith('/api/')) {
      return sendJson(res, 404, { error: 'unknown api' });
    }
    serveStatic(req, res, pathname);
  } catch (e) {
    sendJson(res, 500, { error: String(e && e.message || e) });
  }
});

server.listen(PORT, HOST, () => {
  const url = `http://localhost:${PORT}`;
  console.log('==============================================');
  console.log('  法笺｜法考主观题智能训练与评测平台 已启动');
  console.log(`  请用浏览器打开:  ${url}`);
  console.log('  数据保存在 data/db.json，关闭本窗口即停止服务');
  console.log('==============================================');
  // Windows 下自动打开浏览器
  if (process.env.NO_OPEN_BROWSER === '1') return;
  try {
    if (process.platform === 'win32') exec(`start "" "${url}"`);
    else if (process.platform === 'darwin') exec(`open "${url}"`);
    else exec(`xdg-open "${url}"`);
  } catch (e) { /* 打不开就算了 */ }
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.error(`端口 ${PORT} 已被占用。请关闭占用该端口的程序，或用命令指定其他端口启动：`);
    console.error(`  set PORT=3738 && node server.js`);
  } else {
    console.error('服务器启动失败:', e.message);
  }
  process.exit(1);
});
