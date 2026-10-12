#!/bin/bash
# ==========================================================
# ☁️ EC2 One-Command Deployment Script for Ubuntu
# Cloud-Based Anomaly Detection Platform
# ==========================================================

set -e

echo "🚀 Starting Deployment on AWS EC2..."

# 1. Update packages and install Node.js 20 LTS & Git
sudo apt-get update -y
sudo apt-get install -y curl git

if ! command -v node &> /dev/null; then
    echo "📦 Installing Node.js 20 LTS..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

echo "✅ Node.js version: $(node -v)"
echo "✅ npm version: $(npm -v)"

# 2. Install PM2 process manager globally
sudo npm install -g pm2

# 3. Install project dependencies
echo "📦 Installing dependencies..."
cd target-app && npm install && cd ..
cd monitor-server && npm install && cd ..

# 4. Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️ .env file not found. Creating from .env.example..."
    cp .env.example .env
    echo "ℹ️ Please update .env with your Amazon RDS and AWS credentials if deploying in Cloud Mode."
fi

# 5. Start services in the background using PM2
echo "⚡ Launching Target Demo App on port 3000..."
pm2 start target-app/server.js --name "target-ecommerce-app"

echo "⚡ Launching Monitoring Server & Dashboard on port 5000..."
pm2 start monitor-server/server.js --name "monitoring-platform"

# 6. Save PM2 processes to auto-restart on instance reboot
pm2 save

echo ""
echo "=========================================================="
echo "🎉 DEPLOYMENT SUCCESSFUL!"
echo "=========================================================="
echo "📊 Monitoring Dashboard: http://$(curl -s http://checkip.amazonaws.com):5000"
echo "🛍️ Demo E-Commerce App:  http://$(curl -s http://checkip.amazonaws.com):3000"
echo "📋 View logs with: pm2 logs"
echo "=========================================================="
