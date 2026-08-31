const fs = require('fs');
const path = require('path');

const PRICING_FILE = path.join(__dirname, '..', 'pricing-data', 'Module Tiers.json');

let cachedProducts = null;
let cacheTimestamp = null;
const CACHE_DURATION = 0; // No caching (for development/debugging)

// Manual tier range overrides for products where ranges can't be inferred from commitments
const TIER_RANGE_OVERRIDES = {
  'Decision Lender 4 - Indirect Lending': {
    'Tier 5': { min: 0, max: 2999 },
    'Tier 4': { min: 3000, max: 3999 },
    'Tier 3': { min: 4000, max: 7999 },
    'Tier 2': { min: 8000, max: 14999 },
    'Tier 1': { min: 15000, max: Infinity }
  }
};

/**
 * Load products from clean JSON pricing data
 */
async function loadProducts(forceRefresh = false) {
  console.log('[PricingDataLoader] loadProducts called, forceRefresh:', forceRefresh);

  if (!forceRefresh && cachedProducts && cacheTimestamp && Date.now() - cacheTimestamp < CACHE_DURATION) {
    console.log('[PricingDataLoader] Using cached products');
    return cachedProducts;
  }

  // Clear cache if forcing refresh
  if (forceRefresh) {
    cachedProducts = null;
    cacheTimestamp = null;
    console.log('[PricingDataLoader] Cache cleared, forcing refresh');
  }

  try {
    if (!fs.existsSync(PRICING_FILE)) {
      throw new Error(`Pricing file not found at ${PRICING_FILE}`);
    }

    console.log('[PricingDataLoader] Reading Module Tiers.json...');
    let jsonString = fs.readFileSync(PRICING_FILE, 'utf8');

    // Replace NaN with null (Python JSON exports NaN which isn't valid JSON)
    jsonString = jsonString.replace(/: NaN/g, ': null');

    const rawData = JSON.parse(jsonString);

    console.log(`[PricingDataLoader] Parsed ${rawData.length} rows`);

    const productsByType = parseProductsFromJson(rawData);
    console.log('[PricingDataLoader] parseProductsFromJson completed');

    cachedProducts = productsByType;
    cacheTimestamp = Date.now();
    console.log('[PricingDataLoader] Loaded products by type:', Object.keys(productsByType));

    return productsByType;
  } catch (error) {
    console.error('[PricingDataLoader] Error:', error.message);
    return {};
  }
}

/**
 * Parse products from JSON array structure
 */
function parseProductsFromJson(data) {
  console.log('[parseProductsFromJson] Starting to parse', data.length, 'rows');
  const productsByType = {
    'Consumer': [],
    'Mortgage': [],
    'Collect': [],
    'Access': [],
    'Insight': [],
    'Decision Lender': []
  };
  console.log('[parseProductsFromJson] Initialized productsByType with categories:', Object.keys(productsByType));

  let currentModuleName = null;
  let currentModuleHeader = null;
  let currentServiceLines = [];

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (!row || !row['Unnamed: 0']) continue;

    const firstCol = String(row['Unnamed: 0']).trim();

    // Check if this is a module header (starts with "MeridianLink" or "Decision Lender")
    // But exclude service lines (Setup Fee, Annual Fee, etc.)
    const isModuleHeader = (firstCol.startsWith('MeridianLink') || firstCol.startsWith('Decision Lender')) &&
      (firstCol.includes('Module') || firstCol.includes('Plan') || firstCol.includes('Volume') || (firstCol.includes('Insight') && (firstCol.includes('Mortgage') || firstCol.includes('Collect')))) &&
      !firstCol.includes('Setup Fee') && !firstCol.includes('Annual Fee');

    // Log Access module detection
    if (firstCol.includes('MeridianLink Access')) {
      console.log(`[parseProductsFromJson] Found Access-like row: "${firstCol}" | isModuleHeader=${isModuleHeader}`);
    }

    if (isModuleHeader) {
      console.log(`[parseProductsFromJson] Found module header: ${firstCol.substring(0, 80)}`);

      // Log all module names we encounter
      console.log(`[parseProductsFromJson] FULL MODULE NAME: "${firstCol}"`);

      // Process previous module if exists
      if (currentModuleName && currentServiceLines.length > 0) {
        // Log if this is the Direct Consumer module
        if (currentModuleName.includes('Direct Consumer Module Volume Plan')) {
          console.log(`[parseProductsFromJson] Detected Direct Consumer Module: ${currentModuleName}`);
        }

        let products;
        if (currentModuleName.includes('MeridianLink Access')) {
          console.log(`[parseProductsFromJson] Using parseAccessModule for: ${currentModuleName.substring(0, 50)}`);
          products = parseAccessModule(currentModuleName, currentModuleHeader, currentServiceLines);
        } else {
          products = parseModule(currentModuleName, currentModuleHeader, currentServiceLines);
        }
        const type = classifyType(currentModuleName);
        console.log(`[parseProductsFromJson] Module: ${currentModuleName.substring(0, 50)}... → Type: ${type}, Products: ${products.length}`);
        if (products.length > 0 && productsByType[type]) {
          productsByType[type].push(...products);
        } else if (products.length > 0) {
          console.warn(`[parseProductsFromJson] Type "${type}" not found in productsByType for module: ${currentModuleName.substring(0, 50)}`);
        }
      }

      // Start new module
      currentModuleName = firstCol;
      currentModuleHeader = row;
      currentServiceLines = [];
    } else if (currentModuleName) {
      // This is a service line for the current module
      currentServiceLines.push(row);
    }
  }

  // Process last module
  if (currentModuleName && currentServiceLines.length > 0) {
    // Log if this is the Direct Consumer module
    if (currentModuleName.includes('Direct Consumer Module Volume Plan')) {
      console.log(`[parseProductsFromJson] Detected Direct Consumer Module (LAST): ${currentModuleName}`);
    }

    let products;
    if (currentModuleName.includes('MeridianLink Access')) {
      console.log(`[parseProductsFromJson] Using parseAccessModule for (LAST): ${currentModuleName.substring(0, 50)}`);
      products = parseAccessModule(currentModuleName, currentModuleHeader, currentServiceLines);
    } else {
      products = parseModule(currentModuleName, currentModuleHeader, currentServiceLines);
    }
    const type = classifyType(currentModuleName);
    console.log(`[parseProductsFromJson] LAST Module: ${currentModuleName.substring(0, 50)}... → Type: ${type}, Products: ${products.length}`);
    if (products.length > 0 && productsByType[type]) {
      productsByType[type].push(...products);
    } else if (products.length > 0) {
      console.warn(`[parseProductsFromJson] Type "${type}" not found in productsByType for module: ${currentModuleName.substring(0, 50)}`);
    }
  }

  // Remove empty types
  Object.keys(productsByType).forEach(type => {
    if (productsByType[type].length === 0) {
      console.log(`[parseProductsFromJson] Removing empty type: ${type}`);
      delete productsByType[type];
    } else {
      console.log(`[parseProductsFromJson] Type ${type} has ${productsByType[type].length} products`);
    }
  });

  console.log('[parseProductsFromJson] Final productsByType:', Object.keys(productsByType));
  return productsByType;
}

