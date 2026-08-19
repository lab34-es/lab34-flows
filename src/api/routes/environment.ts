import express from 'express';
const router = express.Router();

import * as apps from '../../helpers/applications';

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

export default router;
