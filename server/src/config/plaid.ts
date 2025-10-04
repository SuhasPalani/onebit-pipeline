export const plaidConfig = {
  clientId: process.env.PLAID_CLIENT_ID,
  secret: process.env.PLAID_SECRET,
  env: process.env.PLAID_ENV || 'production', // Changed default
  
  environments: {
    sandbox: 'https://sandbox.plaid.com',
    development: 'https://development.plaid.com',
    production: 'https://production.plaid.com',
  },
  
  products: ['transactions', 'auth', 'balance'], // Added auth and balance
  countryCodes: ['US', 'CA'], // Added Canada if needed
  language: 'en',
  
  webhookUrl: process.env.PLAID_WEBHOOK_URL
};