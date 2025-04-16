const express = require('express');
const router = express.Router();

const apps = require('../../helpers/applications');

router.get('/', (req, res) => {
  apps.parseApplications()
    .then(list => {
      res.send(list)
    })
});

router.get('/:application', (req, res) => {
  const application = req.params.application;

  apps.parseApplications()
    .then(list => {
      const app = list.find(app => app.slug === application);
      res.send(app)
    });
});

router.get('/:application/envs', (req, res) => {
  const application = req.params.application;

  apps.parseApplications()
    .then(list => {
      const app = list.find(app => app.slug === application);
      res.send(app.envFiles)
    });
});

router.get('/:application/envs/:env', (req, res) => {
  const application = req.params.application;
  const env = req.params.env;

  apps.parseApplications()
    .then(list => {
      const app = list.find(app => app.slug === application);
      const envFile = app.envFiles.find(envFile => envFile.name === env);
      res.send(envFile)
    });
});

module.exports = router;