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
  const username = process.env.TURN_USERNAME || "watchparty";
  const credential = process.env.TURN_CREDENTIAL || "SuperSecretPass123";
  const turnIp = process.env.TURN_IP || "20.197.58.178";

  res.json({
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { 
        urls: `turn:${turnIp}:3478`, 
        username: username, 
        credential: credential 
      },
      { 
        urls: `turn:${turnIp}:3478?transport=udp`, 
        username: username, 
        credential: credential 
      },
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