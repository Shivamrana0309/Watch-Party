require("dotenv").config();
const express = require("express");
const { ExpressPeerServer } = require("peer");
const cors = require("cors");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

// Import your User model
const User = require('./models/User'); 

const app = express();

// Middleware
app.use(cors());
app.use(express.json()); // CRUCIAL: Allows Express to parse JSON bodies for login/register

const PORT = process.env.PORT || 9000;

// ==========================================
// DATABASE CONNECTION
// ==========================================
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB successfully'))
  .catch((err) => console.error('❌ MongoDB connection error:', err));

// ==========================================
// API ROUTES
// ==========================================

// 1. API endpoint to serve secure TURN credentials
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

// 2. Register User Route
app.post('/api/register', async (req, res) => {
    try {
        const { name, username, emailOrMobile, password } = req.body;

        // Check if user already exists
        const existingUser = await User.findOne({ 
            $or: [{ emailOrMobile }, { username }] 
        });

        if (existingUser) {
            return res.status(400).json({ message: 'Username or Email/Mobile already exists' });
        }

        // Hash the password securely
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create and save new user
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

// --- JWT AUTHENTICATION MIDDLEWARE ---
const authenticateToken = (req, res, next) => {
  // The token comes in the header as "Bearer <token>"
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  // Use your secret key to verify if the token is authentic
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: "Invalid or expired token" });
    }
    // If valid, attach the user data to the request and move on
    req.user = user;
    next();
  });
};

// --- VERIFY SESSION ROUTE ---
app.get('/api/verify', authenticateToken, (req, res) => {
  // If the authenticateToken middleware passes, this code runs.
  // We send back a 200 OK status and the user's details.
  res.status(200).json({ 
    valid: true, 
    user: req.user 
  });
});

// 3. Login User Route
app.post('/api/login', async (req, res) => {
    try {
        const { emailOrMobile, password } = req.body;

        // Find user by email or mobile
        const user = await User.findOne({ emailOrMobile });
        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        // Compare incoming password with stored hashed password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        // Generate JWT Token
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

// 4. Health check endpoint 
app.get("/health", (req, res) => {
  res.status(200).send("PeerJS Server & API are healthy and running!");
});


// ==========================================
// SERVER & PEERJS INITIALIZATION
// ==========================================
const server = app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});

// Initialize the PeerJS server
const peerServer = ExpressPeerServer(server, {
  debug: true,
  path: "/myapp", 
});

// Mount the PeerJS server to the root route (Keep this at the bottom!)
app.use("/", peerServer);