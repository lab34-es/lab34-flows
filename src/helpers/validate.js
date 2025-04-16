const Ajv = require('ajv');
const ajv = new Ajv({ allErrors: true });

/**
 * Validates the given data against the provided schema using AJV.
 *
 * @param {Object} schema - The JSON schema to validate against.
 * @param {Object} data - The data to be validated.
 * @throws {Error} Throws an error if the data is not valid according to the schema.
 */
const validate = (schema, data) => {
  const valid = ajv.validate(schema, data);
  if (!valid) {
    throw new Error(ajv.errorsText());
  }
}

const body = schema => {
  const validator = (ctx, parameters) => {
    validate(schema, parameters.body);
  };
  // Attach the schema to the validator function
  validator.schemaType = 'body';
  validator.schema = schema;
  return validator;
};

const query = schema => {
  const validator = (ctx, parameters) => {
    validate(schema, parameters.query);
  };
  // Attach the schema to the validator function
  validator.schemaType = 'query';
  validator.schema = schema;
  return validator;
}

const params = schema => {
  const validator = (ctx, parameters) => {
    validate(schema, parameters);
  };
  // Attach the schema to the validator function
  validator.schemaType = 'params';
  validator.schema = schema;
  return validator;
}

const headers = schema => {
  const validator = (ctx, parameters) => {
    validate(schema, parameters.headers);
  };
  // Attach the schema to the validator function
  validator.schemaType = 'headers';
  validator.schema = schema;
  return validator;
}

module.exports.validate = validate;
module.exports.body = body;
module.exports.query = query;
module.exports.params = params;
module.exports.headers = headers;
