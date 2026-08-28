const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const EXCEL_PATH = path.join(__dirname, '..', 'ML_PriceCard.xlsm');

let cachedProducts = null;
let cacheTimestamp = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Implementation fee lookup
const IMPLEMENTATION_FEES = {
  'No Implementation': 0,
  '1 Implementation': 7950,
  '2 Implementation': 13200,
  '3 Implementation': 18425
};

/**
 * Load and parse products from Excel
 * Returns products organized by type
 */
async function loadProducts() {
  // Check cache
  if (cachedProducts && cacheTimestamp && Date.now() - cacheTimestamp < CACHE_DURATION) {
    console.log('[ProductLoader] Using cached products');
    return cachedProducts;
  }

  try {
    if (!fs.existsSync(EXCEL_PATH)) {
      console.error(`[ProductLoader] Excel file not found at ${EXCEL_PATH}`);
      throw new Error(`Excel file not found`);
    }

    console.log('[ProductLoader] Reading Excel file...');
    const workbook = XLSX.readFile(EXCEL_PATH);

    // Use "Module Tiers" sheet
    const sheetToUse = 'Module Tiers';
    if (!workbook.Sheets[sheetToUse]) {
      throw new Error(`Sheet "${sheetToUse}" not found`);
    }

    const sheet = workbook.Sheets[sheetToUse];
    const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    console.log(`[ProductLoader] Parsing ${rawData.length} rows...`);

    // Parse products and organize by type
    const productsByType = parseProductsByType(rawData);

    cachedProducts = productsByType;
    cacheTimestamp = Date.now();
    console.log(`[ProductLoader] Loaded products by type:`, Object.keys(productsByType));

    return productsByType;
  } catch (error) {
    console.error('[ProductLoader] Error:', error.message);
    return getSampleProducts();
  }
}

/**
 * Classify and parse products, organizing by type
 */
function parseProductsByType(rawData) {
  const productsByType = {
    'Consumer': [],
    'Mortgage': [],
    'Collect': [],
    'Access': [],
    'Insight': [],
    'Decision Lender 4': []
  };

  let currentModuleName = null;
  let currentModuleData = [];

  for (let i = 0; i < rawData.length; i++) {
    const row = rawData[i];
    if (!row || row.length === 0) continue;

    const firstCell = row[0];
    if (!firstCell) continue;

    const isModuleHeader = typeof firstCell === 'string' && firstCell.includes('MeridianLink');

    if (isModuleHeader) {
      // Process previous module
      if (currentModuleName && currentModuleData.length > 0) {
        const products = parseModuleData(currentModuleName, currentModuleData);
        const type = classifyProductType(currentModuleName);

        if (products.length > 0) {
          if (!productsByType[type]) productsByType[type] = [];
          productsByType[type].push(...products);
        }
      }

      currentModuleName = firstCell.trim();
      currentModuleData = [];
    } else if (currentModuleName && firstCell && typeof firstCell === 'string') {
      // Collect ALL rows under a module (including potential header rows)
      // Don't filter yet - we need headers for tier information
      currentModuleData.push(row);
    }
  }

  // Process last module
  if (currentModuleName && currentModuleData.length > 0) {
    const products = parseModuleData(currentModuleName, currentModuleData);
    const type = classifyProductType(currentModuleName);

    if (products.length > 0) {
      if (!productsByType[type]) productsByType[type] = [];
      productsByType[type].push(...products);
    }
  }

  // Remove empty types
  Object.keys(productsByType).forEach(type => {
    if (productsByType[type].length === 0) delete productsByType[type];
  });

  return productsByType;
}

/**
 * Classify product type from module name
 */
function classifyProductType(moduleName) {
  if (moduleName.includes('Mortgage')) return 'Mortgage';
  if (moduleName.includes('Collect')) return 'Collect';
  if (moduleName.includes('Access')) return 'Access';
  if (moduleName.includes('Insight')) return 'Insight';
  if (moduleName.includes('Decision Lender')) return 'Decision Lender 4';
  if (moduleName.includes('Consumer') || moduleName.includes('Indirect') || moduleName.includes('Business') || moduleName.includes('Home Equity')) return 'Consumer';
  return 'Other';
}

