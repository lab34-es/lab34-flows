const axios = require('axios');
const debug = require('debug')('lab34:flows:helpers:httpClient');

/**
 * Generates request headers based on the context environment
 * @param {Object} ctx - The context object containing environment variables
 * @returns {Object} - Compiled headers object
 */
const headers = (ctx) => {
  const { env } = ctx;
  // Merge all conditional headers into a single object
  return [
    env.X_API_KEY ? { 'x-api-key': env.X_API_KEY } : {},
    env.HTTP_BASIC_AUTH ? { 'Authorization': `Basic ${Buffer.from(env.HTTP_BASIC_AUTH).toString('base64')}` } : {}
  ].reduce((acc, h) => Object.assign(acc, h), {});
};

/**
 * Core fetch function to make HTTP requests
 * @param {Object} ctx - The context object containing environment and reporter
 * @param {string} urlPath - The URL path to be appended to the base URL
 * @param {Object} opts - Request options including method, headers, data, etc.
 * @returns {Promise<Array>} - Promise resolving to [headers, status, body]
 */
const _fetch = (ctx, urlPath, opts) => {
  // Prepare meta object to track request timing
  const meta = { start: Date.now() };

  const filteredCase = ctx.case || ''; // Default case if not provided

  // ctx.env must contain all ctx.env variables, giving priority
  // to the ones ending by "filteredCase" (e.g. "BASE_URL_filteredCase")

  if (filteredCase) {
    ctx.env = Object.keys(ctx.env).reduce((acc, key) => {
      // Check if the key ends with the filtered case
      if (key.endsWith(`_${filteredCase}`)) {
        // Create a new key without the filtered case suffix
        const newKey = key.replace(`_${filteredCase}`, '');
        acc[newKey] = ctx.env[key]; // Assign the value to the new key
      } else {
        acc[key] = ctx.env[key]; // Keep the original key-value pair
      }
      return acc;
    }, {});
  }

  // Build full URL by combining base URL with the provided path
  const fullUrl = `${ctx.env.BASE_URL}${urlPath}`;
  
  // Debug URL
  debug('Request URL: %s', fullUrl);
  
  // Extract special options and keep standard axios options
  const {
    skipCertCheck, // Custom option to bypass SSL certificate validation
    ...options
  } = opts || {};

  // Initialize and merge headers from context
  if (!options.headers) {options.headers = {};}
  options.headers = Object.assign(headers(ctx), options.headers);

  // Process request body for JSON objects
  if (options.data) {
    if (typeof options.data === 'object') {
      options.data = JSON.stringify(options.data);
      options.headers['content-type'] = 'application/json';
    }
  }
  
  if (options.body) {
    if (typeof options.body === 'object') {
      options.data = JSON.stringify(options.body);
      options.headers['content-type'] = 'application/json';
      delete options.body; // Remove body to avoid duplication
    }
  }

  // Handle SSL certificate validation bypass if requested
  const prevRejectUnauthorized = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  if (skipCertCheck) {
    // Setting to 0 disables certificate validation (use with caution)
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;
  }
  
  // Log the outgoing request using the context's reporter
  ctx.reporter.request(options.method, { url: fullUrl, options });

  // Prepare axios request configuration
  const axiosRequest = Object.assign({}, { url: fullUrl }, options);

  // Perform the request and handle response processing
  return axios.request(axiosRequest)
    .then(response => formatResponse(ctx, response, meta))
    .catch(error => formatResponse(ctx, error, meta))
    .finally(() => {
      // Restore original SSL certificate validation setting if it was changed
      if (skipCertCheck) {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = prevRejectUnauthorized;
      }
    });
};

/**
 * Process and format HTTP response
 * @param {Object} ctx - The context object
 * @param {Object|Error} response - The axios response or error object
 * @param {Object} meta - Metadata including timing information
 * @returns {Promise<Array>} - Promise resolving to [headers, status, body]
 */
const formatResponse = async (ctx, response, meta) => {
  // Record end time for performance tracking
  meta.end = Date.now();

  // Network-level failures (DNS, connection refused, timeout...) carry no
  // HTTP response: propagate them so the runner can mark the step as errored.
  if (response instanceof Error && !response.response) {
    throw response;
  }

  // HTTP-level errors (4xx / 5xx) are regular responses for this tool:
  // flows frequently assert on them (e.g. "test: status: 404").
  if (response instanceof Error) {
    response = response.response;
  }

  const headers = response.headers || {};
  const status = response.status;

  // Read a header value from either an AxiosHeaders instance or a plain object
  const getHeader = (name) => {
    if (typeof headers.get === 'function') {
      return headers.get(name);
    }
    return headers[name];
  };

  const isJson = String(getHeader('content-type') || '').includes('application/json');

  // Parse response body according to content type
  let body;
  try {
    if (isJson && response.data) {
      body = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
    } else {
      body = response.data || '';
    }
  } catch {
    // Fallback to raw data if parsing fails
    body = response.data || '';
  }

  // Log the response using the context's reporter and return response components
  const timing = meta.end - meta.start;
  ctx.reporter.response({ headers, status, body }, {
    ...meta,
    timing // Total request duration
  });

  return [headers, status, body];
};

/**
 * Perform a GET request
 * @param {Object} ctx - The context object
 * @param {string} url - The URL path
 * @param {Object} opts - Request options
 * @returns {Promise<Array>} - Promise resolving to [headers, status, body]
 */
const get = (ctx, url, opts) => {
  return _fetch(ctx, url, Object.assign(opts || {}, { method: 'GET' }));
};

/**
 * Perform a POST request
 * @param {Object} ctx - The context object
 * @param {string} url - The URL path
 * @param {Object} opts - Request options
 * @returns {Promise<Array>} - Promise resolving to [headers, status, body]
 */
const post = (ctx, url, opts) => {
  return _fetch(ctx, url, Object.assign(opts || {}, { method: 'POST' }));
};

/**
 * Perform a PUT request
 * @param {Object} ctx - The context object
 * @param {string} url - The URL path
 * @param {Object} opts - Request options
 * @returns {Promise<Array>} - Promise resolving to [headers, status, body]
 */
const put = (ctx, url, opts) => {
  return _fetch(ctx, url, Object.assign(opts || {}, { method: 'PUT' }));
};

/**
 * Perform a DELETE request
 * @param {Object} ctx - The context object
 * @param {string} url - The URL path
 * @param {Object} opts - Request options
 * @returns {Promise<Array>} - Promise resolving to [headers, status, body]
 */
const del = (ctx, url, opts) => {
  return _fetch(ctx, url, Object.assign(opts || {}, { method: 'DELETE' }));
};

/**
 * Perform a PATCH request
 * @param {Object} ctx - The context object
 * @param {string} url - The URL path
 * @param {Object} opts - Request options
 * @returns {Promise<Array>} - Promise resolving to [headers, status, body]
 */
const patch = (ctx, url, opts) => {
  return _fetch(ctx, url, Object.assign(opts || {}, { method: 'PATCH' }));
};

module.exports = {
  get,
  post,
  put,
  del,
  patch
};
