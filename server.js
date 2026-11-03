require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Main Root Route
app.get('/', (req, res) => {
  res.send('Student Management API is running!');
});

// Student and Assistant Routes
app.use('/api/students', require('./routes/studentRoutes'));
app.use('/api/assistant', require('./routes/assistantRoutes'));

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

// MongoDB Connection
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

if (MONGO_URI) {
  mongoose.connect(MONGO_URI)
    .then(() => {
      console.log('MongoDB Connected Successfully! ✅');
    })
    .catch((err) => {
      console.error('MongoDB Connection Error ❌:', err.message);
    });
} else {
  console.warn('⚠️ MONGO_URI is not set in environment variables');
}

module.exports = app;