/**
 * Parse a single module into product entries
 */
function parseModuleData(moduleName, moduleRows) {
  const products = [];

  if (!moduleRows || moduleRows.length === 0) return products;

  // Special handling for mortgage products (implementation + tier-based pricing)
  if (moduleName.includes('Mortgage')) {
    const mortgageProducts = parseMortgageProduct(moduleName, moduleRows);
    if (mortgageProducts) {
      if (Array.isArray(mortgageProducts)) {
        products.push(...mortgageProducts);
      } else {
        products.push(mortgageProducts);
      }
    }
    return products;
  }

  // Standard tiered pricing
  const tiers = extractTiersFromModule(moduleRows);

  if (tiers.length === 0) {
    // Flat-priced product
    const flatProduct = createFlatPricedProduct(moduleName, moduleRows);
    if (flatProduct) products.push(flatProduct);
    return products;
  }

  // Tiered product - create entry for each tier
  tiers.forEach((tier, tierIdx) => {
    const product = {
      id: `prod_${Date.now()}_${tierIdx}`,
      type: classifyProductType(moduleName),
      moduleName: moduleName,
      name: `${moduleName} - ${tier.name}`,
      tier: tier.name,
      tierIndex: tierIdx,
      tierRange: tier.range,
      serviceLines: [],
      totalSetupFee: 0,
      totalAnnualFee: 0,
      oneTimeFee: 0,
      annualFee: 0
    };

    moduleRows.forEach((row) => {
      const serviceName = row[0];
      const priceInTierColumn = row[tier.columnIndex];

      if (serviceName && typeof serviceName === 'string') {
        const price = typeof priceInTierColumn === 'number' ? priceInTierColumn : (parseFloat(priceInTierColumn) || 0);

        if (price > 0) {
          product.serviceLines.push({
            name: serviceName.trim(),
            price: price,
            tier: tier.name
          });

          if (serviceName.toLowerCase().includes('setup')) {
            product.totalSetupFee += price;
          } else {
            product.totalAnnualFee += price;
          }
        }
      }
    });

    if (product.totalSetupFee > 0 || product.totalAnnualFee > 0) {
      product.oneTimeFee = product.totalSetupFee;
      product.annualFee = product.totalAnnualFee;
      products.push(product);
    }
  });

  return products;
}

/**
 * Parse mortgage products with dual pricing (implementation + volume tiers)
 * Handles interleaved structure: $ | TierName | $ | Price | $ | TierName | $ | Price ...
 */
function parseMortgageProduct(moduleName, moduleRows) {
  if (!moduleRows || moduleRows.length === 0) return null;

  // Extract implementation level from module name (No/1/2/3 Implementation)
  let implKey = 'No Implementation';
  if (moduleName.includes('1 Implementation')) implKey = '1 Implementation';
  else if (moduleName.includes('2 Implementation')) implKey = '2 Implementation';
  else if (moduleName.includes('3 Implementation')) implKey = '3 Implementation';

  const implementationFee = IMPLEMENTATION_FEES[implKey] || 0;

  // Parse the interleaved tier structure
  const tiers = extractMortgageTiers(moduleRows);

  if (tiers.length === 0) {
    return null;
  }

  const products = [];

  // Create a product for each tier
  tiers.forEach((tier, tierIdx) => {
    const product = {
      id: `prod_mortgage_${Date.now()}_${tierIdx}`,
      type: 'Mortgage',
      moduleName: moduleName,
      name: `${moduleName} - ${tier.name}`,
      tier: tier.name,
      tierIndex: tierIdx,
      implementationFee: implementationFee,
      serviceFees: {},
      totalSetupFee: implementationFee,
      totalAnnualFee: 0
    };

    // Extract fees for this tier from each service row
    moduleRows.forEach((row, rowIdx) => {
      if (rowIdx === 0) return; // Skip first row if it's headers

      const serviceName = row[0];
      if (!serviceName || typeof serviceName !== 'string') return;

      const serviceNameTrimmed = serviceName.trim();
      const price = tier.priceColumn < row.length ? row[tier.priceColumn] : 0;

      if (typeof price === 'number' && price > 0) {
        product.serviceFees[serviceNameTrimmed] = price;

        // Add to appropriate total
        if (serviceNameTrimmed.toLowerCase().includes('setup') || serviceNameTrimmed.toLowerCase().includes('implementation')) {
          // Setup fees already counted
        } else {
          product.totalAnnualFee += price;
        }
      }
    });

    product.oneTimeFee = product.totalSetupFee;
    product.annualFee = product.totalAnnualFee;
    products.push(product);
  });

  return products.length > 0 ? products : null;
}

