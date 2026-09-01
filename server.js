const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Disable caching for all responses
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

app.use(express.static('public', {
  setHeaders: (res, path) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
  }
}));

// Import routes
const productRoutes = require('./routes/products');
const customerRoutes = require('./routes/customers');
const proposalRoutes = require('./routes/proposals');

// Routes
app.use('/api/products', productRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/proposals', proposalRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'API is running', timestamp: new Date().toISOString() });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({ error: err.message });
});

// Start server
app.listen(PORT, () => {
  console.log(`CPQ Proposal Generator API running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
