# OneBit Transaction Pipeline

A full-stack financial transaction processing system with Plaid integration, automatic classification, transfer detection, and reconciliation.

## Architecture

```
┌─────────────────┐      ┌──────────────────┐      ┌─────────────────┐
│   React Frontend │◄────►│  Express Backend │◄────►│   PostgreSQL    │
│   (Vite + TS)   │      │   (Node.js)      │      │   + Prisma ORM  │
└─────────────────┘      └──────────────────┘      └─────────────────┘
                                 │
                                 ├─────► Redis (Caching + Queues)
                                 │
                                 └─────► Plaid API (Bank Data)
```

## Features

- **Plaid Integration**: Connect real bank accounts and sync transactions
- **Transaction Ingestion**: Multi-provider support with deduplication
- **Auto-Classification**: Rule-based transaction categorization
- **Transfer Detection**: Automatically links transfers between accounts
- **Reconciliation**: Balance checking against institution data
- **Ledger System**: Double-entry bookkeeping with GL accounts
- **Queue Workers**: Background jobs for classification and sync

## Tech Stack

### Backend
- Node.js + TypeScript
- Express.js
- Prisma ORM
- PostgreSQL
- Redis + Bull (job queues)
- Plaid SDK
- Winston (logging)

### Frontend
- React + TypeScript
- Vite
- TailwindCSS
- Axios
- Plaid Link

## Prerequisites

- Node.js 18+ and npm
- Docker and Docker Compose
- Plaid API credentials (free sandbox account)
- ngrok (for Plaid webhooks in development)

## Installation

### 1. Clone and Install Dependencies

```bash
# Clone the repository
git clone <your-repo-url>
cd onebit-pipeline

# Install root dependencies
npm install

# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
cd ..
```

### 2. Setup Environment Variables

Create `.env` file in the `server/` directory:

```bash
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/onebit?schema=onebit"

# Redis
REDIS_URL="redis://:redis_password@localhost:6379"

# Plaid (get from https://dashboard.plaid.com)
PLAID_CLIENT_ID="your_client_id"
PLAID_SECRET="your_sandbox_secret"
PLAID_ENV="sandbox"  # sandbox, development, or production
PLAID_WEBHOOK_URL="https://your-ngrok-url.ngrok.io/api/plaid/webhook"

# Server
PORT=3001
NODE_ENV=development

# Client URL (for CORS)
CLIENT_URL="http://localhost:3000"
```

### 3. Setup Database

```bash
cd server

# Generate Prisma client
npm run prisma:generate

# Run migrations
npx prisma migrate deploy

# Seed initial data (providers and categories)
npm run prisma:seed
```

### 4. Setup ngrok for Plaid Webhooks (Optional but Recommended)

```bash
# Install ngrok
# Mac: brew install ngrok
# Or download from: https://ngrok.com/download

# Start ngrok tunnel
ngrok http 3001

# Copy the HTTPS URL (e.g., https://abc123.ngrok.io)
# Update PLAID_WEBHOOK_URL in your .env file:
# PLAID_WEBHOOK_URL="https://abc123.ngrok.io/api/plaid/webhook"
```

## Running the Application

### Development Mode (Recommended)

Open **three terminals**:

**Terminal 1 - Backend Server:**
```bash
cd server
npm run dev:nodemon
```

**Terminal 2 - Queue Workers:**
```bash
cd server
npm run worker
```

**Terminal 3 - Frontend:**
```bash
cd client
npm run dev
```

### Production Mode

```bash
# Build backend
cd server
npm run build
npm start

# Build frontend
cd client
npm run build
npm run preview
```

## Accessing the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001/api
- **Health Check**: http://localhost:3001/api/health
- **Prisma Studio**: `cd server && npx prisma studio` (http://localhost:5555)

## Plaid Integration Setup

### 1. Get Plaid Credentials

1. Sign up at https://dashboard.plaid.com
2. Create a new app
3. Get your `client_id` and `sandbox` secret
4. Add them to your `.env` file

### 2. Configure Redirect URI

In Plaid Dashboard:
- Go to **Team Settings** → **API**
- Add redirect URI: `http://localhost:3000`

### 3. Enable Webhooks (Optional)

1. Start ngrok: `ngrok http 3001`
2. Copy the HTTPS URL
3. Update `PLAID_WEBHOOK_URL` in `.env`
4. In Plaid Dashboard, add webhook URL: `https://your-ngrok-url.ngrok.io/api/plaid/webhook`

### 4. Test Plaid Connection

1. Go to http://localhost:3000
2. Click "Connect Bank Account via Plaid"
3. Use Plaid sandbox credentials:
   - Username: `user_good`
   - Password: `pass_good`
   - MFA: `1234`
4. Select an account
5. Click "Sync Transactions"

## API Endpoints

### Accounts
- `GET /api/accounts` - List all accounts
- `POST /api/accounts` - Create account
- `GET /api/accounts/:id` - Get account details
- `PATCH /api/accounts/:id` - Update account
- `DELETE /api/accounts/:id` - Delete account

### Transactions
- `GET /api/transactions?account_id=xxx` - List transactions
- `GET /api/transactions/:id` - Get transaction details

### Plaid
- `POST /api/plaid/link/token` - Create link token
- `POST /api/plaid/link/exchange` - Exchange public token
- `POST /api/plaid/sync/:accountId` - Sync transactions
- `GET /api/plaid/balance/:accountId` - Get account balance
- `POST /api/plaid/webhook` - Plaid webhook handler
- `DELETE /api/plaid/unlink/:accountId` - Disconnect account

### Classifications
- `GET /api/classifications/transaction/:txnId` - Get classification
- `PUT /api/classifications/transaction/:txnId` - Update classification
- `GET /api/classifications/unclassified` - Get low-confidence classifications
- `GET /api/classifications/categories` - List categories
- `POST /api/classifications/categories` - Create category

### Transfers
- `GET /api/transfers` - List detected transfers

### Reconciliation
- `GET /api/reconciliation/account/:accountId` - Get reconciliation history
- `POST /api/reconciliation/account/:accountId` - Run reconciliation
- `GET /api/reconciliation` - List all reconciliations
- `GET /api/reconciliation/summary` - Get summary stats

### Ingestion (for custom providers)
- `POST /api/ingest/:providerId/:accountId/transactions` - Bulk ingest

## Database Schema

Key tables:
- `providers` - Data providers (Plaid, Yodlee, etc.)
- `accounts` - User bank accounts
- `raw_transactions` - Original transaction data
- `canonical_transactions` - Normalized, deduplicated transactions
- `links_transfers` - Detected transfer pairs
- `categories` - Transaction categories
- `txn_classifications` - Transaction categorizations
- `ledger_entries` - Double-entry bookkeeping
- `reconciliation_runs` - Balance reconciliation history

## Queue Jobs

Background workers process:
- **Classification**: Auto-categorize transactions (hourly sweep)
- **Transfer Detection**: Link transfers between accounts (every 15 min)
- **Reconciliation**: Balance checks (nightly at 2 AM)
- **Ingestion**: Async bulk transaction processing
