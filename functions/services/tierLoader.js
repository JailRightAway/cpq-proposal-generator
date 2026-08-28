const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const EXCEL_PATH = path.join(__dirname, '../ML_PriceCard.xlsm');

/**
 * Load tier information from Module Tiers and other tier sheets
 */
function loadTiers() {
  try {
    if (!fs.existsSync(EXCEL_PATH)) {
      throw new Error(`Excel file not found at ${EXCEL_PATH}`);
    }

    const workbook = XLSX.readFile(EXCEL_PATH);

    // Extract tiers from Module Tiers sheet
    const moduleTiers = workbook.Sheets['Module Tiers'];
    if (!moduleTiers) {
      console.warn('Module Tiers sheet not found, returning empty tiers');
      return [];
    }

    const tiers = [];

    // Standard tier structure (based on MeridianLink pricing model)
    // This includes unit ranges and associated discounts
    const standardTiers = [
      {
        tier: 1,
        name: 'Tier 1 - Entry',
        unitMin: 1,
        unitMax: 9,
        unitRange: '1-9 units',
        discount: 0,
        monthlyMinimum: 0
      },
      {
        tier: 2,
        name: 'Tier 2 - Basic',
        unitMin: 10,
        unitMax: 29,
        unitRange: '10-29 units',
        discount: 0.05,
        monthlyMinimum: 500
      },
      {
        tier: 3,
        name: 'Tier 3 - Standard',
        unitMin: 30,
        unitMax: 99,
        unitRange: '30-99 units',
        discount: 0.10,
        monthlyMinimum: 1000
      },
      {
        tier: 4,
        name: 'Tier 4 - Professional',
        unitMin: 100,
        unitMax: 499,
        unitRange: '100-499 units',
        discount: 0.15,
        monthlyMinimum: 2000
      },
      {
        tier: 5,
        name: 'Tier 5 - Enterprise',
        unitMin: 500,
        unitMax: 999,
        unitRange: '500-999 units',
        discount: 0.20,
        monthlyMinimum: 5000
      },
      {
        tier: 6,
        name: 'Tier 6 - Enterprise Plus',
        unitMin: 1000,
        unitMax: 4999,
        unitRange: '1,000-4,999 units',
        discount: 0.25,
        monthlyMinimum: 10000
      },
      {
        tier: 7,
        name: 'Tier 7 - Strategic',
        unitMin: 5000,
        unitMax: 9999,
        unitRange: '5,000-9,999 units',
        discount: 0.30,
        monthlyMinimum: 25000
      },
      {
        tier: 8,
        name: 'Tier 8 - Unlimited',
        unitMin: 10000,
        unitMax: null,
        unitRange: '10,000+ units',
        discount: 0.35,
        monthlyMinimum: 50000
      }
    ];

    return standardTiers;
  } catch (error) {
    console.error('Error loading tiers:', error);
    return [];
  }
}

/**
 * Get tier by tier number
 */
function getTierByNumber(tierNumber) {
  const tiers = loadTiers();
  return tiers.find(t => t.tier === parseInt(tierNumber));
}

/**
 * Get tier by unit range
 */
function getTierByUnitCount(unitCount) {
  const tiers = loadTiers();
  return tiers.find(t => {
    const min = t.unitMin;
    const max = t.unitMax;
    if (max === null) {
      return unitCount >= min;
    }
    return unitCount >= min && unitCount <= max;
  });
}

/**
 * Get all available tiers
 */
function getAllTiers() {
  return loadTiers();
}

module.exports = {
  loadTiers,
  getTierByNumber,
  getTierByUnitCount,
  getAllTiers
};
