# PantryPulse – Full‑Stack IoT Dashboard Summary

---

## 1. Project Overview

**PantryPulse** is a modern, responsive web application that visualises real‑time telemetry from an ESP32‑based IoT sensor suite (load‑cell, DHT22, MQ gas sensor, RFID).  It provides a complete dashboard for food‑storage facilities – hotels, restaurants, commercial kitchens – helping them reduce waste by monitoring weight, temperature, humidity, VOC levels, and inventory status.

---

## 2. Architecture Diagram (high‑level)

```
┌─────────────────────┐      ┌─────────────────────┐
│   ESP32 Devices     │      │  Browser (React)    │
│  (sensor firmware) │      │   (Vite, TS, Tail‑) │
│   → POST /telemetry│      │   wind)            │
└─────────┬───────────┘      └───────┬─────────────┘
          │                         │
          ▼                         ▼
   ┌────────────────┐   WebSocket (Socket.IO)   
   │  Backend API   │────────────────────────────►│
   │  (Node/Express│   ↔  Real‑time events        │
   │   + Prisma)    │   ↔  (telemetry:update)       │
   └───────┬────────┘                            │
           │                                     │
           ▼                                     ▼
   ┌─────────────────────┐               ┌─────────────────────┐
   │   SQLite Database   │               │   React‑Query Cache │
   │   (Prisma ORM)     │               │   (client‑side)      │
   └─────────────────────┘               └─────────────────────┘
```

---

## 3. Tech Stack

| Layer | Technology | Reason |
|-------|-------------|--------|
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, Lucide‑react, Recharts, Framer‑Motion, React‑Query | Modern, component‑driven UI with excellent dev experience and built‑in data‑fetching/state management |
| **Backend** | Node .js, Express, TypeScript, Socket.IO, Prisma ORM, SQLite | Lightweight API server with realtime capability; SQLite keeps the prototype simple |
| **Realtime** | Socket.IO (WebSocket fallback) | Pushes telemetry updates instantly to the dashboard |
| **Database** | Prisma 5 + SQLite | Schema‑first, type‑safe DB access; SQLite for quick local development |
| **Development Tools** | concurrently, ts-node-dev, nodemon, ESLint, Prettier | Fast parallel dev server, live reload |

---

## 4. Database Schema (Prisma)

```prisma
model Device {
  id        Int       @id @default(autoincrement())
  deviceId  String    @unique
  name      String?
  ip        String?
  status    String    @default("OFFLINE")
  lastSeen  DateTime?
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  shelves   Shelf[]
  telemetry Telemetry[]
}

model Shelf {
  id          Int       @id @default(autoincrement())
  shelfId     String    @unique
  name        String?
  capacityKg  Float?
  deviceId    Int
  device      Device   @relation(fields: [deviceId], references: [id])
  telemetry   Telemetry[]
  inventory   InventoryItem[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  batches     Batch[]
}

model Telemetry {
  id          Int      @id @default(autoincrement())
  deviceId    String
  shelfId     String
  weightKg    Float?
  temperature Float?
  humidity    Float?
  voc         Float?
  gasStatus   String?
  timestamp   DateTime @default(now())
  createdAt   DateTime @default(now())
  device      Device   @relation(fields: [deviceId], references: [deviceId])
  shelf       Shelf    @relation(fields: [shelfId], references: [shelfId])
}

model FoodItem {
  id          Int      @id @default(autoincrement())
  name        String
  category    String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  batches     Batch[]
}

model Batch {
  id          Int      @id @default(autoincrement())
  batchId     String   @unique
  foodItemId  Int
  foodItem    FoodItem @relation(fields: [foodItemId], references: [id])
  quantity    Int
  weightKg    Float?
  expiryDate  DateTime
  shelfId     Int?
  shelf       Shelf?   @relation(fields: [shelfId], references: [id])
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  inventory   InventoryItem[]
}

model InventoryItem {
  id          Int      @id @default(autoincrement())
  batchId     Int
  batch       Batch    @relation(fields: [batchId], references: [id])
  quantity    Int
  shelfId     Int?
  shelf       Shelf?   @relation(fields: [shelfId], references: [id])
  addedAt     DateTime @default(now())
  expiryDate  DateTime
  status      String   @default("GOOD")
}

model Alert {
  id          Int      @id @default(autoincrement())
  type        String
  severity    String
  message     String
  shelfId     Int?
  deviceId    Int?
  createdAt   DateTime @default(now())
  read        Boolean  @default(false)
  resolved    Boolean  @default(false)
}

model Setting {
  id          Int      @id @default(autoincrement())
  key         String   @unique
  value       String
}
```

