const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const context = {
  UI: { SUBJECTS: ['刑法', '民法', '刑事诉讼法', '民事诉讼法', '行政法', '商经知', '理论法'] }
};
context.window = context;
vm.createContext(context);
for (const file of ['public/js/views/bank.js', 'public/js/prompt.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context, { filename: file });
}

const paired = context.parseImport([
  '【科目】民法',
  '【题目】善意取得的条件',
  '【标准答案】善意；合理价格；交付。',
  '【题目】合同解除的条件',
  '【标准答案】约定解除或法定解除。'
].join('\n'));
assert.equal(paired.length, 2);
assert.equal(paired[0].answer, '善意；合理价格；交付。');
assert.equal(paired[1].answer, '约定解除或法定解除。');
assert.equal(paired[1].subject, '民法');

const qa = context.parseImport('问：什么是正当防卫？\n答：针对正在进行的不法侵害。\n问：什么是紧急避险？\n答：为避免正在发生的危险。');
assert.equal(qa.length, 2);
assert.equal(qa[0].answer, '针对正在进行的不法侵害。');
assert.equal(qa[1].answer, '为避免正在发生的危险。');

const switched = context.parseImport('【科目】刑法\n【题目】第一题\n【答案】第一题答案\n【科目】民法\n【题目】第二题\n【答案】第二题答案');
assert.equal(switched.length, 2);
assert.equal(switched[0].answer, '第一题答案');
assert.equal(switched[1].subject, '民法');

const topics = context.parseImport([
  '理论法专题资料',
  '专题 1 至 4 搭建理论框架',
  '专题 1 全面依法治国',
  '定位',
  '依法治国是国家治理的基本方式。',
  '专题 2 法治思想重大意义',
  '核心意义',
  '是全面依法治国的根本遵循。'
].join('\n'));
assert.equal(topics.length, 2);
assert.equal(topics[0].title, '全面依法治国');
assert.equal(topics[0].subject, '理论法');
assert.equal(topics[1].title, '法治思想重大意义');

const outlined = context.parseImport([
  '# 第一章 总论',
  '## 民事法律关系',
  '### 构成要素',
  '民事法律关系由主体、客体和内容构成，并受民法规范调整。',
  '## 民事法律行为',
  '### 成立条件',
  '民事法律行为需要当事人、意思表示和标的，其效力另行判断。',
  '# 第二章 合同',
  '## 合同成立',
  '### 要约承诺',
  '当事人通过要约和承诺方式订立合同，依法还可采用其他方式。',
  '## 合同效力',
  '### 一般规则',
  '依法成立的合同原则上自成立时生效，法律另有规定的除外。'
].join('\n'));
assert.equal(outlined.length, 4);
assert.deepEqual(Array.from(outlined, q => q.title), ['民事法律关系', '民事法律行为', '合同成立', '合同效力']);
assert.ok(outlined.every(q => q.subject === '民法'));
assert.match(outlined[0].answer, /^一、构成要素/);

const aiChunks = context.splitImportForAI('# 第一章\n' + '甲'.repeat(40) + '\n# 第二章\n' + '乙'.repeat(40), 60);
assert.equal(aiChunks.length, 2);
assert.ok(aiChunks[0].startsWith('# 第一章'));
assert.ok(aiChunks[1].startsWith('# 第二章'));
assert.equal(context.fixSubject('宪法'), '理论法');
assert.equal(context.fixSubject(''), '未分类');

assert.equal(context.parseImport('一段正文。\n\n另一段正文。').length, 0);

const identified = context.parseAIJson('```json\n{"questions":[{"subject":"民法","title":"善意取得","answer":"善意且交付"}]}\n```');
assert.equal(identified.length, 1);
assert.equal(identified[0].answer, '善意且交付');

const grade = context.Prompt.parseResult('总分：78 / 100\n| 采分点 | 分值 | 得分 | 判分说明 |\n| --- | --- | --- | --- |\n| 起因条件 | 20 | 10 | 遗漏 |');
assert.equal(grade.score, 78);
assert.equal(grade.lostPoints[0], '起因条件');
assert.equal(context.Prompt.parseResult('最终得分：84分').score, 84);
assert.equal(context.Prompt.parseResult('总分：120/100').score, null);

console.log('导入切分与判分回复解析测试通过');
