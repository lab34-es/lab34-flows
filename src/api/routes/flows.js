const express = require('express');
const router = express.Router();

const flows = require('../../helpers/flows');

router.get('/', (req, res) => {
  flows.list()
    .then(list => res.send(list))
    .catch(error => res.status(500).send({ error: error.message || error }));
});

// Create a new flow file (inside the flows directory of the current context)
router.post('/', (req, res) => {
  flows.create(req.body)
    .then(flow => res.status(201).send(flow))
    .catch(error => res.status(400).send({ error: error.message || error }));
});

router.post('/create/ai', (req, res) => {
  flows.createAI(req.body)
    .then(flow => res.send(flow))
    .catch(error => res.status(500).send({ error: error.message || error }));
});

router.post('/start', (req, res) => {
  flows.start(req.body, {
    io: req.app.get('io')
  })
    .then(flow => {
      res.send({ execution: flow.execution });
    })
    .catch(error => {
      const message = (error && error.message) || error;
      const status = /already in progress/i.test(String(message)) ? 409 : 400;
      res.status(status).send({ error: message });
    });
});

router.get('/user', (req, res) => {
  const path = req.query.path;
  flows.getUserFlow(path)
    .then(flow => res.send(flow))
    .catch(error => res.status(404).send({ error: error.message || error }));
});

// Save (overwrite) an existing flow file
router.put('/user', (req, res) => {
  const { path, content } = req.body;
  flows.saveUserFlow(path, content)
    .then(flow => res.send(flow))
    .catch(error => res.status(400).send({ error: error.message || error }));
});

module.exports = router;
