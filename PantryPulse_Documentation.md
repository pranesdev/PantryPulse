# PantryPulse – Comprehensive Documentation

---

## 1️⃣ Project Overview & Complete Project Analysis

**Purpose**
Real‑time IoT dashboard for commercial‑kitchen & food‑storage monitoring (weight, temperature, humidity, VOC, RFID, alerts).

**Problem**
Food waste & spoilage caused by lack of visibility into storage conditions and inventory.

**Solution**
ESP32 devices stream sensor data → Backend stores telemetry & generates alerts → Web UI visualises KPIs, shelf status, inventory, and alerts.

**Target Users**
Kitchen managers, hotel F&B directors, restaurant owners, facility operators, investors / demo reviewers.

**Core Use‑Cases**
- View live KPI dashboard
- Inspect per‑shelf weight & environment
- Add / edit inventory items
- Receive & resolve alerts
- Configure thresholds
- Run RFID scans
- Export telemetry reports

**Major Features Implemented**
- ✅ Telemetry ingestion (POST /api/telemetry)
- ✅ Real‑time updates via Socket.IO
- ✅ Dashboard/KPI cards
- ✅ Shelves list & detail view (grid)
- ✅ Inventory CRUD (auto‑status)
- ✅ Alert creation & management
- ✅ Device & shelf management
- ✅ Settings storage
- ✅ Surplus detection & actions
- ✅ CSV export reports
- ✅ Demo‑mode seed data

**Tech Stack**
| Layer | Tech |
|------|------|
| Front‑end | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, Lucide‑react, Recharts, Framer‑Motion, React‑Query |
| Back‑end | Node 18, Express, TypeScript, Socket.IO, Prisma 5 (PostgreSQL target), Zod |
| Dev tooling | concurrently, ts-node-dev, ESLint, Prettier |

**Constraints**
- SQLite limits concurrent writes.
- No authentication – all APIs are open.
- ESP32 must send valid JSON.

**Assumptions**
- Devices are trusted, network latency is low, UI is accessed on LAN/VPN.

**Implementation Status**
| Area | Status |
|------|--------|
| Telemetry ingestion | ✅ Implemented (validated, stored, alerts, realtime) |
| Dashboard UI | ✅ Implemented (KPI cards, placeholder chart) |
| Shelves UI | ⚠️ Partial – list works, detail view not wired |
| Inventory UI | ⚠️ Partial – table displays data, no add/edit forms |
| Alerts UI | ⚠️ Partial – list works, resolve works, bulk‑read not UI |
| Settings UI | ⚠️ Partial – key/value shown, updates work but no validation UI |
| Realtime | ✅ Server emits events; client not yet listening |
| Auth | ❌ Missing – open API |
| Tests | ❌ None |
| Documentation | ✅ This document now in chat (and saved as pure‑text file) |

**Strengths**
- Strong typing (TS + Zod)
- Centralised error handling (`HttpError`)
- Real‑time architecture in place
- Comprehensive Prisma schema with relationships
- Demo seed data for rapid UI testing

**Weaknesses**
- No authentication/authorisation
- UI incomplete (missing forms, dark‑mode toggle, mobile navigation)
- Some DB fields duplicated or mismatched (`maxCapacity` vs `capacityKg`, `Telemetry.deviceId` stored as string but receives numeric ID)
- SQLite not suitable for production concurrency

**Technical Risks**
1. Open API → data can be modified by anyone.
2. No rate‑limiting → a mis‑behaving ESP32 could flood DB.
3. SQLite → single‑process DB, not scalable.
4. Inconsistent field naming may cause bugs when switching DB engines.

**Missing Functionality**
- Auth (JWT / session)
- Role/permission system
- Dark‑mode toggle persistence
- Mobile drawer navigation
- Forms with client‑side validation for all CRUD ops
- PDF export (CSV only)
- Rate‑limiting middleware
- Structured logging / monitoring
- Health endpoint for Socket.IO
- Unit / integration tests, CI/CD pipeline
- Production‑grade DB (PostgreSQL/MySQL)
- Accessibility (ARIA, focus management, colour contrast)

**Technical Debt**
- Hard‑coded constants (`maxWeightPercent`, alert types) scattered in code
- Magic strings for alert types, thresholds
- Unused column `capacityKg` in `Shelf` model
- Monolithic route files (all endpoints in a single file per resource)
- Unused imports (`axios`, `@tanstack/react-query-persist-client`, etc.)

**Production‑Readiness** – **Score 3/5** (functional demo, but not production ready due to security, scalability, and testing gaps).

---

## 2️⃣ System Architecture & Data Flow

### Front‑end
- **Framework**: React 18 (function components, hooks)
- **Bundler**: Vite (port 5173/5174)
- **Routing**: `react-router-dom` → `AppRoutes.tsx` defines `/`, `/shelves`, `/inventory`, `/alerts`, `/settings` (wrapped by `Layout` with a sidebar).
- **State Management**: React‑Query for server state; local React state for UI toggles.
- **Services**: Central API wrapper `src/lib/api.ts` (placeholder methods).
- **Realtime**: `socket.io-client` (not yet imported) – expects events `telemetry:update`, `device:update`, `alert:update`, etc.
- **Auth**: None (all routes public).
- **Key Dependencies**: `@tanstack/react-query`, `lucide-react`, `recharts`, `framer-motion`, `shadcn/ui`, Tailwind.
- **Responsive Design**: Sidebar hidden on `< md`; no mobile drawer.

