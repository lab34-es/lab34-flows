const express = require('express');
const router = express.Router();

const ai = require('../../helpers/ai');

const sendError = (res, error, status = 400) => {
  const message = (error && error.message) || String(error);
  res.status(status).send({ error: message });
};

// AI provider settings. API keys are never sent back to the client.
router.get('/ai', (req, res) => {
  ai.getSettings()
    .then(settings => res.send(settings))
    .catch(error => sendError(res, error, 500));
});

// { provider, providers: { <id>: { model, apiKey, host } } }
router.put('/ai', (req, res) => {
  ai.saveSettings(req.body)
    .then(settings => res.send(settings))
    .catch(error => sendError(res, error));
});

// Send a tiny prompt to the provider, to validate model and credentials
router.post('/ai/test', (req, res) => {
  ai.test(req.body && req.body.provider)
    .then(result => res.send({ success: true, ...result }))
    .catch(error => sendError(res, error));
});

// Models available on the provider (Ollama only, for now)
router.get('/ai/models/:provider', (req, res) => {
  ai.listModels(req.params.provider)
    .then(models => res.send({ models }))
    .catch(error => sendError(res, error));
});

module.exports = router;
