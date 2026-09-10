# LinkedIn Hermes Enterprise Platform (v2)

An enterprise-ready, zero-setup LinkedIn automation platform built with **NestJS + TypeScript**, **MongoDB Atlas**, **Telegram Bot Integration**, and a dedicated **Hermes LinkedIn Cron Agent**.

---

## 🌟 Key Architectural Features

1. **Zero-Setup for End Users**:
   - Users never need a LinkedIn Developer account or API keys.
   - You (the platform owner) configure **one single LinkedIn Master App**.
   - Users connect their profile in 5 seconds via standard LinkedIn OAuth with 1 tap.

2. **Multi-Channel Extensibility**:
   - Modular architecture implementing `INotificationChannel`.
   - Native **Telegram Bot** onboarding (`/start`) with interactive inline buttons (`[✅ Approve]`, `[❌ Skip]`).
   - Pluggable design ready for **Discord** and **WhatsApp** in v3 without modifying business logic.

3. **Multi-User MongoDB Atlas Architecture**:
   - Uses **MongoDB Atlas Free (M0 Cluster)** with Mongoose.
   - Built-in graceful local JSON fallback (`data/users.json`, `data/drafts.json`) if MongoDB URI is not yet configured.

4. **Dual-Layer Image Pipeline**:
   - **Default (0 Cost)**: [Pollinations.ai](https://pollinations.ai/) Flux model generating crisp $1200 \times 627$ developer visuals.
   - **Face-Reference Provider (Optional)**: [Fal.ai](https://fal.ai/) FLUX IP-Adapter slot (~$0.01/image) when users upload their real face photo.

5. **Airtight Human Approval State Machine**:
   - `PENDING_APPROVAL` $\rightarrow$ `APPROVED` $\rightarrow$ `PUBLISHED`.
   - Cryptographic SHA-256 tamper guard preventing unauthorized or altered posting.
   - Posts can only be published after explicit human review.

6. **Content Roadmap (Posts $\rightarrow$ Articles)**:
   - Built for high-converting visual short posts.
   - Data schema pre-structured with `postType: 'SHORT_POST' | 'ARTICLE'` for automated long-form LinkedIn articles.

---

## 🏗️ Architecture

```
User → Telegram Bot (/start)
         │
         ├── 1-Tap LinkedIn OAuth (Consent screen: "Allow")
         │     │
         │     ▼
         │   Tokens saved to MongoDB Atlas
         │
         └── Daily Cron Job (10:00 AM)
               │
               ▼
             Hermes Dedicated LinkedIn Agent
               │
               ├── Researches trending topics
               ├── Generates post & Pollinations visual
               └── Registers draft (PENDING_APPROVAL)
                     │
                     ▼
             Telegram Notification with Photo Preview
               [✅ Approve]   [❌ Skip]   [📱 Full Web View]
                     │
                     ▼ User Approves
             LinkedIn REST API (Media Upload + Publish) ✅
```

---

## 🛠️ MCP Tools for Hermes

When Hermes connects via MCP, it receives access to 8 isolated LinkedIn tools:

| Tool | Parameters | Description |
|---|---|---|
| `linkedin_get_style_profile` | `userId` (optional) | Retrieves dynamic user skills, active projects, and tone rules. |
| `linkedin_create_draft` | `userId`, `text`, `imagePrompt`, `topic`, `tags` | Creates draft in `PENDING_APPROVAL` status, generates image, and notifies user in Telegram. |
| `linkedin_list_drafts` | `userId`, `status` | Lists drafts by status (`PENDING_APPROVAL`, `APPROVED`, `PUBLISHED`, `REJECTED`, `ALL`). |
| `linkedin_get_draft` | `draftId` | Returns full details of a draft. |
| `linkedin_approve_draft` | `draftId` | Marks draft as `APPROVED`. |
| `linkedin_reject_draft` | `draftId`, `reason` | Marks draft as `REJECTED`. |
| `linkedin_publish_post` | `draftId` | Enforces the safety gate (approval check, tamper check) and publishes to LinkedIn. |
| `linkedin_get_profile` | `userId` (optional) | Returns authenticated member details. |

---

## 🚀 Getting Started

### 1. Configure Environment
Copy `.env.example` to `.env`:
```powershell
cp .env.example .env
```
Fill in your credentials:
- `LINKEDIN_CLIENT_ID` & `LINKEDIN_CLIENT_SECRET`: Your platform's LinkedIn developer app credentials.
- `TELEGRAM_BOT_TOKEN`: Token from [@BotFather](https://t.me/botfather).
- `MONGODB_URI`: (Optional) MongoDB Atlas Free connection string. If omitted, uses local JSON fallback.

### 2. Build & Start the Platform
```powershell
# Compile TypeScript
npm run build

# Start the NestJS Platform
npm start
```
Endpoints:
- **Web Control Center**: `http://localhost:3000/drafts`
- **OAuth Connect**: `http://localhost:3000/auth/linkedin`

### 3. Connect Hermes Agent
Configure Hermes to connect to the MCP server:
```json
{
  "mcpServers": {
    "linkedin": {
      "command": "node",
      "args": [
        "d:\\workspace\\linkedin-hermes-mcp\\dist\\mcp\\mcp.server.js"
      ]
    }
  }
}
```

---

## 🐳 Docker Deployment ($5/month VPS or Container)

Deploy on any low-cost cloud provider (DigitalOcean, Hetzner, Render):

```powershell
cd docker
docker compose up -d --build
```
This deploys the NestJS platform with persistent storage volume for generated media.