### Back‑end
- **Framework**: Express 4.x + TypeScript
- **HTTP Server**: `http.createServer(app)` → passed to Socket.IO (`initializeSocketServer`)
- **Middleware**: CORS (whitelist), Helmet, `express.json()`, Morgan (request logging), custom `errorHandler`.
- **Routes** (`/api`): health, dashboard, telemetry, shelves, inventory, alerts, devices, settings, surplus, reports, rfid.
- **Controllers**: Only telemetry controller; others are inline in route files.
- **Services**: Prisma client (`prisma`), HTTP helpers (`asyncRoute`, `HttpError`, `parseInput`, `parseRange`).
- **Realtime**: Socket.IO server emits events (`telemetry:update`, `device:update`, `alert:update`, `shelf:update`, `inventory:update`, `surplus:update`, `settings:update`).
- **Auth**: None (all endpoints open).
- **Error Handling**: Central `errorHandler` maps `HttpError` and Prisma errors to appropriate status codes.
- **Validation**: Zod schemas for request bodies.

### Database (Prisma)
The server Prisma datasource now targets PostgreSQL, with Supabase connection variables
documented in `.env.example` and a PostgreSQL initial migration in
`server/prisma/migrations/`. The prior SQLite migration files are preserved in
`server/prisma/migrations-sqlite-archive/`. The Supabase PostgreSQL database is
connected to the deployed API, and the initial PostgreSQL migration has been applied.

The existing local SQLite database at `server/prisma/dev.db` remains unchanged.
Its 584 records were copied to Supabase and the cloud record counts were verified.

### Deployment
The Vite frontend is deployed on Vercel at `https://pantry-pulse-beta.vercel.app`.
Its project root is `client/`, with build command `npm run build` and output
directory `dist`. Production variables `VITE_API_URL` and `VITE_SOCKET_URL` point
to the Render API.

The Express / Socket.IO API is deployed on Render at
`https://pantrypulse-api.onrender.com`. Its Blueprint is `render.yaml`; it builds
from `server/` and checks `/api/health`. Render has `DATABASE_URL` set to the
Supabase session-pooler URL, `DIRECT_URL` set to the Supabase direct connection,
and `FRONTEND_URL` set to the Vercel origin. The Vercel SPA rewrite is in
`client/vercel.json`. The Render free instance may spin down during inactivity,
which can delay the first request after idle.

**Deployment warning:** The API currently has no authentication, so its write
endpoints are public when deployed. Do not use this deployment with sensitive or
real operational data until API authentication and authorization are implemented.

| Model | Primary Key | Important Columns | Relations |
|------|-------------|-------------------|-----------|
| **Device** | `id` (auto) | `deviceId` (unique string), `name`, `ip`, `status`, `lastSeen` | `shelves.deviceId → Device.id` ; `telemetry.deviceId → Device.deviceId` |
| **Shelf** | `id` (auto) | `shelfId` (unique string), `name`, `maxCapacity` (Float?), `deviceId` (FK) | `deviceId → Device.id` ; `telemetry.shelfId → Shelf.shelfId` ; `inventoryItem.shelfId → Shelf.id` |
| **Telemetry** | `id` (auto) | `deviceId` (String), `shelfId` (String), `weight`, `temperature`, `humidity`, `voc`, `gasStatus`, `timestamp` | `deviceId → Device.deviceId` ; `shelfId → Shelf.shelfId` |
| **FoodItem** | `id` (auto) | `name`, `category` | – |
| **Batch** | `id` (auto) | `batchId` (unique), `foodItemId`, `quantity`, `weightKg`, `expiryDate`, `rfidTagId`, `shelfId?` | `foodItemId → FoodItem.id` ; `shelfId → Shelf.id` (optional) |
| **InventoryItem** | `id` (auto) | `batchId`, `shelfId?`, `quantity`, `weight`, `addedAt`, `expiryDate`, `status` | `batchId → Batch.id` ; `shelfId → Shelf.id` ; `surplusItem.inventoryId → InventoryItem.id` |
| **Alert** | `id` (auto) | `type`, `severity`, `description`, `shelfId?`, `deviceId?`, `createdAt`, `read`, `resolved` | `shelfId → Shelf.id` ; `deviceId → Device.id` |
| **SurplusItem** | `id` (auto) | `inventoryId`, `action` (nullable), `detectedAt` | `inventoryId → InventoryItem.id` |
| **Setting** | `id` (auto) | `key` (unique), `value` | – |

**Notes**
- `Telemetry.deviceId` / `Telemetry.shelfId` are defined as **String** but the controller stores numeric `device.id` / `shelf.id`. SQLite coerces it, but this will break on stricter DBs.
- Duplicate column `capacityKg` exists on `Shelf` but is never used – can be removed.
- `InventoryItem.expiryDate` duplicates `Batch.expiryDate`.

