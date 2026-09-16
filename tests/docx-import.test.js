const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

// Node 没有 DOMParser；这个小适配器只提供正文段落与文字节点，
// 让测试覆盖真实 .docx 的 ZIP 解压和题目切分。
class TextOnlyDomParser {
  parseFromString(xml) {
    if (/<w:styles[\s>]/.test(xml)) {
      const styles = [...xml.matchAll(/<w:style\b([^>]*)>([\s\S]*?)<\/w:style>/g)].map(match => {
        const outer = match[1], body = match[2];
        function valueOf(name) {
          const source = name === 'styleId' || name === 'default' ? outer : body;
          const m = source.match(new RegExp('w:' + name + '="([^"]+)"')) || source.match(new RegExp('<w:' + name + '[^>]*w:val="([^"]+)"'));
          return m ? m[1] : '';
        }
        return {
          getAttributeNS: (_, name) => valueOf(name),
          getAttribute: name => valueOf(name.replace(/^w:/, '')),
          getElementsByTagNameNS: (_, name) => {
            const tag = body.match(new RegExp('<w:' + name + '\\b([^>]*)\\/?\\s*>'));
            if (!tag) return [];
            const val = (tag[1].match(/w:val="([^"]+)"/) || [])[1] || '';
            return [{ getAttributeNS: () => val, getAttribute: () => val }];
          }
        };
      });
      return {
        getElementsByTagName: () => [],
        getElementsByTagNameNS: (_, name) => name === 'style' ? styles : []
      };
    }
    const paras = [...xml.matchAll(/<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>/g)].map(match => ({
      getElementsByTagNameNS: (_, name) => {
        const body = match[1];
        if (name === 't') return [...body.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map(t => ({ textContent: t[1] }));
        if (name === 'pStyle') {
          const style = body.match(/<w:pStyle[^>]*w:val="([^"]+)"[^>]*\/?\s*>/);
          return style ? [{
            getAttributeNS: () => style[1],
            getAttribute: () => style[1]
          }] : [];
        }
        if (name === 'outlineLvl' || name === 'numPr') return new RegExp('<w:' + name + '\\b').test(body) ? [{ getAttributeNS: () => '', getAttribute: () => '' }] : [];
        if (name === 'r') return [...body.matchAll(/<w:r(?:\s[^>]*)?>([\s\S]*?)<\/w:r>/g)].map(run => ({
          getElementsByTagNameNS: (_, runName) => {
            if (runName === 't') return [...run[1].matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map(t => ({ textContent: t[1] }));
            const tag = run[1].match(new RegExp('<w:' + runName + '\\b([^>]*)\\/?\\s*>'));
            if (!tag) return [];
            const val = (tag[1].match(/w:val="([^"]+)"/) || [])[1] || '';
            return [{ getAttributeNS: () => val, getAttribute: () => val }];
          }
        }));
        return [];
      }
    }));
    return {
      getElementsByTagName: () => [],
      getElementsByTagNameNS: (_, name) => name === 'p' ? paras : []
    };
  }
}

const context = {
  DOMParser: TextOnlyDomParser,
  DecompressionStream, Blob, Response, TextDecoder, Uint8Array,
  UI: { SUBJECTS: ['刑法', '民法', '刑事诉讼法', '民事诉讼法', '行政法', '商经知', '理论法'] }
};
context.window = context;
vm.createContext(context);
for (const file of ['public/js/docx.js', 'public/js/views/bank.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context, { filename: file });
}

(async () => {
  const input = process.argv[2] || path.join(__dirname, 'fixtures/two-questions.docx');
  const bytes = fs.readFileSync(input);
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const text = await context.DOCX.extractText(buffer);
  const questions = context.parseImport(text);
  if (process.argv[2]) {
    assert.equal(questions.length, 18);
    assert.equal(questions[0].title, '全面依法治国');
    assert.equal(questions[17].title, '发展和安全');
    assert.ok(questions.every(q => q.subject === '理论法'));
    assert.ok(!questions.some(q => /结构总览|复习建议/.test(q.title)));
    assert.match(questions[0].answer, /^一、是什么/);
    assert.ok(!questions[0].answer.includes('发布 2026'));
    assert.ok(!questions[17].answer.includes('复习建议'));
    assert.ok(questions.every(q => q.answer.length > 100));
    console.log('用户理论法 Word 已准确识别 18 个专题');
  } else {
    assert.match(text, /【题目】善意取得条件/);
    assert.match(text, /【答案】约定解除或法定解除。/);
    assert.equal(questions.length, 2);
    assert.equal(questions[0].answer, '受让人善意且完成交付。');
    assert.equal(questions[1].answer, '约定解除或法定解除。');
    const customBytes = fs.readFileSync(path.join(__dirname, 'fixtures/custom-style-sections.docx'));
    const customBuffer = customBytes.buffer.slice(customBytes.byteOffset, customBytes.byteOffset + customBytes.byteLength);
    const customText = await context.DOCX.extractText(customBuffer);
    const customQuestions = context.parseImport(customText);
    assert.equal(customQuestions.length, 2);
    assert.deepEqual(Array.from(customQuestions, q => q.title), ['合同成立', '合同效力']);
    assert.ok(customQuestions.every(q => q.subject === '民法'));
    const directBytes = fs.readFileSync(path.join(__dirname, 'fixtures/direct-format-sections.docx'));
    const directBuffer = directBytes.buffer.slice(directBytes.byteOffset, directBytes.byteOffset + directBytes.byteLength);
    const directText = await context.DOCX.extractText(directBuffer);
    const directQuestions = context.parseImport(directText);
    assert.equal(directQuestions.length, 2);
    assert.deepEqual(Array.from(directQuestions, q => q.title), ['合同成立', '合同效力']);
    console.log('真实 Word、继承样式、手动加粗大标题与双题导入测试通过');
  }
})().catch(err => { console.error(err); process.exitCode = 1; });
