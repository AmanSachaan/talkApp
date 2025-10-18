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

// Simple peer pairing logic
let waitingSocket = null;

io.on('connection', socket => {
  console.log('User connected:', socket.id);

  if (waitingSocket) {
    // Pair with waiting user
    socket.on('offer', data => {
      waitingSocket.emit('offer', data);
    });
    socket.on('answer', data => {
      waitingSocket.emit('answer', data);
    });
    socket.on('ice-candidate', data => {
      waitingSocket.emit('ice-candidate', data);
    });
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

// Use dynamic port for Render
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));