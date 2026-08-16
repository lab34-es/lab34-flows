// Example application: jsonplaceholder
//
// Talks to https://jsonplaceholder.typicode.com, a free fake REST API for
// testing. Demonstrates a typical CRUD-style API and how to pass data
// between steps using flow memory.
const { applications, httpClient } = require('lab34-flows');

module.exports.listPosts = applications.handler([
  'Lists posts (GET /posts). Optionally filter by userId with query.userId.',
  async (ctx, parameters) => {
    const { query } = parameters || {};
    return httpClient.get(ctx, '/posts', { params: query || {} });
  }
], 'listPosts');

module.exports.getPost = applications.handler([
  'Gets a single post by id (GET /posts/{id}).',
  async (ctx, parameters) => {
    const params = (parameters || {}).params || {};
    return httpClient.get(ctx, `/posts/${params.id}`);
  }
], 'getPost');

module.exports.createPost = applications.handler([
  'Creates a post (POST /posts). Writes the new post id to memory as "lastPostId".',
  async (ctx, parameters) => {
    const { body } = parameters || {};
    const [headers, status, responseBody] = await httpClient.post(ctx, '/posts', {
      body: body || {}
    });
    const memory = responseBody && responseBody.id ? { lastPostId: responseBody.id } : {};
    return [headers, status, responseBody, memory];
  }
], 'createPost');

module.exports.getUser = applications.handler([
  'Gets a user by id (GET /users/{id}).',
  async (ctx, parameters) => {
    const params = (parameters || {}).params || {};
    return httpClient.get(ctx, `/users/${params.id}`);
  }
], 'getUser');
