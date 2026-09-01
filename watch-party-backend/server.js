require("dotenv").config();
const express = require("express");
const { ExpressPeerServer } = require("peer");
const cors = require("cors");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const User = require('./models/User'); 
const app = express();

app.use(cors());
app.use(express.json()); 

const PORT = process.env.PORT || 9000;
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB successfully'))
  .catch((err) => console.error('❌ MongoDB connection error:', err));

app.get("/api/turn-credentials", (req, res) => {
  const username = process.env.TURN_USERNAME;
  const credential = process.env.TURN_CREDENTIAL;
  const turnIp = process.env.TURN_IP;

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

app.post('/api/register', async (req, res) => {
    try {
        const { name, username, emailOrMobile, password } = req.body;

        const existingUser = await User.findOne({ 
            $or: [{ emailOrMobile }, { username }] 
        });

        if (existingUser) {
            return res.status(400).json({ message: 'Username or Email/Mobile already exists' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = new User({
            name,
            username,
            emailOrMobile,
            password: hashedPassword
        });

        await newUser.save();
        res.status(201).json({ message: 'User registered successfully' });

    } catch (error) {
        console.error("Registration Error:", error);
        res.status(500).json({ message: 'Server error during registration' });
    }
});

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: "Invalid or expired token" });
    }
    req.user = user;
    next();
  });
};

app.get('/api/verify', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) {
        return res.status(404).json({ valid: false, message: "User not found" });
    }
    res.status(200).json({ 
      valid: true, 
      user 
    });
  } catch (error) {
    console.error("Verification error:", error);
    res.status(500).json({ valid: false, message: "Server error" });
  }
});

app.post('/api/login', async (req, res) => {
    try {
        const { emailOrMobile, password } = req.body;

        const user = await User.findOne({ emailOrMobile });
        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { userId: user._id, username: user.username }, 
            process.env.JWT_SECRET, 
            { expiresIn: '24h' }
        );

        res.json({ token, message: 'Logged in successfully' });

    } catch (error) {
        console.error("Login Error:", error);
        res.status(500).json({ message: 'Server error during login' });
    }
});

app.get("/health", (req, res) => {
  res.status(200).send("PeerJS Server & API are healthy and running!");
});

const server = app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});

const peerServer = ExpressPeerServer(server, {
  debug: true,
  path: "/myapp", 
});

app.use("/", peerServer);