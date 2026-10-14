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

// Student Routes Register Karo
app.use('/api/students', require('./routes/studentRoutes'));

const PORT = process.env.PORT || 5000;

// MongoDB Connection check
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('MongoDB Connected Successfully! ✅');
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('MongoDB Connection Error ❌:', err.message);
  });