const express = require('express');
const router = express.Router();

const packageJson = require('../../../package.json');
const apps = require('../../helpers/applications');
const paths = require('../../helpers/paths');

router.get('/', (req, res) => {

  return Promise.all([
    apps.allPossibleEnvironments()
  ])
  .then(async ([environments]) => {
    res.send({
      version: packageJson.version,
      environments
    });
  });
});

module.exports = router;