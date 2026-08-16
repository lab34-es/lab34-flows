const express = require('express');
const router = express.Router();

const packageJson = require('../../../package.json');
const paths = require('../../helpers/paths');

// Basic information about the running instance, used by the UI shell
router.get('/', (req, res) => {
  paths.contextDir([])
    .then(contextDir => {
      res.json({
        name: packageJson.name,
        version: packageJson.version,
        contextDir
      });
    })
    .catch(error => res.status(500).json({ error: error.message || error }));
});

module.exports = router;