/**
 * Special handler for MeridianLink Access - extracts tier ranges from volume row
 */
function parseAccessModule(moduleName, moduleHeader, serviceLines) {
  const products = [];

  // Find the "Direct Consumer Module Monthly App Volume" row which has the tier ranges
  let volumeRow = null;
  serviceLines.forEach(line => {
    const serviceName = String(line['Unnamed: 0'] || '').trim();
    if (serviceName.includes('Direct Consumer Module Monthly App Volume') ||
        serviceName.includes('Monthly App Volume')) {
      volumeRow = line;
    }
  });

  if (!volumeRow) {
    console.warn(`[PricingDataLoader] Access module missing volume row: ${moduleName}`);
    return products;
  }

  // Extract tier names and ranges from header row values
  // Group by tier name first (multiple columns can have same tier)
  const tiersByName = {};
  Object.keys(moduleHeader).forEach(columnKey => {
    const tierName = moduleHeader[columnKey];
    if (tierName && typeof tierName === 'string' && tierName.match(/^Tier\s+\d+$/)) {
      const volumeRange = volumeRow[columnKey];
      if (volumeRange) {
        if (!tiersByName[tierName]) {
          tiersByName[tierName] = [];
        }
        tiersByName[tierName].push({
          columnKey,
          tierName,
          volumeRange: String(volumeRange).trim()
        });
      }
    }
  });

  // For each tier, pick the column with actual numeric pricing (not ">")
  const tierData = [];
  const setupFeeRow = serviceLines.find(line =>
    String(line['Unnamed: 0'] || '').includes('Setup Fee')
  );

  Object.entries(tiersByName).forEach(([tierName, columns]) => {
    // Find the column with numeric pricing in the setup fee row
    const bestColumn = columns.find(col => {
      const price = setupFeeRow?.[col.columnKey];
      const priceStr = String(price || '').trim();
      return priceStr && priceStr !== '>' && priceStr !== 'NaN' && !isNaN(parseFloat(priceStr));
    }) || columns[0]; // Fall back to first if none have numeric pricing

    tierData.push(bestColumn);
  });

  console.log(`[PricingDataLoader] Access module found ${tierData.length} tiers`);
  console.log(`[PricingDataLoader] Access tier data before range parsing:`, tierData.map(t => `${t.tierName}: "${t.volumeRange}"`).join(' | '));

  // Parse ranges and build tier boundaries
  // First pass: parse all upper bounds and handle special cases
  const tiersByBound = []; // Array of {tierName, upperBound, tierNum}
  tierData.forEach((tier) => {
    const tierNum = parseInt(tier.tierName.match(/\d+/)[0]);
    let upperBound = null;

    if (tier.volumeRange === '>' || tier.volumeRange === '>') {
      // Tier 1 is unlimited, Tier 6 is lowest
      upperBound = tierNum === 1 ? Infinity : (tierNum === 6 ? 500 : null);
    } else {
      const rangeObj = parseVolumeRange(tier.volumeRange);
      upperBound = rangeObj.max;
    }

    tiersByBound.push({
      tierName: tier.tierName,
      tierNum: tierNum,
      upperBound: upperBound,
      columnKey: tier.columnKey,
      volumeRange: tier.volumeRange
    });
  });

  // Sort by upper bound ascending (lowest tier first)
  tiersByBound.sort((a, b) => {
    if (a.upperBound === Infinity) return 1;
    if (b.upperBound === Infinity) return -1;
    return a.upperBound - b.upperBound;
  });

  console.log(`[PricingDataLoader] Access tiers sorted by bound:`, tiersByBound.map(t => `${t.tierName}: up to ${t.upperBound === Infinity ? '∞' : t.upperBound}`).join(' | '));

  // Second pass: assign min/max based on sorted order
  tiersByBound.forEach((tier, idx) => {
    if (tier.upperBound === Infinity) {
      // Tier 1: start from 8000
      tier.min = 8000;
      tier.max = Infinity;
    } else if (idx === 0) {
      // First tier (lowest bound): start from 0
      tier.min = 0;
      tier.max = tier.upperBound;
    } else {
      // Subsequent tiers: start from previous tier's max + 1
      tier.min = tiersByBound[idx - 1].upperBound + 1;
      tier.max = tier.upperBound;
    }
  });

  console.log(`[PricingDataLoader] Access tier ranges after boundary calc:`, tiersByBound.map(t => `${t.tierName}: ${t.min}-${t.max === Infinity ? '∞' : t.max}`).join(' | '));

  // Update tierData with the new ranges
  tierData.forEach(tier => {
    const boundData = tiersByBound.find(t => t.tierName === tier.tierName);
    if (boundData) {
      tier.min = boundData.min;
      tier.max = boundData.max;
    }
  });

  // Create products for each tier
  tierData.forEach((tierInfo, tierIdx) => {
    const product = {
      id: `prod_${Date.now()}_access_${tierIdx}`,
      type: 'Access',
      moduleName: moduleName,
      name: 'MeridianLink Access',
      tier: tierInfo.tierName,
      tierIndex: tierIdx,
      tierRange: tierInfo.volumeRange,
      columnKey: tierInfo.columnKey,
      services: {},
      totalSetupFee: 0,
      totalAnnualFee: 0,
      tierMin: tierInfo.min,
      tierMax: tierInfo.max
    };

    // Debug: log what we're looking for
    if (tierIdx === 0) {
      console.log(`[parseAccessModule] Tier 1 - looking in column: ${tierInfo.columnKey}, serviceLines count: ${serviceLines.length}`);
    }

    // Extract pricing from service lines
    serviceLines.forEach(serviceLine => {
      const serviceName = serviceLine['Unnamed: 0'];
      if (!serviceName) return;

      const serviceNameTrimmed = String(serviceName).trim();
      let price = serviceLine[tierInfo.columnKey];

      // Debug: log prices for Tier 1
      if (tierIdx === 0) {
        console.log(`[parseAccessModule] Tier 1 - "${serviceNameTrimmed}" raw price: ${price} (type: ${typeof price})`);
      }

      // Convert string prices (with $ and commas) to numbers
      if (typeof price === 'string') {
        price = parseFloat(price.replace(/[$,]/g, ''));
      }

      if (typeof price === 'number' && price > 0) {
        product.services[serviceNameTrimmed] = price;

        if (serviceNameTrimmed.toLowerCase().includes('setup')) {
          product.totalSetupFee += price;
        } else if (serviceNameTrimmed.toLowerCase().includes('per') &&
                   (serviceNameTrimmed.toLowerCase().includes('app') ||
                    serviceNameTrimmed.toLowerCase().includes('file') ||
                    serviceNameTrimmed.toLowerCase().includes('transaction'))) {
          // Extract per-transaction fee separately, don't add to annual fees
          product.perFileFee = price;
        } else if (!serviceNameTrimmed.includes('Monthly')) {
          // Only add to annual fees if it's not a per-transaction fee
          product.totalAnnualFee += price;
        }
      }
    });

    // Debug: log final totals for Tier 1
    if (tierIdx === 0) {
      console.log(`[parseAccessModule] Tier 1 - FINAL: totalSetupFee=${product.totalSetupFee}, totalAnnualFee=${product.totalAnnualFee}`);
    }

    // Always add products, even with $0 pricing (so all tiers are available for matching)
    product.oneTimeFee = product.totalSetupFee;
    product.annualFee = product.totalAnnualFee;
    products.push(product);
  });

  console.log(`[PricingDataLoader] Access module created ${products.length} products:`, products.map(p => `${p.tier}(${p.tierMin}-${p.tierMax === Infinity ? '∞' : p.tierMax}) setup=$${p.oneTimeFee} annual=$${p.annualFee}`).join(' | '));
  return products;
}

