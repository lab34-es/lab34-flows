const { Server } = require('socket.io');

const io = (server) => new Server(server, {
  cors: {
    // Local-only tool: reflect the request origin so both the Vite dev
    // server (any port) and the built UI served by the API can connect.
    origin: true,
    methods: ['GET', 'POST']
  }
});

module.exports.io = io;