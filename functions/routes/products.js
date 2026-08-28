const express = require('express');
const router = express.Router();
const { loadProducts } = require('../services/pricingDataLoader');

// Get all products organized by type
router.get('/', async (req, res) => {
  try {
    const productsByType = await loadProducts();
    res.json({
      success: true,
      data: productsByType
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get products for a specific type
router.get('/type/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const productsByType = await loadProducts();

    if (!productsByType[type]) {
      return res.json({
        success: true,
        data: []
      });
    }

    res.json({
      success: true,
      data: productsByType[type]
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get unique product types
router.get('/types/list', async (req, res) => {
  try {
    const productsByType = await loadProducts();
    const types = Object.keys(productsByType).sort();

    res.json({
      success: true,
      data: types
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