/**
 * Special handler for Direct Consumer Module - splits into two product types
 */
function parseDirectConsumerModule(moduleName, moduleHeader, serviceLines) {
  const products = [];
  const tiers = extractTiersFromHeader(moduleHeader, moduleName, serviceLines);

  if (tiers.length === 0) {
    console.warn(`[PricingDataLoader] No tiers found for module: ${moduleName}`);
    return products;
  }

  console.log(`[PricingDataLoader] Splitting Direct Consumer Module into two products - Found ${tiers.length} tiers`);

  // Helper function to create a product with specific setup fee type
  const createProductForSetupType = (tierIdx, tier, setupFeeType, productName) => {
    const product = {
      id: `prod_${Date.now()}_${setupFeeType}_${tierIdx}`,
      type: 'Consumer',
      moduleName: moduleName,
      name: productName,
      tier: tier.tierName,
      tierIndex: tierIdx,
      tierRange: tier.tierRange,
      tierMin: tier.tierMin,
      tierMax: tier.tierMax,
      columnKey: tier.columnKey,
      services: {},
      totalSetupFee: 0,
      totalAnnualFee: 0
    };

    // Extract pricing for this tier
    serviceLines.forEach(serviceLine => {
      const serviceName = serviceLine['Unnamed: 0'];
      if (!serviceName) return;

      const serviceNameTrimmed = String(serviceName).trim();
      const price = serviceLine[tier.columnKey];

      if (typeof price === 'number') {
        // Add matching setup fee
        if (serviceNameTrimmed.includes(setupFeeType)) {
          if (price > 0) {
            product.services[serviceNameTrimmed] = price;
            product.totalSetupFee += price;
          }
        }
        // Add shared fees (Monthly Minimum, Per Application)
        else if (serviceNameTrimmed.includes('Monthly Minimum') ||
                 serviceNameTrimmed.includes('Per Application')) {
          if (price > 0) {
            product.services[serviceNameTrimmed] = price;
            product.totalAnnualFee += price;

            // Extract per-app fee
            if (serviceNameTrimmed.toLowerCase().includes('per') &&
                (serviceNameTrimmed.toLowerCase().includes('app') ||
                 serviceNameTrimmed.toLowerCase().includes('file') ||
                 serviceNameTrimmed.toLowerCase().includes('transaction'))) {
              product.perFileFee = price;
            }
          }
        }
      }
    });

    if (product.totalSetupFee > 0 || product.totalAnnualFee > 0) {
      product.oneTimeFee = product.totalSetupFee;
      product.annualFee = product.totalAnnualFee;
      return product;
    }
    return null;
  };

  // Create products for "Direct Consumer" using "Direct Consumer Loans Setup Fee"
  tiers.forEach((tier, tierIdx) => {
    const product = createProductForSetupType(tierIdx, tier, 'Direct Consumer', 'MeridianLink Consumer - Direct Consumer');
    if (product) {
      product.moduleName = 'MeridianLink Consumer - Direct Consumer Module Volume Plan';
      products.push(product);
    }
  });

  // Create products for "ML Opening" using "MeridianLink Opening Setup Fee"
  tiers.forEach((tier, tierIdx) => {
    const product = createProductForSetupType(tierIdx, tier, 'MeridianLink Opening', 'ML Opening');
    if (product) {
      product.moduleName = 'ML Opening Module';  // Different module name for grouping
      products.push(product);
    } else {
      console.warn(`[PricingDataLoader] ML Opening product for tier ${tier.tierName} had no pricing`);
    }
  });

  console.log(`[PricingDataLoader] Direct Consumer Module split into ${products.length} products`);
  console.log(`[PricingDataLoader] Service lines available:`, serviceLines.map(s => s['Unnamed: 0']).filter(Boolean));
  return products;
}

