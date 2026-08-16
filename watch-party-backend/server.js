require("dotenv").config();
const express = require("express");
const { ExpressPeerServer } = require("peer");
const cors = require("cors");

const app = express();

// Enable CORS for all requests
app.use(cors());

const PORT = process.env.PORT || 9000;

// API endpoint to serve secure TURN credentials using environment variables
app.get("/api/turn-credentials", (req, res) => {
  const username = process.env.TURN_USERNAME;
  const credential = process.env.TURN_CREDENTIAL;
  const turnIp = process.env.TURN_IP;

  res.json({
    iceServers: [
      // Google STUN fallback for quick local connections
      { urls: "stun:stun.l.google.com:19302" },
      
      // Custom Azure Coturn Server (STUN / Base TURN)
      { 
        urls: `turn:${turnIp}:3478`, 
        username: username, 
        credential: credential 
      },
      
      // Custom Azure Coturn Server (UDP Transport)
      { 
        urls: `turn:${turnIp}:3478?transport=udp`, 
        username: username, 
        credential: credential 
      },
      
      // Custom Azure Coturn Server (TCP Transport to bypass strict firewalls)
      { 
        urls: `turn:${turnIp}:3478?transport=tcp`, 
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