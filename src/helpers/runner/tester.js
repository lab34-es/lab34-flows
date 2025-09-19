/**
 * Compares two objects deeply to check if they are equal.
 *
 * @param {Object} obj1 - The first object to compare.
 * @param {Object} obj2 - The second object to compare.
 * @returns {boolean} - Returns true if the objects are equal, otherwise false.
 */
const compareObjectsDeep = (obj1, obj2) => {
  // Get the keys of both objects
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);

  // Check if the number of keys is the same
  if (keys1.length !== keys2.length) {
    return false;
  }

  // Check if the keys are the same
  if (!keys1.every(key => keys2.includes(key))) {
    return false;
  }

  // Check if the values are the same
  return keys1.every(key => {
    if (typeof obj1[key] === 'object' && typeof obj2[key] === 'object') {
      return compareObjectsDeep(obj1[key], obj2[key]);
    }
    return obj1[key] === obj2[key];
  });
};

/**
 * Compares the expected status with the actual status.
 *
 * @param {number|number[]} expected - The expected status or list of possible statuses.
 * @param {number} actual - The actual status to compare.
 * @returns {Object[]} - Returns an array of error objects if the statuses do not match, otherwise an empty array.
 */
const status = (expected, actual) => {
  const errors = [];

  // Ensure expected is an array of statuses
  expected = Array.isArray(expected) ? expected : [expected];
  
  // Check if the actual status is one of the expected statuses
  if (!expected.includes(actual)) {
    errors.push({
      message: 'Expected status does not match actual status',
      expected,
      actual
    });
  }

  return errors;
};

/**
 * Evaluates a JavaScript expression against a value.
 *
 * @param {string} expr - JavaScript expression to evaluate.
 * @param {any} value - The actual value to test against.
 * @returns {boolean} - Returns true if the expression evaluates to true, otherwise false.
 */
const evaluateExpression = (expr, value) => {
  try {
    // Using Function constructor to create a safe evaluation environment
    const func = new Function('value', `return ${expr}`);
    return func(value);
  } catch (error) {
    console.error(`Error evaluating expression: ${expr}`, error);
    return false;
  }
};

/**
 * Determines if a value is a JavaScript expression test.
 * 
 * @param {any} value - The value to check.
 * @returns {boolean} - Returns true if the value is an expression test.
 */
const isExpressionTest = (value) => {
  return typeof value === 'string' && value.startsWith('$expr:');
};

/**
 * Compares the expected body with the actual body.
 *
 * @param {Object} expected - The expected body object.
 * @param {Object} actual - The actual body object to compare.
 * @returns {Object[]} - Returns an array of error objects if the bodies do not match, otherwise an empty array.
 */
const body = (expected, actual) => {
  const errors = [];

  // Check if we need to do deep comparison or expression evaluation
  const processObjectOrExpression = (expected, actual, path = '') => {
    // If the expected value is a JavaScript expression
    if (isExpressionTest(expected)) {
      const expression = expected.substring(6); // Remove '$expr:' prefix
      const result = evaluateExpression(expression, actual);
      
      if (!result) {
        errors.push({
          message: `Expression evaluation failed at ${path}`,
          expression: expression,
          actualValue: actual
        });
      }
      return;
    }
    
    // If both are objects (not null), do deep comparison
    if (typeof expected === 'object' && expected !== null && 
        typeof actual === 'object' && actual !== null) {
      
      const expectedKeys = Object.keys(expected);
      
      for (const key of expectedKeys) {
        const newPath = path ? `${path}.${key}` : key;
        
        if (!(key in actual)) {
          errors.push({
            message: `Missing key '${newPath}' in actual object`,
            expected: expected[key],
            actual: undefined
          });
          continue;
        }
        
        processObjectOrExpression(expected[key], actual[key], newPath);
      }
    }
    // Otherwise do direct comparison
    else if (expected !== actual) {
      errors.push({
        message: `Value mismatch at ${path}`,
        expected,
        actual
      });
    }
  };
  
  processObjectOrExpression(expected, actual);
  
  return errors;
};

module.exports.test = async (flow, test, contents, opts) => {
  const cases = {};

  if (test.status) {
    cases.status = status(test.status, contents.status);
  }

  if (test.body) {
    cases.body = body(test.body, contents.body);
  }

  if (test.latentApplications && test.latentApplications.length) {
    cases.latentApplications = [];

    await Promise.all(test.latentApplications.map(async (testApplication) => {
      const { application } = testApplication;
      const testApplicationCode = flow.latentApplications.find(app => app.application === application).code;
      const errors = await testApplicationCode.test(flow, testApplication, contents);
      if (errors) {
        cases.latentApplications.push({
          application,
          errors
        });
      }
    }));
  }

  // Normal cases with errors?
  const hasErrors = Object.values(cases).some(c => c.length > 0);

  return {
    hasErrors,
    ...cases
  };
};

/**
 * Make sure all test applications are started.
 * @param {*} flow 
 */
module.exports.getReady = async (flow) => {
  if (!flow.latentApplications) {
    flow.latentApplications = [];
  }

  let index = 0;
  for (const testApplication of flow.latentApplications) {
    const { application } = testApplication;
    flow.latentApplications[index].code = require(`../../latentApplications/${application}`);
    await flow.latentApplications[index].code.start(flow, testApplication);
    index++;
  }
};
