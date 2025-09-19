const express = require('express');
const router = express.Router();

const apps = require('../../helpers/applications');

// Get all possible environments across all applications
router.get('/all-possible', (req, res) => {
  apps.allPossibleEnvironments()
    .then(environments => {
      res.json(environments);
    })
    .catch(error => {
      console.error('Error fetching all possible environments:', error);
      res.status(500).json({ error: 'Failed to fetch environments' });
    });
});

module.exports = router;
