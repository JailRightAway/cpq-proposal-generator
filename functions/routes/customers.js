const express = require('express');
const router = express.Router();
const { searchSalesforceAccount, getSalesforceConfig } = require('../services/salesforceService');

// Salesforce OAuth config endpoint
router.get('/salesforce/config', (req, res) => {
  try {
    const config = getSalesforceConfig();
    res.json({
      success: true,
      configured: config.isConfigured,
      message: config.isConfigured ? 'Salesforce is configured' : 'Salesforce credentials not configured - please add to .env'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Search for customer accounts in Salesforce
router.post('/search', async (req, res) => {
  try {
    const { query } = req.body;

    if (!query) {
      return res.status(400).json({ success: false, error: 'Search query required' });
    }

    const results = await searchSalesforceAccount(query);

    res.json({
      success: true,
      count: results.length,
      data: results
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      hint: 'Make sure Salesforce credentials are configured in .env file'
    });
  }
});

// Get account details by ID
router.get('/:accountId', async (req, res) => {
  try {
    const { accountId } = req.params;

    if (!accountId) {
      return res.status(400).json({ success: false, error: 'Account ID required' });
    }

    // In a real implementation, this would fetch from Salesforce
    // For now, return placeholder
    res.json({
      success: true,
      data: {
        id: accountId,
        name: 'Customer Name',
        billingAddress: {
          street: '123 Main St',
          city: 'San Francisco',
          state: 'CA',
          postalCode: '94105',
          country: 'USA'
        },
        note: 'Salesforce integration requires credentials in .env'
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