/**
 * Parse a single module into tier-based products
 */
function parseModule(moduleName, moduleHeader, serviceLines) {
  // Special case: Split "Direct Consumer Module Volume Plan" into two products
  if (moduleName.includes('Direct Consumer Module Volume Plan')) {
    return parseDirectConsumerModule(moduleName, moduleHeader, serviceLines);
  }

  // Special case: Handle "MeridianLink Access" (both Mortgage and Consumer versions)
  // Consumer Access is for tier-based pricing, Mortgage Access is standard
  if (moduleName.includes('MeridianLink Access')) {
    // Check if this is Mortgage Access (which has "Mortgage" in the name)
    const isMortgageAccess = moduleName.includes('Mortgage');

    if (!isMortgageAccess) {
      console.log(`[PricingDataLoader] Detected Consumer MeridianLink Access module: ${moduleName}`);
      return parseAccessModule(moduleName, moduleHeader, serviceLines);
    }
    // Mortgage Access is handled by standard parsing below
  }

  const products = [];

  if (!moduleHeader) return products;

  // Extract tier columns from header row
  // Tier columns have long descriptive names like "MeridianLink Consumer - Consumer Module Tier 12 (up to 249 apps)"
  const tiers = extractTiersFromHeader(moduleHeader, moduleName, serviceLines);

  if (tiers.length === 0) {
    console.warn(`[PricingDataLoader] No tiers found for module: ${moduleName}`);
    return products;
  }

  console.log(`[PricingDataLoader] Module: ${moduleName} - Found ${tiers.length} tiers`);

  // Create a product for each tier
  tiers.forEach((tier, tierIdx) => {
    // Extract clean product name (remove "Volume Plan" suffix)
    const cleanName = moduleName
      .replace(/\s+Volume\s+Plan\s*$/i, '')
      .replace(/\s*-\s*$/i, '');

    const product = {
      id: `prod_${Date.now()}_${tierIdx}`,
      type: classifyType(moduleName),
      moduleName: moduleName,
      name: cleanName,
      tier: tier.tierName,
      tierIndex: tierIdx,
      tierRange: tier.tierRange,
      tierMin: tier.tierMin,
      tierMax: tier.tierMax,
      columnKey: tier.columnKey,
      services: {},
      totalSetupFee: 0,
      totalAnnualFee: 0
    };

    // Extract pricing for this tier from all service lines
    serviceLines.forEach(serviceLine => {
      const serviceName = serviceLine['Unnamed: 0'];
      if (!serviceName) return;

      const serviceNameTrimmed = String(serviceName).trim();
      const price = serviceLine[tier.columnKey];

      if (typeof price === 'number' && price > 0) {
        product.services[serviceNameTrimmed] = price;

        // Categorize as setup or annual
        if (serviceNameTrimmed.toLowerCase().includes('setup')) {
          product.totalSetupFee += price;
        } else {
          product.totalAnnualFee += price;
        }

        // Extract per-app fee (Per Application Fee, Per File Fee, Per Transaction, etc.)
        if (serviceNameTrimmed.toLowerCase().includes('per') &&
            (serviceNameTrimmed.toLowerCase().includes('app') ||
             serviceNameTrimmed.toLowerCase().includes('file') ||
             serviceNameTrimmed.toLowerCase().includes('transaction'))) {
          product.perFileFee = price;
        }
      }
    });

    // Only add if has pricing
    if (product.totalSetupFee > 0 || product.totalAnnualFee > 0) {
      product.oneTimeFee = product.totalSetupFee;
      product.annualFee = product.totalAnnualFee;
      products.push(product);
    }
  });

  return products;
}

