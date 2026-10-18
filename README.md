# 🎯 Website Lead Finder & Marketing Technology Scanner

A production-ready, self-hosted **Personal Website Lead Finder + Marketing Technology Scanner + Tracking Opportunity Detector** designed for solo founders, freelance tracking specialists, and marketing agencies.

Engineered to run seamlessly on a **Hostinger VPS (Ubuntu 22.04 / 24.04 LTS)** with Docker Compose and Nginx, accessed through your private domain or subdomain.

---

## ⚡ Highlights

* **100% Deterministic & Rule-Based:** Zero AI or LLM API calls. Completely free to run with zero recurring token costs.
* **Dual-Tier Crawling Pipeline:**
  1. *Fast Tier:* HTTPX + BeautifulSoup4 + LXML for lightning-fast HTML parsing, sitemap discovery, contact extraction, and initial CMS detection.
  2. *Deep Script Tier:* Headless Playwright Chromium for rendering dynamic single-page applications (SPAs), monitoring active network requests (pixels, beacons), and inspecting global JavaScript runtime variables (`window.dataLayer`, `fbq`, `gtag`, etc.). Non-essential assets (images, fonts, stylesheets, media) are strictly blocked to conserve VPS memory.
* **Hardened SSRF Protection:** Pre-flight DNS validation blocks access to loopback (`127.0.0.1`), private RFC1918/RFC4193 subnets, link-local addresses (`169.254.0.0/16`), and internal domains. Redirects are re-validated on every hop.
* **Granular Tracking Opportunity Detection:** Automatically flags high-value tracking fixes (e.g., GA4 without GTM, Meta Pixel without CAPI inspection notes, Google Ads remarketing without conversion tags, unmeasured checkout flows).
* **Transparent Lead Scoring (0–100):** Every lead is scored across commercial technology presence, tracking sophistication, gaps & opportunities, and contact richness with a clear breakdown.
* **Export-Ready:** Filter leads, multi-select, and export to comprehensive CSV formats with all contact channels, tech stack lists, and opportunity summaries.

---

## 🏗️ Architecture

```
                                  [ User Browser ]
                                         │
                                         ▼
                            [ Nginx Reverse Proxy: 80 / 443 ]
                             ├── Rate Limiting (30 req/s API, 5/min Login)
                             └── Security Headers & SSL Termination
                                   /           \
                                  /             \
                  [ Next.js 14 Frontend ]     [ FastAPI Backend: 8000 ]
                     (App Router, React)        ├── JWT & Cookie Auth
                                                ├── SQLite (WAL mode)
                                                └── Job Queue (Redis / Sync)
                                                           │
                                                           ▼
                                                [ Dual-Tier Crawler Engine ]
                                                ├── HTTPX + BS4 (Fast HTML)
                                                └── Playwright (JS & Tracking)
```

---

## 🛠️ Tech Stack

* **Frontend:** Next.js 14 (App Router), TypeScript, Tailwind CSS, Lucide Icons
* **Backend:** Python 3.12, FastAPI, Pydantic v2, SQLAlchemy 2.0 (SQLite with Write-Ahead Logging `WAL`)
* **Crawler & Parser:** Playwright Chromium, HTTPX, BeautifulSoup4, LXML, dnspython
* **Reverse Proxy:** Nginx (Alpine) with Gzip, HTTP/2, and security headers
* **Containerization:** Docker Compose with isolated network bridges and persistent volumes

---

## 🚀 Quick Start (Local Development)

