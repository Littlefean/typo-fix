(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./vendor/diff.min.js') : root.Diff);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TypoCore = api;
})(globalThis, function (Diff) {
  'use strict';

  const segmenter = typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter('zh', { granularity: 'grapheme' }) : null;
  const tokens = text => segmenter ? Array.from(segmenter.segment(text), item => item.segment) : Array.from(text);
  const newlines = text => (text.match(/\n/g) || []).length;

  // Decisions always apply to an immutable snapshot, so earlier replacements
  // never shift the offsets of later changes.
  function createReview(original, corrected) {
    const changes = Diff.diffArrays(tokens(original), tokens(corrected), { timeout: 1000, maxEditLength: 2000 });
    if (!changes) {
      return { original, corrected, coarse: true, segments: [{ id: 0, changed: true, original, corrected }] };
    }
    let nextId = 0;
    const segments = [];
    for (const part of changes) {
      const value = part.value.join('');
      if (!part.added && !part.removed) {
        if (value) segments.push({ changed: false, original: value, corrected: value });
        continue;
      }
      let segment = segments.at(-1);
      if (!segment?.changed) {
        segment = { id: nextId++, changed: true, original: '', corrected: '' };
        segments.push(segment);
      }
      if (part.removed) segment.original += value;
      if (part.added) segment.corrected += value;
    }
    return { original, corrected, coarse: false, segments };
  }

  function resultText(review, accepted) {
    return review.segments.map(segment => segment.changed && accepted.has(segment.id)
      ? segment.corrected : segment.original).join('');
  }

  // Rows break only at unchanged newlines. A change that adds/removes a newline
  // stays in a single group, keeping both columns aligned and safely applicable.
  function reviewRows(review) {
    const rows = [];
    let oldLine = 1, newLine = 1;
    const fresh = () => ({ oldLine, newLine, left: [], right: [], ids: [], multiline: false });
    let row = fresh();
    function append(original, corrected, id) {
      row.left.push({ text: original, id });
      row.right.push({ text: corrected, id });
      oldLine += newlines(original);
      newLine += newlines(corrected);
      if (id !== undefined) {
        row.ids.push(id);
        row.multiline ||= original.includes('\n') || corrected.includes('\n');
      }
    }
    function flush() { rows.push(row); row = fresh(); }
    for (const segment of review.segments) {
      if (segment.changed) {
        append(segment.original, segment.corrected, segment.id);
      } else {
        const parts = segment.original.split('\n');
        parts.forEach((part, index) => {
          if (part) append(part, part);
          if (index < parts.length - 1) {
            oldLine += 1;
            newLine += 1;
            flush();
          }
        });
      }
    }
    if (row.left.length || row.right.length || !rows.length || review.original.endsWith('\n') || review.corrected.endsWith('\n')) flush();
    return rows;
  }

  return { createReview, resultText, reviewRows };
});
