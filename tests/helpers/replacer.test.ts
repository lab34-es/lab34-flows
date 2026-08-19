import * as replacer from '../../src/helpers/replacer';

describe('replacer.oneOf', () => {
  test('returns an element of the array', () => {
    const arr = ['a', 'b', 'c'];
    for (let i = 0; i < 20; i++) {
      expect(arr).toContain(replacer.oneOf(arr));
    }
  });

  test('rejects anything that is not a non-empty array', () => {
    expect(() => replacer.oneOf([])).toThrow();
    expect(() => replacer.oneOf(null)).toThrow();
    expect(() => replacer.oneOf(undefined)).toThrow();
    expect(() => replacer.oneOf('nope' as any)).toThrow();
  });
});

describe('replacer.timeAgo', () => {
  const FIXED = new Date('2026-06-15T12:30:45.500Z');

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(FIXED);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test.each([
    ['ms', 500],
    ['millisecond', 500],
    ['milliseconds', 500]
  ])('subtracts %s', (unit, amount) => {
    expect(replacer.timeAgo(amount, unit).getTime()).toBe(FIXED.getTime() - 500);
  });

  test.each(['second', 'seconds'])('subtracts %s', (unit) => {
    expect(replacer.timeAgo(10, unit).getTime()).toBe(FIXED.getTime() - 10_000);
  });

  test.each(['minute', 'minutes'])('subtracts %s', (unit) => {
    expect(replacer.timeAgo(5, unit).getTime()).toBe(FIXED.getTime() - 5 * 60_000);
  });

  test.each(['hour', 'hours'])('subtracts %s', (unit) => {
    expect(replacer.timeAgo(2, unit).getTime()).toBe(FIXED.getTime() - 2 * 3_600_000);
  });

  test.each(['day', 'days'])('subtracts %s', (unit) => {
    expect(replacer.timeAgo(3, unit).getTime()).toBe(FIXED.getTime() - 3 * 86_400_000);
  });

  test.each(['month', 'months'])('subtracts %s keeping the day of month', (unit) => {
    const result = replacer.timeAgo(3, unit);
    expect(result.getMonth()).toBe(new Date(FIXED).getMonth() - 3);
    expect(result.getDate()).toBe(new Date(FIXED).getDate());
  });

  test.each(['year', 'years'])('subtracts %s', (unit) => {
    const result = replacer.timeAgo(1, unit);
    expect(result.getFullYear()).toBe(new Date(FIXED).getFullYear() - 1);
  });

  test('is case insensitive', () => {
    expect(replacer.timeAgo(1, 'DAYS').getTime()).toBe(FIXED.getTime() - 86_400_000);
  });

  test('names the unsupported unit in the error', () => {
    expect(() => replacer.timeAgo(1, 'fortnights')).toThrow(/Invalid time lapse unit: fortnights/);
  });
});

describe('replacer.timestampAgo / tsAgo', () => {
  const FIXED = new Date('2026-06-15T12:30:45.500Z');

  beforeEach(() => jest.useFakeTimers().setSystemTime(FIXED));
  afterEach(() => jest.useRealTimers());

  test('timestampAgo returns milliseconds', () => {
    expect(replacer.timestampAgo(1, 'hours')).toBe(FIXED.getTime() - 3_600_000);
  });

  test('tsAgo returns a zero-padded YYYYMMDDHHMMSS stamp', () => {
    const stamp = replacer.tsAgo(0, 'seconds');
    expect(stamp).toMatch(/^\d{14}$/);

    const local = new Date(FIXED);
    const expected = [
      String(local.getFullYear()).padStart(4, '0'),
      String(local.getMonth() + 1).padStart(2, '0'),
      String(local.getDate()).padStart(2, '0'),
      String(local.getHours()).padStart(2, '0'),
      String(local.getMinutes()).padStart(2, '0'),
      String(local.getSeconds()).padStart(2, '0')
    ].join('');
    expect(stamp).toBe(expected);
  });
});

