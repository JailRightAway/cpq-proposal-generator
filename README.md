# MeridianLink CPQ Proposal Generator

A web application for creating custom pricing proposals with MeridianLink branding. Sales representatives can input customer information, select products with tiered pricing, apply discounts, and generate professional Word documents.

## Features

- **Customer Lookup**: Search Salesforce for customer accounts (requires Salesforce credentials)
- **Product Selection**: Filter products by family and service type
- **Tiered Pricing**: Support for 8 tier levels with unit commitments (1-9, 10-29, 30-99, etc.)
- **Multi-Year Pricing**: Set different pricing tiers for Year 1, Year 2, and Year 3
- **Flexible Discounts**: Apply percentage or dollar-amount discounts (supports negative values for markups)
- **Professional Output**: Generates MeridianLink-branded Word documents with:
  - Customer information
  - Line items with year-by-year pricing breakdown
  - Discount calculations with list price visibility
  - Contract terms and legal disclaimers
  - Pricing valid through end of current quarter

## Architecture

### Backend
- **Node.js + Express**: REST API server
- **Python + python-docx**: Word document generation
- **OpenPyXL**: Excel file parsing (product data extraction)
- **Salesforce API**: Customer account lookup (scaffolded)

### Frontend
- **React**: Interactive proposal builder UI
- **CSS3**: Responsive design with MeridianLink branding

## Installation

### Prerequisites
- Node.js 16+
- Python 3.8+
- pip packages: python-docx, openpyxl

### Setup Steps

1. **Install dependencies**
   ```bash
   npm install
   pip install python-docx openpyxl
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your Salesforce credentials (optional for MVP)
   ```

3. **Run the server**
   ```bash
   npm start
   # Or for development with auto-reload:
   npm run dev
   ```

4. **Access the application**
   - Open http://localhost:5000 in your browser

## Usage

### Basic Workflow

1. **Enter Customer Information**
   - Manually enter company name, contact details, billing address
   - OR search Salesforce to auto-populate account name and billing address

2. **Add Products**
   - Filter by Product Family and Service Type
   - Search for specific products
   - Click "Add Product" to add line items

3. **Set Pricing Details**
   - For each product, select unit commitment tiers for Year 1, 2, 3
   - Quantity can be adjusted
   - Optional tiers available

4. **Apply Discounts**
   - Choose percentage or dollar-amount discount
   - Support for negative discounts (markups)
   - See real-time pricing summary

5. **Generate Proposal**
   - Click "Generate Proposal" button
   - Word document downloads with all details
   - Document includes contract terms, legal disclaimers, and quarterly expiration

## API Endpoints

### Products
- `GET /api/products` - List all products
- `GET /api/products?family=X&serviceType=Y` - Filter products
- `GET /api/products/filter/families` - Get unique product families
- `GET /api/products/filter/servicetypes` - Get unique service types

### Customers
- `POST /api/customers/search` - Search Salesforce accounts
- `GET /api/customers/salesforce/config` - Check Salesforce configuration

### Proposals
- `POST /api/proposals/generate` - Generate Word document
- `POST /api/proposals/calculate` - Calculate totals and pricing

## Salesforce Integration

To enable Salesforce customer lookup:

1. Get OAuth credentials from your Salesforce org:
   - Client ID
   - Client Secret
   - Instance URL
   - Username
   - Password

2. Add to `.env`:
   ```
   SALESFORCE_CLIENT_ID=your_client_id
   SALESFORCE_CLIENT_SECRET=your_client_secret
   SALESFORCE_INSTANCE_URL=https://your_instance.salesforce.com
   SALESFORCE_USERNAME=your_username
   SALESFORCE_PASSWORD=your_password
   ```

3. Restart the server

## Project Structure

```
.
├── server.js                 # Express server entry point
├── package.json             # Node dependencies
├── .env.example            # Environment variables template
├── routes/
│   ├── products.js         # Product API endpoints
│   ├── customers.js        # Customer/Salesforce endpoints
│   └── proposals.js        # Proposal generation endpoints
├── services/
│   ├── productLoader.js    # Excel product data loader
│   ├── tierLoader.js       # Tiering logic
│   ├── salesforceService.js # Salesforce API wrapper
│   └── proposalGenerator.js # Word doc generator orchestration
├── utils/
│   └── helpers.js          # Utility functions (currency formatting, date calc)
├── python/
│   └── word_generator.py   # Python script for Word doc generation
├── public/
│   └── index.html          # HTML entry point
└── src/
    ├── App.jsx             # Main React component
    ├── App.css
    ├── index.jsx           # React entry point
    ├── index.css
    └── components/
        ├── CustomerInfo.jsx
        ├── ProductSelector.jsx
        ├── PricingTable.jsx
        ├── DiscountCalculator.jsx
        └── ProposalSummary.jsx
```

## Pricing Model

### Tiering System
- **Tier 1**: 1-9 units (no discount)
- **Tier 2**: 10-29 units (5% discount)
- **Tier 3**: 30-99 units (10% discount)
- **Tier 4**: 100-499 units (15% discount)
- **Tier 5**: 500-999 units (20% discount)
- **Tier 6**: 1,000-4,999 units (25% discount)
- **Tier 7**: 5,000-9,999 units (30% discount)
- **Tier 8**: 10,000+ units (35% discount)

### Discount Calculation
- **Percentage Discount**: Applied to total pricing across all products
- **Dollar Amount Discount**: Fixed amount across proposal
- **Negative Discounts**: Supported for markups (e.g., -10% = 10% increase)

## Excel Data Source

The system reads pricing from `ML_PriceCard.xlsm`:
- **MasterInventory sheet**: Product catalog with pricing
- **Module Tiers sheet**: Tiering structure and discounts
- **Quote Builder sheet**: Pricing calculation templates

## Word Document Generation

The generated proposal includes:
- MeridianLink branding (logo, colors, fonts)
- Customer information
- Line-item table with year-by-year breakdown
  - Product name
  - Tier level
  - Quantity
  - List price | Discount | Selling price (per year)
- Subtotals and totals by year
- Total Contract Value (TCV)
- Pricing valid through end of current quarter
- Terms and conditions
- Legal disclaimers
- Copyright footer

## Development

### Build & Run
```bash
npm install
npm run dev
```

### Build for production
```bash
npm run build
```

### Test endpoints
```bash
# List products
curl http://localhost:5000/api/products

# Check Salesforce config
curl http://localhost:5000/api/customers/salesforce/config

# Health check
curl http://localhost:5000/api/health
```

## Known Limitations & Future Enhancements

### Current MVP Limitations
- Salesforce credentials must be manually configured
- Product data is cached for 5 minutes
- Year ramp shows options 1-3 (extendable)
- Discount applies uniformly across all line items

### Planned Enhancements
- Advanced tiering rules per product
- Multi-currency support
- Email proposal directly to customer
- Proposal versioning and audit trail
- Saved proposal templates
- Integration with opportunity pipeline
- Analytics dashboard

## Support & Troubleshooting

### Common Issues

**"Salesforce credentials not configured"**
- Add credentials to `.env` file
- Restart the server
- Verify Salesforce OAuth app permissions

**"Excel file not found"**
- Ensure `ML_PriceCard.xlsm` is in the project root
- Check file path in `.env` if customized

**"Word generation failed"**
- Verify Python 3.8+ is installed
- Check python-docx is installed: `pip install python-docx`
- Ensure PYTHON_PATH in `.env` points to correct Python executable

## License

© MeridianLink, Inc. All rights reserved.
