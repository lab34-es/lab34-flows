const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const http = require('http');

const app = express();
const server = http.createServer(app);
const defineRoutes = require('./routes');
const ioHelper = require('../helpers/io');

// Initialize Socket.IO with the server
const socketIO = ioHelper.io(server);
app.set('io', socketIO);

module.exports.start = () => {
  app.use(cors());
  app.use(bodyParser.json());

  app.use((req, res, next) => {
    console.log('Request received', req.url);
    next();
  });
  defineRoutes(app);

  // API error reporter
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).send('Something broke!');
  });

  server.listen(3001, () => {
    console.log('Server is running on port 3001');
  });
}

module.exports.stop = () => {
  server.close(() => {
    console.log('Server stopped');
  });
}