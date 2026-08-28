import React, { useState } from 'react';
import './App.css';
import CustomerInfo from './components/CustomerInfo';
import ProductSelector from './components/ProductSelector';
import PricingTable from './components/PricingTable';
import DiscountCalculator from './components/DiscountCalculator';
import ProposalSummary from './components/ProposalSummary';

function App() {
  const [customerData, setCustomerData] = useState({
    name: '',
    contact: '',
    email: '',
    phone: '',
    billingAddress: {}
  });

  const [lineItems, setLineItems] = useState([]);
  const [discountType, setDiscountType] = useState('percentage');
  const [discountAmount, setDiscountAmount] = useState(0);
  const [discountPercentage, setDiscountPercentage] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleCustomerUpdate = (data) => {
    setCustomerData(data);
  };

  const handleAddProduct = (product) => {
    const newItem = {
      id: `item_${Date.now()}`,
      ...product,
      quantity: 1,
      year1Tier: null,
      year2Tier: null,
      year3Tier: null
    };
    setLineItems([...lineItems, newItem]);
  };

  const handleUpdateLineItem = (itemId, updates) => {
    setLineItems(lineItems.map(item =>
      item.id === itemId ? { ...item, ...updates } : item
    ));
  };

  const handleRemoveLineItem = (itemId) => {
    setLineItems(lineItems.filter(item => item.id !== itemId));
  };

  const handleGenerateProposal = async () => {
    if (!customerData.name || lineItems.length === 0) {
      alert('Please fill in customer name and add at least one product');
      return;
    }

    setIsGenerating(true);
    try {
      const proposalPayload = {
        customerName: customerData.name,
        customerContact: customerData.contact,
        customerEmail: customerData.email,
        customerPhone: customerData.phone,
        billingAddress: customerData.billingAddress,
        lineItems: lineItems,
        discountAmount: discountType === 'dollar' ? discountAmount : 0,
        discountPercentage: discountType === 'percentage' ? discountPercentage : 0,
        contractTermYears: 1
      };

      const response = await fetch('/api/proposals/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(proposalPayload)
      });

      if (!response.ok) {
        throw new Error('Failed to generate proposal');
      }

      // Download the document
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Proposal_${customerData.name}_${new Date().toISOString().split('T')[0]}.docx`;
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);
    } catch (error) {
      alert(`Error generating proposal: ${error.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>MeridianLink CPQ Proposal Generator</h1>
        <p>Create custom pricing proposals in minutes</p>
      </header>

      <main className="app-container">
        <section className="section">
          <h2>Customer Information</h2>
          <CustomerInfo onUpdate={handleCustomerUpdate} />
        </section>

        <section className="section">
          <h2>Products & Services</h2>
          <ProductSelector onAddProduct={handleAddProduct} />
        </section>

        {lineItems.length > 0 && (
          <>
            <section className="section">
              <h2>Pricing Details</h2>
              <PricingTable
                lineItems={lineItems}
                onUpdateItem={handleUpdateLineItem}
                onRemoveItem={handleRemoveLineItem}
              />
            </section>

            <section className="section">
              <h2>Discounts</h2>
              <DiscountCalculator
                discountType={discountType}
                discountAmount={discountAmount}
                discountPercentage={discountPercentage}
                onTypeChange={setDiscountType}
                onAmountChange={setDiscountAmount}
                onPercentageChange={setDiscountPercentage}
              />
            </section>

            <section className="section">
              <h2>Proposal Summary</h2>
              <ProposalSummary
                lineItems={lineItems}
                discountType={discountType}
                discountAmount={discountAmount}
                discountPercentage={discountPercentage}
              />
            </section>

            <section className="section actions">
              <button
                className="btn btn-primary btn-lg"
                onClick={handleGenerateProposal}
                disabled={isGenerating}
              >
                {isGenerating ? 'Generating...' : 'Generate Proposal'}
              </button>
              <p className="help-text">
                This will create a Word document with MeridianLink branding, ready to send to your customer.
              </p>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

export default App;
