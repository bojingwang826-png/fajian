const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const context = {
  location: { protocol: 'file:' },
  fetch: async () => { throw new Error('offline'); },
  localStorage: { getItem: () => null, setItem: () => {} },
  freshSeedDb: () => ({ questions: [], history: [], wrongbook: [], reviewQueue: [], settings: {}, drafts: {} }),
  UI: {
    uid: () => 'id',
    todayStr: () => '2026-09-16',
    addDaysStr: (d, n) => 'D+' + n,
    toast: () => {}
  }
};
context.window = context;
vm.createContext(context);
for (const file of ['public/js/rubric.js', 'public/js/store.js', 'public/js/prompt.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context, { filename: file });
}

const points = context.Rubric.derive('一、起因条件：存在现实的不法侵害。\n二、时间条件：不法侵害正在进行。\n三、对象条件：针对不法侵害人。');
assert.equal(points.length, 3);
assert.equal(Math.round(points.reduce((n, p) => n + p.full, 0)), 100);
assert.match(context.Prompt.gradingPrompt({ subject: '刑法', title: '正当防卫', answer: '一、起因条件：存在现实的不法侵害。', rubric: [{ name: '起因条件', full: 100, correct: '存在现实的不法侵害' }] }, '存在侵害', '标准'), /结构化采分点与分值/);

context.Store.db = { questions: [], history: [], wrongbook: [], reviewQueue: [], settings: {}, drafts: {} };
assert.equal(context.Store.nextReview('q1', 95, { hintsUsed: 0 }).intervalDays, 7);
context.Store.db.history = [{ questionId: 'q1', score: 96, date: '2026-09-15' }];
assert.equal(context.Store.nextReview('q1', 95, { hintsUsed: 0 }).intervalDays, 14);
assert.equal(context.Store.nextReview('q1', 95, { hintsUsed: 2 }).intervalDays, 2);

console.log('结构化采分点与智能复习测试通过');