/**
 * Parse volume range from description like "(up to 249 apps)" or "(250-499 apps)"
 * Returns {min, max} for volume-based tier matching
 */
function parseVolumeRange(rangeStr) {
  if (!rangeStr) return { min: 0, max: Infinity };

  const str = String(rangeStr).trim();

  // Match "Unlimited" or "unlimited"
  if (/unlimited/i.test(str)) {
    return { min: 8000, max: Infinity };  // Tier 1 starts at 8000
  }

  // Match "greater than X" or "X or more"
  const greaterMatch = str.match(/greater\s+than\s+([\d,]+)/i) || str.match(/^([\d,]+)\s+or\s+more/i);
  if (greaterMatch) {
    const min = parseInt(greaterMatch[1].replace(/,/g, ''));
    return { min, max: Infinity };
  }

  // Match "(up to X apps)" or "up to X" format
  const upToMatch = str.match(/up\s+to\s+([\d,]+)/i);
  if (upToMatch) {
    const max = parseInt(upToMatch[1].replace(/,/g, ''));
    return { min: 0, max: max };
  }

  // Match "(X-Y apps)" format
  const rangeMatch = str.match(/^([\d,]+)-([\d,]+)/);
  if (rangeMatch) {
    const min = parseInt(rangeMatch[1].replace(/,/g, ''));
    const max = parseInt(rangeMatch[2].replace(/,/g, ''));
    return { min, max };
  }

  // Match "(X+ apps)" format
  const plusMatch = str.match(/^([\d,]+)\+/);
  if (plusMatch) {
    const min = parseInt(plusMatch[1].replace(/,/g, ''));
    return { min, max: Infinity };
  }

  return { min: 0, max: Infinity };
}

/**
 * Extract tier information from module header row
 * Finds both "Tier X" format and "10-14" range format
 */
