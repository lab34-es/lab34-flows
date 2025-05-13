const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const paths = require('../../helpers/paths');
const configHelper = require('../../helpers/config');

// Path to the AI configuration file
let configFilePath;

// Get the current AI configuration
router.get('/ai', async (req, res) => {
  try {
    const config = await configHelper.load('ai');
    
    // Don't send the API key directly to the client for security
    const safeConfig = { ...config };
    if (safeConfig.openai && safeConfig.openai.apiKey) {
      // Replace with a placeholder if key exists
      safeConfig.openai.apiKey = safeConfig.openai.apiKey ? '********' : '';
    }
    
    res.json(safeConfig);
  } catch (error) {
    console.error('Error reading AI configuration:', error);
    res.status(500).json({ error: 'Failed to retrieve AI configuration' });
  }
});

// Save AI configuration
router.post('/ai', async (req, res) => {
  try {
    const newConfig = req.body;
    
    // Validate required fields
    if (!newConfig.defaultProvider) {
      return res.status(400).json({ error: 'Default provider is required' });
    }
    
    // Load existing config to preserve API key if not provided
    let existingConfig = await configHelper.load('ai');
    
    // Preserve API key if masked
    if (newConfig.openai && newConfig.openai.apiKey === '********' && existingConfig.openai) {
      newConfig.openai.apiKey = existingConfig.openai.apiKey;
    }
    
    // Write the updated config
    await configHelper.save('ai', newConfig);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving AI configuration:', error);
    res.status(500).json({ error: 'Failed to save AI configuration' });
  }
});

module.exports = router;
