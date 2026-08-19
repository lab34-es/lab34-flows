import * as expression from '../../src/helpers/bases/expression';

/** Evaluate a source string against a scope, defaulting to an empty one. */
const ev = (source: string, scope: Record<string, any> = {}) => expression.evaluate(source, scope);

describe('literals, identifiers and keywords', () => {
  test('numbers, strings and booleans', () => {
    expect(ev('42')).toBe(42);
    expect(ev('3.5')).toBe(3.5);
    expect(ev('"hello"')).toBe('hello');
    expect(ev("'hello'")).toBe('hello');
    expect(ev('true')).toBe(true);
    expect(ev('false')).toBe(false);
    expect(ev('null')).toBeNull();
  });

  test('string escapes are honoured', () => {
    expect(ev('"a\\"b"')).toBe('a"b');
    expect(ev('"a\\nb"')).toBe('a\nb');
  });

  test('a bare identifier is a frontmatter property', () => {
    expect(ev('owner', { note: { owner: 'ana' } })).toBe('ana');
    expect(ev('missing', { note: {} })).toBeNull();
  });

  test('the namespaces resolve to their objects, defaulting to empty', () => {
    expect(ev('note', { note: { a: 1 } })).toEqual({ a: 1 });
    expect(ev('flow', {})).toEqual({});
  });

  test('member access walks nested objects and tolerates gaps', () => {
    expect(ev('note.owner', { note: { owner: 'ana' } })).toBe('ana');
    expect(ev('note.deep.missing', { note: {} })).toBeNull();
  });

  test('list literals', () => {
    expect(ev('[1, 2, 3]')).toEqual([1, 2, 3]);
    expect(ev('[]')).toEqual([]);
  });
});

describe('operators', () => {
  test('arithmetic', () => {
    expect(ev('2 + 3')).toBe(5);
    expect(ev('10 - 4')).toBe(6);
    expect(ev('3 * 4')).toBe(12);
    expect(ev('10 / 4')).toBe(2.5);
    expect(ev('10 % 3')).toBe(1);
  });

  test('string concatenation with +', () => {
    expect(ev('"a" + "b"')).toBe('ab');
  });

  test('comparison', () => {
    expect(ev('2 < 3')).toBe(true);
    expect(ev('3 <= 3')).toBe(true);
    expect(ev('4 > 5')).toBe(false);
    expect(ev('5 >= 5')).toBe(true);
  });

  test('equality is loose across representations', () => {
    expect(ev('1 == "1"')).toBe(true);
    expect(ev('1 != 2')).toBe(true);
  });

  test('logical and / or short-circuit', () => {
    expect(ev('true && false')).toBe(false);
    expect(ev('false || true')).toBe(true);
    // && short-circuits, so the right side is never reached
    expect(ev('false && missing.deep.thing', { note: {} })).toBe(false);
  });

  test('unary not and negation', () => {
    expect(ev('!false')).toBe(true);
    expect(ev('-5')).toBe(-5);
  });

  test('parentheses and precedence', () => {
    expect(ev('2 + 3 * 4')).toBe(14);
    expect(ev('(2 + 3) * 4')).toBe(20);
  });

  test('the ternary conditional', () => {
    expect(ev('true ? "yes" : "no"')).toBe('yes');
    expect(ev('false ? "yes" : "no"')).toBe('no');
  });
});

