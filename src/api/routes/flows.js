const express = require('express');
const router = express.Router();

const apps = require('../../helpers/applications');
const flows = require('../../helpers/flows');

router.get('/', (req, res) => {
  flows.list()
    .then(list => res.send(list));
});

router.post('/create/ai', (req, res) => {
  flows.createAI(req.body)
    .then(flow => res.send(flow));
});

router.post('/start', (req, res) => {
  flows.start(req.body, {
    io: req.app.get('io')
  })
    .then(flow => {
      res.send({ execution: flow.execution });
    });
});

router.get('/user', (req, res) => {
  const path = req.query.path;
  flows.getUserFlow(path)
    .then(flow => res.send(flow))
    .catch(error => res.status(404).send({ error: error.message || error }));
});

router.post('/user/:application', (req, res) => {
  const path = req.query.path;
  flows.getUserFlow(path)
    .then(flow => res.send(flow));
});

module.exports = router;
