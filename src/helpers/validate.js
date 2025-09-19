const Ajv = require('ajv');
const replacer = require('./replacer');
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

/**
 * Applies fallbacks to data based on schema configuration
 * @param {Object} data - The original data
 * @param {Object} schema - The schema with fallbacks configuration
 * @param {Object} flow - The flow context for memory access
 * @returns {Object} Data with fallbacks applied
 */
const applyFallbacks = (data, schema, flow) => {
  if (!schema.fallbacks) return data;
  
  const result = { ...data };
  
  for (const [key, fallbackConfig] of Object.entries(schema.fallbacks)) {
    if (result[key] === undefined || result[key] === null) {
      // Apply fallbacks in order until we find a value
      for (const fallback of fallbackConfig) {
        let value;
        
        if (fallback.type === 'memory') {
          value = flow.memory?.[fallback.key];
        } else if (fallback.type === 'replacer') {
          if (fallback.method === 'oneOf') {
            value = replacer.oneOf(fallback.values);
          } else if (fallback.method === 'values') {
            value = replacer.values()[fallback.key];
          } else if (fallback.method === 'function') {
            value = fallback.value();
          }
        } else if (fallback.type === 'static') {
          value = fallback.value;
        }
        
        if (value !== undefined && value !== null) {
          // Apply transform function if provided
          if (fallback.transform && typeof fallback.transform === 'function') {
            value = fallback.transform(value);
          }
          result[key] = value;
          break;
        }
      }
    } else if (typeof result[key] === 'object' && result[key] !== null && !Array.isArray(result[key])) {
      // Handle nested objects - recursively apply fallbacks to nested properties
      const schemaProperty = schema.properties?.[key];
      if (schemaProperty && schemaProperty.properties) {
        result[key] = applyNestedFallbacks(result[key], schemaProperty, schema.fallbacks, flow);
      }
    }
  }
  
  return result;
};

/**
 * Recursively applies fallbacks to nested objects
 * @param {Object} data - The nested object data
 * @param {Object} schema - The schema for the nested object
 * @param {Object} parentFallbacks - The fallbacks from the parent schema
 * @param {Object} flow - The flow context for memory access
 * @returns {Object} Data with nested fallbacks applied
 */
const applyNestedFallbacks = (data, schema, parentFallbacks, flow) => {
  if (!schema.properties) return data;
  
  const result = { ...data };
  
  // Check each property in the schema
  for (const [key, propertySchema] of Object.entries(schema.properties)) {
    if (result[key] === undefined || result[key] === null) {
      // This property is missing, but we don't have direct fallbacks for nested properties
      // The fallback should have been applied at the parent level
      // If we reach here, it means the parent object exists but this nested property is missing
      // We'll leave it as undefined and let validation catch it if it's required
    } else if (typeof result[key] === 'object' && result[key] !== null && !Array.isArray(result[key])) {
      // Recursively handle deeper nesting
      if (propertySchema.properties) {
        result[key] = applyNestedFallbacks(result[key], propertySchema, parentFallbacks, flow);
      }
    }
  }
  
  return result;
};

const body = schema => {
  const validator = (ctx, parameters, flow) => {
    const originalData = (parameters||{}).body || {};
    const dataWithFallbacks = applyFallbacks(originalData, schema, flow);
    
    // Create a clean schema without fallbacks for AJV validation
    const { fallbacks, ...cleanSchema } = schema;
    validate(cleanSchema, dataWithFallbacks);
    
    // Update parameters with fallback values
    if (!parameters) parameters = {};
    if (!parameters.body) parameters.body = {};
    Object.assign(parameters.body, dataWithFallbacks);
  };
  // Attach the schema to the validator function
  validator.schemaType = 'body';
  validator.schema = schema;
  return validator;
};

const query = schema => {
  const validator = (ctx, parameters, flow) => {
    const originalData = (parameters||{}).query || {};
    const dataWithFallbacks = applyFallbacks(originalData, schema, flow);
    
    // Create a clean schema without fallbacks for AJV validation
    const { fallbacks, ...cleanSchema } = schema;
    validate(cleanSchema, dataWithFallbacks);
    
    // Update parameters with fallback values
    if (!parameters) parameters = {};
    if (!parameters.query) parameters.query = {};
    Object.assign(parameters.query, dataWithFallbacks);
  };
  // Attach the schema to the validator function
  validator.schemaType = 'query';
  validator.schema = schema;
  return validator;
}

const params = schema => {
  const validator = (ctx, parameters, flow) => {
    const originalData = (parameters||{}).params || {};
    const dataWithFallbacks = applyFallbacks(originalData, schema, flow);
    
    // Create a clean schema without fallbacks for AJV validation
    const { fallbacks, ...cleanSchema } = schema;
    validate(cleanSchema, dataWithFallbacks);
    
    // Update parameters with fallback values
    if (!parameters) parameters = {};
    if (!parameters.params) parameters.params = {};
    Object.assign(parameters.params, dataWithFallbacks);
  };
  // Attach the schema to the validator function
  validator.schemaType = 'params';
  validator.schema = schema;
  return validator;
}

const headers = schema => {
  const validator = (ctx, parameters) => {
    validate(schema, (parameters||{}).headers || {});
  };
  // Attach the schema to the validator function
  validator.schemaType = 'headers';
  validator.schema = schema;
  return validator;
}

module.exports.validate = validate;
module.exports.applyFallbacks = applyFallbacks;
module.exports.body = body;
module.exports.query = query;
module.exports.params = params;
module.exports.headers = headers;