describe('global functions', () => {
  test('type coercions', () => {
    expect(ev('number("42")')).toBe(42);
    expect(ev('string(42)')).toBe('42');
    expect(ev('date("2026-01-15")')).toBeInstanceOf(Date);
  });

  test('now and today', () => {
    expect(ev('now()')).toBeInstanceOf(Date);
    const today: any = ev('today()');
    expect(today.getHours()).toBe(0);
  });

  test('list and length', () => {
    expect(ev('list(1, 2, 3)')).toEqual([1, 2, 3]);
    expect(ev('length([1, 2])')).toBe(2);
    expect(ev('length("abc")')).toBe(3);
  });

  test('min, max and sum ignore values that are not numbers', () => {
    expect(ev('min(3, 1, 2)')).toBe(1);
    expect(ev('max(3, 1, 2)')).toBe(3);
    expect(ev('sum(1, 2, 3)')).toBe(6);
    expect(ev('min("nope")')).toBeNull();
    expect(ev('max("nope")')).toBeNull();
  });

  test('rounding helpers', () => {
    expect(ev('round(3.456, 2)')).toBe(3.46);
    expect(ev('round(3.4)')).toBe(3);
    expect(ev('floor(3.9)')).toBe(3);
    expect(ev('ceil(3.1)')).toBe(4);
    expect(ev('abs(-3)')).toBe(3);
  });

  test('string helpers', () => {
    expect(ev('lower("ABC")')).toBe('abc');
    expect(ev('upper("abc")')).toBe('ABC');
    expect(ev('trim("  a  ")')).toBe('a');
    expect(ev('concat("a", "b", 1)')).toBe('ab1');
    expect(ev('join([1, 2], "-")')).toBe('1-2');
  });

  test('contains, isEmpty, empty and not', () => {
    expect(ev('contains("hello", "ell")')).toBe(true);
    expect(ev('isEmpty("")')).toBe(true);
    expect(ev('empty(null)')).toBe(true);
    expect(ev('not(false)')).toBe(true);
  });

  test('default falls back only when the value is empty', () => {
    expect(ev('default("", "fallback")')).toBe('fallback');
    expect(ev('default("set", "fallback")')).toBe('set');
  });

  test('if only evaluates the branch it takes', () => {
    expect(ev('if(true, "a", "b")')).toBe('a');
    expect(ev('if(false, "a", "b")')).toBe('b');
    expect(ev('if(false, missing.deep.thing, "safe")')).toBe('safe');
  });

  test('if without an else yields null', () => {
    expect(ev('if(false, "a")')).toBeNull();
  });

  test('choice is an alias of if', () => {
    expect(ev('choice(true, "a", "b")')).toBe('a');
  });

  test('an unknown function is an error', () => {
    expect(() => ev('nope(1)')).toThrow(/nope/);
  });
});

describe('value methods', () => {
  test('emptiness', () => {
    expect(ev('"".isEmpty()')).toBe(true);
    expect(ev('"a".isNotEmpty()')).toBe(true);
  });

  test('string predicates are case insensitive', () => {
    expect(ev('"Hello".startsWith("he")')).toBe(true);
    expect(ev('"Hello".endsWith("LO")')).toBe(true);
    expect(ev('"Hello".contains("ell")')).toBe(true);
  });

  test('containsAny and containsAll', () => {
    expect(ev('"hello".containsAny("x", "ell")')).toBe(true);
    expect(ev('"hello".containsAll("he", "lo")')).toBe(true);
    expect(ev('"hello".containsAll("he", "zz")')).toBe(false);
  });

  test('string transforms', () => {
    expect(ev('"AbC".lower()')).toBe('abc');
    expect(ev('"abc".upper()')).toBe('ABC');
    expect(ev('"  a  ".trim()')).toBe('a');
    expect(ev('"hello world".title()')).toBe('Hello World');
    expect(ev('"a-b".replace("-", "+")')).toBe('a+b');
    expect(ev('"a, b".split(",")')).toEqual(['a', 'b']);
    expect(ev('"abc".split()')).toEqual(['abc']);
    expect(ev('"abcdef".slice(1, 3)')).toBe('bc');
    expect(ev('"abcdef".slice(2)')).toBe('cdef');
    expect(ev('"abc".toString()')).toBe('abc');
  });

  test('list methods', () => {
    expect(ev('[1, 2].join("-")')).toBe('1-2');
    // Arrays carry a native join, which wins over the generic value method
    // and therefore uses ',' rather than the documented ', ' default
    expect(ev('[1, 2].join()')).toBe('1,2');
    expect(ev('[1, 1, 2].unique()')).toEqual([1, 2]);
    expect(ev('[3, 1, 2].sort()')).toEqual([1, 2, 3]);
    expect(ev('[1, 2, 3].reverse()')).toEqual([3, 2, 1]);
    expect(ev('"abc".reverse()')).toBe('cba');
    expect(ev('[1, 2, 3].first()')).toBe(1);
    expect(ev('[1, 2, 3].last()')).toBe(3);
    expect(ev('[1, 2, 3].slice(1)')).toEqual([2, 3]);
    expect(ev('[].first()')).toBeNull();
  });

  test('number methods', () => {
    expect(ev('(-3).abs()')).toBe(3);
    expect(ev('(3.456).round(1)')).toBe(3.5);
    expect(ev('(3.9).floor()')).toBe(3);
    expect(ev('(3.1).ceil()')).toBe(4);
    expect(ev('(3.14159).toFixed(2)')).toBe('3.14');
  });

  test('date methods', () => {
    expect(ev('date("2026-01-15").date()')).toBe('2026-01-15');
    expect(ev('date("2026-01-15").format("YYYY/MM/DD")')).toBe('2026/01/15');
    expect(ev('date("2026-01-15").time()')).toMatch(/^\d{2}:\d{2}$/);
  });

  test('date methods on a value that is not a date yield an empty string', () => {
    expect(ev('"nope".date()')).toBe('');
    expect(ev('"nope".time()')).toBe('');
    expect(ev('"nope".format("YYYY")')).toBe('');
  });

  test('a receiver\'s own function wins over the shared method', () => {
    const scope = { file: { inFolder: (candidate: string) => `called:${candidate}` } };
    expect(ev('file.inFolder("payments")', scope)).toBe('called:payments');
  });

  test('an unknown method is an error', () => {
    expect(() => ev('"a".nope()')).toThrow(/nope/);
  });
});

