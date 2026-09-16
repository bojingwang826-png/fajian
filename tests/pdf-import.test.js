const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const context = {
  UI: { SUBJECTS: ['刑法', '民法', '刑事诉讼法', '民事诉讼法', '行政法', '商经知', '理论法'] },
  LLM: { configured: () => false }
};
context.window = context;
vm.createContext(context);
for (const file of ['public/js/documents.js', 'public/js/views/bank.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context, { filename: file });
}

function item(str, x, y, width, height) {
  return { str, width, height, transform: [height, 0, 0, height, x, y] };
}

function topicPage(number, title, body) {
  return context.Documents.textItemsToLines([
    item('专题', 72, 770, 33, 16),
    item(String(number), 110, 767.2, 8, 16),
    item(title, 125, 770, 150, 16),
    item('发布 2026 年 8 月 24 日', 72, 735, 120, 9),
    item('是什么', 72, 705, 42, 12),
    item(body + '第一部分。', 72, 680, 300, 10.4),
    item(body + '第二部分。', 72, 661, 300, 10.4),
    item('为什么', 72, 630, 42, 12),
    item(body + '第三部分。', 72, 605, 300, 10.4),
    item(body + '第四部分。', 72, 586, 300, 10.4),
    item(body + '第五部分。', 72, 567, 300, 10.4),
    item(String(number + 3), 300, 55, 6, 9)
  ]);
}

const first = topicPage(1, '全面依法治国', '依法治国是国家治理的基本方式，');
const second = topicPage(2, '法治思想重大意义', '法治思想提供科学指南，');
assert.match(first, /^# 专题 1 全面依法治国/m);
assert.match(first, /^## 是什么/m);
assert.doesNotMatch(first, /^4$/m);

const parsed = context.parseImport('<!--PDF_PAGE:3-->\n' + first + '\n\n<!--PDF_PAGE:4-->\n' + second);
assert.equal(parsed.length, 2);
assert.deepEqual(Array.from(parsed, q => q.title), ['全面依法治国', '法治思想重大意义']);
assert.ok(parsed.every(q => q.subject === '理论法'));
assert.match(parsed[0].answer, /^一、是什么/);
assert.match(parsed[0].answer, /二、为什么/);
assert.ok(!parsed[0].answer.includes('发布 2026'));
assert.equal(parsed[0].sourcePage, 3);
assert.equal(parsed[1].sourcePage, 4);

// 某些 PDF 会把专题号和标题挤在一起，仍应正确识别。
const compact = context.parseImport('专题3法治思想的鲜明特色\n核心内容\n原创性、系统性、时代性、人民性和实践性。');
assert.equal(compact.length, 1);
assert.equal(compact[0].title, '法治思想的鲜明特色');

console.log('PDF 坐标分行、标题恢复与专题切分测试通过');
