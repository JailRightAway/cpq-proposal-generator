const { Document, Packer, Paragraph, Table, TableRow, TableCell, AlignmentType, TextRun, HeadingLevel, WidthType } = require('docx');
const JSZip = require('jszip');
const fs = require('fs');
const path = require('path');

const TEMPLATE_PATH = path.join(__dirname, '..', 'templates', 'proposal-template.docx');

function formatCurrency(amount) {
  const numAmount = typeof amount === 'string' ? parseFloat(amount.trim()) : Number(amount) || 0;
  return `$${numAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getDefaultExpirationDate() {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function createHeaderCell(text) {
  return new TableCell({
    shading: { fill: '004B8E' },
    margins: { top: 80, bottom: 80, left: 80, right: 80 },
    children: [
      new Paragraph({
        text: text,
        bold: true,
        color: 'FFFFFF',
        alignment: AlignmentType.CENTER
      })
    ]
  });
}

function createDataCell(text, centered = false) {
  return new TableCell({
    margins: { top: 80, bottom: 80, left: 80, right: 80 },
    children: [
      new Paragraph({
        text: String(text).trim(),
        alignment: centered ? AlignmentType.CENTER : AlignmentType.LEFT
      })
    ]
  });
}

function groupLineItemsByProduct(lineItems) {
  const grouped = {};
  lineItems.forEach(item => {
    const key = item.productName || item.moduleName || 'Unknown';
    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push(item);
  });
  return grouped;
}

async function generateProposal(proposalData) {
  const lineItems = proposalData.lineItems || [];
  const contractYears = proposalData.contractTermYears || 1;
  const customerName = proposalData.customerName || 'N/A';
  const customerContact = proposalData.customerContact || '';
  const expirationDate = proposalData.expirationDate || getDefaultExpirationDate();
  const yearlyTiers = proposalData.yearlyTiers || {};

  // Check product types
  const hasInsight = lineItems.some(item =>
    (item.productName || item.moduleName || '').toLowerCase().includes('insight')
  );

  // Group line items by product
  const groupedItems = groupLineItemsByProduct(lineItems);
  const primaryServiceSections = [];

  // Create a separate table for each product
  Object.entries(groupedItems).forEach(([productName, items]) => {
    const tableRows = [];
    const isInsight = productName.toLowerCase().includes('insight');
    const hasAnnualFees = items.some(item => (item.annualFee || item.annualPrice) > 0);

    // Build header row based on product type
    const headerCells = [
      createHeaderCell('Service / Module'),
      createHeaderCell('Year')
    ];

    if (isInsight || hasAnnualFees) {
      headerCells.push(createHeaderCell('One-Time Fee'));
      headerCells.push(createHeaderCell('Annual Fee'));
    } else {
      headerCells.push(createHeaderCell('One-Time Fee'));
      headerCells.push(createHeaderCell('Per Transaction'));
      headerCells.push(createHeaderCell('Monthly Minimum'));
    }

    tableRows.push(new TableRow({ children: headerCells }));

    // Data rows for this product
    items.forEach((item) => {
      const dataCells = [
        createDataCell(productName),
        createDataCell(String(item.year || 1), true)
      ];

      const hasAnnualFee = (item.annualFee || item.annualPrice) > 0;

      if (isInsight || hasAnnualFee) {
        // For Insight and annual-fee products (like Access), show annual fee instead of monthly
        dataCells.push(createDataCell(formatCurrency(item.setupFee || item.oneTimePrice || 0), true));
        dataCells.push(createDataCell(formatCurrency(item.annualFee || item.annualPrice || 0), true));
      } else {
        // For volume/transaction-based products, show per-file fee and monthly commitment
        const perFileFee = Number(item.perFileFee) || 0;
        dataCells.push(createDataCell(formatCurrency(item.setupFee || item.oneTimePrice || 0), true));
        // Display perFileFee as plain number (no $) to avoid cell wrapping
        dataCells.push(createDataCell(perFileFee > 0 ? perFileFee.toFixed(2) : 'N/A', true));
        dataCells.push(createDataCell(formatCurrency(item.monthlyCommitment || item.annualPrice || 0), true));
      }

      tableRows.push(new TableRow({ children: dataCells }));
    });

    // Add product heading and table
    primaryServiceSections.push(
      new Paragraph({
        text: productName,
        bold: true,
        size: 22,
        color: '004B8E',
        spacing: { before: 50, after: 50 }
      })
    );

    // Create table with column widths
    const columnCount = isInsight ? 4 : 5;
    const columnWidth = Math.floor(5000 / columnCount); // 5000 twips per column

    primaryServiceSections.push(
      new Table({
        rows: tableRows,
        width: { size: 100, type: WidthType.PERCENT },
        columnWidths: Array(columnCount).fill(columnWidth)
      })
    );

    primaryServiceSections.push(
      new Paragraph({ text: '', spacing: { after: 50 } })
    );
  });

  // Calculate yearly costs for Annual Investment Summary
  let totalSetup = lineItems.reduce((sum, item) => sum + (item.setupFee || item.oneTimePrice || 0), 0);
  let contractTotal = 0;
  const summaryRows = [];

  // Header row
  summaryRows.push(
    new TableRow({
      children: [
        createHeaderCell('Cost Category'),
        createHeaderCell('Amount')
      ]
    })
  );

  for (let year = 1; year <= contractYears; year++) {
    let yearCost = lineItems.reduce((sum, item) => {
      if ((item.year || 1) === year) {
        // Add both monthly commitment (if any) and annual fee (if any)
        const monthlyTotal = (item.monthlyCommitment || 0) * 12;
        const annualTotal = (item.annualFee || item.annualPrice || 0);
        return sum + monthlyTotal + annualTotal;
      }
      return sum;
    }, 0);

    const yearTotal = (year === 1 ? totalSetup : 0) + yearCost;
    contractTotal += yearTotal;

    summaryRows.push(
      new TableRow({
        children: [
          createDataCell(`Year ${year}`),
          createDataCell(formatCurrency(yearTotal), true)
        ]
      })
    );
  }

  // Total row
  summaryRows.push(
    new TableRow({
      children: [
        createDataCell(`Total ${contractYears}-Year Investment`),
        createDataCell(formatCurrency(contractTotal), true)
      ]
    })
  );

  // Build content sections for the proposal body
  const contentSections = [
    new Paragraph({
      text: '',
      bold: true,
      size: 30,
      color: '004B8E',
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 50 }
    }),

    new Paragraph({
      children: [
        new TextRun({ text: 'Prepared For: ', bold: true }),
        new TextRun({
          text: customerContact ? `${customerName} (${customerContact})` : customerName
        })
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 50 }
    }),

    new Paragraph({
      children: [
        new TextRun({ text: 'Date: ', bold: true }),
        new TextRun({ text: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) })
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 50 }
    }),

    new Paragraph({
      children: [
        new TextRun({ text: 'Proposal Expiration: ', bold: true }),
        new TextRun({ text: expirationDate })
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 150 }
    }),

    new Paragraph({
      text: 'Contract Terms',
      heading: HeadingLevel.HEADING_2,
      color: '004B8E',
      spacing: { before: 100, after: 50 }
    }),

    new Paragraph({
      children: [
        new TextRun({ text: 'Initial Term: ', bold: true }),
        new TextRun({ text: `${contractYears} year${contractYears > 1 ? 's' : ''}` })
      ],
      spacing: { after: 100 }
    }),

    new Paragraph({
      text: 'Primary Services',
      heading: HeadingLevel.HEADING_2,
      color: '004B8E',
      spacing: { before: 100, after: 50 }
    }),

    ...primaryServiceSections,

    new Paragraph({
      text: 'Annual Investment Summary',
      heading: HeadingLevel.HEADING_2,
      color: '004B8E',
      spacing: { before: 100, after: 50 }
    }),

    new Table({
      rows: summaryRows,
      width: { size: 100, type: WidthType.PERCENT },
      columnWidths: [2500, 2500]
    }),

    new Paragraph({ text: '' })
  ];

  // Load template and inject content
  try {
    console.log('[wordGenerator] Loading template from:', TEMPLATE_PATH);
    const templateBuffer = fs.readFileSync(TEMPLATE_PATH);
    const zip = new JSZip();
    await zip.loadAsync(templateBuffer);

    // Get document.xml
    const docXmlFile = zip.file('word/document.xml');
    if (!docXmlFile) {
      throw new Error('Template missing word/document.xml');
    }

    let docXml = await docXmlFile.async('string');
    console.log('[wordGenerator] Template loaded, modifying content');

    // Convert sections to docx format and inject
    const tempDoc = new Document({ sections: [{ children: contentSections }] });
    const tempBuffer = await Packer.toBuffer(tempDoc);

    // Extract the body content from temp document
    const tempZip = new JSZip();
    await tempZip.loadAsync(tempBuffer);
    const tempDocXml = await tempZip.file('word/document.xml').async('string');

    // Extract content from temp (excluding section properties to preserve template's header/footer refs)
    const bodyMatch = tempDocXml.match(/<w:body>([\s\S]*?)<w:sectPr[\s\S]*?<\/w:sectPr>\s*<\/w:body>/);
    const tempContent = bodyMatch ? bodyMatch[1] : '<w:p><w:pPr></w:pPr></w:p>';

    // Replace only the content between <w:body> and <w:sectPr>, preserving template's section properties (header/footer refs)
    docXml = docXml.replace(
      /<w:body>([\s\S]*?)<w:sectPr/,
      `<w:body>${tempContent}<w:sectPr`
    );

    // Update the document.xml in the template
    zip.file('word/document.xml', docXml);

    // Generate modified docx
    const finalBuffer = await zip.generateAsync({ type: 'nodebuffer' });
    console.log('[wordGenerator] Document generated with template');
    return finalBuffer;

  } catch (err) {
    console.error('[wordGenerator] Template error:', err.message);
    console.log('[wordGenerator] Falling back to creating document from scratch');

    // Fallback: create document without template
    const doc = new Document({
      sections: [{
        properties: {
          page: {
            margins: {
              top: 1440,
              bottom: 1440,
              left: 1440,
              right: 1440
            }
          }
        },
        children: contentSections
      }]
    });

    return await Packer.toBuffer(doc);
  }
}

module.exports = { generateProposal };
