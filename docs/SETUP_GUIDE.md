# GitHub App Configuration & Setup Guide

This guide provides instructions for registering, configuring, installing, and running the **IEEEsoc-Bot** as a GitHub App across the 100+ repositories participating in the fellowship program.

---

## 1. Creating the GitHub App

To register the bot for the Graphic Era Hill University IEEE Student Branch organization:

1. Navigate to your GitHub Organization page -> **Settings** -> **Developer Settings** -> **GitHub Apps** -> Click **New GitHub App**.
2. **App Name**: `iee-soc-bot-2026` (or organization-specific variant).
3. **Homepage URL**: `https://ieeesoc.gehu.ac.in` (Points to the official program website).
4. **Webhook URL**: `https://api.ieeesoc.gehu.ac.in/api/bot/webhook` (Points to your deployed webhook intake service).
5. **Webhook Secret**: Generate a secure 32-character random string (e.g., `openssl rand -hex 16`) and store it safely.
6. **Private Key**: Scroll to the bottom and click **Generate a private key**. Save the downloaded `.pem` file safely.

---

## 2. GitHub App Permissions

To function correctly while adhering to the principle of least privilege, configure the following permissions under **Permissions & events** in your GitHub App settings:

### 2.1 Repository Permissions

| Permission Type | Access Level | Reason for Requirement |
| :--- | :--- | :--- |
| **Pull Requests** | `Read & Write` | * Listen to PR state changes (open, close, merge).<br/>* Write review comments to warn/prompt contributors and mentors. |
| **Issues** | `Read & Write` | * GitHub integrates repository label management under the Issues API.<br/>* Required to read and assign `soc-easy`, `soc-medium`, and `soc-hard` labels. |
| **Metadata** | `Read-only` | * Mandatory base permission to resolve repository names, owner IDs, and SHA commits. |

### 2.2 Organization & User Permissions
* **Organization Permissions**: None.
* **User Permissions**: None.

---

## 3. Webhook Event Subscriptions

Subscribe to the following events under the **Subscribe to events** section:

* **[x] Pull request**: Receives payloads for events: `opened`, `closed`, `reopened`, `assigned`, `unassigned`, `labeled`, `unlabeled`, and `edited`.
* **[x] Pull request review**: Receives payloads for events: `submitted`, `edited`, and `dismissed`. Used to calculate Mentor review SLAs.

---

## 4. Installation Options

Under **Where can this GitHub App be installed?**, select:
* **Any account** (Public) – This allows maintainers of external (vetted) open-source repositories to install the bot onto their repos.

### How to Install on Matched Repositories
1. Open the public link: `https://github.com/apps/ieee-soc-bot-2026`.
2. Click **Install**.
3. Select **Only select repositories** and pick the specific codebase matched during the Phase 1 scouting stage.
4. Grant the requested read/write permissions.

---

## 5. Local Development Environment

To run the bot server locally and receive webhook payloads, follow these steps:

### 5.1 Webhook Forwarding with Smee.io
Because GitHub cannot send webhooks directly to `localhost`, you must use a proxy:
1. Go to [smee.io](https://smee.io/) and click **Start a new channel**.
2. Copy your unique Smee URL (e.g., `https://smee.io/abc123xyz`).
3. Temporarily update the **Webhook URL** in your GitHub App developer settings to this Smee URL.
4. Install the Smee client locally:
   ```bash
   npm install --global smee-client
   ```
5. Start the forwarder, proxying to your local port `3000`:
   ```bash
   smee --url https://smee.io/abc123xyz --path /api/bot/webhook --port 3000
   ```

### 5.2 Environment Variables Configuration
Create a `.env` file in the root of the bot repository:

```env
# Server Port
PORT=3000

# Database Configuration
MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/ieeesoc?retryWrites=true&w=majority
REDIS_URL=redis://127.0.0.1:6379

# GitHub App Configuration
GITHUB_APP_ID=123456
GITHUB_CLIENT_ID=Iv1.abcdef123456
GITHUB_CLIENT_SECRET=your_github_client_secret_here
GITHUB_WEBHOOK_SECRET=your_webhook_secret_here

# GitHub Private Key
# Can be loaded as a base64 string to prevent file path mapping errors in cloud environments
GITHUB_PRIVATE_KEY_BASE64=LS0tLS1CRUdJTiBSU0EgUFJJVkFURSBLRVktLS0tLV...

# System Integration Alerts
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/123/abc
```

---

## 6. Running the Service

### 6.1 Installation
```bash
npm install
```

### 6.2 Development Mode
```bash
npm run dev
```

### 6.3 Production Deployment
Deploy the service using a PaaS provider (e.g., Render, Fly.io, or AWS). Ensure you set the environment variables in your deployment dashboard and set the GitHub App Webhook URL back to your production API endpoint.
```bash
npm start
```