function extractTiersFromHeader(headerRow, productType, serviceLines) {
  const tiers = [];
  const tierMap = new Map(); // Map to avoid duplicates

  // Determine if this is a Consumer/Collect/Decision Lender product (uses Tier numbering)
  // or Mortgage/other product (uses volume range numbering)
  const isConsumerOrCollect = productType && (productType.includes('Consumer') || productType.includes('Collect') || productType.includes('Decision Lender'));
  console.log(`[extractTiersFromHeader] Product type: ${productType}, isConsumerOrCollect: ${isConsumerOrCollect}`);

  // Store tier info as we find it, will populate ranges later
  const tiersByColumn = {}; // Map columnKey -> tierName

  Object.entries(headerRow).forEach(([columnKey, columnValue]) => {
    if (!columnValue) return;

    const keyStr = String(columnKey).trim();
    const colStr = String(columnValue).trim();

    if (!colStr || colStr.startsWith('MeridianLink')) return; // Skip module/product names

    // Extract range from column KEY (header), not column VALUE
    // Column key format: "MeridianLink Consumer - Consumer Module Tier 12 (up to 249 apps)"
    let volumeRange = null;
    let tierRangeStr = '';

    if (keyStr.includes('(') && keyStr.includes(')')) {
      const rangeMatch = keyStr.match(/\((.*?)\)/);
      tierRangeStr = rangeMatch ? rangeMatch[1] : '';
      volumeRange = parseVolumeRange(tierRangeStr);
    }

    // Check for "Tier X" format in the column VALUE
    const tierMatch = colStr.match(/^Tier\s+(\d+|01|02|03|04|05|06|07|08|09|10|11|12)$/i);
    if (tierMatch) {
      const tierNum = parseInt(tierMatch[1]);
      const tierName = `Tier ${tierNum}`;

      // Store column key mapping for later range extraction from commitment rows
      tiersByColumn[columnKey] = { tierName, tierNum, tierRangeStr };

      // Use range extracted from column key, or default if not found
      const tierMin = volumeRange ? volumeRange.min : 0;
      const tierMax = volumeRange ? volumeRange.max : Infinity;

      tierMap.set(tierName, {
        columnKey: columnKey,
        tierName: tierName,
        tierRange: tierRangeStr || tierName,
        tierMin: tierMin,
        tierMax: tierMax,
        sortKey: tierNum,
        perFileFee: 0  // Will be populated later from serviceLines
      });
      return;
    }

    // Check for range format like "10-14" or "1200+"
    const rangeMatch = colStr.match(/^(\d+)-(\d+)$|^(\d+)\+$/);
    if (rangeMatch) {
      const tierName = colStr;
      const startNum = parseInt(rangeMatch[1] || rangeMatch[3]);
      const volumeRange = rangeMatch[1] && rangeMatch[2]
        ? { min: startNum, max: parseInt(rangeMatch[2]) }
        : { min: startNum, max: Infinity };

      tierMap.set(tierName, {
        columnKey: columnKey,
        tierName: tierName,
        tierRange: `${tierName} units`,
        tierMin: volumeRange.min,
        tierMax: volumeRange.max,
        sortKey: startNum,
        perFileFee: 0  // Will be populated later from serviceLines
      });
      return;
    }

    // Check for range with parenthetical (e.g., "Tier 12 (up to 249 apps)")
    if (colStr.includes('Tier') && colStr.includes('(')) {
      const tierNumMatch = colStr.match(/Tier\s+(\d+)/i);
      const rangeMatch = colStr.match(/\((.*?)\)/);
      if (tierNumMatch) {
        const tierNum = tierNumMatch[1];
        const tierName = `Tier ${tierNum}`;
        const tierRangeStr = rangeMatch ? rangeMatch[1] : '';
        const volumeRange = parseVolumeRange(tierRangeStr);

        tierMap.set(tierName, {
          columnKey: columnKey,
          tierName: tierName,
          tierRange: tierRangeStr,
          tierMin: volumeRange.min,
          tierMax: volumeRange.max,
          sortKey: parseInt(tierNum),
          perFileFee: 0  // Will be populated later from serviceLines
        });
      }
    }
  });

  // Convert to array and sort
  let tierArray = Array.from(tierMap.values());

  // Check if there's a manual override for this product
  const override = TIER_RANGE_OVERRIDES[productType];
  if (override) {
    console.log(`[extractTiersFromHeader] Using manual tier range override for: ${productType}`);
    const tierRangesDebug = [];
    tierArray.forEach(tier => {
      if (override[tier.tierName]) {
        const rangeOverride = override[tier.tierName];
        tier.tierMin = rangeOverride.min;
        tier.tierMax = rangeOverride.max;
        tierRangesDebug.push(`${tier.tierName}: ${tier.tierMin}-${tier.tierMax === Infinity ? '∞' : tier.tierMax}`);
      }
    });
    console.log('[extractTiersFromHeader] ALL TIER RANGES (from override):', tierRangesDebug.join(' | '));
  } else if (Object.keys(tiersByColumn).length > 0) {
    // For other products, extract actual volume ranges from commitment rows
    // Find row with volume thresholds (e.g., "Minimum Monthly Application Commitment")
    const commitmentRow = serviceLines?.find(line => {
      const name = String(line['Unnamed: 0'] || '').toLowerCase();
      return name.includes('minimum') && name.includes('application') && name.includes('commitment');
    });

    if (commitmentRow) {
      console.log('[extractTiersFromHeader] Extracting tier ranges from commitment row');
      const commitmentValues = [];

      // Extract commitment values for each tier column
      Object.entries(tiersByColumn).forEach(([columnKey, tierInfo]) => {
        const value = commitmentRow[columnKey];
        if (typeof value === 'number' && value >= 0) {
          commitmentValues.push({ columnKey, value, ...tierInfo });
        }
      });

      if (commitmentValues.length > 0) {
        // Sort by value (commitment amounts ascending)
        commitmentValues.sort((a, b) => a.value - b.value);

        console.log('[extractTiersFromHeader] COMMITMENT VALUES (sorted):', commitmentValues.map(c => `${c.tierName}: ${c.value}`).join(', '));

        // Update tier ranges based on commitment thresholds
        // Each tier's commitment value is the MINIMUM volume for that tier
        const tierRangesDebug = [];
        commitmentValues.forEach((curr, idx) => {
          const tierData = tierMap.get(curr.tierName);
          if (tierData) {
            // tierMin = current tier's commitment value
            const tierMin = curr.value;
            // tierMax = next tier's commitment value - 1, or Infinity for last tier
            const tierMax = idx < commitmentValues.length - 1 ? (commitmentValues[idx + 1].value - 1) : Infinity;
            tierData.tierMin = tierMin;
            tierData.tierMax = tierMax;
            tierRangesDebug.push(`${curr.tierName}: ${tierMin}-${tierMax === Infinity ? '∞' : tierMax}`);
          }
        });

        console.log('[extractTiersFromHeader] ALL TIER RANGES:', tierRangesDebug.join(' | '));

        tierArray = Array.from(tierMap.values());
      }
    }
  }

  // Extract per-transaction fees for each tier from serviceLines
  if (serviceLines && serviceLines.length > 0) {
    // Find row with per-transaction or per-app fee
    const transactionFeeRow = serviceLines.find(line => {
      const name = String(line['Unnamed: 0'] || '').toLowerCase();
      return (name.includes('per') || name.includes('transaction')) &&
             (name.includes('application') || name.includes('file') || name.includes('app'));
    });

    if (transactionFeeRow) {
      console.log('[extractTiersFromHeader] Extracting per-transaction fees from serviceLines');
      tierArray.forEach(tier => {
        if (tier.columnKey && transactionFeeRow[tier.columnKey]) {
          const fee = transactionFeeRow[tier.columnKey];
          if (typeof fee === 'number') {
            tier.perFileFee = fee;
            console.log(`[extractTiersFromHeader] ${tier.tierName}: perFileFee = ${fee}`);
          }
        }
      });
    }
  }

  console.log(`[extractTiersFromHeader] Extracted ${tierArray.length} tiers:`, tierArray.map(t => ({
    name: t.tierName,
    range: t.tierRange,
    min: t.tierMin,
    max: t.tierMax,
    perFileFee: t.perFileFee
  })));

  // Sort: Consumer/Collect products by Tier number descending (Tier 12/4 first)
  // Mortgage products by range start ascending (10-14 first)
  return tierArray.sort((a, b) => {
    // If both are "Tier X" format, sort by tier number descending
    if (a.tierName.startsWith('Tier') && b.tierName.startsWith('Tier')) {
      return b.sortKey - a.sortKey;
    }
    // If both are range format, sort by start number ascending
    if (!a.tierName.startsWith('Tier') && !b.tierName.startsWith('Tier')) {
      return a.sortKey - b.sortKey;
    }
    // Mixed formats - shouldn't happen
    return 0;
  });
}

