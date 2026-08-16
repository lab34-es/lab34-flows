import { io } from 'socket.io-client';

// When VITE_API_URL is set (dev), connect to the API server directly.
// Otherwise connect to the same origin (built frontend served by the API).
const API_BASE_URL = import.meta.env.VITE_API_URL || undefined;

export const socket = API_BASE_URL ? io(API_BASE_URL) : io();