describe('coercions', () => {
  test('toNumber', () => {
    expect(expression.toNumber('42')).toBe(42);
    expect(expression.toNumber(42)).toBe(42);
    expect(expression.toNumber(true)).toBe(1);
    expect(expression.toNumber(false)).toBe(0);
    expect(expression.toNumber('nope')).toBeNull();
    expect(expression.toNumber(null)).toBeNull();
  });

  test('toText', () => {
    expect(expression.toText('a')).toBe('a');
    expect(expression.toText(42)).toBe('42');
    expect(expression.toText(null)).toBe('');
    expect(expression.toText(undefined)).toBe('');
    expect(expression.toText([1, 2])).toBe('1, 2');
  });

  test('toList', () => {
    expect(expression.toList([1, 2])).toEqual([1, 2]);
    expect(expression.toList('a')).toEqual(['a']);
    expect(expression.toList(null)).toEqual([]);
  });

  test('toDate', () => {
    expect(expression.toDate('2026-01-15')).toBeInstanceOf(Date);
    expect(expression.toDate(new Date())).toBeInstanceOf(Date);
    expect(expression.toDate('not a date')).toBeNull();
    expect(expression.toDate(null)).toBeNull();
  });

  test('isEmpty', () => {
    expect(expression.isEmpty(null)).toBe(true);
    expect(expression.isEmpty(undefined)).toBe(true);
    expect(expression.isEmpty('')).toBe(true);
    expect(expression.isEmpty('  ')).toBe(true);
    expect(expression.isEmpty([])).toBe(true);
    expect(expression.isEmpty(0)).toBe(false);
    expect(expression.isEmpty('a')).toBe(false);
  });

  test('isTruthy', () => {
    expect(expression.isTruthy(true)).toBe(true);
    expect(expression.isTruthy('a')).toBe(true);
    expect(expression.isTruthy(0)).toBe(false);
    expect(expression.isTruthy([])).toBe(false);
    expect(expression.isTruthy(null)).toBe(false);
  });

  test('looseEquals', () => {
    expect(expression.looseEquals(1, '1')).toBe(true);
    expect(expression.looseEquals('a', 'a')).toBe(true);
    expect(expression.looseEquals(null, null)).toBe(true);
    expect(expression.looseEquals(1, 2)).toBe(false);
  });

  test('contains works on strings and lists', () => {
    expect(expression.contains('hello', 'ell')).toBe(true);
    expect(expression.contains(['a', 'b'], 'a')).toBe(true);
    expect(expression.contains(['a'], 'z')).toBe(false);
  });

  test('formatDate honours the pattern tokens', () => {
    const date = new Date(2026, 0, 15, 9, 5, 3);
    expect(expression.formatDate(date, 'YYYY-MM-DD')).toBe('2026-01-15');
    expect(expression.formatDate(date, 'HH:mm:ss')).toBe('09:05:03');
  });
});

describe('tokenize and parse', () => {
  test('tokenizes numbers, strings, names and punctuation', () => {
    const tokens = expression.tokenize('a + 1');
    expect(tokens.map(t => t.type)).toEqual(['name', 'punct', 'number']);
  });

  test('an unterminated string is an error', () => {
    expect(() => expression.tokenize('"abc')).toThrow();
  });

  test('an unexpected character is an error', () => {
    expect(() => expression.tokenize('a # b')).toThrow();
  });

  test('parse rejects an incomplete expression', () => {
    expect(() => expression.parse('1 +')).toThrow();
    expect(() => expression.parse('(1')).toThrow(/Expected/);
    expect(() => expression.parse('1 2')).toThrow(/after the end/);
  });
});

describe('expression.test', () => {
  test('reports a match', () => {
    expect(expression.test('note.owner == "ana"', { note: { owner: 'ana' } }))
      .toEqual({ matches: true, error: null });
  });

  test('reports a non-match', () => {
    expect(expression.test('note.owner == "bo"', { note: { owner: 'ana' } }))
      .toEqual({ matches: false, error: null });
  });

  test('turns an evaluation failure into an error rather than throwing', () => {
    const result = expression.test('nope(', {});
    expect(result.matches).toBe(false);
    expect(result.error).toBeTruthy();
  });
});
