const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true
  }
});
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// MongoDB Connection
const connectDB = async () => {
  try {
    console.log('🔗 Attempting to connect to MongoDB...');
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return true;
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    return false;
  }
};

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);
  const token = socket.handshake.auth.token;
  if (token) {
    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.userId;
      socket.userType = decoded.userType;
      console.log(`User ${decoded.userId} connected via socket`);
    } catch (error) {
      console.error('Socket auth error:', error);
    }
  }

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
  if (socket.userId) {
    socket.join(`user_${socket.userId}`);
  }
});
app.set('io', io);
app.get('/', (req, res) => {
  res.json({ 
    message: 'HamroFreelance API Server is running!',
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
    socket: 'Socket.io server is running'
  });
});



// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/jobs', require('./routes/jobs'));
app.use('/api/users', require('./routes/users'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/reviews', require('./routes/reviews'));
app.use('/api/freelancers', require('./routes/freelancers'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/proposals', require('./routes/proposal')); // Make sure this route exists

// 404 handler
app.use((req, res, next) => {
  res.status(404).json({ 
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method,
    message: 'The requested endpoint does not exist'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(' Server Error:', err.stack);
  res.status(500).json({ 
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

const PORT = process.env.PORT || 5000;

// Start server
const startServer = async () => {
  console.log('Starting KaamKhoj Server...');
  console.log('Environment:', process.env.NODE_ENV || 'development');
  
  const dbConnected = await connectDB();
  
  if (dbConnected) {
    server.listen(PORT, () => {
      console.log(`Server successfully started on port ${PORT}`);
    });
  } else {
    console.log('Server cannot start without database connection');
    process.exit(1);
  }
};

startServer();

// MongoDB connection events
mongoose.connection.on('connected', () => {
  console.log('MongoDB connected successfully');
});

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected');
});

mongoose.connection.on('error', (err) => {
  console.error(' MongoDB connection error:', err);
});