const { Server } = require('socket.io');

const io = (server) => new Server(server, {
  cors: {
    origin: 'http://localhost:4200',
    methods: ['GET', 'POST']
  }
});

module.exports.io = io;