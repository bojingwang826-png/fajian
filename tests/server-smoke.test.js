const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');

async function freePort() {
  const socket = net.createServer();
  await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve));
  const port = socket.address().port;
  await new Promise(resolve => socket.close(resolve));
  return port;
}

(async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fkms-test-'));
  const port = await freePort();
  const child = spawn(process.execPath, ['server.js'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: String(port), DATA_DIR: dataDir, NO_OPEN_BROWSER: '1' },
    stdio: 'ignore'
  });
  try {
    let response;
    for (let i = 0; i < 30; i++) {
      try { response = await fetch(`http://127.0.0.1:${port}/api/db`); break; }
      catch (e) { await new Promise(resolve => setTimeout(resolve, 100)); }
    }
    assert.ok(response, '本地服务未能启动');
    assert.equal(response.status, 200);
    const db = await response.json();
    assert.ok(Array.isArray(db.questions));
    const page = await fetch(`http://127.0.0.1:${port}/`);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /法笺｜法考主观题智能训练与评测平台/);
    const llm = await fetch(`http://127.0.0.1:${port}/api/llm`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: '测试' })
    });
    assert.equal(llm.status, 400);
    const original = fs.readFileSync(path.join(dataDir, 'db.json'), 'utf8');
    fs.writeFileSync(path.join(dataDir, 'db.backup.json'), original);
    fs.writeFileSync(path.join(dataDir, 'db.json'), '{损坏');
    const recovered = await fetch(`http://127.0.0.1:${port}/api/db`);
    assert.equal(recovered.status, 200);
    assert.equal(fs.readFileSync(path.join(dataDir, 'db.json'), 'utf8'), original);
    fs.unlinkSync(path.join(dataDir, 'db.backup.json'));
    fs.writeFileSync(path.join(dataDir, 'db.json'), '{损坏');
    const blocked = await fetch(`http://127.0.0.1:${port}/api/db`);
    assert.equal(blocked.status, 500);
    assert.equal(fs.readFileSync(path.join(dataDir, 'db.json'), 'utf8'), '{损坏');
    console.log('本地服务与 AI 配置检查测试通过');
  } finally {
    child.kill();
    assert.ok(path.resolve(dataDir).startsWith(path.resolve(os.tmpdir()) + path.sep));
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
})().catch(err => { console.error(err); process.exitCode = 1; });