---

## 5. API Overview (REST)

The Express API is mounted under `/api`; Prisma/SQLite is the source of truth. Request bodies are validated with Zod, and errors use a consistent JSON envelope.

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/health` | Health check |
| `GET` | `/api/dashboard?range=&shelfId=` | KPI aggregation, current shelf/device state, inventory, alerts, settings, telemetry history |
| `GET`, `POST` | `/api/telemetry` | Query history or accept ESP32 telemetry; ingestion updates heartbeat and evaluates thresholds |
| `GET`, `POST` | `/api/shelves` | List shelves or register one |
| `GET`, `PATCH`, `DELETE` | `/api/shelves/:shelfId` | Shelf detail/edit/delete (delete is rejected while referenced) |
| `GET`, `POST` | `/api/inventory` | Search/filter inventory or add a batch |
| `PATCH`, `DELETE` | `/api/inventory/:id` | Edit/delete inventory and clean up unreferenced batch/food rows |
| `GET` | `/api/alerts` | Filter alerts by severity, read state, and resolution |
| `PATCH` | `/api/alerts/:id/read`, `/api/alerts/:id/resolve` | Read/unread and resolve alerts |
| `POST` | `/api/alerts/read-all` | Mark current unread alerts as read |
| `GET`, `POST` | `/api/devices` | List/register ESP32 controllers |
| `PATCH`, `DELETE` | `/api/devices/:deviceId` | Edit/delete a device (delete is rejected while referenced) |
| `GET`, `PUT` | `/api/settings`, `/api/settings/:key` | Read and persist supported thresholds/alert settings |
| `GET`, `POST`, `PATCH` | `/api/surplus` and `/api/surplus/:inventoryId/action` | List surplus, classify an inventory item, and record donation/use/dismissal |
| `POST`, `GET` | `/api/rfid/scan`, `/api/rfid/:rfidTagId` | Resolve RFID tags to saved batches and shelf assignments |
| `GET` | `/api/reports?from=&to=` | Date-bounded telemetry, inventory, shelf utilization, alerts, and surplus summaries |
| `GET` | `/api/reports/export.csv?from=&to=` | Export recorded telemetry as CSV |

There is no authentication flow, user-facing user model, firmware/OTA control, or waste-event ledger in the current project. Reports therefore summarize tracked inventory/telemetry and do not invent food-waste totals.

---

## 6. Realtime Flow

1. ESP32 posts telemetry to **POST `/api/telemetry`** using the registered `deviceId` and public `shelfId`.
2. The server validates the payload, stores the reading, updates the device heartbeat, deduplicates threshold alerts, then emits `telemetry:update`, `device:update`, and any `alert:update` events.
3. The React client invalidates the corresponding React Query caches on Socket.IO events and polls every 30 seconds as a fallback.

---

## 7. Demo Mode

- When `DEMO_MODE=true`, the idempotent server seed creates sample devices/shelves/sensors, inventory, an alert, and a month of deterministic telemetry without deleting existing records.
- The API exposes the mode flag; the dashboard labels it `DEMO MODE`.
- New ESP32 readings are stored alongside demo readings. The project does not automatically purge or replace historical demo rows.

---

## 8. UI Pages (React Router)

| Route | Page | Main Elements |
|-------|------|----------------|
| `/`, `/dashboard` | **Dashboard** | Persisted KPI summaries, 1H–30D telemetry charts, shelf filter, live/demo and socket/polling state |
| `/shelves`, `/shelves/:shelfId` | **Shelves** | Shelf list/detail, capacity, utilization, telemetry, sensors, inventory, alerts, edit/register |
| `/inventory` | **Inventory** | Search, shelf/category/status filters, sorting, add/edit/delete, RFID lookup, surplus actions |
| `/alerts` | **Alerts** | Persisted severity/status/read filters, read/unread, resolve, affected shelf/device links |
| `/reports` | **Reports** | Date-bounded telemetry/environment trends, inventory status, utilization, alerts, surplus, CSV |
| `/devices` | **Devices** | Persisted ESP32 status/heartbeat/firmware/sensors, register, safe delete |
| `/settings` | **Settings** | Persisted thresholds, timeout, alerts enabled, read-only demo-mode state |

All pages share a responsive sidebar/drawer, route-aware top bar, unread alert count, connection state, and common data loading/error behavior.

---

## 9. Styling & Design Language

- **Dark charcoal theme** with restrained emerald identity and semantic amber/red/blue states.
- **Typography** – large, bold headings for app name & page titles; medium headings for KPI titles; regular text for values.
- **Cards** – subtle background `#1e1f26`, rounded corners, slight shadow, padding.
- **Responsive** – the sidebar becomes a drawer below 1024px; tables scroll intentionally and KPI/chart layouts adapt down to 375px.
- **Animations** – subtle Framer Motion entrances; Recharts renders persisted telemetry.

