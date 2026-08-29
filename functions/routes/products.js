const express = require('express');
const router = express.Router();
const { loadProducts, loadAddOns } = require('../services/pricingDataLoader');

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

// Get add-ons for a specific product type (e.g., 'Mortgage')
router.get('/addons/:type', async (req, res) => {
  try {
    const { type } = req.params;
    console.log(`[products.js] GET /addons/${type}`);

    const addOns = await loadAddOns(type);

    res.json({
      success: true,
      data: addOns,
      type: type
    });
  } catch (error) {
    console.error(`[products.js] Error loading add-ons:`, error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get add-ons for a specific category within a product type
router.get('/addons/:type/category/:category', async (req, res) => {
  try {
    const { type, category } = req.params;
    const decodedCategory = decodeURIComponent(category);
    console.log(`[products.js] GET /addons/${type}/category/${decodedCategory}`);

    const addOns = await loadAddOns(type);

    if (!addOns[decodedCategory]) {
      return res.json({
        success: true,
        data: []
      });
    }

    res.json({
      success: true,
      data: addOns[decodedCategory],
      category: decodedCategory
    });
  } catch (error) {
    console.error(`[products.js] Error loading add-ons by category:`, error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
