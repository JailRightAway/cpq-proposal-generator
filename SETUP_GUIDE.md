# CPQ Proposal Generator - Detailed Setup Guide

## Prerequisites

Before starting, verify you have these installed:

### 1. Node.js (v16 or higher)
**Check if installed:**
```bash
node --version
npm --version
```

**If not installed:**
- Download from https://nodejs.org/ (LTS version recommended)
- Run installer and follow prompts
- Verify installation worked with commands above

### 2. Python (v3.8 or higher)
**Check if installed:**
```bash
python --version
# or
python3 --version
```

**If not installed:**
- Download from https://www.python.org/
- Run installer
- During installation, CHECK "Add Python to PATH"
- Verify: `python --version`

### 3. Git (Optional but recommended)
**Check if installed:**
```bash
git --version
```

---

## Step 1: Navigate to Project Directory

Open a terminal/command prompt and go to the project folder:

```bash
# On Windows:
cd "C:\Users\JailR\OneDrive - MeridianLink\CPQ Project - 2026"

# On Mac/Linux:
cd ~/OneDrive\ -\ MeridianLink/CPQ\ Project\ -\ 2026
```

Verify you're in the right place - you should see these files:
- `server.js`
- `package.json`
- `README.md`
- `.env.example`

---

## Step 2: Install Node Dependencies

Run this command to download all required Node.js packages:

```bash
npm install
```

**What this does:**
- Reads `package.json`
- Downloads Express, Axios, python-shell, and other dependencies
- Creates a `node_modules/` folder
- This takes 2-5 minutes on first run

**You should see:**
- Progress bars for each package
- Final message: "added XX packages"

**If errors occur:**
```bash
# Try clearing npm cache and reinstalling
npm cache clean --force
rm -rf node_modules
npm install
```

---

## Step 3: Install Python Dependencies

Run these commands to install Python packages:

```bash
# Install python-docx (for Word document generation)
pip install python-docx

# Install openpyxl (for reading Excel files)
pip install openpyxl
```

**What this does:**
- Downloads Python libraries needed for Excel/Word processing
- Takes 30 seconds to 2 minutes

**Verify installation:**
```bash
pip list
```

You should see both `python-docx` and `openpyxl` in the list.

---

## Step 4: Set Up Environment Variables

The app needs configuration. You'll create a `.env` file:

### Option A: Manual Setup (Recommended for first run)

1. **In the project folder, create a new file called `.env`**

2. **Copy this content into the `.env` file:**

```
# Server Configuration
PORT=5000
NODE_ENV=development

# Salesforce Configuration (OPTIONAL - leave as-is for MVP)
# Only fill these in if you have Salesforce API credentials ready
SALESFORCE_CLIENT_ID=your_client_id_here
SALESFORCE_CLIENT_SECRET=your_client_secret_here
SALESFORCE_INSTANCE_URL=https://your_instance.salesforce.com
SALESFORCE_USERNAME=your_salesforce_username
SALESFORCE_PASSWORD=your_salesforce_password

# Python Configuration
PYTHON_PATH=python3

# Excel File Configuration
EXCEL_FILE_PATH=./ML_PriceCard.xlsm
```

3. **Save the file**

### Option B: Copy the template

```bash
# Copy the example file
cp .env.example .env

# Then edit .env in a text editor if needed
```

---

## Step 5: Add Salesforce Credentials (Optional)

**Skip this step for MVP** — the app works without Salesforce. Customer lookup will show a "not configured" message, but you can manually enter customer info.

### If you want Salesforce integration:

