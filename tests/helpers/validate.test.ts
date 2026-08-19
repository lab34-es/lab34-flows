import * as validate from '../../src/helpers/validate';

const SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    age: { type: 'number' }
  },
  required: ['name']
};

describe('validate.validate', () => {
  test('accepts data matching the schema', () => {
    expect(() => validate.validate(SCHEMA, { name: 'ana', age: 3 })).not.toThrow();
  });

  test('throws with AJV\'s message when the data does not match', () => {
    expect(() => validate.validate(SCHEMA, {})).toThrow(/required/);
    expect(() => validate.validate(SCHEMA, { name: 1 })).toThrow(/must be string/);
  });
});

describe('validate.applyFallbacks', () => {
  test('returns the data untouched when the schema declares no fallbacks', () => {
    const data = { a: 1 };
    expect(validate.applyFallbacks(data, { type: 'object' }, {})).toEqual(data);
  });

  test('reads a missing value out of flow memory', () => {
    const schema = { fallbacks: { token: [{ type: 'memory', key: 'authToken' }] } };
    const out = validate.applyFallbacks({}, schema, { memory: { authToken: 'abc' } });
    expect(out.token).toBe('abc');
  });

  test('leaves a value that is already present', () => {
    const schema = { fallbacks: { token: [{ type: 'memory', key: 'authToken' }] } };
    const out = validate.applyFallbacks({ token: 'given' }, schema, { memory: { authToken: 'abc' } });
    expect(out.token).toBe('given');
  });

  test('treats null like missing', () => {
    const schema = { fallbacks: { token: [{ type: 'static', value: 'fallback' }] } };
    expect(validate.applyFallbacks({ token: null }, schema, {}).token).toBe('fallback');
  });

  test('walks the fallback list in order until one produces a value', () => {
    const schema = {
      fallbacks: {
        token: [
          { type: 'memory', key: 'missing' },
          { type: 'static', value: 'second' },
          { type: 'static', value: 'third' }
        ]
      }
    };
    expect(validate.applyFallbacks({}, schema, { memory: {} }).token).toBe('second');
  });

  test('supports the replacer oneOf method', () => {
    const schema = {
      fallbacks: { city: [{ type: 'replacer', method: 'oneOf', values: ['Ghent', 'Mons'] }] }
    };
    expect(['Ghent', 'Mons']).toContain(validate.applyFallbacks({}, schema, {}).city);
  });

  test('supports the replacer values method', () => {
    const schema = {
      fallbacks: { id: [{ type: 'replacer', method: 'values', key: 'uuid' }] }
    };
    expect(validate.applyFallbacks({}, schema, {}).id).toMatch(/^[0-9a-f]{8}-/);
  });

  test('supports a replacer function fallback', () => {
    const schema = {
      fallbacks: { n: [{ type: 'replacer', method: 'function', value: () => 42 }] }
    };
    expect(validate.applyFallbacks({}, schema, {}).n).toBe(42);
  });

  test('applies a transform to whatever the fallback produced', () => {
    const schema = {
      fallbacks: { name: [{ type: 'static', value: 'ana', transform: (v: string) => v.toUpperCase() }] }
    };
    expect(validate.applyFallbacks({}, schema, {}).name).toBe('ANA');
  });

  test('an unknown fallback type yields nothing', () => {
    const schema = { fallbacks: { x: [{ type: 'nope' }] } };
    expect(validate.applyFallbacks({}, schema, {}).x).toBeUndefined();
  });

  test('a replacer fallback with an unknown method yields nothing', () => {
    const schema = { fallbacks: { x: [{ type: 'replacer', method: 'nope' }] } };
    expect(validate.applyFallbacks({}, schema, {}).x).toBeUndefined();
  });

  test('missing flow memory does not throw', () => {
    const schema = { fallbacks: { x: [{ type: 'memory', key: 'k' }] } };
    expect(validate.applyFallbacks({}, schema, {}).x).toBeUndefined();
  });

  test('recurses into a nested object that the schema describes', () => {
    const schema = {
      fallbacks: { address: [] },
      properties: {
        address: {
          type: 'object',
          properties: { geo: { type: 'object', properties: { lat: { type: 'number' } } } }
        }
      }
    };
    const data = { address: { geo: { lat: 1 } } };
    expect(validate.applyFallbacks(data, schema, {})).toEqual(data);
  });

  test('leaves a nested object alone when the schema does not describe it', () => {
    const schema = { fallbacks: { address: [] }, properties: {} };
    const data = { address: { city: 'Ghent' } };
    expect(validate.applyFallbacks(data, schema, {})).toEqual(data);
  });

  test('does not recurse into arrays', () => {
    const schema = { fallbacks: { items: [] }, properties: { items: { properties: {} } } };
    const data = { items: [1, 2] };
    expect(validate.applyFallbacks(data, schema, {}).items).toEqual([1, 2]);
  });
});

