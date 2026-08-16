// Example application: a fictional "billing" API.
//
// In the example flows this application is MIMICKED: mimic.js starts a local
// HTTP server that impersonates the real API, so the flows run fully offline.
// Point BASE_URL at the real service (per environment) when you have one.
const { applications, httpClient, validate } = require('lab34-flows');
const { handler } = applications;

module.exports.createInvoice = handler([
  'Create an invoice for a customer (POST /invoices)',
  validate.body({
    type: 'object',
    properties: {
      customerId: { type: ['string', 'number'] },
      amount: { type: 'number' }
    },
    required: ['customerId'],
    fallbacks: {
      amount: [{ type: 'replacer', method: 'values', key: 'randomInt0_1000' }]
    }
  }),
  (ctx, parameters) => {
    const { body, headers } = parameters || {};
    return httpClient.post(ctx, '/invoices', { body, headers });
  }
], 'createInvoice');

module.exports.getInvoice = handler([
  'Fetch an invoice by id (GET /invoices/:id)',
  validate.params({
    type: 'object',
    properties: {
      id: { type: ['string', 'number'] }
    },
    required: ['id']
  }),
  (ctx, parameters) => {
    const { params, headers } = parameters || {};
    return httpClient.get(ctx, `/invoices/${params.id}`, { headers });
  }
], 'getInvoice');