1. **Get credentials from your Salesforce admin:**
   - OAuth Client ID
   - OAuth Client Secret
   - Instance URL (e.g., https://yourcompany.salesforce.com)
   - Salesforce username
   - Salesforce password

2. **Edit your `.env` file:**

```
SALESFORCE_CLIENT_ID=3MVG9yZ.WNe6BY...
SALESFORCE_CLIENT_SECRET=1234567890ABCDEF...
SALESFORCE_INSTANCE_URL=https://yourcompany.my.salesforce.com
SALESFORCE_USERNAME=your.email@yourcompany.com
SALESFORCE_PASSWORD=your_salesforce_password
```

3. **Save and restart the server** (see Step 7)

---

## Step 6: Verify Excel File Location

The app reads product pricing from `ML_PriceCard.xlsm`.

**Check that the file exists:**

```bash
# You should see the file in the project folder
ls ML_PriceCard.xlsm

# On Windows:
dir ML_PriceCard.xlsm
```

**If the file is missing:**
- Copy `ML_PriceCard.xlsm` into the project root folder
- The app will load products from this file

---

## Step 7: Start the Server

Now you're ready to run the application!

### Development Mode (with auto-reload)

```bash
npm run dev
```

**You should see output:**
```
CPQ Proposal Generator API running on port 5000
Environment: development
```

### Production Mode

```bash
npm start
```

**The server is running when you see:**
- No error messages
- Console shows port 5000 listening
- Process hasn't crashed

---

## Step 8: Open in Browser

Open your web browser and go to:

```
http://localhost:5000
```

**You should see:**
- MeridianLink logo and header
- "CPQ Proposal Generator" title
- Customer Information form
- Search Salesforce section (if configured)

---

## Step 9: Test the Application

### Quick Test Workflow:

1. **Enter a customer:**
   - Company Name: "Test Corp"
   - Contact: "John Doe"
   - Email: "john@testcorp.com"
   - Add a billing address (optional)

2. **Add a product:**
   - Click "Products & Services" section
   - Click "Add Product" on any product
   - You should see it appear in the Pricing Details table

3. **Set pricing:**
   - Select a Tier 1-8 for Year 1
   - Adjust quantity if needed
   - Click "Add Product" for another item (optional)

4. **Apply discount:**
   - Choose "Percentage Discount"
   - Enter "10" for 10% off
   - See the summary update

5. **Generate proposal:**
   - Click "Generate Proposal" button
   - A Word document should download

6. **Open the Word doc:**
   - Check that it has:
     - Company name, contact info, current date
     - Product line items
     - Pricing breakdown (List | Discount | Selling Price)
     - Year-by-year totals
     - Terms and conditions
     - MeridianLink branding

---

## Troubleshooting

### Issue: "npm: command not found"
**Solution:** Node.js not installed or not in PATH
- Download Node.js from https://nodejs.org/
- Reinstall and check "Add to PATH" during installation
- Restart terminal and try again

### Issue: "python: command not found"
**Solution:** Python not installed or not in PATH
- Install Python from https://www.python.org/
- Make sure to check "Add Python to PATH"
- Restart terminal and try `python --version`

### Issue: "port 5000 already in use"
**Solution:** Another app is using that port
```bash
# Kill the process on port 5000
# On Mac/Linux:
lsof -i :5000
kill -9 <PID>

# On Windows (PowerShell as admin):
netstat -ano | findstr :5000
taskkill /PID <PID> /F

# Or use a different port in .env:
PORT=5001
```

### Issue: "Excel file not found"
**Solution:** ML_PriceCard.xlsm is missing
- Copy the file into the project root folder
- Verify path: `./ML_PriceCard.xlsm`

### Issue: "Word generation failed"
**Solution:** Python dependencies missing
```bash
# Reinstall:
pip install --upgrade python-docx openpyxl

# Verify Python path in .env (try both):
PYTHON_PATH=python
# or
PYTHON_PATH=python3
```

### Issue: "Salesforce search not working"
**Solution:** Credentials not configured or incorrect
- For MVP, this is optional — skip Salesforce
- Manually enter customer info instead
- To enable later: add credentials to `.env` and restart server

---

## File Structure After Setup

After running `npm install`, your folder should look like:

```
CPQ Project - 2026/
├── node_modules/          (created by npm install)
├── src/                   (React frontend)
├── routes/                (API endpoints)
├── services/              (Business logic)
├── public/                (HTML, static files)
├── python/                (Python scripts)
├── utils/                 (Helper functions)
├── server.js              (Main server file)
├── package.json
├── .env                   (YOUR configuration)
├── .env.example
├── README.md
├── SETUP_GUIDE.md         (this file)
├── ML_PriceCard.xlsm      (Excel product data)
└── node_modules/          (dependencies)
```

---

## Common Commands

### Start the server
```bash
npm start                 # Production
npm run dev               # Development (with auto-reload)
```

### Stop the server
```bash
Ctrl + C    (Windows/Mac/Linux)
```

### Check what's running
```bash
# See if port 5000 is in use:
lsof -i :5000        (Mac/Linux)
netstat -ano | findstr :5000    (Windows)
```

### View server logs
Server logs appear in the terminal where you ran `npm start`

### Clear cache and reinstall
```bash
npm cache clean --force
rm -rf node_modules
npm install
```

---

## Next: Customization

Once the app is running, you can customize:

1. **Company branding** → Edit colors in `src/App.css`
2. **Product data** → Update `ML_PriceCard.xlsm`
3. **Tier levels** → Modify `services/tierLoader.js`
4. **Word doc template** → Edit `python/word_generator.py`
5. **Discount rules** → Update `routes/proposals.js`

See README.md for full documentation.

---

## Support

**Check that:**
- Node.js is installed (`node --version`)
- Python is installed (`python --version`)
- `npm install` completed without errors
- `.env` file exists in project root
- `ML_PriceCard.xlsm` exists in project root
- Server started without error messages
- Browser shows content at `http://localhost:5000`

**If stuck:**
- Check the terminal for error messages
- Verify all prerequisites above
- Restart terminal/command prompt and try again
