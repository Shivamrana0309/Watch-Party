require("dotenv").config();
const express = require("express");
const { ExpressPeerServer } = require("peer");
const cors = require("cors");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');

const User = require('./models/User'); 
const app = express();


const allowedOrigins = [
  'http://localhost:5173', // Local frontend development
  'https://watch-party-opal-pi.vercel.app' // Production frontend deployment
];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    // or if the origin is in our allowed list
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true, // Crucial if your app uses cookies, sessions, or specific Authorization headers
  optionsSuccessStatus: 200 // Some legacy browsers choke on 204
};

app.use(cors(corsOptions));

// app.use(cors());
app.use(express.json()); 

const PORT = process.env.PORT || 9000;
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB successfully'))
  .catch((err) => console.error('❌ MongoDB connection error:', err));

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

app.get("/api/turn-credentials", authenticateToken, (req, res) => {
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

// CRITICAL for Render deployments: Trust the first proxy to get the real client IP
app.set('trust proxy', 1);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: { message: "Too many attempts from this IP, please try again after 15 minutes" },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/login', authLimiter);
app.use('/api/register', authLimiter);


app.post('/api/register', [
    // 1. Validate and sanitize inputs
    body('name')
        .trim()
        .isLength({ min: 2, max: 50 }).withMessage('Name must be between 2 and 50 characters')
        .escape(), // Converts HTML tags to safe characters (e.g., < to &lt;)
    
    body('username')
        .trim()
        .isLength({ min: 3, max: 30 }).withMessage('Username must be between 3 and 30 characters')
        .isAlphanumeric().withMessage('Username must only contain letters and numbers')
        .escape(),
    
    body('emailOrMobile')
        .trim()
        .notEmpty().withMessage('Email or Mobile is required')
        // Note: If you accept BOTH email and mobile, you might need custom logic here, 
        // but typically you'd enforce a valid email format if it includes an '@'
        .escape(),
    
    body('password')
        .isLength({ min: 8 }).withMessage('Password must be at least 8 characters long')
        // Do NOT trim or escape passwords! Users might intentionally use spaces or special characters like '<'
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

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


app.get('/api/verify', authenticateToken, async (req, res) => {
  try {
    const timeLeft = req.user.exp - Math.floor(Date.now() / 1000);
    let newToken = undefined;

    // If it's a guest token, just return it without a database check
    if (req.user.role === 'guest') {
        if (timeLeft < 900) { // Less than 15 minutes remaining
            newToken = jwt.sign(
                { userId: 'guest_id', username: req.user.username, role: 'guest' },
                process.env.JWT_SECRET,
                { expiresIn: '1h' }
            );
        }
        return res.status(200).json({
            valid: true,
            user: req.user,
            ...(newToken && { newToken })
        });
    }

    const user = await User.findById(req.user.userId).select('-password');
    if (!user) {
        return res.status(404).json({ valid: false, message: "User not found" });
    }

    if (timeLeft < 7200) { // Less than 2 hours remaining
        newToken = jwt.sign(
            { userId: user._id, username: user.username }, 
            process.env.JWT_SECRET, 
            { expiresIn: '24h' }
        );
    }

    res.status(200).json({ 
      valid: true, 
      user,
      ...(newToken && { newToken })
    });
  } catch (error) {
    console.error("Verification error:", error);
    res.status(500).json({ valid: false, message: "Server error" });
  }
});

app.post('/api/login', [
    body('emailOrMobile').trim().notEmpty().escape(),
    body('password').notEmpty()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

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

app.post('/api/guest-login', (req, res) => {
    try {
        const generatedUsername = `Guest_${Math.floor(Math.random() * 10000)}`;
        
        const token = jwt.sign(
            { userId: 'guest_id', username: generatedUsername, role: 'guest' }, 
            process.env.JWT_SECRET, 
            { expiresIn: '1h' }
        );

        res.status(200).json({ 
            message: 'Guest logged in successfully',
            token,
            user: { userId: 'guest_id', username: generatedUsername, role: 'guest' }
        });
    } catch (error) {
        console.error("Guest Login Error:", error);
        res.status(500).json({ message: 'Server error during guest login' });
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