---

## 10. Getting Started (Developer Guide)

1. **Clone the repository** (already on your machine under `pantrypulse`).
2. **Install root dependencies**:
   ```bash
   npm install
   ```
3. **Install client & server deps** (the root install does not recursively invoke itself):
   ```bash
   cd client && npm install && cd ..
   cd server && npm install && cd ..
   ```
4. **Configure environment** – copy `.env.example` to `.env`; default frontend/API ports are `5174` and `4001`.
5. **Generate the client, apply migrations, and seed**:
   ```bash
  npm run db:generate
  npm run db:deploy
  npm run seed
   ```
6. **Run both parts together**:
   ```bash
   npm run dev
   ```
   - Frontend will be at `http://localhost:5174` (or the next free port).
  - Backend API listens on `http://localhost:4001` by default.
7. **Test the telemetry endpoint** (simulate ESP32):
   ```bash
  curl -X POST http://localhost:4001/api/telemetry \
       -H "Content-Type: application/json" \
      -d '{"deviceId":"PANTRY-ESP32-01","shelfId":"shelf-A","weightKg":32.4,"temperature":24,"humidity":60,"voc":120,"gasStatus":"NORMAL"}'
   ```
   The dashboard will update instantly.

---

## 11. Future Enhancements (Roadmap)

- **Authentication / Multi‑tenant support** – separate dashboards per kitchen/hotel.
- **PWA support** – offline cache of the shell, installable on mobile devices.
- **Waste event ledger** – capture measured disposal/usage events before calculating food-waste reduction.
- **RFID association workflow** – link an unassigned tag to an existing batch from the UI.
- **Firmware/OTA management** – only after an ESP32 update protocol is defined.
- **Authentication / multi-tenant support** – the `User` table currently has no login/session routes.
- **Dark‑mode toggle** – store user preference in local storage.
- **Unit tests** – Jest + React Testing Library for UI, supertest for API.

---

## 12. License & Credits

- **License:** MIT – feel free to fork, modify, and deploy.
- **Icon set:** Lucide (MIT licensed).
- **UI components:** shadcn/ui (MIT).
- **Charts:** Recharts (MIT).
- **Realtime:** Socket.IO (MIT).
- **Database:** Prisma (Apache‑2.0).

---

*Prepared by OpenCode – the AI‑assisted development environment.*
