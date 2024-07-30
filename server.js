const WebSocket = require('ws');
const express = require('express');
const http = require('http');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const port = 3001;

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Object to store connected peers with unique IDs
let connectedPeers = {};

wss.on('connection', function connection(ws) {
  // Assign a unique ID to the new peer
  const peerId = generateUniqueId();
  connectedPeers[peerId] = ws;
  ws.peerId = peerId;

  ws.on('message', function incoming(message) {
    const data = JSON.parse(message);

    // Handle any incoming messages
    if (data.next === 'video' || data.next === 'audio') {
      connectToNextPeer(ws, data.next);
    } else if (data.offer || data.answer || data.iceCandidate) {
      relayMessage(data, ws.peerId);
    }
  });

  ws.on('close', function () {
    // Remove closed connection from the list
    delete connectedPeers[ws.peerId];
  });
});

// Function to generate a unique ID
function generateUniqueId() {
  return 'peer_' + Math.random().toString(36).substr(2, 9);
}

// Function to handle connecting to the next peer
function connectToNextPeer(currentPeer, type) {
  const peerIds = Object.keys(connectedPeers);
  if (peerIds.length > 1) {
    const currentPeerIndex = peerIds.indexOf(currentPeer.peerId);
    let nextPeerIndex = (currentPeerIndex + 1) % peerIds.length;
    let nextPeer = connectedPeers[peerIds[nextPeerIndex]];

    // Ensure the next peer is not the current peer
    while (nextPeer === currentPeer && peerIds.length > 1) {
      nextPeerIndex = (nextPeerIndex + 1) % peerIds.length;
      nextPeer = connectedPeers[peerIds[nextPeerIndex]];
    }

    if (nextPeer && nextPeer.readyState === WebSocket.OPEN) {
      currentPeer.send(JSON.stringify({ action: 'connect', peerId: nextPeer.peerId, type }));
      nextPeer.send(JSON.stringify({ action: 'connect', peerId: currentPeer.peerId, type }));
    }
  }
}

// Function to relay messages between peers
function relayMessage(data, fromPeerId) {
  const toPeer = connectedPeers[data.to];
  if (toPeer && toPeer.readyState === WebSocket.OPEN) {
    toPeer.send(JSON.stringify({ ...data, from: fromPeerId }));
  }
}

server.listen(port, function () {
  console.log(`Server is running on http://localhost:${port}`);
});
