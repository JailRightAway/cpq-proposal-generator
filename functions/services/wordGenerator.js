const { Document, Packer, Paragraph, Table, TableRow, TableCell, BorderStyle, AlignmentType, TextRun, HeadingLevel, WidthType, VerticalAlign, convertInchesToTwip } = require('docx');

const ML_BLUE = { r: 0, g: 73, b: 142 };

function formatCurrency(amount) {
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function createHeaderCell(text) {
  return new TableCell({
    text: text,
    shading: { fill: '004B8E' },
    textVAlign: VerticalAlign.center,
    margins: { top: 100, bottom: 100, left: 100, right: 100 },
    children: [
      new Paragraph({
        text: text,
        run: {
          bold: true,
          color: 'FFFFFF',
          size: 22
        }
      })
    ]
  });
}

function createDataCell(text, centered = false) {
  return new TableCell({
    text: text,
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

  // Check if any mortgage products
  const hasMortgage = lineItems.some(item =>
    (item.productName || item.moduleName || '').toLowerCase().includes('mortgage')
  );

  // Group line items by product
  const groupedItems = groupLineItemsByProduct(lineItems);
  const primaryServiceSections = [];

  // Create a separate table for each product
  Object.entries(groupedItems).forEach(([productName, items]) => {
    const tableRows = [];

    // Header row with Year column
    tableRows.push(
      new TableRow({
        children: [
          createHeaderCell('Year'),
          createHeaderCell('Service / Module'),
          createHeaderCell('One-Time Fee'),
          createHeaderCell('Per Transaction'),
          createHeaderCell('Monthly Minimum')
        ]
      })
    );

    // Data rows for this product
    items.forEach((item) => {
      tableRows.push(
        new TableRow({
          children: [
            createDataCell(String(item.year || 1), true),
            createDataCell(productName),
            createDataCell(formatCurrency(item.setupFee || item.oneTimePrice || 0), true),
            createDataCell(item.perFileFee > 0 ? formatCurrency(item.perFileFee) : 'N/A', true),
            createDataCell(formatCurrency(item.monthlyCommitment || item.annualPrice || 0), true)
          ]
        })
      );
    });

    // Add platform fee rows for Mortgage products
    if (hasMortgage && platformFee > 0 && productName.toLowerCase().includes('mortgage')) {
      for (let year = 1; year <= contractYears; year++) {
        tableRows.push(
          new TableRow({
            children: [
              createDataCell(String(year), true),
              createDataCell(`MeridianLink Mortgage Platform Fee - Year ${year} (Billed Monthly)`),
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

  // Build Annual Investment Summary rows
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

  // Calculate yearly costs
  let totalSetup = lineItems.reduce((sum, item) => sum + (item.setupFee || item.oneTimePrice || 0), 0);
  let contractTotal = 0;

  for (let year = 1; year <= contractYears; year++) {
    let yearMonthly = lineItems.reduce((sum, item) => {
      if ((item.year || 1) === year) {
        return sum + (item.monthlyCommitment || item.annualPrice || 0);
      }
      return sum;
    }, 0);

    yearMonthly += platformFee;
    const yearTotal = (year === 1 ? totalSetup : 0) + (yearMonthly * 12);
    contractTotal += yearTotal;

    const yearTier = (proposalData.yearlyTiers || {})[year];
    const tierName = yearTier ? yearTier.tierName : 'Standard';

    summaryRows.push(
      new TableRow({
        children: [
          createDataCell(`Year ${year} (${tierName})`),
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

  // Create document sections
  const sections = [
    // Title
    new Paragraph({
      text: 'PRICING PROPOSAL',
      heading: HeadingLevel.HEADING_1,
      bold: true,
      size: 32,
      color: '004B8E',
      spacing: { after: 200 }
    }),

    // Prepared For
    new Paragraph({
      children: [
        new TextRun({ text: 'Prepared For: ', bold: true }),
        new TextRun({
          text: customerContact ? `${customerName} (${customerContact})` : customerName
        })
      ],
      spacing: { after: 100 }
    }),

    // Date
    new Paragraph({
      children: [
        new TextRun({ text: 'Date: ', bold: true }),
        new TextRun({ text: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) })
      ],
      spacing: { after: 200 }
    }),

    // Executive Summary heading
    new Paragraph({
      text: 'Executive Summary',
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 200, after: 100 }
    }),

    new Paragraph({
      text: "This proposal outlines the pricing for MeridianLink's Mortgage Loan Origination System (LOS) integrated with DocMagic for document generation and management. The solution provides a complete end-to-end origination platform with scalable, per-transaction pricing.",
      spacing: { after: 200 }
    }),

    // Primary Services heading
    new Paragraph({
      text: 'Primary Services',
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 200, after: 100 }
    }),

    // Primary Services tables (one per product)
    ...primaryServiceSections,

    new Paragraph({ text: '', spacing: { after: 200 } }),

    // Annual Investment Summary heading
    new Paragraph({
      text: 'Annual Investment Summary',
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 200, after: 100 }
    }),

    // Summary table
    new Table({
      rows: summaryRows,
      width: { size: 100, type: WidthType.PERCENT }
    }),

    new Paragraph({ text: '', spacing: { after: 200 } }),

    // Contract Terms heading
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
      spacing: { after: 100 }
    }),

    ...(proposalData.yearlyTiers && contractYears > 1 ? [
      new Paragraph({
        children: [
          new TextRun({ text: 'Tier Schedule: ', bold: true }),
          new TextRun({
            text: Array.from({ length: contractYears }, (_, i) => {
              const tier = (proposalData.yearlyTiers || {})[i + 1];
              return `Year ${i + 1}: ${tier ? tier.tierName : 'Standard'}`;
            }).join(' | ')
          })
        ],
        spacing: { after: 100 }
      })
    ] : []),

    new Paragraph({
      children: [
        new TextRun({ text: 'Renewal: ', bold: true }),
        new TextRun({ text: 'Automatic renewal terms will be negotiated as contract end approaches' })
      ],
      spacing: { after: 200 }
    }),

    // Confidentiality notice
    new Paragraph({
      text: 'This proposal and all materials contained herein are confidential and proprietary to MeridianLink, Inc. This document is intended solely for the use of the recipient and may not be reproduced, distributed, or disclosed to third parties without prior written consent. © 2026 MeridianLink, Inc. All rights reserved.',
      italic: true,
      size: 18,
      spacing: { before: 200 }
    })
  ];

  // Create document
  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margins: {
            top: convertInchesToTwip(1),
            bottom: convertInchesToTwip(1),
            left: convertInchesToTwip(1),
            right: convertInchesToTwip(1)
          }
        }
      },
      children: sections
    }]
  });

  // Generate buffer
  return await Packer.toBuffer(doc);
}

module.exports = { generateProposal };
