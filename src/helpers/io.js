const { Server } = require('socket.io');

// This is a local-only tool: reflect any origin so the UI works both from
// the Vite dev server (http://localhost:3000) and the built frontend served
// by the API itself (http://localhost:3001).
const io = (server) => new Server(server, {
  cors: {
    origin: true,
    methods: ['GET', 'POST']
  }
});

module.exports.io = io;
