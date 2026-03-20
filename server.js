const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// Debug middleware to see all incoming requests
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// MongoDB Connection
const connectDB = async () => {
  try {
    console.log('🔗 Attempting to connect to MongoDB...');
    console.log('📝 Connection string:', process.env.MONGODB_URI ? 'Present' : 'Missing');
    
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000, // 5 second timeout
      socketTimeoutMS: 45000, // 45 second socket timeout
    });
    
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`📊 Database: ${conn.connection.name}`);
    return true;
  } catch (error) {
    console.error('❌ MongoDB connection failed:');
    console.error('   Error:', error.message);
    console.error('   Code:', error.code);
    console.error('   Name:', error.name);
    return false;
  }
};

// Test route - add this before other routes
app.get('/', (req, res) => {
  res.json({ 
    message: 'KaamKhoj API Server is running!',
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'
  });
});

// Health check route
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Server is running',
    database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
    timestamp: new Date().toISOString()
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

// 404 handler for undefined routes - FIXED: Use proper wildcard syntax
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
  console.error('❌ Server Error:', err.stack);
  res.status(500).json({ 
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

const PORT = process.env.PORT || 5000;

// Connect to MongoDB and start server
const startServer = async () => {
  console.log('🚀 Starting KaamKhoj Server...');
  console.log('📍 Environment:', process.env.NODE_ENV || 'development');
  console.log('🔐 JWT Secret:', process.env.JWT_SECRET ? 'Configured' : 'Missing');
  console.log('🗄️  MongoDB URI:', process.env.MONGODB_URI ? 'Configured' : 'Missing');
  
  const dbConnected = await connectDB();
  
  if (dbConnected) {
    app.listen(PORT, () => {
      console.log(`🎯 Server successfully started on port ${PORT}`);
      console.log(`🌐 Base URL: http://localhost:${PORT}`);
      console.log(`❤️  Health check: http://localhost:${PORT}/api/health`);
      console.log(`🏠 Home: http://localhost:${PORT}/`);
      console.log('✅ All routes are now available!');
    });
  } else {
    console.log('❌ Server cannot start without database connection');
    console.log('💡 Please check your MongoDB connection string and network access');
    process.exit(1);
  }
};

// Start the server
startServer();

// MongoDB connection events
mongoose.connection.on('connected', () => {
  console.log('📈 MongoDB connected successfully');
});

mongoose.connection.on('disconnected', () => {
  console.log('⚠️  MongoDB disconnected');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB connection error:', err);
});