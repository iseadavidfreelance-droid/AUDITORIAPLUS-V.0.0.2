# MaraPlus On-Premise Relay Agent

Dockerized Node.js daemon that synchronizes **Supabase Cloud Realtime** with the local **MaraPlus ERP** physical REST API (`http://192.168.15.225:3002`).

---

## 🚀 Quick Start in 3 Steps

### 1. Configure Supabase Schema
Execute `schema.sql` in the [Supabase SQL Editor](https://supabase.com/dashboard/project/_/sql). This creates the `Relay_Queue` table and enables Realtime replication (`ALTER PUBLICATION supabase_realtime ADD TABLE "Relay_Queue";`).

### 2. Configure Environment Variables
Copy `.env.example` to `.env` and fill in your Supabase credentials:
```bash
cp .env.example .env
```
Ensure `SUPABASE_SERVICE_ROLE_KEY` is provided so the agent can update job status without RLS restrictions.

### 3. Deploy via Docker Compose
```bash
docker compose up -d --build
```
Check live logs:
```bash
docker compose logs -f maraplus-relay
```

---

## ⚙️ Architecture & Technical Specifications

| Requirement | Implementation Detail |
| :--- | :--- |
| **Realtime Engine** | `@supabase/supabase-js` WebSocket client listening to `Relay_Queue` (`INSERT` / `UPDATE`) with `Status = 'Pending'`. |
| **Cold Recovery** | On startup, queries pending rows ordered by `CreatedAt ASC` to prevent data loss after power/network outages. |
| **FIFO Ordering** | Single-threaded in-memory queue with memory deduplication `Set` preventing race conditions. |
| **Micro-Throttle** | 300 ms mandatory pause between individual HTTP requests to protect MaraPlus CPU. |
| **Batch Ceiling** | Enforces a maximum of 10 consecutive requests per batch. |
| **Inter-Batch Pause** | Mandatory **2,000 ms cooldown** after every 10 requests before starting the next batch. |
| **REST Consumption** | `GET http://192.168.15.225:3002/api/inventory?search={Sku}&deposito={Dep}&onlyOffers=false` |
| **Metrics Extracted** | Parses `stock_quantity` and `ventas_del_dia` (or `ventas_dia`). |
| **Resilience / Retries** | 3 attempts with exponential backoff (`1000ms`, `2000ms`, `4000ms`). |
| **Status Update** | Success: `Status='Completed'`, `ProcessedAt=NOW()`, `Payload={...}`. Failure: `Status='Failed'`. |
| **Networking** | `network_mode: host` in `docker-compose.yml` ensures the container can reach the LAN IP `192.168.15.225`. |

---

## 🩺 Monitoring & Healthcheck

The agent exposes an internal HTTP monitoring server on port **3001**:
- `GET http://localhost:3001/healthz`: Docker health probe (`200 OK`)
- `GET http://localhost:3001/metrics`: Live JSON metrics (queue depth, items completed, batch counter, uptime)
