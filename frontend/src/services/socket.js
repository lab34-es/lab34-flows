import { io } from 'socket.io-client';
import { API_BASE_URL } from './api';

// Single shared Socket.IO connection to the API server.
// The server streams flow execution progress through it
// ("flowexecution:update" events).
let socket = null;

export const getSocket = () => {
  if (!socket) {
    // An empty base URL means "same origin" (production build served by the API)
    socket = API_BASE_URL ? io(API_BASE_URL) : io();
  }
  return socket;
};

export const FLOW_EXECUTION_EVENT = 'flowexecution:update';
