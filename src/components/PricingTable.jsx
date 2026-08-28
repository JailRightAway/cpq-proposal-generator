import React from 'react';
import './PricingTable.css';

function PricingTable({ lineItems, onUpdateItem, onRemoveItem }) {
  const handleQuantityChange = (itemId, value) => {
    onUpdateItem(itemId, { quantity: parseInt(value) || 1 });
  };

  const handleTierChange = (itemId, year, value) => {
    onUpdateItem(itemId, { [`year${year}Tier`]: value || null });
  };

  return (
    <div className="pricing-table-container">
      <table className="pricing-table">
        <thead>
          <tr>
            <th>Product</th>
            <th>Qty</th>
            <th>Year 1 Tier</th>
            <th>Year 2 Tier</th>
            <th>Year 3 Tier</th>
            <th>List Price</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {lineItems.map(item => (
            <tr key={item.id}>
              <td>{item.name}</td>
              <td>
                <input
                  type="number"
                  min="1"
                  value={item.quantity || 1}
                  onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                  className="qty-input"
                />
              </td>
              <td>
                <select
                  value={item.year1Tier || ''}
                  onChange={(e) => handleTierChange(item.id, 1, e.target.value)}
                  className="tier-select"
                >
                  <option value="">None</option>
                  <option value="1">Tier 1 (1-9)</option>
                  <option value="2">Tier 2 (10-29)</option>
                  <option value="3">Tier 3 (30-99)</option>
                  <option value="4">Tier 4 (100-499)</option>
                  <option value="5">Tier 5 (500-999)</option>
                  <option value="6">Tier 6 (1000-4999)</option>
                  <option value="7">Tier 7 (5000-9999)</option>
                  <option value="8">Tier 8 (10000+)</option>
                </select>
              </td>
              <td>
                <select
                  value={item.year2Tier || ''}
                  onChange={(e) => handleTierChange(item.id, 2, e.target.value)}
                  className="tier-select"
                >
                  <option value="">None</option>
                  <option value="1">Tier 1 (1-9)</option>
                  <option value="2">Tier 2 (10-29)</option>
                  <option value="3">Tier 3 (30-99)</option>
                  <option value="4">Tier 4 (100-499)</option>
                  <option value="5">Tier 5 (500-999)</option>
                  <option value="6">Tier 6 (1000-4999)</option>
                  <option value="7">Tier 7 (5000-9999)</option>
                  <option value="8">Tier 8 (10000+)</option>
                </select>
              </td>
              <td>
                <select
                  value={item.year3Tier || ''}
                  onChange={(e) => handleTierChange(item.id, 3, e.target.value)}
                  className="tier-select"
                >
                  <option value="">None</option>
                  <option value="1">Tier 1 (1-9)</option>
                  <option value="2">Tier 2 (10-29)</option>
                  <option value="3">Tier 3 (30-99)</option>
                  <option value="4">Tier 4 (100-499)</option>
                  <option value="5">Tier 5 (500-999)</option>
                  <option value="6">Tier 6 (1000-4999)</option>
                  <option value="7">Tier 7 (5000-9999)</option>
                  <option value="8">Tier 8 (10000+)</option>
                </select>
              </td>
              <td>${((item.oneTimeFee || 0) + (item.annualFee || 0)).toLocaleString()}</td>
              <td>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => onRemoveItem(item.id)}
                >
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default PricingTable;
