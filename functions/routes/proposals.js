const express = require('express');
const router = express.Router();
const { generateProposal } = require('../services/proposalGenerator');
const { generatePDFBuffer } = require('../services/pdfGenerator');

// Generate a proposal and return Word doc or PDF
router.post('/generate', async (req, res) => {
  try {
    // DEBUG: Log the entire request body
    console.log('=== PROPOSAL GENERATE REQUEST ===');
    console.log('Full request body:', JSON.stringify(req.body, null, 2));

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

    // DEBUG: Log extracted format value
    console.log('Extracted format value:', format);
    console.log('Format type:', typeof format);
    console.log('Format === "pdf":', format === 'pdf');
    console.log('Format === "docx":', format === 'docx');
    console.log('Format.toLowerCase():', format ? format.toLowerCase() : 'undefined');

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
    console.log('About to check format condition. Format:', format, 'Will generate:', format === 'pdf' ? 'PDF' : 'DOCX');

    if (format === 'pdf') {
      // Generate PDF
      console.log('Generating PDF...');
      try {
        const pdfBuffer = await generatePDFBuffer(proposalPayload);
        console.log('PDF generated successfully. Buffer size:', pdfBuffer.length);

        // Send PDF as file download
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="Proposal_${customerName}_${new Date().toISOString().split('T')[0]}.pdf"`);
        res.send(pdfBuffer);
      } catch (pdfError) {
        console.error('PDF generation failed:', pdfError);
        throw pdfError;
      }
    } else {
      // Generate Word document (default)
      console.log('Generating Word document (.docx)...');
      try {
        const docBuffer = await generateProposal(proposalPayload);
        console.log('Word document generated successfully. Buffer size:', docBuffer.length);

        // Send Word doc as file download
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename="Proposal_${customerName}_${new Date().toISOString().split('T')[0]}.docx"`);
        res.send(docBuffer);
      } catch (docError) {
        console.error('Word document generation failed:', docError);
        throw docError;
      }
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