### 1. Prerequisites
* Python 3.12+ (or [uv](https://github.com/astral-sh/uv))
* Node.js 18+ & npm
* Docker & Docker Compose (optional for local, required for production)

### 2. Environment Setup
```bash
# Clone the repository
git clone <your-repo-url> website-lead-finder
cd website-lead-finder

# Copy environment configuration
cp .env.example .env
```

### 3. Backend Setup
```bash
# Create and activate virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r backend/requirements.txt
playwright install chromium

# Run backend tests
PYTHONPATH=backend:. pytest backend/tests/

# Start backend development server
uvicorn app.main:app --app-dir backend --reload --port 8000
```

### 4. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) and sign in using:
* **Email:** `admin@example.com`
* **Password:** `AdminSecurePassword123!` (or the value set in `.env`)

---

## 🌐 Production Deployment on Hostinger VPS

### Step 1: Provisioning & DNS Setup
1. Log in to your Hostinger VPS control panel and create an **Ubuntu 22.04 LTS or 24.04 LTS** instance.
2. In your DNS provider (Hostinger DNS, Cloudflare, etc.), create an **A Record** pointing your desired subdomain to your VPS IPv4 address:
   ```
   Type: A
   Name: leadfnder
   Target: 2.25.228.102
   TTL: 300
   ```
   *(Note: The DNS A record `leadfnder.sakibhossain.online` -> `2.25.228.102` has already been created in Hostinger DNS).*

### Step 2: Bootstrap the VPS
SSH into your VPS as `root`:
```bash
ssh root@2.25.228.102
```

Clone the repository and run the automated setup script:
```bash
git clone <your-repo-url> /opt/leadfinder
cd /opt/leadfinder
bash deploy/setup-vps.sh
```
*This script updates system packages, installs Docker CE + Docker Compose plugin, configures UFW firewall (ports 22, 80, 443), and optimizes kernel swappiness for 8GB memory.*

### Step 3: Configure Environment Variables
Edit `/opt/leadfinder/.env`:
```bash
nano .env
```
Ensure you update the following production values:
```ini
APP_ENV=production
SECRET_KEY=generate_a_very_long_random_secret_hex_here
ADMIN_EMAIL=your_actual_email@domain.com
ADMIN_PASSWORD=SetAStrongRandomPassword123!
FRONTEND_URL=https://leadfnder.sakibhossain.online
MAX_CONCURRENT_SCANS=2
```

### Step 4: Configure SSL / HTTPS with Let's Encrypt
To secure your instance with free HTTPS certificates via Certbot:

1. Obtain the SSL certificate using Certbot standalone:
   ```bash
   apt-get install -y certbot
   certbot certonly --standalone -d leadfnder.sakibhossain.online -d leadfinder.sakibhossain.online
   ```
2. Activate the SSL Nginx configuration:
   ```bash
   cp nginx/nginx.ssl.conf.template nginx/nginx.conf
   ```
3. Update `docker-compose.yml` to mount the Let's Encrypt certificates into Nginx:
   ```yaml
   nginx:
     volumes:
       - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
       - /etc/letsencrypt:/etc/letsencrypt:ro
   ```

### Step 5: Start the Application
```bash
docker compose up -d --build
```
Verify all containers are running and healthy:
```bash
docker compose ps
```
Visit `https://leadfnder.sakibhossain.online` and log in with your admin credentials.

---

## 📊 Lead Scoring Model (0–100)

Every crawled site is deterministically evaluated across 4 categories:

| Category | Max Points | Evaluation Criteria |
| :--- | :--- | :--- |
| **Tech Stack Sophistication** | 25 pts | Presence of modern CMS, enterprise e-commerce platform, CRM, or payment gateway. |
| **Tracking Stack Maturity** | 25 pts | Presence of Google Tag Manager, GA4, Meta Pixel, Google Ads, heatmaps, or marketing automation scripts. |
| **Audit Opportunities & Gaps** | 30 pts | High-intent tracking deficiencies (GA4 without GTM, unconfigured conversions, missing remarketing, untracked checkout). |
| **Contact Data Richness** | 20 pts | Discovered direct emails (sales/support), verified phone numbers, WhatsApp, and social media channels. |

### Qualification Grades:
* **80 – 100:** 🔥 **High Priority Opportunity** (Strong commercial foundation, active marketing spend, major tracking optimization gaps).
* **55 – 79:** ⚡ **Medium Priority Opportunity** (Good prospect with clear tracking or conversion measurement fixes needed).
* **30 – 54:** ℹ️ **Low Priority Lead** (Basic website with low tracking maturity or limited commercial signals).
* **0 – 29:** 💤 **Unqualified** (Personal blog, placeholder, or static brochure without marketing infrastructure).

---

## 🎯 Audit Opportunity Detection Rules

1. **GA4 Installed Without Google Tag Manager:**
   * *Rule:* GA4 (`G-XXXXXXXX`) is present on the page via direct gtag script, but Google Tag Manager (`GTM-XXXXXXX`) is absent.
   * *Pitch:* Migrating hardcoded GA4 to GTM centralizes conversion tracking, enables custom click/form triggers, and simplifies tag maintenance.
2. **Meta Pixel Client-Side Only (CAPI Verification):**
   * *Rule:* Meta Pixel (`fbq`) detected in browser script without evidence of server-side conversion delivery.
   * *Audit Note:* *"Server-side Meta CAPI cannot be confirmed from browser-side inspection."*
   * *Pitch:* Standard browser-only pixels lose 15–30% of events to iOS Safari ITP and ad-blockers. Implementing Server-Side Conversions API (CAPI) restores attribution accuracy.
3. **Google Ads Retargeting Without Conversion Tracking:**
   * *Rule:* Google Ads tag (`AW-XXXXXXX`) detected on site, but no purchase/lead conversion configuration or event firing detected.
   * *Pitch:* The business is paying for traffic and remarketing audiences without measuring ROAS or actual conversions.
4. **E-Commerce Measurement Gaps:**
   * *Rule:* Shopify, WooCommerce, or Magento store detected without GA4 enhanced e-commerce tags, purchase event listeners, or Tag Manager.
   * *Pitch:* Lack of funnel visualization and cart abandonment measurement causes blind spots in ad optimization.
5. **Contact Form / Lead Generation Tracking Blindspot:**
   * *Rule:* Business site contains contact forms or appointment booking widgets (Calendly/HubSpot), but lacks submit event listeners or conversion pixels.
   * *Pitch:* Form submissions are not feeding back into Google Ads or Meta algorithms as conversion events.

---

## 🔒 Security & SSRF Protection

To ensure the crawler cannot be abused or target internal infrastructure:
* **Pre-flight DNS & IP Filtering:** Resolves target hostname via DNS before fetching. If any resolved IP falls inside:
  * `127.0.0.0/8` (Loopback)
  * `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16` (Private RFC1918)
  * `169.254.0.0/16` (AWS/Cloud link-local metadata)
  * `fc00::/7`, `fe80::/10` (IPv6 private/link-local)
  * System domains (`localhost`, `*.internal`, `*.local`)
  The scan is immediately aborted with a 400 Bad Request error.
* **Redirect Validation:** Automatic HTTP redirects are handled manually, verifying safety before every redirect hop.
* **Rate Limiting:** Auth login endpoints are restricted to 5 attempts per minute per IP. Scan creation is limited to 10 jobs per minute.
* **Payload Restrictions:** Request payloads are capped at 5MB with `413 Payload Too Large` middleware protection.

---

## 💾 Maintenance & Operations

### Updating the Application
Run the one-command update script anytime:
```bash
bash deploy/update.sh
```
*This pulls latest commits, rebuilds Docker images, applies container updates, and verifies system health.*

### Automated Daily Backups
The backup script creates a safe, online SQLite snapshot without locking the database:
```bash
# Manual backup
bash deploy/backup.sh
```

To schedule automatic daily backups at 3:00 AM, add a cron job:
```bash
crontab -e
```
Add the following line:
```cron
0 3 * * * /opt/leadfinder/deploy/backup.sh >> /opt/leadfinder/logs/backup.log 2>&1
```

### Restoring from Backup
```bash
bash deploy/restore.sh backups/backup_leadfinder_20260923_120000.tar.gz
```

---

## 🧪 Testing

The codebase includes an automated test suite covering unit logic, SSRF safety, URL normalization, detectors, extractors, opportunity rules, and authentication:

```bash
PYTHONPATH=backend:. pytest backend/tests/ -v
```

---

## 📄 License
Private Personal Use License. Designed for single-operator client acquisition and tracking audits.
