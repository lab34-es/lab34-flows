const express = require('express');
const router = express.Router();

const jira = require('../../helpers/jira');

const sendError = (res, error, status = 400) => {
  const message = (error && error.message) || String(error);
  res.status(status).send({ error: message });
};

// Xray data for the tests a flow points at: /api/jira/tests?keys=BOP-1,BOP-2
// Called by the UI once a flow has been rendered — never during a run.
router.get('/tests', (req, res) => {
  const keys = String(req.query.keys || '')
    .split(',')
    .map(key => key.trim())
    .filter(Boolean);

  jira.getTests(keys)
    .then(result => res.send(result))
    .catch(error => sendError(res, error, 500));
});

module.exports = router;
