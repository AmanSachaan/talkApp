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

let waitingUsers = [];
const pairs = new Map();

io.on('connection', socket => {
  console.log('User connected:', socket.id);

  // Add to queue and try to pair
  waitingUsers.push(socket);
  tryPairUsers();

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
    waitingUsers = waitingUsers.filter(s => s.id !== socket.id);
    if (peerId) {
      const peerSocket = io.sockets.sockets.get(peerId);
      if (peerSocket && peerSocket.connected) {
        waitingUsers.push(peerSocket);
        tryPairUsers();
      }
    }
  });
});

function tryPairUsers() {
  while (waitingUsers.length >= 2) {
    const userA = waitingUsers.shift();
    const userB = waitingUsers.shift();
    pairs.set(userA.id, userB.id);
    pairs.set(userB.id, userA.id);
    console.log(`Paired ${userA.id} with ${userB.id}`);
  }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));