const express = require('express');
const router = express.Router();

const apps = require('../../helpers/applications');
const flows = require('../../helpers/flows');

router.get('/', (req, res) => {
  return Promise.all([
    flows.user()
  ])
    .then(([user]) => {
      res.send({
        user,
      });
    });
});

router.get('/user', (req, res) => {
  flows.user()
    .then(list => res.send(list))
});

router.post('/start', (req, res) => {
  flows.start(req.body, {
    io: req.app.get('io')
  })
    .then(flow => {
        res.send({ execution: flow.execution });
    })
});

router.post('/user/:application', (req, res) => {
  const path = req.query.path;
  flows.getUserFlow(path)
    .then(flow => res.send(flow))
});

module.exports = router;