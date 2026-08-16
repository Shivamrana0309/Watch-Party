require("dotenv").config();
const express = require("express");
const { ExpressPeerServer } = require("peer");
const cors = require("cors");

const app = express();
app.use(cors());
const PORT = process.env.PORT || 9000;

app.get("/api/turn-credentials", (req, res) => {
  res.json({
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      
      // Metered STUN
      { urls: "stun:stun.relay.metered.ca:80" },
      
      // Metered TURN Servers (Testing all ports and protocols)
      { urls: "turn:global.relay.metered.ca:80", username, credential },
      { urls: "turn:global.relay.metered.ca:80?transport=tcp", username, credential },
      { urls: "turn:global.relay.metered.ca:443", username, credential },
      { urls: "turns:global.relay.metered.ca:443?transport=tcp", username, credential },
    ],
  });
});

const server = app.listen(PORT, () => {
  console.log(`✅ Signaling Server running on port ${PORT}`);
});

const peerServer = ExpressPeerServer(server, {
  debug: true,
  path: "/myapp", 
});

app.use("/", peerServer);

app.get("/health", (req, res) => {
  res.status(200).send("PeerJS Server is healthy and running!");
});