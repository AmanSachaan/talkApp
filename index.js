const express = require('express');
const http = require('http');
const path = require('path');
const socketIO = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// Serve static files (index.html, socket.io client, etc.)
app.use(express.static(__dirname));

// Serve the main HTML
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Peer pairing logic
let waitingSocket = null;

io.on('connection', socket => {
  console.log('User connected:', socket.id);

  if (waitingSocket && waitingSocket.connected) {
    // Pair with waiting user
    setupPeerEvents(socket, waitingSocket);
    setupPeerEvents(waitingSocket, socket);
    waitingSocket = null;
  } else {
    waitingSocket = socket;
  }

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    if (waitingSocket === socket) {
      waitingSocket = null;
    }
  });
});

// Relay signaling messages between paired sockets
function setupPeerEvents(sender, receiver) {
  sender.on('offer', data => {
    receiver.emit('offer', data);
  });
  sender.on('answer', data => {
    receiver.emit('answer', data);
  });
  sender.on('ice-candidate', data => {
    receiver.emit('ice-candidate', data);
  });
}

// Use dynamic port for Render
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));