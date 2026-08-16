// Example application: JSONPlaceholder (https://jsonplaceholder.typicode.com)
//
// An "application" is a plain Node.js module. Each exported method is built
// with the handler() helper:
//
//   handler([ description, ...validators, executor ], 'methodName')
//
// - description: shown in the UI, the CLI (--capabilities) and given to the AI
// - validators:  optional JSON-schema validation (with fallbacks) for the
//                step parameters (body, query, params, headers)
// - executor:    (ctx, parameters, flow) => [headers, status, body, memory?]
//
// The "lab34-flows" import below is resolved automatically by the tool to the
// installed @lab34/flows package.
const { applications, httpClient, validate } = require('lab34-flows');
const { handler } = applications;

module.exports.getPost = handler([
  'Fetch a single blog post by id (GET /posts/:id)',
  validate.params({
    type: 'object',
    properties: {
      id: { type: ['string', 'number'] }
    },
    required: ['id'],
    // When the flow does not provide params.id, pick a random existing post
    fallbacks: {
      id: [{ type: 'replacer', method: 'oneOf', values: [1, 2, 3, 4, 5] }]
    }
  }),
  (ctx, parameters) => {
    const { params, headers } = parameters || {};
    return httpClient.get(ctx, `/posts/${params.id}`, { headers });
  }
], 'getPost');

module.exports.listPosts = handler([
  'List blog posts, optionally filtered by author (GET /posts?userId=...)',
  validate.query({
    type: 'object',
    properties: {
      userId: { type: ['string', 'number'] }
    }
  }),
  (ctx, parameters) => {
    const { query, headers } = parameters || {};
    return httpClient.get(ctx, '/posts', { params: query, headers });
  }
], 'listPosts');

module.exports.createPost = handler([
  'Create a blog post (POST /posts). Stores the new id in flow memory as "createdPostId"',
  validate.body({
    type: 'object',
    properties: {
      title: { type: 'string' },
      body: { type: 'string' },
      userId: { type: ['string', 'number'] }
    },
    required: ['title', 'userId'],
    // Fallbacks fill missing values so the flow can stay minimal
    fallbacks: {
      title: [{ type: 'replacer', method: 'values', key: 'randomString' }],
      userId: [{ type: 'static', value: 1 }]
    }
  }),
  async (ctx, parameters) => {
    const { body, headers } = parameters || {};
    const [resHeaders, status, resBody] = await httpClient.post(ctx, '/posts', { body, headers });

    // The optional 4th element is merged into flow.memory and becomes
    // available to later steps as {{ memory.createdPostId }}
    return [resHeaders, status, resBody, { createdPostId: resBody && resBody.id }];
  }
], 'createPost');

module.exports.getUser = handler([
  'Fetch a user profile by id (GET /users/:id)',
  validate.params({
    type: 'object',
    properties: {
      id: { type: ['string', 'number'] }
    },
    required: ['id']
  }),
  (ctx, parameters) => {
    const { params, headers } = parameters || {};
    return httpClient.get(ctx, `/users/${params.id}`, { headers });
  }
], 'getUser');
