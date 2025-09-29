#!/bin/bash
# scripts/setup.sh
set -e

echo "🚀 Setting up ONEBIT Transaction Pipeline..."

# Install root dependencies
npm install

# Install server dependencies
cd server && npm install && cd ..

# Install client dependencies
cd client && npm install && cd ..

# Start Docker services
echo "Starting Docker services..."
docker-compose up -d postgres redis pgbouncer

# Wait for PostgreSQL
echo "Waiting for PostgreSQL to be ready..."
sleep 10

# Run migrations
echo "Running database migrations..."
cd server && npx prisma migrate deploy && cd ..

# Seed database
echo "Seeding database..."
cd server && npm run db:seed && cd ..

echo "✅ Setup complete!"
echo "Run 'npm run dev' to start the development servers"