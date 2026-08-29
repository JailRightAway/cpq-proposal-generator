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

  console.log('[wordGenerator] Received lineItems:', JSON.stringify(lineItems));

  // Check product types
  const hasInsight = lineItems.some(item =>
    (item.productName || item.moduleName || '').toLowerCase().includes('insight')
  );

  // Group line items by product
  const groupedItems = groupLineItemsByProduct(lineItems);
  const primaryServiceSections = [];
  const addOnSections = [];

  // Identify add-ons (products containing common add-on keywords)
  const addOnKeywords = ['Insight', 'Beta', 'Test Environment', 'Access', 'DocMagic', 'Document Prep', 'Data Storage', 'Admin Pro', 'Professional Services', 'Core Conversion', 'KeyStone', 'Fiserv', 'Spectrum', 'XP System', 'Warehouse Extract', 'Baseline', 'Batch Field', 'PriceMyLoan', 'Platform Fee'];

  const isAddOn = (productName) => addOnKeywords.some(keyword => productName.toLowerCase().includes(keyword.toLowerCase()));

  // Helper function to determine if item should only show Year 1
  const showOnlyYear1 = (productName) => {
    const year1OnlyKeywords = ['Platform Fee', 'DocDownload', 'PriceMyLoan Implementation', 'PriceMyLoan Service Package'];
    return year1OnlyKeywords.some(keyword => productName.toLowerCase().includes(keyword.toLowerCase()));
  };

  // Create a separate table for each product
  Object.entries(groupedItems).forEach(([productName, items]) => {
    const isAddOnProduct = isAddOn(productName);
    const targetSections = isAddOnProduct ? addOnSections : primaryServiceSections;

    // Filter items for year 1-only products
    const filteredItems = showOnlyYear1(productName) ? items.filter(item => (item.year || 1) === 1) : items;

    const tableRows = [];
    const isInsight = productName.toLowerCase().includes('insight');
    const hasAnnualFees = filteredItems.some(item => (item.annualFee || item.annualPrice) > 0);
    const hasTransactionFees = filteredItems.some(item => (item.perFileFee || 0) > 0);
    const hasMonthlyCommitment = filteredItems.some(item => (item.monthlyCommitment || 0) > 0);

    // Build header row - always show all columns
    const headerCells = [
      createHeaderCell('Service / Module'),
      createHeaderCell('Year'),
      createHeaderCell('One-Time Fee'),
      createHeaderCell('Annual Fee')
    ];

    if (hasTransactionFees) {
      headerCells.push(createHeaderCell('Per Transaction'));
    }

    if (hasMonthlyCommitment) {
      headerCells.push(createHeaderCell('Monthly Commitment'));
    }

    tableRows.push(new TableRow({ children: headerCells }));

    // Data rows for this product
    filteredItems.forEach((item) => {
      console.log(`[wordGenerator] Product: ${productName}, Year: ${item.year}, setupFee: ${item.setupFee}, annualFee: ${item.annualFee}`);

      const dataCells = [
        createDataCell(productName),
        createDataCell(String(item.year || 1), true),
        createDataCell(formatCurrency(item.setupFee || item.oneTimePrice || 0), true),
        createDataCell(formatCurrency(item.annualFee || item.annualPrice || 0), true)
      ];

      if (hasTransactionFees) {
        const perFileFee = Number(item.perFileFee) || 0;
        dataCells.push(createDataCell(perFileFee > 0 ? perFileFee.toFixed(2) : 'N/A', true));
      }

      if (hasMonthlyCommitment) {
        dataCells.push(createDataCell(formatCurrency(item.monthlyCommitment || 0), true));
      }

      tableRows.push(new TableRow({ children: dataCells }));
    });

    // Add product heading and table
    targetSections.push(
      new Paragraph({
        text: productName,
        bold: true,
        size: 22,
        color: '004B8E',
        spacing: { before: 50, after: 50 }
      })
    );

    // Create table with dynamic column widths
    const columnCount = headerCells.length;
    const columnWidth = Math.floor(5000 / columnCount); // 5000 twips per column

    targetSections.push(
      new Table({
        rows: tableRows,
        width: { size: 100, type: WidthType.PERCENT },
        columnWidths: Array(columnCount).fill(columnWidth)
      })
    );

    targetSections.push(
      new Paragraph({ text: '', spacing: { after: 50 } })
    );

    // Add disclaimer for PriceMyLoan Service Package
    if (productName.includes('PriceMyLoan Service Package')) {
      targetSections.push(
        new Paragraph({
          children: [
            new TextRun({
              text: 'Note: The hourly rate is only billed when custom products are requested, built, or adjusted.',
              italic: true,
              size: 18,
              color: '666666'
            })
          ],
          spacing: { after: 100 }
        })
      );
    }
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

    ...(addOnSections.length > 0 ? [
      new Paragraph({
        text: 'Add-Ons',
        heading: HeadingLevel.HEADING_2,
        color: '004B8E',
        spacing: { before: 100, after: 50 }
      }),
      ...addOnSections
    ] : []),

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
  const skipTemplate = false; // Use updated template

  try {
    if (skipTemplate) {
      throw new Error('Template mode disabled - using generated content only');
    }

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

    // Debug: log sample of generated content to see how values are encoded
    console.log('[wordGenerator] Checking generated content...');
    const contentSample = tempContent.substring(0, 2000);
    if (contentSample.includes('11') && contentSample.includes('250')) {
      console.log('[wordGenerator] Found 11...250 in content (may be split across XML)');
    } else if (contentSample.includes('1250')) {
      console.log('[wordGenerator] ⚠ Found 1250 in content');
    }
    // Show a snippet of actual content for debugging
    const currencyMatches = tempContent.match(/\$[\d,\.]+/g) || [];
    console.log('[wordGenerator] Currency values found in content:', currencyMatches.slice(0, 10));

    // Replace all content between <w:body> and </w:body>, then re-add sectPr from template
    // This ensures our content completely replaces template content
    const sectionPropsMatch = docXml.match(/<w:sectPr[^>]*>[\s\S]*?<\/w:sectPr>/);
    const sectionProps = sectionPropsMatch ? sectionPropsMatch[0] : '<w:sectPr/>';

    docXml = docXml.replace(
      /<w:body>[\s\S]*?<\/w:body>/,
      `<w:body>${tempContent}${sectionProps}</w:body>`
    );

    console.log('[wordGenerator] Injected generated content into template');

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
