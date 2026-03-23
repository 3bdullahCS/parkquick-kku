# 🅿 ParkQuick KKU

> **Community-driven real-time parking availability for King Khalid University students**

🌐 **[Live Demo → parkquick-kku.vercel.app](https://parkquick-kku.vercel.app)**

<div align="center">

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![AWS](https://img.shields.io/badge/AWS-Serverless-FF9900?logo=amazonaws&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)
![Leaflet](https://img.shields.io/badge/Leaflet-Maps-199900?logo=leaflet&logoColor=white)

</div>

---

## 📖 About

ParkQuick KKU is a web application that helps King Khalid University students find available parking in real-time. Students report the parking status of different zones, and the app aggregates these reports to show live congestion levels on an interactive satellite map.

**Key idea:** Instead of driving around looking for parking, students open ParkQuick and instantly see which zones have available spots — saving time and reducing campus traffic.

---

## ✨ Features

- 🗺️ **Interactive Satellite Map** — Real Google satellite imagery with KKU parking zones overlaid using Leaflet
- 📊 **Live Congestion Status** — Zones color-coded green (available), orange (moderate), red (full)
- 📝 **Student Reports** — Students report parking status with one tap (available / moderate / full)
- 🧭 **Smart Navigation** — "Navigate to best zone" button finds the least congested area
- 🌗 **Dark/Light Mode** — Toggle between themes for comfortable viewing
- ⏱️ **Auto-Expiry** — Reports automatically expire after 15 minutes (DynamoDB TTL)
- 🚫 **Rate Limiting** — One report per 2 minutes per user (prevents spam)
- 📳 **Shake Animation** — Visual alert when a zone's status changes
- 📱 **Mobile-First** — Designed for phone screens with haptic feedback
- 🟢 **Connection Status** — Shows if connected to live backend or running in demo mode

---

## 🏗️ Architecture

```
Student's Phone
      │
      ▼
┌─────────────────────┐
│  Vercel (CDN)        │  ← React + TypeScript + Vite
│  parkquick-kku       │
│  .vercel.app         │
└──────────┬──────────┘
           │ HTTPS
           ▼
┌─────────────────────┐
│  API Gateway         │  ← HTTP API + CORS + Throttling
│  (HTTP API)          │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  AWS Lambda (x3)     │  ← Node.js 20 / arm64
│  getZoneStatus       │
│  submitReport        │
│  getBestZone         │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  DynamoDB            │  ← On-demand + TTL + GSI
│  parkquick-reports   │
└─────────────────────┘
```

---

## 🧠 AWS Concepts Demonstrated

| Concept | Implementation |
|---------|---------------|
| **Serverless Compute** | Lambda functions — no servers, scales to zero |
| **NoSQL Key Design** | DynamoDB PK (`zoneId`) + SK (`timestamp`) for efficient zone queries |
| **Global Secondary Index** | `visitorId-index` for rate limiting lookups |
| **TTL Auto-Expiry** | Reports auto-delete after 15 minutes |
| **Infrastructure as Code** | CloudFormation template creates all resources |
| **Least-Privilege IAM** | Lambda role with only `Query` + `PutItem` permissions |
| **API Throttling** | API Gateway burst (100) and rate (50) limits |
| **CORS Security** | API Gateway CORS configuration |
| **Cost Optimization** | On-demand DynamoDB + arm64 Lambda + free tier |
| **High Availability** | Lambda + DynamoDB = automatic multi-AZ |

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- AWS CLI configured (`aws configure`)
- GitHub CLI (`gh`)

### Local Development

```bash
git clone https://github.com/3bdullahCS/parkquick-kku.git
cd parkquick-kku
npm install
npm run dev
```

The app runs in **demo mode** locally (with sample data). To connect to the live backend, create `.env.local`:

```
VITE_API_URL=https://your-api-url.execute-api.us-east-1.amazonaws.com
```

### Deploy Backend (AWS)

One command deploys everything via CloudFormation:

```bash
chmod +x deploy.sh
./deploy.sh us-east-1 prod
```

This creates:
- DynamoDB table with TTL and GSI
- IAM role with least-privilege policy
- 3 Lambda functions (arm64, Node.js 20)
- API Gateway with CORS and throttling

### Deploy Frontend (Vercel)

```bash
gh repo create parkquick-kku --public --source=. --push
```

Then on [vercel.com](https://vercel.com):
1. Import the repository
2. Add environment variable: `VITE_API_URL` = your API URL
3. Deploy

---

## 📁 Project Structure

```
parkquick-kku/
├── src/
│   ├── App.tsx                 # Main app — API integration + state management
│   ├── main.tsx                # React entry point
│   ├── index.css               # Global styles + dark/light themes
│   ├── components/
│   │   ├── ParkingMap.tsx      # Map component — Leaflet + zones + reports
│   │   └── ParkingMap.css      # Component styles
│   └── data/
│       └── zones.ts            # Zone definitions + GPS coordinates + logic
├── aws/
│   ├── infra/
│   │   └── template.yaml       # CloudFormation — all AWS resources
│   └── lambda/
│       ├── getZoneStatus.mjs   # GET /zones/status — returns all zone statuses
│       ├── submitReport.mjs    # POST /zones/report — submit with rate limiting
│       └── getBestZone.mjs     # GET /zones/best — find least congested zone
├── deploy.sh                   # One-command AWS deployment script
├── index.html                  # HTML entry (RTL Arabic)
├── package.json
├── vite.config.ts
└── tsconfig.json
```

---

## 🔌 API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/zones/status` | Get congestion status for all zones |
| `GET` | `/zones/status?side=front` | Get status for front parking only |
| `POST` | `/zones/report` | Submit a congestion report |
| `GET` | `/zones/best?side=front` | Get the best zone for a side |

### Example: Submit a Report

```bash
curl -X POST https://YOUR_API/zones/report \
  -H "Content-Type: application/json" \
  -d '{"zoneId":"F-A","score":50,"visitorId":"user123"}'
```

---

## 💰 Cost

**$0/month** — all services within AWS Free Tier:

| Service | Free Tier | App Usage (est.) |
|---------|-----------|-----------------|
| Lambda | 1M requests/month | ~50K |
| API Gateway | 1M requests/month | ~50K |
| DynamoDB | 25 RCU + 25 WCU | ~5 each |
| Vercel | Free for personal | ✅ |

---

## 🛠️ Tech Stack

**Frontend:** React 18, TypeScript, Vite, Leaflet, React-Leaflet

**Backend:** AWS Lambda (Node.js 20), API Gateway (HTTP API), DynamoDB

**Infrastructure:** CloudFormation (IaC)

**Hosting:** Vercel (frontend), AWS (backend)

---

## 👤 Author

**Abdullah** — Computer Science, King Khalid University

- GitHub: [@3bdullahCS](https://github.com/3bdullahCS)

---

## 📄 License

This project is a graduation project (مشروع تخرج) at King Khalid University.
