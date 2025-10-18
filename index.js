const express = require('express');
const http = require('http');
const path = require('path');
const socketIO = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

app.use(express.static(__dirname));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

let waitingSocket = null;
const pairs = new Map();

io.on('connection', socket => {
  console.log('User connected:', socket.id);

  // Pair with waiting user or wait
  if (waitingSocket && waitingSocket.connected) {
    pairs.set(socket.id, waitingSocket.id);
    pairs.set(waitingSocket.id, socket.id);
    console.log(`Paired ${socket.id} with ${waitingSocket.id}`);
    waitingSocket = null;
  } else {
    waitingSocket = socket;
  }

  // Relay signaling messages
  ['offer', 'answer', 'ice-candidate'].forEach(event => {
    socket.on(event, data => {
      const peerId = pairs.get(socket.id);
      if (peerId) io.to(peerId).emit(event, data);
    });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    const peerId = pairs.get(socket.id);
    if (peerId) {
      io.to(peerId).emit('peer-disconnected');
      pairs.delete(peerId);
    }
    pairs.delete(socket.id);
    if (waitingSocket === socket) {
      waitingSocket = null;
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));