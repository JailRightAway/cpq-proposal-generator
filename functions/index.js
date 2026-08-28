const express = require('express');
const cors = require('cors');
const path = require('path');

console.log('Starting CPQ API...');

const app = express();

// Middleware
app.use(cors({ origin: true }));
app.use(express.json());

console.log('Importing routes...');

// Import routes (adjust paths as needed)
let productRoutes, customerRoutes, proposalRoutes;
try {
  productRoutes = require('./routes/products');
  customerRoutes = require('./routes/customers');
  proposalRoutes = require('./routes/proposals');
  console.log('Routes imported successfully');
} catch (e) {
  console.error('Error importing routes:', e.message);
  console.error(e.stack);
}

// Routes
if (productRoutes) app.use('/api/products', productRoutes);
if (customerRoutes) app.use('/api/customers', customerRoutes);
if (proposalRoutes) app.use('/api/proposals', proposalRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'API is running', timestamp: new Date().toISOString() });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({ error: err.message });
});

// For Render (not Firebase Cloud Functions)
const PORT = process.env.PORT || 10000;
const server = app.listen(PORT, () => {
  console.log(`CPQ API running on port ${PORT}`);
});

// Handle startup errors
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  process.exit(1);
});

module.exports = app;
