/**
 * Format number as currency
 */
function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

/**
 * Get the end date of the current quarter
 */
function getQuarterEndDate(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth();

  let quarterEndMonth;

  if (month < 3) {
    // Q1: Jan-Mar, ends Mar 31
    quarterEndMonth = 2; // March (0-indexed)
  } else if (month < 6) {
    // Q2: Apr-Jun, ends Jun 30
    quarterEndMonth = 5; // June
  } else if (month < 9) {
    // Q3: Jul-Sep, ends Sep 30
    quarterEndMonth = 8; // September
  } else {
    // Q4: Oct-Dec, ends Dec 31
    quarterEndMonth = 11; // December
  }

  // Get last day of quarter month
  const nextMonth = new Date(year, quarterEndMonth + 1, 0);
  return nextMonth;
}

/**
 * Get quarter name (Q1, Q2, etc.)
 */
function getQuarterName(date = new Date()) {
  const month = date.getMonth();
  const year = date.getFullYear();

  if (month < 3) return `Q1 ${year}`;
  if (month < 6) return `Q2 ${year}`;
  if (month < 9) return `Q3 ${year}`;
  return `Q4 ${year}`;
}

/**
 * Format date as MM/DD/YYYY
 */
function formatDate(date) {
  if (typeof date === 'string') {
    date = new Date(date);
  }
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
}

/**
 * Calculate discount amount from percentage
 */
function calculateDiscount(baseAmount, discountPercent) {
  return baseAmount * (discountPercent / 100);
}

/**
 * Calculate selling price after discount
 */
function calculateSellingPrice(baseAmount, discountAmount, discountPercent) {
  let discount = 0;

  if (discountPercent) {
    discount = calculateDiscount(baseAmount, discountPercent);
  } else if (discountAmount) {
    discount = discountAmount;
  }

  return baseAmount - discount;
}

module.exports = {
  formatCurrency,
  getQuarterEndDate,
  getQuarterName,
  formatDate,
  calculateDiscount,
  calculateSellingPrice
};
