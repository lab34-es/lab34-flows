const { Server } = require('socket.io');

// This is a local-only tool, but the socket streams flow executions
// (requests, responses, environment-derived data), so only the tool's own
// origins may connect — not arbitrary websites doing drive-by requests
// against localhost.
const ALLOWED_ORIGINS = [
  'http://localhost:3000', // Vite dev server
  'http://localhost:3001', // Built frontend served by the API
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001'
];

const io = (server) => new Server(server, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ['GET', 'POST']
  }
});

module.exports.io = io;
module.exports.ALLOWED_ORIGINS = ALLOWED_ORIGINS;
