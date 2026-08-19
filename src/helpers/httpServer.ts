import express from 'express';

import * as replacer from './replacer';

/** A running mimic HTTP server, tracked so it can be reused and stopped. */
interface MimicServer {
  id?: string;
  application: string;
  port: number;
  server: import('node:http').Server;
}

// List of servers with 
// _id: unique id
// port: port number
// server: express server
const servers: MimicServer[] = [];

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

    // Add replacer to res. The mimic replaces express' own json(), so the
    // cast is needed to sidestep its overloaded Send<> signature.
    res.json = ((data) => {
      mimicConfig.flow.reporter.mimicResponse(application, req.url);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      const response = replacer.any(data, req.body);
      mimicConfig.flow.reporter.mimicResponseBody(response);
      res.end(JSON.stringify(response));
    }) as typeof res.json;

    cb(req, res, next);
  });

  // Start the server
  return new Promise((resolve, _reject) => {
    const server = app.listen(port, () => {
      servers.push({ application, port, server });
      // `server` is already the http.Server; the reuse path above hands back
      // the same thing out of the registry
      resolve(server);
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
  return new Promise<void>((resolve, _reject) => {
    server.server.close(() => {
      servers.splice(servers.indexOf(server), 1);
      resolve();
    });
  });
};

export { start };
export { stop };