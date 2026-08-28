const functions = require('firebase-functions');
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

// Middleware
app.use(cors({ origin: true }));
app.use(express.json());

// Import routes (adjust paths as needed for Cloud Functions)
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

// Export as Cloud Function
exports.api = functions.https.onRequest(app);
