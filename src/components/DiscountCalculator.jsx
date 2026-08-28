import React from 'react';
import './DiscountCalculator.css';

function DiscountCalculator({
  discountType,
  discountAmount,
  discountPercentage,
  onTypeChange,
  onAmountChange,
  onPercentageChange
}) {
  return (
    <div className="discount-calculator">
      <div className="discount-type-selector">
        <label>
          <input
            type="radio"
            value="percentage"
            checked={discountType === 'percentage'}
            onChange={(e) => onTypeChange(e.target.value)}
          />
          Percentage Discount (%)
        </label>

        <label>
          <input
            type="radio"
            value="dollar"
            checked={discountType === 'dollar'}
            onChange={(e) => onTypeChange(e.target.value)}
          />
          Dollar Amount ($)
        </label>
      </div>

      <div className="discount-input">
        {discountType === 'percentage' ? (
          <div className="form-group">
            <label>Discount Percentage (Negative = Markup)</label>
            <div className="input-with-unit">
              <input
                type="number"
                step="0.1"
                value={discountPercentage}
                onChange={(e) => onPercentageChange(parseFloat(e.target.value) || 0)}
                placeholder="Enter percentage"
              />
              <span className="unit">%</span>
            </div>
            <p className="help-text">
              Positive values discount price. Negative values increase price (e.g., -10 = 10% markup).
            </p>
          </div>
        ) : (
          <div className="form-group">
            <label>Discount Amount (Negative = Markup)</label>
            <div className="input-with-unit">
              <span className="unit">$</span>
              <input
                type="number"
                step="0.01"
                value={discountAmount}
                onChange={(e) => onAmountChange(parseFloat(e.target.value) || 0)}
                placeholder="Enter dollar amount"
              />
            </div>
            <p className="help-text">
              Positive values discount price. Negative values increase price (e.g., -1000 = $1000 markup).
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default DiscountCalculator;
