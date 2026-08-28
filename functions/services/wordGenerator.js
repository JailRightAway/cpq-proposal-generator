const { Document, Packer, Paragraph, Table, TableRow, TableCell, AlignmentType, TextRun, HeadingLevel, WidthType } = require('docx');
const JSZip = require('jszip');
const fs = require('fs');
const path = require('path');

const TEMPLATE_PATH = path.join(__dirname, '..', 'templates', 'proposal-template.docx');

function formatCurrency(amount) {
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getDefaultExpirationDate() {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function createHeaderCell(text) {
  return new TableCell({
    shading: { fill: '004B8E' },
    margins: { top: 100, bottom: 100, left: 100, right: 100 },
    children: [
      new Paragraph({
        text: text,
        bold: true,
        color: 'FFFFFF'
      })
    ]
  });
}

function createDataCell(text, centered = false) {
  return new TableCell({
    margins: { top: 100, bottom: 100, left: 100, right: 100 },
    children: [
      new Paragraph({
        text: text,
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
  const platformFee = proposalData.platformFee || 0;
  const contractYears = proposalData.contractTermYears || 1;
  const customerName = proposalData.customerName || 'N/A';
  const customerContact = proposalData.customerContact || '';
  const expirationDate = proposalData.expirationDate || getDefaultExpirationDate();
  const yearlyTiers = proposalData.yearlyTiers || {};

  // Check product types
  const hasMortgage = lineItems.some(item =>
    (item.productName || item.moduleName || '').toLowerCase().includes('mortgage')
  );
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

    // Build header row based on product type
    const headerCells = [
      createHeaderCell('Service / Module'),
      createHeaderCell('Year')
    ];

    if (isInsight) {
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

      if (isInsight) {
        dataCells.push(createDataCell(formatCurrency(item.setupFee || item.oneTimePrice || 0), true));
        dataCells.push(createDataCell(formatCurrency(item.annualFee || item.annualPrice || 0), true));
      } else {
        dataCells.push(createDataCell(formatCurrency(item.setupFee || item.oneTimePrice || 0), true));
        dataCells.push(createDataCell(item.perFileFee > 0 ? formatCurrency(item.perFileFee) : 'N/A', true));
        dataCells.push(createDataCell(formatCurrency(item.monthlyCommitment || item.annualPrice || 0), true));
      }

      tableRows.push(new TableRow({ children: dataCells }));
    });

    // Add platform fee rows for Mortgage products (not Insight)
    if (hasMortgage && platformFee > 0 && productName.toLowerCase().includes('mortgage') && !isInsight) {
      for (let year = 1; year <= contractYears; year++) {
        tableRows.push(
          new TableRow({
            children: [
              createDataCell('MeridianLink Mortgage Platform Fee'),
              createDataCell(String(year), true),
              createDataCell('N/A', true),
              createDataCell('N/A', true),
              createDataCell(formatCurrency(platformFee), true)
            ]
          })
        );
      }
    }

    // Add product heading and table
    primaryServiceSections.push(
      new Paragraph({
        text: productName,
        bold: true,
        size: 24,
        spacing: { before: 200, after: 100 }
      })
    );

    primaryServiceSections.push(
      new Table({
        rows: tableRows,
        width: { size: 100, type: WidthType.PERCENT }
      })
    );

    primaryServiceSections.push(
      new Paragraph({ text: '', spacing: { after: 100 } })
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
        const isInsightItem = (item.productName || item.moduleName || '').toLowerCase().includes('insight');
        if (isInsightItem) {
          return sum + (item.annualFee || item.annualPrice || 0);
        } else {
          return sum + (item.monthlyCommitment || item.annualPrice || 0) * 12;
        }
      }
      return sum;
    }, 0);

    if (!hasInsight && hasMortgage) {
      yearCost += platformFee * 12;
    }

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
      text: 'PRICING PROPOSAL',
      bold: true,
      size: 32,
      color: '004B8E',
      spacing: { before: 0, after: 100 }
    }),

    new Paragraph({
      children: [
        new TextRun({ text: 'Prepared For: ', bold: true }),
        new TextRun({
          text: customerContact ? `${customerName} (${customerContact})` : customerName
        })
      ],
      spacing: { after: 100 }
    }),

    new Paragraph({
      children: [
        new TextRun({ text: 'Date: ', bold: true }),
        new TextRun({ text: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) })
      ],
      spacing: { after: 100 }
    }),

    new Paragraph({
      children: [
        new TextRun({ text: 'Proposal Expiration: ', bold: true }),
        new TextRun({ text: expirationDate })
      ],
      spacing: { after: 200 }
    }),

    new Paragraph({
      text: 'Contract Terms',
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 200, after: 100 }
    }),

    new Paragraph({
      children: [
        new TextRun({ text: 'Initial Term: ', bold: true }),
        new TextRun({ text: `${contractYears} year${contractYears > 1 ? 's' : ''}` })
      ],
      spacing: { after: 200 }
    }),

    new Paragraph({
      text: 'Primary Services',
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 200, after: 100 }
    }),

    ...primaryServiceSections,

    new Paragraph({
      text: 'Annual Investment Summary',
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 200, after: 100 }
    }),

    new Table({
      rows: summaryRows,
      width: { size: 100, type: WidthType.PERCENT }
    }),

    new Paragraph({ text: '', spacing: { after: 200 } })
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

    // Extract just the body content from temp
    const bodyMatch = tempDocXml.match(/<w:body>([\s\S]*?)<\/w:body>/);
    const newBody = bodyMatch ? bodyMatch[1] : '<w:p><w:pPr></w:pPr></w:p>';

    // Replace body in template, keeping header/footer
    docXml = docXml.replace(/<w:body>[\s\S]*?<\/w:body>/, `<w:body>${newBody}</w:body>`);

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
