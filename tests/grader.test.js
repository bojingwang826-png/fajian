const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const context = { LLM: { configured: () => false } };
context.window = context;
vm.createContext(context);
for (const file of ['public/js/rubric.js', 'public/js/prompt.js', 'public/js/grader.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context, { filename: file });
}

const q = {
  subject: '刑法', title: '测试题', stem: '请作答',
  answer: '一、条件：行为人应当实施行为。\n二、效果：依法承担责任。',
  rubric: [
    { name: '条件', full: 50, correct: '行为人应当实施行为' },
    { name: '效果', full: 50, correct: '依法承担责任' }
  ]
};

const full = context.GradeEngine.localGrade(q, '行为人应当实施行为。依法承担责任。', '标准');
assert.equal(full.score, 100);
assert.equal(full.points.length, 2);
assert.ok(full.points.every(p => p.confidence >= 55 && p.confidence <= 100));
const empty = context.GradeEngine.localGrade(q, '', '标准');
assert.equal(empty.score, 0);
const conflict = context.GradeEngine.localGrade(q, '行为人可以实施行为。依法承担责任。', '标准');
assert.equal(conflict.points[0].score, 0);
assert.equal(conflict.points[1].score, 50);

const fill = context.GradeEngine.gradeFill(['应当', '错'], ['应当', '责任'], [40, 60]);
assert.equal(fill.score, 40);
assert.equal(fill.summary.points[1].status, '错误');
assert.ok(fill.confidence >= 0 && fill.confidence <= 100);
assert.match(context.Prompt.gradingJsonPrompt(q, '作答', '严格'), /candidate 必须逐字引用/);

console.log('直接结构化判分与证据校验测试通过');
