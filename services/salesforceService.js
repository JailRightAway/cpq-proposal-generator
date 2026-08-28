const axios = require('axios');

/**
 * Get Salesforce configuration from environment variables
 */
function getSalesforceConfig() {
  const clientId = process.env.SALESFORCE_CLIENT_ID;
  const clientSecret = process.env.SALESFORCE_CLIENT_SECRET;
  const instanceUrl = process.env.SALESFORCE_INSTANCE_URL;
  const username = process.env.SALESFORCE_USERNAME;
  const password = process.env.SALESFORCE_PASSWORD;

  return {
    isConfigured: !!(clientId && clientSecret && instanceUrl),
    clientId: clientId ? '***' : 'NOT_SET',
    instanceUrl: instanceUrl || 'NOT_SET'
  };
}

/**
 * Get Salesforce OAuth token
 */
async function getSalesforceToken() {
  const clientId = process.env.SALESFORCE_CLIENT_ID;
  const clientSecret = process.env.SALESFORCE_CLIENT_SECRET;
  const instanceUrl = process.env.SALESFORCE_INSTANCE_URL;
  const username = process.env.SALESFORCE_USERNAME;
  const password = process.env.SALESFORCE_PASSWORD;

  if (!clientId || !clientSecret || !instanceUrl) {
    throw new Error('Salesforce credentials not configured. Set SALESFORCE_CLIENT_ID, SALESFORCE_CLIENT_SECRET, and SALESFORCE_INSTANCE_URL in .env');
  }

  try {
    const response = await axios.post(
      `${instanceUrl}/services/oauth2/token`,
      {
        grant_type: 'password',
        client_id: clientId,
        client_secret: clientSecret,
        username: username,
        password: password
      },
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      }
    );

    return response.data.access_token;
  } catch (error) {
    console.error('Salesforce OAuth error:', error.response?.data || error.message);
    throw new Error('Failed to authenticate with Salesforce');
  }
}

/**
 * Search for accounts in Salesforce
 */
async function searchSalesforceAccount(query) {
  try {
    const token = await getSalesforceToken();
    const instanceUrl = process.env.SALESFORCE_INSTANCE_URL;

    const soqlQuery = `SELECT Id, Name, BillingStreet, BillingCity, BillingState, BillingPostalCode, BillingCountry FROM Account WHERE Name LIKE '%${query}%' LIMIT 10`;

    const response = await axios.get(
      `${instanceUrl}/services/data/v57.0/query`,
      {
        params: { q: soqlQuery },
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    const accounts = response.data.records.map(record => ({
      id: record.Id,
      name: record.Name,
      billingAddress: {
        street: record.BillingStreet,
        city: record.BillingCity,
        state: record.BillingState,
        postalCode: record.BillingPostalCode,
        country: record.BillingCountry
      }
    }));

    return accounts;
  } catch (error) {
    if (error.message.includes('not configured')) {
      throw error;
    }
    console.error('Salesforce search error:', error.message);
    throw new Error('Failed to search Salesforce accounts');
  }
}

module.exports = {
  getSalesforceConfig,
  getSalesforceToken,
  searchSalesforceAccount
};