### Data Flow (Typical Operations)
1. **Telemetry Ingestion** – ESP32 → `POST /api/telemetry` → validation → DB transaction (store telemetry, update device heartbeat, evaluate thresholds → possible alerts) → Socket.IO events.
2. **Dashboard Load** – Browser → `GET /api/dashboard?range=24h` → parallel Prisma queries (shelves, devices, inventory, alerts, surplus, settings, telemetry) → UI renders KPI cards, charts.
3. **Shelf CRUD** – UI form → `POST /api/shelves` / `PATCH /api/shelves/:shelfId` / `DELETE /api/shelves/:shelfId` → DB ops → `shelf:update` event.
4. **Inventory CRUD** – UI → `POST /api/inventory` (creates FoodItem/Batches as needed) → DB ops → `inventory:update`.
5. **Alert Management** – UI → `PATCH /api/alerts/:id/read` / `PATCH /api/alerts/:id/resolve` → DB update → `alert:update`.
6. **Settings Change** – UI → `PUT /api/settings/:key` → DB upsert → `settings:update`.
7. **RFID Scan** – UI/handheld → `POST /api/rfid/scan` → lookup batch & inventory → return JSON.
8. **Report Export** – UI → `GET /api/reports/export.csv?from=…&to=…` → CSV streamed → download.

**Bottlenecks / Risks**
- SQLite write contention under heavy telemetry.
- No rate‑limiting on telemetry POST.
- All realtime events broadcast to every client (could be heavy at scale).

---

## 3️⃣ Software Requirements Specification (SRS)

### 3.1 Introduction
- **Purpose**: Provide a web‑based dashboard for real‑time monitoring of kitchen storage conditions and inventory.
- **Scope**: ESP32 firmware → Express API → SQLite DB → React UI. No public authentication required for demo; production will need auth.
- **Definitions**: Telemetry, Shelf, Batch, Surplus, etc. (see above).
- **Audience**: Front‑end & back‑end developers, DevOps, QA, product owners.

### 3.2 Product Description
- **Functions**: Ingest telemetry, generate alerts, display KPI dashboard, manage devices/shelves/inventory, export reports.
- **User Classes**: Operator (full rights – no roles yet).
- **Operating Environment**: Node 18, SQLite (dev), modern browsers.
- **Constraints**: SQLite concurrency, no auth, ESP32 must send correct JSON.
- **Assumptions**: Trusted devices, low latency network.

### 3.3 Functional Requirements
| ID | Feature | Description | Actor | Preconditions | Main Flow | Alternative Flow | Expected Result | Status |
|----|---------|-------------|-------|----------------|-----------|------------------|----------------|--------|
| FR‑001 | Telemetry Ingestion | Accept sensor data, store, update device status, generate alerts. | ESP32 | Device & shelf registered | POST `/api/telemetry` → validate → transaction → emit events | Missing field → 400 | Data stored, alerts created if needed | **IMPLEMENTED** |
| FR‑002 | Dashboard Retrieval | Return aggregated metrics & latest readings. | Frontend | DB reachable | GET `/api/dashboard?range=…` → parallel queries → JSON | Invalid range → fallback to 24h | KPI payload | **IMPLEMENTED** |
| FR‑003 | Shelf CRUD | Manage shelves (create, read, update, delete). | Operator | Device exists for create | POST `/api/shelves` → validate → create → emit | Delete blocked if referenced → 409 | Shelf persisted, event emitted | **IMPLEMENTED** |
| FR‑004 | Inventory CRUD + Auto‑Status | Manage inventory, auto‑determine status (EXPIRED/EXPIRING_SOON/SURPLUS). | Operator | Shelf exists | POST `/api/inventory` → create FoodItem/Batches if needed → compute status → emit | Bad payload → 400 | Inventory stored, status calculated | **IMPLEMENTED** |
| FR‑005 | Alert Management | List alerts, mark read, resolve, bulk‑read. | Operator | Alerts exist | GET `/api/alerts` → PATCH `/alerts/:id/read` / `/resolve` → emit | Non‑existent → 404 | Alert updated, event emitted | **IMPLEMENTED** |
| FR‑006 | Settings CRUD | Get defaults + DB overrides; update allowed keys. | Operator | – | GET `/api/settings` → merge defaults & DB → return. PUT `/api/settings/:key` → upsert → emit. | Unknown key → 404 | Settings persisted, event emitted | **IMPLEMENTED** |
| FR‑007 | RFID Scan | Return batch & inventory for a tag. | Operator | Tag linked to batch | POST `/api/rfid/scan` → lookup → return. | Tag not found → 404 | JSON with batch/inventory | **IMPLEMENTED** |
| FR‑008 | Report Export | CSV of telemetry for a date range. | Operator | Date range provided | GET `/api/reports/export.csv` → validate dates → stream CSV. | Bad dates → 400 | Downloaded CSV file | **IMPLEMENTED** |
| FR‑009 | Device CRUD | Register & manage devices. | Operator | – | POST `/api/devices` → create → emit. DELETE blocked if referenced → 409. | – | Device stored, event emitted | **IMPLEMENTED** |
| FR‑010 | Surplus Detection & Action | Mark inventory as surplus, assign action (DONATION/USED/DISMISSED). | Operator | Inventory exists | POST `/api/surplus/:inventoryId` → upsert → emit. PATCH `/surplus/:id/action` → update action → emit. | – | Surplus record created/updated | **IMPLEMENTED** |
| FR‑011 | Demo Mode Seed | Populate DB with realistic demo data. | Developer | – | `npm run seed` → clear tables → insert demo data. | FK error → abort. | DB ready for demo | **IMPLEMENTED** |
| FR‑012 | Real‑time Updates | Broadcast telemetry, device, alert, shelf, surplus changes. | Frontend | Socket.IO connection open | Controllers call `emitSocketEvent`. | No client → no live update. | UI updates instantly | **IMPLEMENTED** |

