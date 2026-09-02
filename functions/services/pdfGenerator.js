const PDFDocument = require('pdfkit');
const { Readable } = require('stream');

function formatCurrency(amount) {
  const numAmount = typeof amount === 'string' ? parseFloat(amount.trim()) : Number(amount) || 0;
  return `$${numAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function groupLineItemsByYear(lineItems) {
  const grouped = {};
  lineItems.forEach(item => {
    const year = item.year || 1;
    if (!grouped[year]) {
      grouped[year] = [];
    }
    grouped[year].push(item);
  });
  return grouped;
}

function groupLineItemsByProduct(lineItems) {
  const grouped = {};
  lineItems.forEach(item => {
    const productName = item.productName || 'Unknown Product';
    if (!grouped[productName]) {
      grouped[productName] = [];
    }
    grouped[productName].push(item);
  });
  return grouped;
}

function calculateTotals(lineItems) {
  const totals = {
    year1: 0,
    year2: 0,
    year3: 0,
    tcv: 0
  };

  lineItems.forEach(item => {
    const year = item.year || 1;
    const setupFee = parseFloat(item.setupFee) || 0;
    const annualFee = parseFloat(item.annualFee) || 0;
    const monthlyCommitment = parseFloat(item.monthlyCommitment) || 0;
    const yearlyFromMonthly = monthlyCommitment * 12;
    const yearTotal = setupFee + annualFee + yearlyFromMonthly;

    if (year === 1) totals.year1 += yearTotal;
    if (year === 2) totals.year2 += yearTotal;
    if (year === 3) totals.year3 += yearTotal;
  });

  totals.tcv = totals.year1 + totals.year2 + totals.year3;
  return totals;
}

function generatePDFBuffer(proposalData) {
  return new Promise((resolve, reject) => {
    try {
      console.log('PDF Generation: Starting with proposal data for customer:', proposalData.customerName);

      const doc = new PDFDocument({
        size: 'A4',
        margin: 40,
        bufferPages: true
      });

      // Collect PDF as buffer
      const chunks = [];
      doc.on('data', (chunk) => {
        chunks.push(chunk);
        console.log('PDF chunk received. Size:', chunk.length);
      });
      doc.on('end', () => {
        const buffer = Buffer.concat(chunks);
        console.log('PDF generation complete. Final buffer size:', buffer.length);
        resolve(buffer);
      });
      doc.on('error', (err) => {
        console.error('PDF document error event:', err);
        reject(err);
      });

      // Title
      doc.fontSize(24).font('Helvetica-Bold').text('PROPOSAL', { align: 'center' });
      doc.moveDown(0.5);

      // Customer Info
      doc.fontSize(10).font('Helvetica');
      doc.text(`Customer: ${proposalData.customerName}`, { underline: false });
      if (proposalData.customerContact) {
        doc.text(`Contact: ${proposalData.customerContact}`);
      }
      if (proposalData.customerEmail) {
        doc.text(`Email: ${proposalData.customerEmail}`);
      }
      if (proposalData.customerPhone) {
        doc.text(`Phone: ${proposalData.customerPhone}`);
      }
      if (proposalData.billingAddress) {
        doc.text(`Address: ${proposalData.billingAddress}`);
      }

      doc.moveDown(1);

      // Generate by product tables
      const byProduct = groupLineItemsByProduct(proposalData.lineItems);
      let firstTable = true;

      for (const [productName, items] of Object.entries(byProduct)) {
        if (!firstTable) {
          doc.moveDown(0.5);
        }
        firstTable = false;

        // Product heading
        doc.fontSize(12).font('Helvetica-Bold').text(productName);
        doc.moveDown(0.3);

        // Table headers
        const tableTop = doc.y;
        const col1 = 40;
        const col2 = 150;
        const col3 = 250;
        const col4 = 350;
        const col5 = 450;

        doc.fontSize(9).font('Helvetica-Bold');
        doc.text('Tier', col1, tableTop);
        doc.text('Year', col2, tableTop);
        doc.text('Setup Fee', col3, tableTop);
        doc.text('Annual Fee', col4, tableTop);
        doc.text('Monthly', col5, tableTop);

        // Underline headers
        doc.lineWidth(0.5);
        doc.moveTo(col1 - 5, tableTop + 15).lineTo(550, tableTop + 15).stroke();

        let tableY = tableTop + 20;

        // Table rows
        doc.font('Helvetica').fontSize(9);
        items.forEach((item) => {
          const tier = item.tier || '-';
          const year = item.year || 1;
          const setupFee = formatCurrency(item.setupFee || 0);
          const annualFee = formatCurrency(item.annualFee || 0);
          const monthly = formatCurrency(item.monthlyCommitment || 0);

          if (tableY > 700) {
            doc.addPage();
            tableY = 40;
          }

          doc.text(String(tier).substring(0, 15), col1, tableY);
          doc.text(String(year), col2, tableY);
          doc.text(setupFee, col3, tableY);
          doc.text(annualFee, col4, tableY);
          doc.text(monthly, col5, tableY);

          tableY += 20;
        });
      }

      // Summary section
      doc.moveDown(1);
      doc.fontSize(11).font('Helvetica-Bold').text('SUMMARY');
      doc.moveDown(0.3);

      const totals = calculateTotals(proposalData.lineItems);
      doc.fontSize(10).font('Helvetica');
      doc.text(`Year 1: ${formatCurrency(totals.year1)}`);
      doc.text(`Year 2: ${formatCurrency(totals.year2)}`);
      doc.text(`Year 3: ${formatCurrency(totals.year3)}`);

      doc.moveDown(0.3);
      doc.font('Helvetica-Bold');
      doc.text(`Total Contract Value: ${formatCurrency(totals.tcv)}`);

      if (proposalData.discountAmount) {
        doc.moveDown(0.2);
        doc.font('Helvetica');
        doc.text(`Discount: -${formatCurrency(proposalData.discountAmount)}`);
      } else if (proposalData.discountPercentage) {
        doc.moveDown(0.2);
        doc.font('Helvetica');
        doc.text(`Discount: ${proposalData.discountPercentage}%`);
      }

      // Footer
      doc.moveDown(2);
      doc.fontSize(8).font('Helvetica');
      const generatedDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      doc.text(`Generated: ${generatedDate}`, { align: 'center', color: '#999999' });

      // Finalize PDF
      console.log('PDF Generation: Calling doc.end()');
      doc.end();
    } catch (error) {
      console.error('PDF Generation: Caught error during PDF creation:', error);
      reject(error);
    }
  });
}

module.exports = {
  generatePDFBuffer
};
