require("dotenv").config();
const express = require("express");
const { ExpressPeerServer } = require("peer");
const cors = require("cors");

const app = express();

// Enable CORS for all requests
app.use(cors());

const PORT = process.env.PORT || 9000;

// API endpoint to serve secure TURN credentials
app.get("/api/turn-credentials", (req, res) => {
  // Reading the exact keys from your Render environment variables
  const username = process.env.username || process.env.TURN_USERNAME;
  const credential = process.env.credential || process.env.TURN_PASSWORD;

  res.json({
    iceServers: [
      // Google STUN fallback
      { urls: "stun:stun.l.google.com:19302" },
      
      // Metered STUN
      { urls: "stun:stun.relay.metered.ca:80" },
      
      // Metered TURN Servers (using the extracted credentials)
      { 
        urls: "turn:global.relay.metered.ca:80", 
        username: username, 
        credential: credential 
      },
      { 
        urls: "turn:global.relay.metered.ca:80?transport=tcp", 
        username: username, 
        credential: credential 
      },
      { 
        urls: "turn:global.relay.metered.ca:443", 
        username: username, 
        credential: credential 
      },
      { 
        urls: "turns:global.relay.metered.ca:443?transport=tcp", 
        username: username, 
        credential: credential 
      },
    ],
  });
});

const server = app.listen(PORT, () => {
  console.log(`✅ Signaling Server running on port ${PORT}`);
});

// Initialize the PeerJS server
const peerServer = ExpressPeerServer(server, {
  debug: true,
  path: "/myapp", 
});

// Mount the PeerJS server to the root route
app.use("/", peerServer);

// Health check endpoint 
app.get("/health", (req, res) => {
  res.status(200).send("PeerJS Server is healthy and running!");
});