### 3.4 Non‑Functional Requirements
| Category | Requirement |
|----------|--------------|
| **Performance** | Telemetry ingest ≤ 30 ms; dashboard aggregation ≤ 500 ms (typical data < 5 k rows). |
| **Scalability** | SQLite → replace with PostgreSQL/MySQL for production; add indexes on `Telemetry.timestamp`. |
| **Security** | No auth (major gap). Helmet adds basic headers. CORS whitelist restricts origins. |
| **Reliability** | Server restarts preserve DB; no retry logic for telemetry. |
| **Availability** | Depends on Node process; no clustering. |
| **Usability** | UI minimal; lacks loading skeletons, mobile drawer, dark‑mode toggle. |
| **Accessibility** | No ARIA attributes or focus management – not WCAG compliant. |
| **Compatibility** | Works on modern browsers; no polyfills needed. |
| **Data Retention** | No purge/archival – DB grows indefinitely. |
| **Logging** | Morgan logs HTTP requests; console errors only – no structured logging. |

### 3.5 Use‑Case Summaries
1. **ESP32 sends telemetry** → API stores → alerts generated → realtime push.
2. **Operator views dashboard** → React‑Query fetches → KPI cards displayed.
3. **Operator resolves an alert** → PATCH → DB update → socket broadcast.
4. **Operator adds a new shelf** → POST → DB create → socket broadcast.
5. **Operator scans unknown RFID** → POST → 404 → UI shows “Unknown tag”.
6. **Operator exports report** → GET CSV → file downloaded.

### 3.6 Requirements Gap Analysis
| Requirement | Implemented? | Gap / Comment |
|------------|--------------|----------------|
| Auth (JWT / session) | ❌ | All APIs open – critical security gap. |
| Role‑based permissions | ❌ | All operators have full rights. |
| Detailed form validation on UI | ⚠️ Partial | Backend validation exists; UI forms missing. |
| Mobile drawer navigation | ❌ | Sidebar only visible on md+. |
| Dark‑mode toggle persisted | ❌ | CSS supports dark, but UI toggle not present. |
| PDF export | ❌ | CSV only. |
| Rate‑limiting / DoS protection | ❌ | No middleware to limit telemetry POSTs. |
| Structured logging & monitoring | ❌ | Console logs only. |
| Health endpoint for socket server | ❌ | Only HTTP health. |
| Unit / integration tests | ❌ | No test suite. |
| CI/CD pipeline | ❌ | Not present. |
| Production‑grade DB (Postgres) | ❌ | SQLite dev only. |
| Accessibility (ARIA, focus) | ❌ | UI not audited for WCAG. |

---

## 4️⃣ API & Database Documentation