/**
 * Classify product type
 */
function classifyType(moduleName) {
  // Check Insight FIRST to catch "Insight for X" variants before checking X
  if (moduleName.includes('Insight')) return 'Insight';
  // Then check other specific types
  if (moduleName.includes('Decision Lender')) return 'Decision Lender';
  if (moduleName.includes('Mortgage')) return 'Mortgage';
  if (moduleName.includes('Collect')) return 'Collect';
  if (moduleName.includes('Access')) return 'Access';
  if (moduleName.includes('Consumer') || moduleName.includes('Indirect') ||
      moduleName.includes('Business') || moduleName.includes('Home Equity')) return 'Consumer';
  return 'Other';
}

/**
 * Load add-ons (Mortgage, etc.) from JSON
 */
async function loadAddOns(addonType = 'Mortgage', forceRefresh = false) {
  console.log('[AddOnsLoader] loadAddOns called for type:', addonType);

  const ADDON_FILE = path.join(__dirname, '..', 'pricing-data', `Add Ons - ${addonType}.json`);

  try {
    if (!fs.existsSync(ADDON_FILE)) {
      throw new Error(`Add-ons file not found at ${ADDON_FILE}`);
    }

    console.log(`[AddOnsLoader] Reading Add Ons - ${addonType}.json...`);
    let jsonString = fs.readFileSync(ADDON_FILE, 'utf8');

    // Replace NaN with null
    jsonString = jsonString.replace(/: NaN/g, ': null');

    const rawData = JSON.parse(jsonString);
    console.log(`[AddOnsLoader] Parsed ${rawData.length} rows`);

    const addOnsByCategory = parseAddOnsFromJson(rawData);
    console.log('[AddOnsLoader] parseAddOnsFromJson completed');
    console.log('[AddOnsLoader] Add-on categories:', Object.keys(addOnsByCategory));

    return addOnsByCategory;
  } catch (error) {
    console.error('[AddOnsLoader] Error:', error.message);
    return {};
  }
}

/**
 * Parse add-ons from JSON array structure
 * Groups add-ons by category (e.g., "Add On - Core Conversion", "Add On - Document Prep")
 * Handles rows where category is null by using the previous category (state machine)
 */
