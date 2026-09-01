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
    shading: { fill: '1999C0' },
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

function createDataCell(text, centered = false, shaded = false) {
  const cell = {
    margins: { top: 80, bottom: 80, left: 80, right: 80 },
    children: [
      new Paragraph({
        text: String(text).trim(),
        alignment: centered ? AlignmentType.CENTER : AlignmentType.LEFT
      })
    ]
  };

  if (shaded) {
    cell.shading = { fill: '33FFFE', color: 'auto' };
    cell.children[0].color = '000000';
  }

  return new TableCell(cell);
}

function groupLineItemsByProduct(lineItems) {
  // Group by (year, mortgageType, productName) to support year-first ordering
  const grouped = {};

  lineItems.forEach(item => {
    // Determine mortgage type for ordering
    const productName = item.productName || item.moduleName || 'Unknown';
    let mortgageTypeOrder = 2; // default for non-mortgage products
    let mortgageTypeLabel = 'Other';

    if (productName.includes('Platform Fee') || item.tier === 'Platform Fee') {
      mortgageTypeOrder = 999; // Platform Fee goes last
      mortgageTypeLabel = 'Platform Fee';
    } else if (productName.includes('First Lien')) {
      mortgageTypeOrder = 0;
      mortgageTypeLabel = 'First Lien';
    } else if (productName.includes('Subordinate Lien')) {
      mortgageTypeOrder = 1;
      mortgageTypeLabel = 'Subordinate Lien';
    }

    // Create a composite key that preserves year-first ordering
    const year = item.year || 1;
    const groupKey = `${year}_${mortgageTypeOrder}_${productName}`;

    if (!grouped[groupKey]) {
      grouped[groupKey] = {
        year: year,
        mortgageTypeOrder: mortgageTypeOrder,
        mortgageTypeLabel: mortgageTypeLabel,
        productName: productName,
        items: []
      };
    }
    grouped[groupKey].items.push(item);
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
  let groupedItems = groupLineItemsByProduct(lineItems);
  const primaryServiceSections = [];
  const addOnSections = [];

  // Identify add-ons (products containing common add-on keywords)
  const addOnKeywords = ['Insight', 'Beta', 'Test Environment', 'Access', 'DocMagic', 'Document Prep', 'DocDownload', 'Data Storage', 'Admin Pro', 'Professional Services', 'Core Conversion', 'KeyStone', 'Fiserv', 'Spectrum', 'XP System', 'Warehouse Extract', 'Baseline', 'Batch Field', 'PriceMyLoan', 'SQL'];

  const isAddOn = (productName) => addOnKeywords.some(keyword => productName.toLowerCase().includes(keyword.toLowerCase()));

  // Platform Fee stays in primary services
  const isPlatformFee = (productName) => productName.toLowerCase().includes('platform fee') || productName.includes('Platform Fee');

  // Helper function to determine if item should only show Year 1
  const showOnlyYear1 = (productName) => {
    const year1OnlyKeywords = [
      'Platform Fee',
      'DocDownload',
      'PriceMyLoan Implementation',
      'PriceMyLoan Service Package',
      'Spectrum',
      'Corelation KeyStone',
      'Fiserv DNA',
      'XP System',
      'Core Conversion',
      'Insight',
      'SQL',
      'SQL Transmission'
    ];
    const productLower = productName.toLowerCase();
    const result = year1OnlyKeywords.some(keyword => productLower.includes(keyword.toLowerCase()));
    if (result) {
      console.log(`[wordGenerator] Product "${productName}" identified as Year-1-only`);
    }
    return result;
  };

  // Separate add-on items for consolidated table
  let allAddOnItems = [];

  // Sort the grouped items by (year, mortgageTypeOrder) to maintain ordering
  const sortedGroupKeys = Object.keys(groupedItems).sort((keyA, keyB) => {
    const groupA = groupedItems[keyA];
    const groupB = groupedItems[keyB];

    const yearDiff = groupA.year - groupB.year;
    if (yearDiff !== 0) return yearDiff;

    return groupA.mortgageTypeOrder - groupB.mortgageTypeOrder;
  });

  // Create a separate table for each product
  sortedGroupKeys.forEach((groupKey) => {
    const { year, mortgageTypeOrder, mortgageTypeLabel, productName, items } = groupedItems[groupKey];
    const isAddOnProduct = isAddOn(productName) && !isPlatformFee(productName);
    const isSeparateTable = !isAddOnProduct;
    const isYear1Only = showOnlyYear1(productName);

    // Filter items for year 1-only products
    const filteredItems = isYear1Only ? items.filter(item => (item.year || 1) === 1) : items;

    console.log(`[wordGenerator] Year: ${year}, Type: ${mortgageTypeLabel}, Product: "${productName}", isYear1Only: ${isYear1Only}, original items: ${items.length}, filtered items: ${filteredItems.length}`);

    if (isAddOnProduct) {
      // Collect add-on items for consolidated table
      allAddOnItems.push({ productName, items: filteredItems });
      return; // Skip individual table creation for add-ons
    }

    const targetSections = primaryServiceSections;

    const tableRows = [];
    const isInsight = productName.toLowerCase().includes('insight');
    const isMortgage = productName.toLowerCase().includes('mortgage');
    const hasSetupFees = filteredItems.some(item => (item.setupFee || item.oneTimePrice || 0) > 0);
    const hasAnnualFees = !isMortgage && filteredItems.some(item => (item.annualFee || item.annualPrice || 0) > 0);
    const hasTransactionFees = filteredItems.some(item => (item.perFileFee || 0) > 0);
    const hasMonthlyCommitment = filteredItems.some(item => (item.monthlyCommitment || 0) > 0);

    // Build header row - only show columns that have data
    const headerCells = [
      createHeaderCell('Service / Module'),
      createHeaderCell('Year')
    ];

    if (hasSetupFees) {
      headerCells.push(createHeaderCell('One-Time Fee'));
    }

    if (hasAnnualFees) {
      headerCells.push(createHeaderCell('Annual Fee'));
    }

    if (hasTransactionFees) {
      headerCells.push(createHeaderCell('Per Transaction'));
    }

    if (hasMonthlyCommitment) {
      headerCells.push(createHeaderCell('Monthly Commitment'));
    }

    tableRows.push(new TableRow({ children: headerCells }));

    // Data rows for this product
    filteredItems.forEach((item, rowIndex) => {
      console.log(`[wordGenerator] Product: ${productName}, Year: ${item.year}, setupFee: ${item.setupFee}, annualFee: ${item.annualFee}`);

      // Special handling for Platform Fee - display as "MeridianLink Mortgage Platform Fee" not the full mortgage product name
      const displayName = (item.tier === 'Platform Fee') ? 'MeridianLink Mortgage Platform Fee' : productName;

      // Alternate row shading (every other row, starting with row 1)
      const isShaded = rowIndex % 2 === 1;

      const dataCells = [
        createDataCell(displayName, false, isShaded),
        createDataCell(String(item.year || 1), true, isShaded)
      ];

      if (hasSetupFees) {
        dataCells.push(createDataCell(formatCurrency(item.setupFee || item.oneTimePrice || 0), true, isShaded));
      }

      if (hasAnnualFees) {
        dataCells.push(createDataCell(formatCurrency(item.annualFee || item.annualPrice || 0), true, isShaded));
      }

      if (hasTransactionFees) {
        const perFileFee = Number(item.perFileFee) || 0;
        dataCells.push(createDataCell(perFileFee > 0 ? perFileFee.toFixed(2) : 'N/A', true, isShaded));
      }

      if (hasMonthlyCommitment) {
        dataCells.push(createDataCell(formatCurrency(item.monthlyCommitment || 0), true, isShaded));
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

  // Create consolidated add-ons table if there are any add-ons
  if (allAddOnItems.length > 0) {
    const addOnTableRows = [];

    // Determine which columns we need - always show transaction fee for add-ons
    let hasSetupFees = false;
    let hasAnnualFees = false;
    let hasMonthlyCommitment = false;
    const hasTransactionFees = true; // Always show for add-ons

    allAddOnItems.forEach(({ items }) => {
      items.forEach(item => {
        if ((item.setupFee || 0) > 0) hasSetupFees = true;
        if ((item.annualFee || 0) > 0) hasAnnualFees = true;
        if ((item.monthlyCommitment || 0) > 0) hasMonthlyCommitment = true;
      });
    });

    // Build header row
    const addOnHeaderCells = [
      createHeaderCell('Add-On Service'),
      createHeaderCell('Year')
    ];

    if (hasSetupFees) addOnHeaderCells.push(createHeaderCell('One-Time Fee'));
    if (hasAnnualFees) addOnHeaderCells.push(createHeaderCell('Annual Fee'));
    addOnHeaderCells.push(createHeaderCell('Per Transaction'));
    if (hasMonthlyCommitment) addOnHeaderCells.push(createHeaderCell('Monthly Commitment'));

    addOnTableRows.push(new TableRow({ children: addOnHeaderCells }));

    // Add all add-on items
    let rowIndexAddon = 0;
    allAddOnItems.forEach(({ productName, items }) => {
      items.forEach(item => {
        // Alternate row shading (every other row, starting with row 1)
        const isShaded = rowIndexAddon % 2 === 1;

        const dataCells = [
          createDataCell(productName, false, isShaded),
          createDataCell(String(item.year || 1), true, isShaded)
        ];

        if (hasSetupFees) dataCells.push(createDataCell(formatCurrency(item.setupFee || 0), true, isShaded));
        if (hasAnnualFees) dataCells.push(createDataCell(formatCurrency(item.annualFee || 0), true, isShaded));

        // Always show transaction fee for add-ons
        const perFileFee = Number(item.perFileFee) || 0;
        dataCells.push(createDataCell(perFileFee > 0 ? perFileFee.toFixed(2) : 'N/A', true, isShaded));

        if (hasMonthlyCommitment) dataCells.push(createDataCell(formatCurrency(item.monthlyCommitment || 0), true, isShaded));

        addOnTableRows.push(new TableRow({ children: dataCells }));
        rowIndexAddon++;
      });
    });

    // Add consolidated add-ons table to primary sections
    primaryServiceSections.push(
      new Table({
        rows: addOnTableRows,
        width: { size: 100, type: WidthType.PERCENT },
        columnWidths: Array(addOnHeaderCells.length).fill(Math.floor(5000 / addOnHeaderCells.length))
      })
    );

    primaryServiceSections.push(
      new Paragraph({ text: '', spacing: { after: 50 } })
    );
  }

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

  let summaryRowIndex = 0;
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

    // Alternate row shading
    const isShaded = summaryRowIndex % 2 === 1;

    summaryRows.push(
      new TableRow({
        children: [
          createDataCell(`Year ${year}`, false, isShaded),
          createDataCell(formatCurrency(yearTotal), true, isShaded)
        ]
      })
    );
    summaryRowIndex++;
  }

  // Total row (not shaded - separate visual emphasis)
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