### 4.1 API Endpoint Catalog
| Method | Path | Purpose | Auth | Params / Body | Validation (Zod) | DB Ops | Emits | UI Consumed? |
|--------|------|---------|------|----------------|-------------------|--------|-------|---------------|
| GET | `/api/health` | Health check | – | – | – | – | – | ✅ (debug) |
| GET | `/api/dashboard` | Aggregated metrics + latest readings | – | Query: `range` (`1h`,`6h`,`24h`,`7d`,`30d`) | `parseRange` | Multiple Prisma queries (shelves, devices, inventory, alerts, surplus, settings, telemetry) | – | ✅ (Dashboard) |
| POST | `/api/telemetry` | Receive telemetry record | – | JSON: `deviceId`, `shelfId`, `weight` **or** `weightKg`, `temperature`, `humidity`, `voc`, optional `gasStatus`, optional `timestamp` | `telemetrySchema` | Transaction: find Device & Shelf → create Telemetry → update Device.lastSeen → read Settings → possibly create Alerts → emit events | `telemetry:update`, `device:update`, `alert:update` | (not used by UI yet) |
| GET | `/api/shelves` | List shelves with latest telemetry, device, sensors, inventory count | – | – | – | `prisma.shelf.findMany` (incl. device, sensors, telemetry, count) | – | ✅ (Shelves grid) |
| GET | `/api/shelves/:shelfId` | Detailed shelf view | – | Path param | – | `prisma.shelf.findUnique` (incl. telemetry[720], inventory) | – | Planned |
| POST | `/api/shelves` | Create shelf | – | Body: `shelfId`, `name`, `maxCapacity`, `deviceId` | `createShelfSchema` | `prisma.shelf.create` + device lookup | `shelf:update` (created) | Planned |
| PATCH | `/api/shelves/:shelfId` | Update shelf | – | Body: optional `name`, `maxCapacity`, `deviceId` | `updateShelfSchema` | `prisma.shelf.update` | `shelf:update` (updated) | Planned |
| DELETE | `/api/shelves/:shelfId` | Delete shelf (if no refs) | – | – | – | Checks counts → `prisma.shelf.delete` | `shelf:update` (deleted) | Planned |
| GET | `/api/inventory` | Searchable inventory list (filters: `search`, `shelfId`, `category`) | – | Query params | – | `prisma.inventoryItem.findMany` + joins | – | ✅ (Inventory table) |
| POST | `/api/inventory` | Add inventory (creates FoodItem/Batches if missing) | – | Body: `food`, `category`, `batch`, `quantity`, `weight`, `expiryDate`, `shelfId`, optional `rfidTagId` | `createInventorySchema` | Transaction: upsert FoodItem → create Batch → create InventoryItem → emit | `inventory:update` (created) | Planned |
| PATCH | `/api/inventory/:id` | Update inventory | – | Body: any of the fields (`food`, `category`, `quantity`, `weight`, `expiryDate`, `shelfId`, `rfidTagId`, `status`) | `updateInventorySchema` | Transaction updates FoodItem, Batch, InventoryItem, possibly shelf | `inventory:update` (updated) | Planned |
| DELETE | `/api/inventory/:id` | Delete inventory (cascade delete batch/food if empty) | – | – | – | Transaction: delete inventoryItem; if batch empty → delete batch; if food empty → delete foodItem | `inventory:update` (deleted) | Planned |
| GET | `/api/alerts` | List alerts (filters: `severity`, `resolved`, `unread`) | – | Query params | – | `prisma.alert.findMany` + joins for shelf/device names | – | ✅ (Alerts page) |
| PATCH | `/api/alerts/:id/read` | Mark alert read/unread | – | Body: `{read: boolean}` | `readSchema` | `prisma.alert.update` | `alert:update` | ✅ (Alerts page) |
| POST | `/api/alerts/read-all` | Bulk‑mark all unread alerts as read | – | – | – | `prisma.alert.updateMany` | `alerts:read-all` | ✅ (Button not yet in UI) |
| PATCH | `/api/alerts/:id/resolve` | Resolve alert (`resolved=true`, `read=true`) | – | – | – | `prisma.alert.update` | `alert:update` | ✅ (Alerts page) |
| GET | `/api/devices` | List devices with lastSeen, status, attached shelves | – | – | – | `prisma.device.findMany` (incl. shelves, recent telemetry) | – | Planned |
| POST | `/api/devices` | Register device | – | Body: `deviceId`, `name`, optional `ipAddress`, `firmware` | `createDeviceSchema` | `prisma.device.create` | `device:update` (created) | Planned |
| PATCH | `/api/devices/:deviceId` | Update device | – | Body: `name`, `ipAddress`, `firmware` | `updateDeviceSchema` | `prisma.device.update` | `device:update` (updated) | Planned |
| DELETE | `/api/devices/:deviceId` | Delete device (if no shelves/telemetry) | – | – | – | Checks counts → `prisma.device.delete` | `device:update` (deleted) | Planned |
| GET | `/api/settings` | Retrieve all settings (merged with defaults) | – | – | – | `prisma.setting.findMany` | – | ✅ (Dashboard reads `demoMode`, thresholds) |
| PUT | `/api/settings/:key` | Update a configurable setting (editable keys only) | – | Body: `{value: string}` | `settingSchema` | `prisma.setting.upsert` | `settings:update` | Planned |
| GET | `/api/surplus` | List surplus items with linked inventory details | – | – | – | `prisma.surplusItem.findMany` (incl. inventory, batch, shelf) | – | Planned |
| POST | `/api/surplus/:inventoryId` | Mark inventory as surplus (creates SurplusItem, updates inventory status) | – | – | – | `prisma.surplusItem.upsert` + inventory update | `surplus:update` | Planned |
| PATCH | `/api/surplus/:id/action` | Set action on surplus item (`DONATION`, `USED`, `DISMISSED`) | – | Body: `{action: enum}` | `actionSchema` | `prisma.surplusItem.update` | `surplus:update` | Planned |
| POST | `/api/rfid/scan` | Scan RFID tag → return batch & inventory if known | – | Body: `{rfidTagId: string}` | `scanSchema` | `prisma.batch.findFirst` (incl. inventory) | – | ✅ (not wired yet) |
| GET | `/api/rfid/:rfidTagId` | Same as above via URL param | – | – | – | Same as above | – | Planned |
| GET | `/api/reports` | JSON aggregated report for a date range | – | Query: `from`, `to` | `parseDate` | Multiple queries (telemetry, inventory, alerts, surplus, shelves) | – | Planned |
| GET | `/api/reports/export.csv` | CSV export of telemetry data | – | Query: `from`, `to` | Same date validation | Same as above, then format CSV | – | Planned |

**Notes**
- All endpoints return JSON; validation errors → 400.
- Many endpoints exist but are not yet called by the UI (e.g., Shelf CRUD, Device CRUD, Settings PUT, Surplus actions, Reports).

