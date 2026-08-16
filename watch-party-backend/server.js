require("dotenv").config();
const express = require("express");
const { ExpressPeerServer } = require("peer");
const cors = require("cors");

const app = express();

// Enable CORS for all requests
app.use(cors());

// Use the port provided by Render, or 9000 for local testing
const PORT = process.env.PORT || 9000;

// API endpoint to serve secure TURN credentials
app.get("/api/turn-credentials", (req, res) => {
  res.json({
    iceServers: [
      {
        urls: process.env.TURN_URL,
        username: process.env.TURN_USERNAME,
        credential: process.env.TURN_PASSWORD,
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