/**
 * Extract mortgage tiers from interleaved structure
 * Pattern: $ | TierName | $ | Price | $ | TierName | $ | Price ...
 */
function extractMortgageTiers(moduleRows) {
  const tiers = [];

  if (moduleRows.length === 0) return tiers;

  // The first data row should have the interleaved tier structure
  const firstRow = moduleRows[0];
  if (!firstRow || firstRow.length < 4) return tiers;

  // Pattern: starts with service name in column 0, then alternates $ | TierName | $ | Price
  // Column 1: $ (currency marker)
  // Column 2: TierName (e.g., "10-14")
  // Column 3: $ (currency marker)
  // Column 4: Price (first tier price)
  // Column 5: $ (currency marker)
  // Column 6: TierName (e.g., "15-29")
  // Column 7: $ (currency marker)
  // Column 8: Price (second tier price)
  // etc.

  let tierIndex = 0;
  for (let colIdx = 2; colIdx < firstRow.length; colIdx += 4) {
    const tierName = firstRow[colIdx];
    const priceCol = colIdx + 2; // Price is 2 columns after tier name

    if (tierName && typeof tierName === 'string' && priceCol < firstRow.length) {
      const tierNameTrimmed = tierName.trim();

      // Verify this looks like a tier name (contains - or +, or is a number range)
      if (tierNameTrimmed.match(/^\d+[-+\d]/)) {
        tiers.push({
          name: tierNameTrimmed,
          range: `${tierNameTrimmed} units`,
          tierColumn: colIdx,
          priceColumn: priceCol,
          index: tierIndex++
        });
      }
    }
  }

  console.log(`[MortgageParser] Module: ${moduleRows[0] ? moduleRows[0][0] : 'Unknown'} - Found ${tiers.length} tiers`);

  return tiers;
}


/**
 * Extract tier information from a module's rows
 * Looks through all rows to find tier headers (prioritizes first row)
 */