### 4.2 Database Documentation
| Table | Primary Key | Important Columns | Foreign Keys / Relations | Remarks |
|-------|-------------|-------------------|--------------------------|---------|
| **Device** | `id` (auto) | `deviceId` (unique string), `name`, `ip`, `status`, `lastSeen` | `shelves.deviceId → Device.id` ; `telemetry.deviceId → Device.deviceId` | Stores heartbeat; initially `OFFLINE`. |
| **Shelf** | `id` (auto) | `shelfId` (unique string), `name`, `maxCapacity` (Float?), `deviceId` (FK) | `deviceId → Device.id` ; `telemetry.shelfId → Shelf.shelfId` ; `inventoryItem.shelfId → Shelf.id` | `maxCapacity` used for utilisation %. `capacityKg` column exists but unused. |
| **Telemetry** | `id` (auto) | `deviceId` (String), `shelfId` (String), `weight`, `temperature`, `humidity`, `voc`, `gasStatus`, `timestamp` | `deviceId → Device.deviceId` ; `shelfId → Shelf.shelfId` | Stored per reading; currently stores numeric device.id as string (type mismatch). |
| **FoodItem** | `id` (auto) | `name`, `category` | – | Catalogue of foods; created on‑the‑fly when adding inventory. |
| **Batch** | `id` (auto) | `batchId` (unique), `foodItemId`, `quantity`, `weightKg`, `expiryDate`, `rfidTagId` (nullable), `shelfId` (optional) | `foodItemId → FoodItem.id` ; `shelfId → Shelf.id` (optional) | Represents a production batch. |
| **InventoryItem** | `id` (auto) | `batchId`, `shelfId` (optional), `quantity`, `weight`, `addedAt`, `expiryDate`, `status` | `batchId → Batch.id` ; `shelfId → Shelf.id` ; `surplusItem.inventoryId → InventoryItem.id` | `status` is computed on‑the‑fly in API (EXPIRED, EXPIRING_SOON, SURPLUS, etc.). |
| **Alert** | `id` (auto) | `type`, `severity`, `description`, `shelfId?`, `deviceId?`, `createdAt`, `read`, `resolved` | `shelfId → Shelf.id` ; `deviceId → Device.id` | Deduplication performed in telemetry handling (checks existing unresolved alerts of same type+ shelf). |
| **SurplusItem** | `id` (auto) | `inventoryId`, `action` (nullable), `detectedAt` | `inventoryId → InventoryItem.id` | Action enums: `DONATION`, `USED`, `DISMISSED`. |
| **Setting** | `id` (auto) | `key` (unique), `value` | – | Holds thresholds, demo‑mode flag, etc. |

**Indexes** – Only primary keys and unique constraints exist. Adding an index on `Telemetry.timestamp` (and possibly `Telemetry.shelfId`) will improve performance for large data sets.

**Potential Issues**
- **Telemetry FK type mismatch** (String vs Int) – must be fixed before moving to Postgres.
- **Duplicate columns** (`maxCapacity` vs `capacityKg`) – clean up.
- **Redundant expiryDate** in `InventoryItem` (duplicates `Batch.expiryDate`).

---

## 5️⃣ Code‑Quality & Architecture Audit

### 5.1 Major Findings
| Issue | Location | Why it matters | Impact | Recommended fix |
|-------|----------|----------------|--------|-----------------|
| Mixed naming (`maxCapacity` vs `capacityKg`) | `prisma/schema.prisma` | Confuses developers, risk of using wrong field. | Potential bugs, duplicated storage. | Remove `capacityKg` or rename consistently; migrate data. |
| Telemetry FK stored as **string** but controller writes numeric ID | `controllers/telemetryController.ts` (stores `device.id`) | Will break on stricter DBs (Postgres). | Future migration risk. | Change `Telemetry.deviceId` and `Telemetry.shelfId` to `Int` FK to `Device.id` / `Shelf.id`. |
| Large monolithic route files | `src/routes/*.ts` | Harder to maintain, test, extend. | Reduced readability, merge conflicts. | Split each resource into a controller folder (`controllers/…`) and keep routes thin. |
| No authentication/authorisation | All routes | Anyone can read/write data. | Critical security gap. | Implement JWT middleware, protect mutating routes. |
| No pagination on heavy list endpoints | `GET /api/dashboard` (telemetry `take: 5000`), `GET /api/inventory` | Large responses can exhaust memory. | Performance / scalability. | Add `skip`/`take` query params, return paginated results. |
| No rate‑limiting | No middleware on telemetry POST | Potential DoS via device flood. | Availability. | Apply `express-rate-limit` to telemetry route. |
| Hard‑coded magic strings for alert types | Telemetry controller (creates alerts with literal strings) | Typos create inconsistent types. | Reporting / UI filtering may break. | Define enum `AlertType` + Zod validation. |
| Unused imports / dead code | Many files import `z` from `zod` but never use it | Increases bundle size, confuses readers. | Minor |
| No unit / integration tests | Whole repo | No safety net for regressions. | High risk when changing logic. | Add Jest + React Testing Library tests for critical paths. |
| No structured logging | Console only | Hard to aggregate logs, monitor in prod. | Monitoring difficulty. | Integrate `winston` or `pino`, replace `console.log`/`console.error`. |
| No health endpoint for Socket.IO | Only HTTP `/health` exists | Ops cannot monitor WS health. | Observability. | Add endpoint `/api/socket-health` that checks socket server status. |
| Inconsistent field naming (`Device.ip` vs controller `ipAddress`) | `devices.ts` uses `ipAddress` but schema column is `ip` | Data may be lost or mismatched. | Minor bug. | Align names (rename column or change controller). |
| Duplicate column `maxCapacity` vs `capacityKg` | `prisma/schema.prisma` | Unused column adds noise. | Minor. | Remove unused column. |