describe('validate.body', () => {
  const schema = {
    type: 'object',
    properties: { name: { type: 'string' } },
    required: ['name'],
    fallbacks: { name: [{ type: 'static', value: 'anonymous' }] }
  };

  test('exposes the schema for the docs generator', () => {
    const validator = validate.body(schema);
    expect(validator.schemaType).toBe('body');
    expect(validator.schema).toBe(schema);
  });

  test('fills the fallback in and writes it back onto parameters', () => {
    const parameters: any = { body: {} };
    validate.body(schema)({}, parameters, {});
    expect(parameters.body.name).toBe('anonymous');
  });

  test('creates parameters.body when it is missing', () => {
    const parameters: any = {};
    validate.body(schema)({}, parameters, {});
    expect(parameters.body.name).toBe('anonymous');
  });

  test('tolerates no parameters object at all', () => {
    expect(() => validate.body(schema)({}, undefined, {})).not.toThrow();
  });

  test('rejects a body that fails the schema', () => {
    const noFallback = { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] };
    expect(() => validate.body(noFallback)({}, { body: {} }, {})).toThrow(/required/);
  });
});

describe('validate.query', () => {
  const schema = {
    type: 'object',
    properties: { page: { type: 'number' } },
    fallbacks: { page: [{ type: 'static', value: 1 }] }
  };

  test('is tagged as a query validator', () => {
    expect(validate.query(schema).schemaType).toBe('query');
  });

  test('fills and writes back onto parameters.query', () => {
    const parameters: any = {};
    validate.query(schema)({}, parameters, {});
    expect(parameters.query.page).toBe(1);
  });
});

describe('validate.params', () => {
  const schema = {
    type: 'object',
    properties: { id: { type: 'string' } },
    fallbacks: { id: [{ type: 'static', value: 'x' }] }
  };

  test('is tagged as a params validator', () => {
    expect(validate.params(schema).schemaType).toBe('params');
  });

  test('fills and writes back onto parameters.params', () => {
    const parameters: any = { params: {} };
    validate.params(schema)({}, parameters, {});
    expect(parameters.params.id).toBe('x');
  });

  test('tolerates no parameters object at all', () => {
    expect(() => validate.params(schema)({}, undefined, {})).not.toThrow();
  });
});

describe('validate.headers', () => {
  const schema = {
    type: 'object',
    properties: { authorization: { type: 'string' } },
    required: ['authorization']
  };

  test('is tagged as a headers validator', () => {
    expect(validate.headers(schema).schemaType).toBe('headers');
  });

  test('accepts headers that match', () => {
    expect(() => validate.headers(schema)({}, { headers: { authorization: 'Bearer x' } })).not.toThrow();
  });

  test('rejects headers that do not, including when absent', () => {
    expect(() => validate.headers(schema)({}, { headers: {} })).toThrow(/required/);
    expect(() => validate.headers(schema)({}, undefined)).toThrow(/required/);
  });
});