function extractTiersFromModule(moduleRows) {
  const tiers = [];
  const tierCols = {};

  // First, try to find tier headers in the FIRST row (often contains headers)
  if (moduleRows.length > 0) {
    const firstRow = moduleRows[0];
    let firstRowHasTierInfo = false;

    firstRow.forEach((cell, colIdx) => {
      if (colIdx === 0 || !cell) return;

      const cellStr = String(cell).trim();
      if (!cellStr) return;

      // Check if this looks like a tier header (text, not a large number like pricing)
      const isLikelyHeader = isNaN(cell) || (cellStr.includes('-') && !cellStr.includes('$'));

      if (!isLikelyHeader) return;

      firstRowHasTierInfo = true;

      // Match "Tier X" pattern
      const tierMatch = cellStr.match(/^Tier\s+(\d+)$/i);
      if (tierMatch) {
        tierCols[colIdx] = {
          name: cellStr,
          range: `Tier ${tierMatch[1]}`,
          columnIndex: colIdx
        };
        return;
      }

      // Match unit range pattern (10-14, 15-29, 1200+, etc.)
      const rangeMatch = cellStr.match(/^(\d+[\d,]*)\s*-?\s*(\d+[\d,]*|\+?)$/);
      if (rangeMatch) {
        const start = rangeMatch[1].replace(/,/g, '');
        const end = rangeMatch[2].replace(/,/g, '');
        tierCols[colIdx] = {
          name: `${start}-${end}`,
          range: `${start}-${end} units`,
          columnIndex: colIdx
        };
      }
    });

    // If first row has tier info, we found headers
    if (firstRowHasTierInfo && Object.keys(tierCols).length > 0) {
      Object.values(tierCols).forEach(tier => tiers.push(tier));
      return tiers.sort((a, b) => a.columnIndex - b.columnIndex);
    }
  }

  // If no headers found in first row, scan all rows for tier patterns
  moduleRows.forEach((row) => {
    if (!row) return;

    row.forEach((cell, colIdx) => {
      if (colIdx === 0 || !cell || tierCols[colIdx]) return;

      const cellStr = String(cell).trim();
      if (!cellStr) return;

      // Match "Tier X" pattern
      const tierMatch = cellStr.match(/^Tier\s+(\d+)$/i);
      if (tierMatch) {
        tierCols[colIdx] = {
          name: cellStr,
          range: `Tier ${tierMatch[1]}`,
          columnIndex: colIdx
        };
        return;
      }

      // Match unit range pattern
      const rangeMatch = cellStr.match(/^(\d+[\d,]*)\s*-?\s*(\d+[\d,]*|\+?)$/);
      if (rangeMatch && isNaN(cellStr)) {
        const start = rangeMatch[1].replace(/,/g, '');
        const end = rangeMatch[2].replace(/,/g, '');
        tierCols[colIdx] = {
          name: `${start}-${end}`,
          range: `${start}-${end} units`,
          columnIndex: colIdx
        };
      }
    });
  });

  Object.values(tierCols).forEach(tier => tiers.push(tier));
  return tiers.sort((a, b) => a.columnIndex - b.columnIndex);
}

/**
 * Create flat-priced product
 */
function createFlatPricedProduct(moduleName, moduleRows) {
  if (!moduleRows || moduleRows.length === 0) return null;

  const product = {
    id: `prod_${Date.now()}`,
    type: classifyProductType(moduleName),
    moduleName: moduleName,
    name: moduleName,
    tier: 'Standard',
    serviceLines: [],
    totalSetupFee: 0,
    totalAnnualFee: 0
  };

  moduleRows.forEach((row) => {
    const serviceName = row[0];
    let price = 0;

    for (let i = 1; i < row.length; i++) {
      if (typeof row[i] === 'number' && row[i] > 0) {
        price = row[i];
        break;
      }
    }

    if (serviceName && typeof serviceName === 'string' && price > 0) {
      product.serviceLines.push({
        name: serviceName.trim(),
        price: price,
        tier: 'Standard'
      });

      if (serviceName.toLowerCase().includes('setup')) {
        product.totalSetupFee += price;
      } else {
        product.totalAnnualFee += price;
      }
    }
  });

  if (product.totalSetupFee > 0 || product.totalAnnualFee > 0) {
    product.oneTimeFee = product.totalSetupFee;
    product.annualFee = product.totalAnnualFee;
    return product;
  }

  return null;
}

/**
 * Sample/fallback products
 */
function getSampleProducts() {
  return {
    'Consumer': [
      {
        id: 'sample_1',
        type: 'Consumer',
        moduleName: 'Sample Consumer Product',
        name: 'Sample Consumer Product - Tier 1',
        tier: 'Tier 1',
        oneTimeFee: 5000,
        annualFee: 25000
      }
    ]
  };
}

module.exports = {
  loadProducts,
  clearCache: () => { cachedProducts = null; cacheTimestamp = null; }
};
