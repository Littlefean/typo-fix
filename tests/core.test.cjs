const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createReview, resultText, reviewRows } = require('../core.js');

function acceptedAll(review) { return new Set(review.segments.filter(s => s.changed).map(s => s.id)); }

test('multiple Chinese corrections can be accepted independently in any order', () => {
  const original = '请作好准备。\n讨伦工作按排。\n随时于我联系。';
  const corrected = '请做好准备。\n讨论工作安排。\n随时与我联系。';
  const review = createReview(original, corrected);
  const changes = review.segments.filter(s => s.changed);
  assert.equal(changes.length, 4);
  const accepted = new Set([changes[3].id]);
  assert.equal(resultText(review, accepted), '请作好准备。\n讨伦工作按排。\n随时与我联系。');
  accepted.add(changes[0].id);
  assert.equal(resultText(review, accepted), '请做好准备。\n讨伦工作按排。\n随时与我联系。');
  accepted.delete(changes[3].id);
  assert.equal(resultText(review, accepted), '请做好准备。\n讨伦工作按排。\n随时于我联系。');
  assert.equal(resultText(review, acceptedAll(review)), corrected);
  assert.equal(resultText(review, new Set()), original);
});

test('line adoption selects all and only changes in that row', () => {
  const review = createReview('第一行没错。\n讨伦工作按排。\n提前作好准备。', '第一行没错。\n讨论工作安排。\n提前做好准备。');
  const rows = reviewRows(review);
  assert.equal(rows[1].ids.length, 2);
  assert.equal(rows[1].oldLine, 2);
  assert.equal(resultText(review, new Set(rows[1].ids)), '第一行没错。\n讨论工作安排。\n提前作好准备。');
});

const cases = [
  ['', '新增'], ['删除', ''], ['完全相同\n', '完全相同\n'],
  ['a\nb\nc\n', 'a\n新增\nb\nc\n'], ['a\n旧行\nb', 'a\nb'],
  ['甲\n乙', '甲乙'], ['甲乙', '甲\n乙'], ['\n\n', '\n'],
  ['  首尾空白\n\n\t第二行  ', '  首尾空白\n\n\t第三行  '],
  ['👩‍💻写代码。e\u0301很棒。', '👨‍💻写代码。é很棒。'],
  ['<script>alert("x")</script>', '<script>alert("y")</script>'],
  ['重复重复重复', '重复重复'], ['abcdefghijkl', 'azcdefgJkl'],
  ['旧文'.repeat(1500), '新稿'.repeat(1500)]
];
for (const [index, [original, corrected]] of cases.entries()) {
  test(`reconstruction preserves exact content, case ${index + 1}`, () => {
    const review = createReview(original, corrected);
    assert.equal(resultText(review, new Set()), original);
    assert.equal(resultText(review, acceptedAll(review)), corrected);
    const rows = reviewRows(review);
    const rowIds = rows.flatMap(row => row.ids);
    assert.deepEqual(new Set(rowIds), acceptedAll(review));
    assert.equal(rowIds.length, acceptedAll(review).size, 'each change is in exactly one row');
  });
}

test('emoji grapheme clusters stay intact in a selectable change', () => {
  const review = createReview('你好 👩‍💻！', '你好 👨‍💻！');
  const change = review.segments.find(s => s.changed);
  assert.equal(change.original, '👩‍💻');
  assert.equal(change.corrected, '👨‍💻');
});

test('newline changes are atomic groups and subsequent row numbers stay correct', () => {
  const rows = reviewRows(createReview('甲\n乙\n丙', '甲\n新增\n乙\n丙'));
  assert.ok(rows.some(row => row.multiline));
  assert.equal(rows.at(-1).oldLine, 3);
  assert.equal(rows.at(-1).newLine, 4);
});

test('deterministic randomized insertions and deletions always round trip', () => {
  let seed = 18925;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const alphabet = ['甲', '乙', 'a', ' ', '\n', '🙂', 'e\u0301'];
  for (let i = 0; i < 150; i++) {
    const original = Array.from({ length: 40 }, () => alphabet[Math.floor(random() * alphabet.length)]).join('');
    const chars = Array.from(original);
    chars.splice(Math.floor(random() * chars.length), Math.floor(random() * 5), '修改');
    chars.splice(Math.floor(random() * chars.length), 0, '\n新行');
    const corrected = chars.join('');
    const review = createReview(original, corrected);
    assert.equal(resultText(review, new Set()), original);
    assert.equal(resultText(review, acceptedAll(review)), corrected);
    assert.equal(reviewRows(review).flatMap(row => row.ids).length, acceptedAll(review).size);
  }
});
