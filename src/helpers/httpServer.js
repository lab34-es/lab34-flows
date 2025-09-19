const express = require('express');
const highlight = require('cli-highlight').highlight;

const replacer = require('./replacer');

// List of servers with 
// _id: unique id
// port: port number
// server: express server
const servers = [];

const start = (mimicConfig, port, cb) => {
  const { application } = mimicConfig;

  // Check if server already exists for this id and port
  const server = servers.find(s => s.application === application && s.port === port);

  // If server already exists, return
  if (server) {
    return Promise.resolve(server.server);
  }

  // Create a new express server
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use((req, res, next) => {
    mimicConfig.flow.reporter.mimicRequest(application, req.url, {
      method: req.method,
      headers: req.headers,
      body: req.body
    });

    // Add replacer to res.
    res.json = (data) => {
      mimicConfig.flow.reporter.mimicResponse(application, req.url);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      const response = replacer.any(data, req.body);
      mimicConfig.flow.reporter.mimicResponseBody(response);
      res.end(JSON.stringify(response));
    };

    cb(req, res, next);
  });

  // Start the server
  return new Promise((resolve, reject) => {
    const server = app.listen(port, () => {
      servers.push({ application, port, server });
      resolve(server.server);
    });
  });
};

const stop = (id) => {
  // Find the server with the given id
  const server = servers.find(s => s.id === id);

  // If server is not found, return
  if (!server) {
    return Promise.resolve();
  }

  // Stop the server
  return new Promise((resolve, reject) => {
    server.server.close(() => {
      servers.splice(servers.indexOf(server), 1);
      resolve();
    });
  });
};

module.exports.start = start;
module.exports.stop = stop;