function parseAddOnsFromJson(data) {
  console.log('[parseAddOnsFromJson] Starting to parse', data.length, 'rows');

  const addOnsByCategory = {};
  let headerRowFound = false;
  let currentCategory = null;  // State machine for when category is null

  for (let i = 0; i < data.length; i++) {
    const row = data[i];

    // Skip rows with no data or NaN columns
    if (!row || !row['Unnamed: 2']) continue;

    // Identify header row
    if (row['Unnamed: 0'] === 'Product Of (Primary Service)' || row['Unnamed: 2'] === 'Internal Product Name') {
      headerRowFound = true;
      console.log('[parseAddOnsFromJson] Found header row at index', i);
      continue;
    }

    // Skip rows until header is found
    if (!headerRowFound) continue;

    // Extract fields
    const productName = String(row['Unnamed: 2']).trim();
    const categoryValue = row['Unnamed: 1'];
    const notes = row['Unnamed: 3'] ? String(row['Unnamed: 3']).trim() : '';
    const oneTimePrice = typeof row['Unnamed: 4'] === 'number' ? row['Unnamed: 4'] : 0;
    const annualPrice = typeof row['Unnamed: 5'] === 'number' ? row['Unnamed: 5'] : 0;
    const transactionFee = typeof row['Unnamed: 6'] === 'number' ? row['Unnamed: 6'] : 0;

    // Skip if product name is empty
    if (!productName) continue;

    // Update current category if this row has a category value
    if (categoryValue && String(categoryValue).trim() !== '') {
      currentCategory = String(categoryValue).trim();
    }

    // Skip if we don't have a category yet
    if (!currentCategory) continue;

    // Initialize category array if needed
    if (!addOnsByCategory[currentCategory]) {
      addOnsByCategory[currentCategory] = [];
    }

    // Check for custom pricing flags (negative values like -1234 mean custom pricing needed)
    const customPricing = oneTimePrice < 0 || annualPrice < 0 || transactionFee < 0;

    // Determine pricing model
    let pricingModel = 'unknown';
    if (customPricing) {
      pricingModel = 'custom';
    } else if (oneTimePrice > 0 && annualPrice > 0) pricingModel = 'one-time+annual';
    else if (oneTimePrice > 0 && transactionFee > 0) pricingModel = 'one-time+transaction';
    else if (annualPrice > 0 && transactionFee > 0) pricingModel = 'annual+transaction';
    else if (oneTimePrice > 0) pricingModel = 'one-time';
    else if (annualPrice > 0) pricingModel = 'annual';
    else if (transactionFee > 0) pricingModel = 'transaction';

    // Extract tier info if present (for volume-based add-ons)
    const tierInfo = extractAddOnTierInfo(productName);

    // Mark which fields need custom input (negative values)
    const customFields = {
      oneTime: oneTimePrice < 0,
      annual: annualPrice < 0,
      transaction: transactionFee < 0
    };

    const addOn = {
      name: productName,
      category: currentCategory,
      notes: notes,
      oneTimeFee: oneTimePrice > 0 ? oneTimePrice : 0,  // Changed from oneTimePrice to oneTimeFee
      annualFee: annualPrice > 0 ? annualPrice : 0,      // Changed from annualPrice to annualFee
      transactionFee: transactionFee > 0 ? transactionFee : 0,
      pricingModel: pricingModel,
      customFields: customPricing ? customFields : null, // Only include if custom pricing needed
      requiresCustomInput: customPricing,
      ...tierInfo // Include tier info if it exists (tier, tierMin, tierMax)
    };

    addOnsByCategory[currentCategory].push(addOn);

    console.log(`[parseAddOnsFromJson] Added: ${productName} (${pricingModel})`);
  }

  // Log summary
  Object.entries(addOnsByCategory).forEach(([category, items]) => {
    console.log(`[parseAddOnsFromJson] Category "${category}": ${items.length} items`);
  });

  return addOnsByCategory;
}

/**
 * Extract tier information from add-on product names
 * Examples:
 *   "MeridianLink Insight For Mortgage Tier 01 (1200+ Closed Loans/Mon)" → {tier: "Tier 01", tierMin: 1200, tierMax: Infinity}
 *   "MeridianLink Mortgage Access Tier 02 (900-1199 Closed Loans/Month)" → {tier: "Tier 02", tierMin: 900, tierMax: 1199}
 */
function extractAddOnTierInfo(productName) {
  // Match patterns like "Tier 01" or "Tier 1"
  const tierMatch = productName.match(/Tier\s+(\d+)/i);
  if (!tierMatch) return {}; // Not a tiered add-on

  const tierNum = tierMatch[1];

  // Try to match range patterns
  // Pattern 1: "1200+ Closed Loans" → min=1200, max=Infinity
  const rangeMatch1 = productName.match(/(\d+)\+\s*Closed\s+Loans/i);
  if (rangeMatch1) {
    const min = parseInt(rangeMatch1[1]);
    return {
      tier: `Tier ${tierNum}`,
      tierMin: min,
      tierMax: Infinity
    };
  }

  // Pattern 2: "900-1199 Closed Loans" → min=900, max=1199
  const rangeMatch2 = productName.match(/(\d+)\s*-\s*(\d+)\s*Closed\s+Loans/i);
  if (rangeMatch2) {
    const min = parseInt(rangeMatch2[1]);
    const max = parseInt(rangeMatch2[2]);
    return {
      tier: `Tier ${tierNum}`,
      tierMin: min,
      tierMax: max
    };
  }

  // If no range found, just return the tier name
  return {
    tier: `Tier ${tierNum}`,
    tierMin: null,
    tierMax: null
  };
}

module.exports = {
  loadProducts,
  loadAddOns
};
