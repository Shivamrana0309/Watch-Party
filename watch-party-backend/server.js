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
      // 1. First, try free Google STUN servers to bypass basic NATs
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      // 2. If STUN fails, fallback to your TURN server
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

const peerServer = ExpressPeerServer(server, {
  debug: true,
  path: "/myapp", 
});

app.use("/", peerServer);

app.get("/health", (req, res) => {
  res.status(200).send("PeerJS Server is healthy and running!");
});