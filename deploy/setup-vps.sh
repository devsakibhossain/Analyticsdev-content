#!/usr/bin/env bash
# ==============================================================================
# Hostinger VPS Bootstrap Script for Website Lead Finder
# Supports Ubuntu 22.04 / 24.04 LTS
# ==============================================================================

set -euo pipefail

echo "================================================================"
echo "🚀 Initializing Hostinger VPS Setup for Website Lead Finder"
echo "================================================================"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo "❌ Please run this script as root or with sudo:"
  echo "   sudo bash deploy/setup-vps.sh"
  exit 1
fi

echo "📦 Step 1: Updating system packages..."
apt-get update -y
apt-get upgrade -y

echo "🔧 Step 2: Installing essential dependencies..."
apt-get install -y \
  apt-transport-https \
  ca-certificates \
  curl \
  gnupg \
  lsb-release \
  ufw \
  htop \
  tar \
  gzip \
  cron

echo "🐳 Step 3: Installing Docker & Docker Compose..."
# Remove old/conflicting packages if present
for pkg in docker.io docker-doc docker-compose podman-docker containerd runc; do
  apt-get remove -y $pkg 2>/dev/null || true
done

# Add Docker's official GPG key
install -m 0755 -d /etc/apt/keyrings
if [ ! -f /etc/apt/keyrings/docker.gpg ]; then
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
fi

# Add the repository to Apt sources:
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  tee /etc/apt/sources.list.d/docker.list > /dev/null

apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

systemctl enable docker
systemctl start docker
echo "✅ Docker version: $(docker --version)"
echo "✅ Docker Compose version: $(docker compose version)"

echo "🛡️  Step 4: Configuring UFW Firewall..."
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment 'SSH'
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'

# Enable firewall without interactive prompt
echo "y" | ufw enable
ufw status verbose

echo "⚙️  Step 5: Tuning system performance for 8GB VPS..."
# Optimize swappiness so memory doesn't aggressively swap to disk
sysctl -w vm.swappiness=10
if ! grep -q "vm.swappiness=10" /etc/sysctl.conf; then
  echo "vm.swappiness=10" >> /etc/sysctl.conf
fi

# Ensure directories exist with proper permissions
mkdir -p data exports logs backups
chmod -R 755 data exports logs backups

echo ""
echo "================================================================"
echo "🎉 VPS Setup Complete!"
echo "================================================================"
echo "Next steps:"
echo "1. Verify or create your .env configuration:"
echo "   cp .env.example .env && nano .env"
echo "2. Launch the application stack:"
echo "   docker compose up -d --build"
echo "3. Check container status:"
echo "   docker compose ps"
echo "4. Access the web dashboard at your VPS IP or configured domain!"
echo "================================================================"
