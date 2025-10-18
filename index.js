// index.js

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Serve the static HTML file (Frontend)
app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ----------------------------------------------------------------
// Stranger Connect Logic
// ----------------------------------------------------------------

// Array to hold clients waiting for a match
const waitingClients = [];
// Map to store connected pairs: { client1_socket: client2_socket, client2_socket: client1_socket }
const pairs = new Map();

/**
 * Finds a waiting client and connects them, or adds the client to the waiting list.
 * @param {WebSocket} ws - The connecting client's WebSocket
 */
function attemptToPair(ws) {
    if (waitingClients.length > 0) {
        // Match found!
        const partner = waitingClients.shift(); // Get the oldest waiting client
        
        // Ensure the partner is still open and not already paired
        if (partner.readyState === WebSocket.OPEN && !pairs.has(partner)) {
            pairs.set(ws, partner);
            pairs.set(partner, ws);
            
            // Notify both clients of the connection
            ws.send(JSON.stringify({ type: 'STATUS', message: 'Connected! Say hello.' }));
            partner.send(JSON.stringify({ type: 'STATUS', message: 'Connected! Say hello.' }));
            console.log('New pair established.');
            return;
        }
        // If the old waiting client was invalid, re-try pairing for the current client
        attemptToPair(ws); 
    } else {
        // No one is waiting, so this client waits.
        waitingClients.push(ws);
        ws.send(JSON.stringify({ type: 'STATUS', message: 'Waiting for a stranger to connect...' }));
        console.log('Client waiting for a partner.');
    }
}

/**
 * Disconnects a client from their current partner.
 * @param {WebSocket} ws - The client's WebSocket to disconnect
 */
function disconnectPair(ws) {
    const partner = pairs.get(ws);

    if (partner) {
        // 1. Notify the partner
        if (partner.readyState === WebSocket.OPEN) {
            partner.send(JSON.stringify({ type: 'DISCONNECTED', message: 'Your partner disconnected.' }));
        }

        // 2. Clear both entries from the pairs map
        pairs.delete(ws);
        pairs.delete(partner);
        console.log('Pair disconnected.');
    }
}

/**
 * Handles cleanup when a client completely closes their socket (e.g., closes the browser).
 * @param {WebSocket} ws - The closing client's WebSocket
 */
function cleanupClient(ws) {
    // 1. Remove from waiting list if they were waiting
    const index = waitingClients.indexOf(ws);
    if (index !== -1) {
        waitingClients.splice(index, 1);
        console.log('Removed client from waiting list.');
    }
    
    // 2. Disconnect from partner if they were paired
    disconnectPair(ws);
}

// WebSocket connection handler
wss.on('connection', function connection(ws) {
    console.log('New client connected.');
    
    // Attempt to pair the client immediately upon connection
    attemptToPair(ws);

    // Handle messages from client
    ws.on('message', function incoming(message) {
        let data;
        try {
            data = JSON.parse(message);
        } catch (e) {
            return; // Ignore invalid JSON
        }

        switch (data.type) {
            case 'CONNECT':
                // Request to connect (or reconnect)
                cleanupClient(ws); // Ensure they aren't paired or waiting
                attemptToPair(ws);
                break;
            case 'DISCONNECT':
                // Request to disconnect from the current partner
                disconnectPair(ws);
                // After disconnecting, automatically put them in the waiting list for a new connection
                attemptToPair(ws); 
                break;
            case 'CHAT':
                // Forward the chat message to the partner
                const partner = pairs.get(ws);
                if (partner && partner.readyState === WebSocket.OPEN) {
                    partner.send(JSON.stringify({ type: 'CHAT', message: data.message }));
                }
                break;
            default:
                break;
        }
    });

    // Handle client closing connection (browser tab closed, etc.)
    ws.on('close', function close() {
        console.log('Client disconnected.');
        cleanupClient(ws);
    });

    // Handle connection errors
    ws.on('error', (err) => {
        console.error('WebSocket error:', err.message);
        cleanupClient(ws); // Clean up on error as well
    });
});

// Start the HTTP server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`WebSocket Server running on ws://localhost:${PORT}`);
});