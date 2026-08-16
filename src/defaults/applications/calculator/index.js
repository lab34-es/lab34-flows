// Example application: calculator
//
// A fully offline application, handy to explore flows without any network
// access. It also demonstrates how applications can write to the flow
// memory, so later steps can reuse previous results with
// {{ memory.lastResult }}.
const { applications } = require('lab34-flows');

const toNumber = (value, name) => {
  const num = typeof value === 'number' ? value : parseFloat(value);
  if (Number.isNaN(num)) {
    throw new Error(`Parameter "${name}" must be a number, got: ${JSON.stringify(value)}`);
  }
  return num;
};

const round = (value, ctx) => {
  const precision = parseInt((ctx.env && ctx.env.PRECISION) || '4', 10);
  return Number(value.toFixed(precision));
};

module.exports.add = applications.handler([
  'Adds two numbers (a + b). Writes the result to memory as "lastResult".',
  async (ctx, parameters) => {
    const body = (parameters || {}).body || {};
    const a = toNumber(body.a, 'a');
    const b = toNumber(body.b, 'b');
    const result = round(a + b, ctx);
    return [{}, 200, { operation: 'add', a, b, result }, { lastResult: result }];
  }
], 'add');

module.exports.multiply = applications.handler([
  'Multiplies two numbers (a * b). Writes the result to memory as "lastResult".',
  async (ctx, parameters) => {
    const body = (parameters || {}).body || {};
    const a = toNumber(body.a, 'a');
    const b = toNumber(body.b, 'b');
    const result = round(a * b, ctx);
    return [{}, 200, { operation: 'multiply', a, b, result }, { lastResult: result }];
  }
], 'multiply');

module.exports.divide = applications.handler([
  'Divides two numbers (a / b). Returns a 400 error when dividing by zero.',
  async (ctx, parameters) => {
    const body = (parameters || {}).body || {};
    const a = toNumber(body.a, 'a');
    const b = toNumber(body.b, 'b');

    if (b === 0) {
      return [{}, 400, {
        error: {
          code: 'DIVISION_BY_ZERO',
          message: 'Cannot divide by zero'
        }
      }, {}];
    }

    const result = round(a / b, ctx);
    return [{}, 200, { operation: 'divide', a, b, result }, { lastResult: result }];
  }
], 'divide');
