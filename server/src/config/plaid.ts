export const plaidConfig = {
  clientId: process.env.PLAID_CLIENT_ID,
  secret: process.env.PLAID_SECRET,
  env: process.env.PLAID_ENV || 'sandbox',
  
  // Plaid environments
  environments: {
    sandbox: 'https://sandbox.plaid.com',
    development: 'https://development.plaid.com',
    production: 'https://production.plaid.com',
  },
  
  // Default options
  products: ['transactions'],
  countryCodes: ['US'],
  language: 'en',
};