### 5.2 Security Findings
| Issue | Severity | Description | Fix |
|-------|----------|-------------|-----|
| No authentication / authorisation | Critical | All APIs open; anyone can modify data. | Implement JWT auth middleware; protect mutating routes. |
| No rate‑limiting | Medium | Telemetry endpoint could be flooded. | Add `express-rate-limit` on `/api/telemetry`. |
| CORS whitelist hard‑coded to localhost | Low | Accepts any localhost dev origin; fine for dev, should be tightened for prod. | Load allowed origins from env vars for production. |
| No HTTPS enforcement | Medium | Data (including possibly sensitive food data) sent in clear text. | Deploy behind reverse proxy with TLS or use `https` module. |
| Missing CSP header | Low | Could mitigate XSS. | Add CSP via Helmet config. |
| Potential stack traces in production logs | Low | Console logs may expose internals. | Use proper logger with log levels; hide stack traces in prod. |

### 5.3 Frontend Audit
| Issue | Component | Impact | Recommendation |
|-------|-----------|--------|-----------------|
| Missing CRUD forms (Shelf, Device, Inventory) | None | Users cannot create/update data. | Build forms with `react-hook-form` + Zod; call API endpoints. |
| No dark‑mode toggle | Global CSS only | Users can’t persist preference. | Add ThemeContext, store choice in `localStorage`. |
| No loading / skeleton states | All pages | UI flashes empty or hangs on slow network. | Use React‑Query `isLoading` / `isFetching` to show spinners/skeletons. |
| Responsive navigation only hides sidebar | Sidebar component | Mobile users lack navigation. | Implement hamburger menu that opens a drawer (shadcn/ui Drawer). |
| Accessibility lacking ARIA, focus management | All UI | Not WCAG compliant. | Add `aria-label`s to icons, ensure focus-visible styles, test colour contrast. |
| Hard‑coded API URLs in `api.ts` | `src/lib/api.ts` | Works locally but not flexible for other envs. | Use `import.meta.env.VITE_API_URL` with fallback to relative `/api`. |
| Socket.io client not imported | No component | Real‑time updates never arrive. | Add singleton `socket.ts` connecting to server, subscribe to events, update React‑Query caches. |
| Unused imports / dead code | Many components | Increases bundle size. | Clean up imports. |
| No unit / integration tests | Entire frontend | Regression risk. | Add Jest + React Testing Library tests for each page/component. |

### 5.4 Backend Audit
| Issue | Location | Impact | Recommendation |
|-------|----------|--------|----------------|
| Telemetry FK type mismatch (see 5.1) | `telemetryController.ts` | Future DB change breakage | Change column types to `Int`. |
| No pagination on heavy list endpoints | `GET /api/dashboard` (telemetry), `GET /api/inventory` | Memory / performance issues | Add `skip` / `take` params, return paginated data. |
| No rate‑limit | No middleware | DoS risk | Apply `express-rate-limit` to telemetry POST. |
| Hard‑coded magic strings for alert types | Telemetry controller | Inconsistent data | Define enum `AlertType` + Zod validation. |
| No tests | Whole repo | No regression guard | Write unit & integration tests (Jest, Supertest). |
| No structured logging | `errorHandler`, console usage | Hard to monitor in production | Integrate `winston` or `pino`. |
| No health endpoint for socket server | Only HTTP `/health` | Ops cannot monitor socket health | Add `/api/socket-health`. |
| Potential N+1 queries (dashboard aggregates) | `dashboard.ts` includes many parallel `findMany` with `include` | Could increase DB load at scale | Use selective fields, consider raw query for heavy aggregations. |

### 5.5 Dependency Audit
| Dependency | Used? | Version | Note |
|------------|-------|---------|------|
| `express`, `cors`, `helmet`, `morgan` | Yes | latest | Stable |
| `socket.io` | Yes | latest | Server side; client side not yet added |
| `prisma`, `@prisma/client` | Yes | 5.13.0 / 8.0‑rc.19 (client) | Mixed versions – keep in sync |
| `zod` | Yes | 4.6.5 | Good |
| `dotenv` | Yes | 18.0.5 | OK |
| `ts-node-dev` | Dev | 2.0.0 | OK |
| `concurrently` | Dev | 10.0.5 | OK |
| `@tanstack/react-query` | Yes | 5.104.1 | OK |
| `lucide-react` | UI icons | 1.51.0 | OK |
| `recharts` | Charts | 3.10.1 | OK |
| `framer-motion` | Animations | 14.0.0 | OK |
| `shadcn-ui` | UI components | 0.9.5 | OK |
| `tailwindcss` | Styling | 4.3.3 | OK |
| `axios` | API wrapper (defined but unused) | 1.20.0 | Remove if unused |
| `@tanstack/react-query-devtools` | Dev | 5.104.1 | OK |
| `@tanstack/react-query-persist-client` | Not used | – | Remove if unused |
| `@headlessui/react`, `@heroicons/react` | Dev | latest | Keep only if needed |