describe('replacer.barcode', () => {
  test('keeps strings verbatim and expands numbers into that many digits', () => {
    const result = replacer.barcode(['123456', 3, '789']);
    expect(result).toMatch(/^123456\d{3}789$/);
  });

  test('accepts a mask string with [n] placeholders', () => {
    expect(replacer.barcode('3232_[4]_247')).toMatch(/^3232_\d{4}_247$/);
  });

  test('handles a mask that starts or ends with a placeholder', () => {
    expect(replacer.barcode('[3]ABC')).toMatch(/^\d{3}ABC$/);
    expect(replacer.barcode('ABC[2]')).toMatch(/^ABC\d{2}$/);
  });

  test('a mask with no placeholder is returned as-is', () => {
    expect(replacer.barcode('PLAIN')).toBe('PLAIN');
  });

  test('empty input produces an empty barcode', () => {
    expect(replacer.barcode(null)).toBe('');
    expect(replacer.barcode(undefined)).toBe('');
    expect(replacer.barcode([])).toBe('');
  });

  test('passes through values that are neither string nor number', () => {
    expect(replacer.barcode(['A', true as any])).toBe('Atrue');
  });
});

describe('replacer.values', () => {
  test('exposes the documented generators', () => {
    const v = replacer.values();

    expect(typeof v.timestamp).toBe('number');
    expect(v.datetime).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(v.uuid).toMatch(/^[0-9a-f]{8}-/);
    expect(v.randomEmail).toContain('@');
    expect(v.randomPostalCode).toMatch(/^\d{4}$/);
    expect(String(v.randomPostmanId)).toMatch(/^\d{6}$/);
    expect(v.randomString).toHaveLength(8);
    expect(v.randomName.split(' ').length).toBeGreaterThanOrEqual(2);
  });

  test('keeps every randomInt inside its documented range', () => {
    const v = replacer.values();
    const ranges: Array<[keyof typeof v, number]> = [
      ['randomInt', 1000], ['randomInt0_5', 5], ['randomInt0_10', 10],
      ['randomInt0_100', 100], ['randomInt0_200', 200], ['randomInt0_300', 300],
      ['randomInt0_500', 500], ['randomInt0_1000', 1000], ['randomInt0_9999', 9999],
      ['randomInt0_2000', 2000], ['randomInt0_3000', 3000], ['randomInt0_4000', 4000],
      ['randomInt0_5000', 5000], ['randomStreetNumber', 200]
    ];
    for (const [key, max] of ranges) {
      expect(v[key]).toBeGreaterThanOrEqual(0);
      expect(v[key]).toBeLessThan(max);
    }
  });
});

describe('replacer.json', () => {
  test('renders a template string into an object', () => {
    expect(replacer.json('{"a": "{{name}}"}', { name: 'ana' })).toEqual({ a: 'ana' });
  });

  test('accepts an object and stringifies it first', () => {
    expect(replacer.json({ a: '{{name}}' }, { name: 'bo' })).toEqual({ a: 'bo' });
  });

  test('substitutes the built-in generators', () => {
    const out: any = replacer.json('{"id": "{{uuid}}"}', {});
    expect(out.id).toMatch(/^[0-9a-f]{8}-/);
  });

  test('works without a data argument', () => {
    expect(replacer.json('{"a": 1}')).toEqual({ a: 1 });
  });

  test('empty input is returned untouched', () => {
    expect(replacer.json('', {})).toBe('');
    expect(replacer.json(null, {})).toBeNull();
  });

  test('throws when the rendered template is not valid JSON', () => {
    expect(() => replacer.json('{"a": }', {})).toThrow();
  });

  test('supports the barcode helper', () => {
    const out: any = replacer.json('{"code": "{{barcode "AA-" 3}}"}', {});
    expect(out.code).toMatch(/^AA-\d{3}$/);
  });
});

describe('replacer.string', () => {
  test('renders a plain string template', () => {
    expect(replacer.string('hello {{name}}', { name: 'world' })).toBe('hello world');
  });

  test('works without a data argument', () => {
    expect(replacer.string('static')).toBe('static');
  });
});

describe('replacer.any', () => {
  test('parses JSON when it can', () => {
    expect(replacer.any('{"a": "{{name}}"}', { name: 'ana' })).toEqual({ a: 'ana' });
  });

  test('falls back to string rendering when the result is not JSON', () => {
    expect(replacer.any('hello {{name}}', { name: 'world' })).toBe('hello world');
  });

  test('empty and whitespace-only input short-circuits', () => {
    expect(replacer.any('', {})).toBe('');
    expect(replacer.any('   ', {})).toBe('');
    expect(replacer.any(null, {})).toBeNull();
  });

  test('works without a values argument', () => {
    expect(replacer.any('{"a": 1}')).toEqual({ a: 1 });
  });
});
