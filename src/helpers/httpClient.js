const axios = require('axios');

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
  ].reduce((acc, h) => Object.assign(acc, h), {});
}

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

  // Build full URL by combining base URL with the provided path
  const fullUrl = `${ctx.env.BASE_URL}${urlPath}`;
  
  // Extract special options and keep standard axios options
  let {
    skipCertCheck, // Custom option to bypass SSL certificate validation
    ...options
  } = opts || {};

  // Initialize and merge headers from context
  if (!options.headers) options.headers = {};
  options.headers = Object.assign(options.headers, headers(ctx));

  // Process request body for JSON objects
  if (options.data) {
    if (typeof options.data === 'object') {
      options.data = JSON.stringify(options.data);
      options.headers['Content-Type'] = 'application/json';
    }
  }

  // Handle SSL certificate validation bypass if requested
  const prevRejectUnauthorized = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  if (skipCertCheck) {
    // Setting to 0 disables certificate validation (use with caution)
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;
  }
  
  // Log the outgoing request using the context's reporter
  ctx.reporter.request(options.method, {url: fullUrl, options});

  // Prepare axios request configuration
  const axiosRequest = Object.assign({}, {url: fullUrl}, options);

  // Perform the request and handle response processing
  return axios.request(axiosRequest)
    .then(response => formatResponse(ctx, response, meta))
    .catch(error => formatResponse(ctx, error, meta))
    .finally(() => {
      // Restore original SSL certificate validation setting if it was changed
      if (skipCertCheck) {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = prevRejectUnauthorized;
      }
    })
}

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

  // Re-throw if the response is an error
  if(response instanceof Error) {
    throw response;
  }

  const headers = response.headers;
  const status = response.status;

  // Determine if response is JSON based on content-type header
  const isJson = headers.get('content-type') &&
    headers.get('content-type').includes('application/json');
  
  let body;
  
  // Parse response body according to content type
  try {
    if (isJson) {
      body = JSON.parse(response.data);
    } else {
      body = response.data;
    }
  } catch (error) {
    // Fallback to raw data if parsing fails
    body = response.data;
  }
  
  // Log the response using the context's reporter and return response components
  return Promise.resolve([headers, status, body])
    .then(([headers, status, body]) => {
      ctx.reporter.response({headers, status, body}, {
        ...meta,
        timing: meta.end - meta.start, // Calculate total request duration
      });
      return [headers, status, body];
    });
}

/**
 * Perform a GET request
 * @param {Object} ctx - The context object
 * @param {string} url - The URL path
 * @param {Object} opts - Request options
 * @returns {Promise<Array>} - Promise resolving to [headers, status, body]
 */
const get = (ctx, url, opts) => {
  return _fetch(ctx, url, Object.assign(opts || {}, {method: 'GET'}))
}

/**
 * Perform a POST request
 * @param {Object} ctx - The context object
 * @param {string} url - The URL path
 * @param {Object} opts - Request options
 * @returns {Promise<Array>} - Promise resolving to [headers, status, body]
 */
const post = (ctx, url, opts) => {
  return _fetch(ctx, url, Object.assign(opts || {}, {method: 'POST'}))
}

/**
 * Perform a PUT request
 * @param {Object} ctx - The context object
 * @param {string} url - The URL path
 * @param {Object} opts - Request options
 * @returns {Promise<Array>} - Promise resolving to [headers, status, body]
 */
const put = (ctx, url, opts) => {
  return _fetch(ctx, url, Object.assign(opts || {}, {method: 'PUT'}))
}

/**
 * Perform a DELETE request
 * @param {Object} ctx - The context object
 * @param {string} url - The URL path
 * @param {Object} opts - Request options
 * @returns {Promise<Array>} - Promise resolving to [headers, status, body]
 */
const del = (ctx, url, opts) => {
  return _fetch(ctx, url, Object.assign(opts || {}, {method: 'DELETE'}))
}

/**
 * Perform a PATCH request
 * @param {Object} ctx - The context object
 * @param {string} url - The URL path
 * @param {Object} opts - Request options
 * @returns {Promise<Array>} - Promise resolving to [headers, status, body]
 */
const patch = (ctx, url, opts) => {
  return _fetch(ctx, url, Object.assign(opts || {}, {method: 'PATCH'}))
}

module.exports = {
  get,
  post,
  put,
  del,
  patch,
}