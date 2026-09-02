const express = require('express');
const router = express.Router();
const { generateProposal } = require('../services/proposalGenerator');
const { generatePDFBuffer } = require('../services/pdfGenerator');

// Generate a proposal and return Word doc or PDF
router.post('/generate', async (req, res) => {
  try {
    const {
      customerName,
      customerContact,
      customerEmail,
      customerPhone,
      billingAddress,
      lineItems,
      discountAmount,
      discountPercentage,
      contractTermYears,
      format = 'docx'  // Default to DOCX if not specified
    } = req.body;

    // Validation
    if (!customerName || !lineItems || !Array.isArray(lineItems) || lineItems.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: customerName, lineItems (array)'
      });
    }

    const proposalPayload = {
      customerName,
      customerContact,
      customerEmail,
      customerPhone,
      billingAddress,
      lineItems,
      discountAmount,
      discountPercentage,
      contractTermYears: contractTermYears || 1
    };

    // Generate based on format
    if (format === 'pdf') {
      // Generate PDF
      const pdfBuffer = await generatePDFBuffer(proposalPayload);
      
      // Send PDF as file download
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="Proposal_${customerName}_${new Date().toISOString().split('T')[0]}.pdf"`);
      res.send(pdfBuffer);
    } else {
      // Generate Word document (default)
      const docBuffer = await generateProposal(proposalPayload);
      
      // Send Word doc as file download
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="Proposal_${customerName}_${new Date().toISOString().split('T')[0]}.docx"`);
      res.send(docBuffer);
    }
  } catch (error) {
    console.error('Proposal generation error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Calculate totals and preview
router.post('/calculate', async (req, res) => {
  try {
    const {
      lineItems,
      discountAmount,
      discountPercentage
    } = req.body;

    if (!lineItems || !Array.isArray(lineItems)) {
      return res.status(400).json({
        success: false,
        error: 'lineItems array required'
      });
    }

    // Calculate totals by year
    const yearTotals = {
      year1: 0,
      year2: 0,
      year3: 0,
      tcv: 0
    };

    const processedItems = lineItems.map(item => {
      const listPrice = (item.oneTimePrice || 0) + (item.annualPrice || 0) + (item.transactionPrice || 0);
      let discount = 0;

      if (discountPercentage) {
        discount = listPrice * (discountPercentage / 100);
      } else if (discountAmount) {
        discount = discountAmount / lineItems.length; // Spread discount
      }

      const sellingPrice = listPrice - discount;

      // Accumulate by year
      if (!item.year || item.year === 1) yearTotals.year1 += sellingPrice;
      if (item.year === 2) yearTotals.year2 += sellingPrice;
      if (item.year === 3) yearTotals.year3 += sellingPrice;

      return {
        ...item,
        listPrice: Math.round(listPrice * 100) / 100,
        discount: Math.round(discount * 100) / 100,
        sellingPrice: Math.round(sellingPrice * 100) / 100
      };
    });

    yearTotals.tcv = yearTotals.year1 + yearTotals.year2 + yearTotals.year3;

    // Round all totals
    Object.keys(yearTotals).forEach(key => {
      yearTotals[key] = Math.round(yearTotals[key] * 100) / 100;
    });

    res.json({
      success: true,
      items: processedItems,
      totals: yearTotals
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
