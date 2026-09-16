const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'public/js/store.js'), 'utf8');
async function initialize(protocol, fetchImpl) {
  const context = {
    location: { protocol },
    fetch: fetchImpl,
    localStorage: { getItem: () => null },
    freshSeedDb: () => ({ questions: [], history: [], settings: {}, drafts: {} })
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(source, context);
  await context.Store.init();
  return context.Store;
}

(async () => {
  await assert.rejects(
    initialize('http:', async () => ({ ok: false, status: 500, json: async () => ({ error: '题库数据文件损坏' }) })),
    /题库数据文件损坏/
  );
  const local = await initialize('file:', async () => { throw new Error('无本地服务'); });
  assert.equal(local.localMode, true);
  assert.equal(local.db.questions.length, 0);
  console.log('损坏题库提示与文件模式回退测试通过');
})().catch(err => { console.error(err); process.exitCode = 1; });