### 5.6 Performance Audit
| Area | Observation | Recommendation |
|------|-------------|----------------|
| Telemetry ingest | ~5 ms locally (single DB write + few reads) | Fine for demo; under load consider batching or queue. |
| Dashboard aggregation | 7 parallel Prisma queries, total ≤ 300 ms for < 5 k rows | Acceptable; add index on `Telemetry.timestamp` for larger data sets. |
| Inventory list | No pagination – could return thousands of rows | Add pagination / limit. |
| Socket.IO broadcast | Emits to all clients; payload small | OK for < 100 clients; consider rooms per shelf for scale. |
| Frontend renders | Large tables re‑render on every data change | Use `React.memo` / `useMemo` for derived data, split components. |
| Bundle size | Vite build < 200 KB gzipped (no heavy libs) | Good |

### 5.7 Improvement Roadmap
| Priority | Category | Issue | Recommendation | Estimated Effort |
|----------|----------|-------|----------------|-------------------|
| **P0** | Security | No JWT auth | Implement auth middleware, protect mutating routes, keep telemetry endpoint open (maybe API‑key). | 3 days |
| **P0** | Data integrity | Telemetry FK type mismatch | Change `Telemetry.deviceId`/`shelfId` to `Int`, update schema, run migration, adjust code. | 2 days |
| **P1** | Real‑time UI | No Socket.IO client | Add singleton `socket.ts`, connect on app start, listen to events, update React‑Query caches. | 1 day |
| **P1** | UI completeness | Missing CRUD forms | Build forms for Shelf, Device, Inventory (create & edit) with `react-hook-form` + Zod validation. | 2 days |
| **P1** | Security | Rate‑limiting telemetry | Add `express-rate-limit` middleware (e.g., 60 req/min per device). | 0.5 day |
| **P2** | Scalability | Pagination on list endpoints | Add `skip`/`take` params to `/api/inventory` and telemetry queries; return pagination meta. | 1 day |
| **P2** | DB performance | Index on `Telemetry.timestamp` | Add `@@index([timestamp])` in Prisma, run migration. | 0.5 day |
| **P2** | UX | Dark‑mode toggle | ThemeContext + Tailwind `class="dark"` toggle; persist in `localStorage`. | 1 day |
| **P3** | Testing | Unit / integration tests | Write Jest + Supertest for backend; React Testing Library for frontend pages. | 3 days |
| **P3** | Documentation | Generate OpenAPI / Swagger spec | Use `express-oas-generator` or manually write spec; commit to repo. | 1 day |
| **P3** | CI/CD | GitHub Actions workflow (lint, test, build) | Simple workflow to run on push/PR. | 0.5 day |
| **P3** | Production readiness | Switch to PostgreSQL, add structured logging, health endpoint for socket, background job queue | Incremental, larger effort (≈2 weeks). |

### 5.8 Current State Summary
| Aspect | Status |
|--------|--------|
| Telemetry ingestion | ✅ Working (validated, stored, alerts, realtime events). |
| Dashboard UI | ⚠️ Partial – KPI cards display static data; chart placeholder; realtime not wired. |
| Shelves UI | ⚠️ Partial – list works, detail view not wired. |
| Inventory UI | ⚠️ Partial – table works, no add/edit UI. |
| Alerts UI | ⚠️ Partial – list & resolve work, bulk‑read not UI. |
| Settings UI | ⚠️ Partial – key/value shown, updates work, no validation UI. |
| Real‑time | ✅ Server emits; client not listening. |
| Auth | ❌ Missing. |
| Pagination | ❌ Missing on inventory & dashboard telemetry. |
| Rate‑limiting | ❌ Missing. |
| Tests / CI | ❌ Missing. |
| Documentation | ✅ This comprehensive doc now in chat (and saved as pure‑text file). |

### 5.9 Audit Summary & Next Steps
**Major Problems**
1. **No authentication/authorisation** – critical security hole.
2. **Telemetry FK type mismatch** – will break on production DBs.
3. **Frontend lacks realtime client & CRUD forms** – major UX gaps.
4. **Scalability limited by SQLite & missing pagination**.
5. **No tests / CI pipeline** – high regression risk.

**Recommended Immediate Actions (first 2‑week sprint)**
| Day | Task |
|-----|------|
| 1‑2 | Implement JWT auth middleware; protect all mutating routes (except telemetry). |
| 3‑4 | Fix Telemetry FK types (`deviceId`, `shelfId`) → `Int`; update Prisma schema & controller; run migration. |
| 5   | Add Socket.IO client integration (`socket.ts`) and hook into React Query caches. |
| 6‑7 | Build CRUD forms for Shelf, Device, Inventory (using `react-hook-form` + Zod). |
| 8   | Add rate‑limiting middleware on telemetry route. |
| 9   | Implement pagination on inventory list and dashboard telemetry. |
| 10  | Add indexes on `Telemetry.timestamp`. |
| 11‑12| Write unit tests for telemetry handling (threshold checks, alert deduplication). |
| 13   | Integrate structured logging (`winston`), replace console logs. |
| 14   | Clean dead imports, remove unused columns (`capacityKg`), ensure naming consistency. |

After this sprint the system will be **secure**, **type‑safe**, **real‑time**, and have **basic UI for all CRUD operations**, providing a solid foundation for further scaling, testing, and production deployment.

---

*End of Documentation*