const expression = require('../../src/helpers/bases/expression');

/**
 * A scope shaped like the one bases builds for a flow.
 * @param {Object} note - Frontmatter
 * @param {Object} extra - Overrides for the file/flow namespaces
 * @returns {Object}
 */
const scopeFor = (note = {}, extra = {}) => {
  const tags = note.tags || [];
  return {
    note,
    file: {
      name: 'fraud.md',
      basename: 'fraud',
      path: 'payments/fraud.md',
      folder: 'payments',
      ext: 'md',
      tags,
      hasTag: (candidate) => tags.includes(String(candidate).replace(/^#/, '')),
      hasProperty: (property) => Object.prototype.hasOwnProperty.call(note, property),
      inFolder: (candidate) => 'payments'.startsWith(String(candidate)),
      ...(extra.file || {})
    },
    flow: { format: 'markdown', steps: 3, hasErrors: false, ...(extra.flow || {}) },
    formula: extra.formula || {}
  };
};

describe('bases expression language', () => {
  describe('literals and operators', () => {
    it('evaluates arithmetic and comparisons', () => {
      const scope = scopeFor();
      expect(expression.evaluate('1 + 2 * 3', scope)).toBe(7);
      expect(expression.evaluate('(1 + 2) * 3', scope)).toBe(9);
      expect(expression.evaluate('10 / 4', scope)).toBe(2.5);
      expect(expression.evaluate('7 % 3', scope)).toBe(1);
      expect(expression.evaluate('2 > 1', scope)).toBe(true);
      expect(expression.evaluate('2 >= 2', scope)).toBe(true);
      expect(expression.evaluate('2 < 1', scope)).toBe(false);
    });

    it('never divides by zero', () => {
      expect(expression.evaluate('1 / 0', scopeFor())).toBeNull();
    });

    it('short-circuits && and ||', () => {
      const scope = scopeFor({ priority: 'high' });
      expect(expression.evaluate('priority == "high" && 1 > 0', scope)).toBe(true);
      expect(expression.evaluate('missing.deep.thing || priority == "high"', scope)).toBe(true);
    });

    it('supports ! and the ternary operator', () => {
      const scope = scopeFor({ reviewed: false });
      expect(expression.evaluate('!reviewed', scope)).toBe(true);
      expect(expression.evaluate('reviewed ? "yes" : "no"', scope)).toBe('no');
    });

    it('concatenates when either side is a string', () => {
      expect(expression.evaluate('"a" + 1', scopeFor())).toBe('a1');
      expect(expression.evaluate('1 + 1', scopeFor())).toBe(2);
    });
  });

  describe('namespaces', () => {
    it('reads a bare identifier as a frontmatter property', () => {
      const scope = scopeFor({ priority: 'high' });
      expect(expression.evaluate('priority', scope)).toBe('high');
      expect(expression.evaluate('note.priority', scope)).toBe('high');
    });

    it('returns null for a missing property instead of throwing', () => {
      expect(expression.evaluate('nope', scopeFor())).toBeNull();
      expect(expression.evaluate('note.nope', scopeFor())).toBeNull();
    });

    it('never matches a comparison against a missing property', () => {
      const scope = scopeFor();
      expect(expression.evaluate('nope > 2', scope)).toBe(false);
      expect(expression.evaluate('nope < 2', scope)).toBe(false);
    });

    it('reads the file and flow namespaces', () => {
      const scope = scopeFor();
      expect(expression.evaluate('file.name', scope)).toBe('fraud.md');
      expect(expression.evaluate('file.folder', scope)).toBe('payments');
      expect(expression.evaluate('flow.steps', scope)).toBe(3);
    });

    it('reads a property whose name needs quoting', () => {
      const scope = scopeFor({ 'test key': 'PAY-1' });
      expect(expression.evaluate('note["test key"]', scope)).toBe('PAY-1');
    });

    it('reads formulas', () => {
      const scope = scopeFor({}, { formula: { grade: 'A' } });
      expect(expression.evaluate('formula.grade', scope)).toBe('A');
    });
  });

  describe('functions and methods', () => {
    it('evaluates if() lazily', () => {
      const scope = scopeFor({ score: 8 });
      expect(expression.evaluate('if(score >= 6, "✅", "⚠️")', scope)).toBe('✅');
      // The branch that is not taken must not be evaluated
      expect(expression.evaluate('if(false, unknownFunction(), "safe")', scope)).toBe('safe');
    });

    it('calls the file helpers', () => {
      const scope = scopeFor({ tags: ['smoke', 'payments'] });
      expect(expression.evaluate('file.hasTag("smoke")', scope)).toBe(true);
      expect(expression.evaluate('file.hasTag("#smoke")', scope)).toBe(true);
      expect(expression.evaluate('file.hasTag("nope")', scope)).toBe(false);
      expect(expression.evaluate('file.inFolder("pay")', scope)).toBe(true);
      expect(expression.evaluate('file.hasProperty("tags")', scope)).toBe(true);
    });

    it('calls string and list methods', () => {
      const scope = scopeFor({ owner: 'Ana Lopez', tags: ['smoke', 'slow'] });
      expect(expression.evaluate('owner.lower()', scope)).toBe('ana lopez');
      expect(expression.evaluate('owner.contains("lopez")', scope)).toBe(true);
      expect(expression.evaluate('owner.startsWith("Ana")', scope)).toBe(true);
      expect(expression.evaluate('tags.contains("slow")', scope)).toBe(true);
      expect(expression.evaluate('tags.join(" / ")', scope)).toBe('smoke / slow');
      expect(expression.evaluate('tags.length', scope)).toBe(2);
    });

    it('treats missing and blank values as empty', () => {
      const scope = scopeFor({ owner: '   ', tags: [] });
      expect(expression.evaluate('owner.isEmpty()', scope)).toBe(true);
      expect(expression.evaluate('tags.isEmpty()', scope)).toBe(true);
      expect(expression.evaluate('nope.isEmpty()', scope)).toBe(true);
    });

    it('evaluates the global helpers', () => {
      const scope = scopeFor({ a: 3, b: 9 });
      expect(expression.evaluate('max(a, b)', scope)).toBe(9);
      expect(expression.evaluate('min(a, b)', scope)).toBe(3);
      expect(expression.evaluate('round(2.345, 2)', scope)).toBe(2.35);
      expect(expression.evaluate('default(nope, "n/a")', scope)).toBe('n/a');
      expect(expression.evaluate('number("42") + 1', scope)).toBe(43);
    });
  });

  describe('comparisons across types', () => {
    it('compares numeric strings numerically', () => {
      expect(expression.evaluate('score > 5', scopeFor({ score: '10' }))).toBe(true);
    });

    it('compares dates chronologically', () => {
      const scope = scopeFor({ due: '2026-01-15' });
      expect(expression.evaluate('due > "2026-01-01"', scope)).toBe(true);
      expect(expression.evaluate('due < "2025-12-31"', scope)).toBe(false);
    });

    it('uses loose equality', () => {
      expect(expression.evaluate('score == 10', scopeFor({ score: '10' }))).toBe(true);
      expect(expression.evaluate('reviewed == true', scopeFor({ reviewed: true }))).toBe(true);
      expect(expression.evaluate('owner != "ana"', scopeFor({ owner: 'ana' }))).toBe(false);
    });
  });

  describe('test()', () => {
    it('reports an error instead of throwing', () => {
      const result = expression.test('nope(1)', scopeFor());
      expect(result.matches).toBe(false);
      expect(result.error).toContain('nope');
    });

    it('reports a syntax error instead of throwing', () => {
      const result = expression.test('1 +', scopeFor());
      expect(result.matches).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it('treats a non-empty value as a match', () => {
      expect(expression.test('owner', scopeFor({ owner: 'ana' })).matches).toBe(true);
      expect(expression.test('owner', scopeFor({ owner: '' })).matches).toBe(false);
    });
  });
});
