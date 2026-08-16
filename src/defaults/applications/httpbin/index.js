// Example application: httpbin
//
// Demonstrates HTTP testing against https://httpbin.org, a public service
// that echoes whatever you send to it. Great for exploring query
// parameters, request bodies, headers and non-2xx status codes.
const { applications, httpClient } = require('lab34-flows');

module.exports.get = applications.handler([
  'Performs a GET request to /get. httpbin echoes the query parameters and headers back.',
  async (ctx, parameters) => {
    const { query, headers } = parameters || {};
    return httpClient.get(ctx, '/get', {
      params: query || {},
      headers: headers || {}
    });
  }
], 'get');

module.exports.post = applications.handler([
  'Performs a POST request to /post. httpbin echoes the JSON body back under "json".',
  async (ctx, parameters) => {
    const { body, headers } = parameters || {};
    return httpClient.post(ctx, '/post', {
      body: body || {},
      headers: headers || {}
    });
  }
], 'post');

module.exports.status = applications.handler([
  'Requests /status/{code}, which responds with that HTTP status code. Useful to test error scenarios.',
  async (ctx, parameters) => {
    const params = (parameters || {}).params || {};
    const code = params.code || 200;
    return httpClient.get(ctx, `/status/${code}`);
  }
], 'status');

module.exports.delay = applications.handler([
  'Requests /delay/{seconds}, which waits before responding. Useful to test timeouts and retries.',
  async (ctx, parameters) => {
    const params = (parameters || {}).params || {};
    const seconds = params.seconds || 1;
    return httpClient.get(ctx, `/delay/${seconds}`);
  }
], 'delay');
