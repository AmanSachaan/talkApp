const express = require('express');
const http = require('http');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const socketIO = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

app.use(express.static(__dirname));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

let waitingUsers = [];
const pairs = new Map();         // socket.id → peer socket.id
const userIds = new Map();       // socket.id → userId
const history = new Map();       // userId → [previousUserIds]

io.on('connection', socket => {
  const userId = uuidv4();
  userIds.set(socket.id, userId);
  socket.emit('user-id', userId);

  waitingUsers.push(socket);
  tryPairUsers();

  ['offer', 'answer', 'ice-candidate', 'mute', 'unmute'].forEach(event => {
    socket.on(event, data => {
      const peerId = pairs.get(socket.id);
      if (peerId) io.to(peerId).emit(event, data);
    });
  });

  socket.on('disconnect', () => {
    const peerId = pairs.get(socket.id);
    if (peerId) {
      io.to(peerId).emit('peer-disconnected');
      pairs.delete(peerId);
    }
    pairs.delete(socket.id);

    const uid = userIds.get(socket.id);
    userIds.delete(socket.id);
    waitingUsers = waitingUsers.filter(s => s.id !== socket.id);

    if (peerId) {
      const peerSocket = io.sockets.sockets.get(peerId);
      if (peerSocket && peerSocket.connected) {
        waitingUsers.push(peerSocket);
        tryPairUsers();
      }

      const peerUid = userIds.get(peerId);
      if (uid && peerUid) {
        if (!history.has(uid)) history.set(uid, []);
        history.get(uid).push(peerUid);
      }
    }
  });

  socket.on('get-history', () => {
    const uid = userIds.get(socket.id);
    socket.emit('history', history.get(uid) || []);
  });
});

function tryPairUsers() {
  while (waitingUsers.length >= 2) {
    const userA = waitingUsers.shift();
    const userB = waitingUsers.shift();
    pairs.set(userA.id, userB.id);
    pairs.set(userB.id, userA.id);
    const idA = userIds.get(userA.id);
    const idB = userIds.get(userB.id);
    userA.emit('paired', idB);
    userB.emit('paired', idA);
  }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));