import React, { useState, useEffect } from 'react';
import './ProposalSummary.css';

function ProposalSummary({ lineItems, discountType, discountAmount, discountPercentage }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    calculateSummary();
  }, [lineItems, discountType, discountAmount, discountPercentage]);

  const calculateSummary = async () => {
    if (lineItems.length === 0) return;

    setLoading(true);
    try {
      const response = await fetch('/api/proposals/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lineItems: lineItems,
          discountAmount: discountType === 'dollar' ? discountAmount : 0,
          discountPercentage: discountType === 'percentage' ? discountPercentage : 0
        })
      });

      if (response.ok) {
        const data = await response.json();
        setSummary(data.totals);
      }
    } catch (error) {
      console.error('Error calculating summary:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!summary) return <p>Enter products to see pricing summary...</p>;

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  return (
    <div className="proposal-summary">
      <div className="summary-cards">
        <div className="summary-card">
          <h4>Year 1</h4>
          <p className="amount">{formatCurrency(summary.year1 || 0)}</p>
        </div>

        <div className="summary-card">
          <h4>Year 2</h4>
          <p className="amount">{formatCurrency(summary.year2 || 0)}</p>
        </div>

        <div className="summary-card">
          <h4>Year 3</h4>
          <p className="amount">{formatCurrency(summary.year3 || 0)}</p>
        </div>

        <div className="summary-card highlight">
          <h4>Total Contract Value (TCV)</h4>
          <p className="amount tcv">{formatCurrency(summary.tcv || 0)}</p>
        </div>
      </div>

      <div className="summary-details">
        <h4>Pricing Breakdown</h4>
        <table>
          <tbody>
            <tr>
              <td>Subtotal:</td>
              <td className="amount">Will be calculated from products</td>
            </tr>
            {discountPercentage !== 0 && (
              <tr>
                <td>Discount ({discountPercentage}%):</td>
                <td className="amount discount">Auto-calculated</td>
              </tr>
            )}
            {discountAmount !== 0 && (
              <tr>
                <td>Discount (Fixed):</td>
                <td className="amount discount">{formatCurrency(discountAmount)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ProposalSummary;
