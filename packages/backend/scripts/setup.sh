#!/bin/bash

# Setup script for sTFuel Backend

echo "🚀 Setting up sTFuel Backend..."

# Check if .env exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp env.example .env
    echo "⚠️  Please update .env with your configuration before running the application"
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build the project
echo "🔨 Building the project..."
npm run build

echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Update your .env file with the correct configuration"
echo "2. Set up your PostgreSQL database"
echo "3. Run 'npm run migration:run' to create database tables"
echo "4. Run 'npm start' to start the application"
