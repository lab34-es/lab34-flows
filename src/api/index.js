const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const http = require('http');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const defineRoutes = require('./routes');
const ioHelper = require('../helpers/io');

// Initialize Socket.IO with the server
const socketIO = ioHelper.io(server);
app.set('io', socketIO);

module.exports.start = (options = {}) => {
  // Store context in app locals for access in routes
  if (options.context) {
    app.locals.context = options.context;
    console.log(`Using context directory: ${options.context}`);
  }

  app.use(cors());
  app.use(bodyParser.json());

  app.use((req, res, next) => {
    next();
  });
  
  // Define API routes first
  defineRoutes(app);

  // Serve static files from the built frontend
  const frontendDistPath = path.join(__dirname, '../../frontend/dist');
  if (fs.existsSync(frontendDistPath)) {
    app.use(express.static(frontendDistPath));
    
    // Handle client-side routing - serve index.html for all non-API routes
    app.get('*', (req, res) => {
      // Skip API routes
      if (req.path.startsWith('/api')) {
        return res.status(404).send('API endpoint not found');
      }
      res.sendFile(path.join(frontendDistPath, 'index.html'));
    });
  } else {
    console.warn('Frontend dist folder not found. Run "npm run build:frontend" first.');
  }

  // API error reporter
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).send('Something broke!');
  });

  server.listen(3001, () => {
    console.log('Server is running on port 3001');
    console.log('http://localhost:3001');
  });
}

module.exports.stop = () => {
  server.close(() => {
    console.log('Server stopped');
  });
}
