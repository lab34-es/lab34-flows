// Mimic for the "billing" application.
//
// When a flow step declares this application under its "mimic" section, the
// runner calls start() before executing the step. The httpServer helper
// spins up a local Express server that impersonates the real API - so flows
// can run without the real dependency, and you can force failure scenarios
// through per-step "conditions".
//
// Response bodies support replacers: values like {{ uuid }} are rendered
// with the same Handlebars engine used by flows. Fields of the incoming
// request body can also be referenced, e.g. {{ customerId }}.
const { httpServer } = require('lab34-flows');

const PORT = 4545;

// The server (and its request callback) is created once per port. Keep the
// latest mimic config in module state so per-step conditions apply.
let currentConfig = null;

module.exports.start = (mimicConfig) => {
  currentConfig = mimicConfig;

  return httpServer.start(mimicConfig, PORT, (req, res) => {
    const conditions = (currentConfig && currentConfig.conditions) || {};

    if (req.method === 'POST' && req.url.startsWith('/invoices')) {
      const blocked = (conditions.failForCustomer || []).map(String);
      const customerId = String((req.body || {}).customerId);

      // Failure scenario, driven by the flow's mimic conditions
      if (blocked.includes(customerId)) {
        return res.json({
          error: {
            code: 'CUSTOMER_BLOCKED',
            message: `Customer ${customerId} is blocked and cannot be invoiced`
          }
        });
      }

      // Happy path: pretend the invoice was created
      return res.json({
        invoiceId: '{{ uuid }}',
        status: 'created',
        customerId: (req.body || {}).customerId,
        amount: (req.body || {}).amount
      });
    }

    if (req.method === 'GET' && req.url.startsWith('/invoices/')) {
      return res.json({
        invoiceId: req.url.split('/').pop(),
        status: 'paid'
      });
    }

    // Default response for anything else
    res.json({ ok: true });
  });
};

module.exports.stop = () => Promise.resolve();
