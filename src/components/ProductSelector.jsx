import React, { useState, useEffect } from 'react';
import './ProductSelector.css';

function ProductSelector({ onAddProduct }) {
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [families, setFamilies] = useState([]);
  const [serviceTypes, setServiceTypes] = useState([]);
  const [filters, setFilters] = useState({
    family: '',
    serviceType: ''
  });
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadProducts();
    loadFilters();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [filters, searchTerm, products]);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/products');
      if (response.ok) {
        const data = await response.json();
        setProducts(data.data || []);
      }
    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadFilters = async () => {
    try {
      const familiesRes = await fetch('/api/products/filter/families');
      const typesRes = await fetch('/api/products/filter/servicetypes');

      if (familiesRes.ok) {
        const data = await familiesRes.json();
        setFamilies(data.data || []);
      }

      if (typesRes.ok) {
        const data = await typesRes.json();
        setServiceTypes(data.data || []);
      }
    } catch (error) {
      console.error('Error loading filters:', error);
    }
  };

  const applyFilters = () => {
    let filtered = products;

    if (filters.family) {
      filtered = filtered.filter(p => p.family === filters.family);
    }

    if (filters.serviceType) {
      filtered = filtered.filter(p => p.serviceType === filters.serviceType);
    }

    if (searchTerm) {
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredProducts(filtered);
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters({
      ...filters,
      [name]: value
    });
  };

  return (
    <div className="product-selector">
      <div className="filters">
        <div className="filter-group">
          <label>Family</label>
          <select name="family" value={filters.family} onChange={handleFilterChange}>
            <option value="">All Families</option>
            {families.map(family => (
              <option key={family} value={family}>{family}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>Service Type</label>
          <select name="serviceType" value={filters.serviceType} onChange={handleFilterChange}>
            <option value="">All Types</option>
            {serviceTypes.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>Search Product</label>
          <input
            type="text"
            placeholder="Search by name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="products-list">
        {loading ? (
          <p>Loading products...</p>
        ) : filteredProducts.length === 0 ? (
          <p>No products found. Try adjusting filters.</p>
        ) : (
          filteredProducts.map(product => (
            <div key={product.id} className="product-card">
              <div className="product-info">
                <h4>{product.name}</h4>
                <p className="product-family">{product.family}</p>
                <p className="product-type">{product.serviceType}</p>

                <div className="product-pricing">
                  {product.oneTimeFee > 0 && (
                    <span className="price-item">One Time: ${product.oneTimeFee.toLocaleString()}</span>
                  )}
                  {product.annualFee > 0 && (
                    <span className="price-item">Annual: ${product.annualFee.toLocaleString()}</span>
                  )}
                  {product.perTransactionFee > 0 && (
                    <span className="price-item">Per Trans: ${product.perTransactionFee.toLocaleString()}</span>
                  )}
                </div>
              </div>

              <button
                className="btn btn-primary btn-sm"
                onClick={() => onAddProduct(product)}
              >
                Add Product
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default ProductSelector;
