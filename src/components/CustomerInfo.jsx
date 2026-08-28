import React, { useState } from 'react';
import './CustomerInfo.css';

function CustomerInfo({ onUpdate }) {
  const [formData, setFormData] = useState({
    name: '',
    contact: '',
    email: '',
    phone: '',
    billingAddress: {
      street: '',
      city: '',
      state: '',
      postalCode: '',
      country: 'USA'
    }
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;

    if (name.startsWith('address_')) {
      const addressField = name.replace('address_', '');
      setFormData({
        ...formData,
        billingAddress: {
          ...formData.billingAddress,
          [addressField]: value
        }
      });
    } else {
      setFormData({
        ...formData,
        [name]: value
      });
    }

    onUpdate(formData);
  };

  const handleSearchCustomer = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setLoading(true);
    try {
      const response = await fetch('/api/customers/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery })
      });

      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.data || []);
      } else {
        alert('Error searching customers. Make sure Salesforce credentials are configured.');
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCustomer = (customer) => {
    const newData = {
      ...formData,
      name: customer.name,
      billingAddress: customer.billingAddress || {}
    };
    setFormData(newData);
    setSearchResults([]);
    setSearchQuery('');
    onUpdate(newData);
  };

  return (
    <div className="customer-info">
      <div className="search-section">
        <h3>Search Salesforce Account</h3>
        <form onSubmit={handleSearchCustomer} className="search-form">
          <input
            type="text"
            placeholder="Search customer by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button type="submit" disabled={loading} className="btn btn-secondary btn-sm">
            {loading ? 'Searching...' : 'Search'}
          </button>
        </form>

        {searchResults.length > 0 && (
          <div className="search-results">
            {searchResults.map((customer) => (
              <div key={customer.id} className="result-item" onClick={() => handleSelectCustomer(customer)}>
                <div className="result-name">{customer.name}</div>
                <div className="result-address">
                  {customer.billingAddress?.city && `${customer.billingAddress.city}, ${customer.billingAddress.state}`}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Company Name *</label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            placeholder="Customer company name"
            required
          />
        </div>

        <div className="form-group">
          <label>Contact Name</label>
          <input
            type="text"
            name="contact"
            value={formData.contact}
            onChange={handleInputChange}
            placeholder="Full name of primary contact"
          />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Email</label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleInputChange}
            placeholder="contact@company.com"
          />
        </div>

        <div className="form-group">
          <label>Phone</label>
          <input
            type="tel"
            name="phone"
            value={formData.phone}
            onChange={handleInputChange}
            placeholder="(555) 123-4567"
          />
        </div>
      </div>

      <h3 style={{ marginTop: '30px', marginBottom: '15px' }}>Billing Address</h3>
      <div className="form-group">
        <label>Street Address</label>
        <input
          type="text"
          name="address_street"
          value={formData.billingAddress.street}
          onChange={handleInputChange}
          placeholder="123 Main St"
        />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>City</label>
          <input
            type="text"
            name="address_city"
            value={formData.billingAddress.city}
            onChange={handleInputChange}
            placeholder="San Francisco"
          />
        </div>

        <div className="form-group">
          <label>State</label>
          <input
            type="text"
            name="address_state"
            value={formData.billingAddress.state}
            onChange={handleInputChange}
            placeholder="CA"
          />
        </div>

        <div className="form-group">
          <label>Postal Code</label>
          <input
            type="text"
            name="address_postalCode"
            value={formData.billingAddress.postalCode}
            onChange={handleInputChange}
            placeholder="94105"
          />
        </div>
      </div>

      <div className="form-group">
        <label>Country</label>
        <input
          type="text"
          name="address_country"
          value={formData.billingAddress.country}
          onChange={handleInputChange}
          placeholder="USA"
        />
      </div>
    </div>
  );
}

export default CustomerInfo;
