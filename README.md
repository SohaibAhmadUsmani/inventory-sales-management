# InventoryHub: Enterprise Inventory, POS, Procurement & Business Intelligence Platform

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-4.21.0-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-8.6.0-47A248?logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![React](https://img.shields.io/badge/React-18.3.1-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-5.4.2-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Lenis](https://img.shields.io/badge/Smooth%20Scroll-Lenis-FF6B6B)](https://lenis.darkroom.engineering/)
[![JWT Auth](https://img.shields.io/badge/Auth-JWT%20HS256%20%2B%20RBAC-4F46E5)](https://jwt.io/)
[![Accounting](https://img.shields.io/badge/Valuation-Moving%20Average%20Cost%20(AVCO)-0D9488)](#13-core-accounting-inventory--transactional-business-logic)
[![License](https://img.shields.io/badge/Status-Production%20Ready-22C55E)](#)

---

## Table of Contents

1. [Project Title, Badges & Executive Overview](#1-project-title-badges--executive-overview)
2. [Key Features & Functional Highlights](#2-key-features--functional-highlights)
3. [System Architecture & Cross-Module Data Flow](#3-system-architecture--cross-module-data-flow)
4. [Complete Technology Stack & Dependencies](#4-complete-technology-stack--dependencies)
5. [Exhaustive Repository Directory Structure](#5-exhaustive-repository-directory-structure)
6. [Environment Variables Reference (`.env`)](#6-environment-variables-reference-env)
7. [Step-by-Step Installation & Local Development Setup Guide](#7-step-by-step-installation--local-development-setup-guide)
8. [Database Seeder & Default Login Credentials](#8-database-seeder--default-login-credentials)
9. [Role-Based Access Control (RBAC) Permission Matrix](#9-role-based-access-control-rbac-permission-matrix)
10. [Detailed Guide to All Frontend Pages & Workflows](#10-detailed-guide-to-all-frontend-pages--workflows)
11. [Complete REST API Reference (All 12 Modules & Endpoints)](#11-complete-rest-api-reference-all-12-modules--endpoints)
12. [Database Schema & Entity-Relationship Reference (All 10 Mongoose Models)](#12-database-schema--entity-relationship-reference-all-10-mongoose-models)
13. [Core Accounting, Inventory & Transactional Business Logic](#13-core-accounting-inventory--transactional-business-logic)
14. [Multi-Format Reporting & Export Engine (PDF, Excel, CSV)](#14-multi-format-reporting--export-engine-pdf-excel-csv)
15. [Security, Input Validation & Error Handling Architecture](#15-security-input-validation--error-handling-architecture)
16. [Git Workflow & Multi-Developer Feature Branch Integration](#16-git-workflow--multi-developer-feature-branch-integration)
17. [Production Build & Deployment Guide](#17-production-build--deployment-guide)
18. [Troubleshooting & FAQ](#18-troubleshooting--faq)

---

## 1. Project Title, Badges & Executive Overview

**InventoryHub** is a full-stack **Inventory, Point of Sale (POS), Procurement, Customer/Supplier CRM, and Financial Analytics Platform** built on the **MERN Stack** (`MongoDB`, `Express.js`, `React 18`, `Node.js`). Built for retail, wholesale, and warehouse operations, the system connects daily cashier checkouts with warehouse stock control and financial reporting.

Basic CRUD trackers allow direct stock edits and overwrite historical valuation data. **InventoryHub** enforces strict accounting and operational invariants across the stack:

- **Strict Stock Mutation Lock**: Product stock quantities (`Product.stock`) cannot be overwritten through the catalog edit form. Every unit change after initial product creation must flow through an auditable warehouse movement (`stock_in`, `stock_out`, `damaged`, `adjustment`), a POS sale (`sale`, `sale_return`), or a supplier purchase receipt (`purchase`).
- **Moving Weighted Average Cost (AVCO / MAC) Valuation**: Inbound stock receipts from manual warehouse intake or supplier Purchase Order (`PO`) receipts recalculate the product's unit cost using the Moving Average Cost formula, keeping inventory asset valuation accurate.
- **Historical COGS Snapshot on Sales**: Every POS line item captures the product's exact unit cost (`Sale.items[].cost`) at checkout. Later supplier cost changes never alter historical profit-and-loss (P&L) reports.
- **Atomic Concurrency & Optimistic Locking**: Stock deductions use atomic MongoDB conditional filters (`{ _id, stock: { $gte: qty } }`) to prevent negative inventory balances under concurrent checkouts. Physical cycle counts use Optimistic Concurrency Control (`expectedStock`) and idempotency keys (`idempotencyKey`) to block duplicate submissions and Time-of-Check to Time-of-Use (TOCTOU) race conditions.
- **Automated Low-Stock Replenishment Engine**: One-click scanning identifies all products at or below `minimumStock`, groups items by their linked supplier, and generates `ordered` Purchase Orders with calculated safety buffers.
- **Multi-Format Document & BI Export Suite**: Server-side PDF invoice and report generation (`pdfkit` / `pdfkit-table`), auto-sized `.xlsx` spreadsheets (`xlsx`), and formula-injection-hardened UTF-8 BOM `.csv` exports.
- **Production App Shell & Motion Architecture**: A collapsible sidebar (`272px` expanded $\leftrightarrow$ `78px` compact icon rail), a global command palette (`Ctrl+K` / `⌘K`), live topbar notification popover, Lenis smooth scrolling, and an Emil Kowalski-inspired motion system (`cubic-bezier` easing tokens, tactile `:active` scaling, `tabular-nums`, and `prefers-reduced-motion` support).

---

## 2. Key Features & Functional Highlights

InventoryHub is structured into **12 backend functional domains** paired with a keyboard-first React application shell:

### 2.1 Authentication, Session Security & Self-Service Password Recovery
- **JWT HS256 Stateless Authentication** with configurable token expiration (`JWT_EXPIRE=7d`) and an automatic `401 Unauthorized` session interceptor on the frontend.
- **Cryptographic Password Reset Workflow**: Generates a 32-byte random hex token, stores only its `SHA-256` digest in MongoDB (`resetPasswordToken`) with a 15-minute TTL (`resetPasswordExpire`), and exposes a development-mode reset link for local testing.
- **Brute-Force Protection**: IP and route sliding-window rate limiter protecting `/api/auth/login` and `/api/auth/forgot-password` (`30 requests / 15 minutes`).

### 2.2 Role-Based Access Control (RBAC) & Staff Administration
- Two operational roles: **Admin** (full executive, procurement, staff management, catalog mutation, and financial reporting access) and **Staff** (operational access to POS, Sales History, Inventory Ledger/Operations, Products/Categories read, Customers CRM, and Notifications).
- **Self-Protection & Referential Integrity Guards**: Admins cannot demote, deactivate, or delete their own active account. Deleting a user who has historical `Sale`, `Inventory`, or `Purchase` records triggers a **soft deactivation** (`isActive: false`) so audit trails remain intact.

### 2.3 Product Catalog & Category Management
- Full product lifecycle management with unique uppercase SKU enforcement, category classification, supplier linkage, retail `price`, unit `cost`, `minimumStock` alert threshold, and Multer image upload (`JPG`, `PNG`, `WEBP` up to `5 MB`).
- Automatic `opening_stock` ledger entry (`OPN-<SKU>`) created upon product registration.
- **Non-Zero Stock Deletion Guard**: Products with `stock > 0` cannot be deactivated until existing physical stock is dispatched or written off.

### 2.4 Forensic Inventory Ledger & Warehouse Stock Operations
- **Immutable Audit Chain**: Every movement records `previousStock`, `quantity`, `currentStock`, `unitCost`, `reference` (`TRX-*`, `DMG-*`, `ADJ-*`, `INV-*`, `PO-*`), `performedBy`, and timestamps.
- **4 Dedicated Warehouse Operations**:
  1. **Stock In (`POST /api/inventory/stock-in`)**: Inbound stock with optional supplier attribution and automatic AVCO unit cost recalculation.
  2. **Stock Out (`POST /api/inventory/stock-out`)**: Manual outbound dispatch with atomic `$gte` stock verification.
  3. **Damaged / Expired Write-Off (`POST /api/inventory/damaged`)**: Records shrinkage or spoilage with mandatory reason classification.
  4. **Physical Cycle Count Adjustment (`POST /api/inventory/adjust`)**: Reconciles system stock to physical count with Optimistic Concurrency Control (`expectedStock`).
- **6-Metric Forensic Product Audit Modal**: Evaluates any product's lifetime equation:
  $$\text{Expected Stock} = \text{Opening Stock} + \text{Total Inbound} - \text{Total Sold/Dispatched} - \text{Total Damaged} + \text{Net Adjustments}$$
  and flags any discrepancy against live `Product.stock`.

### 2.5 Point of Sale (POS) Terminal & Fast Checkout
- Cashier interface with debounced product search, category pills, barcode/SKU exact-match auto-add on `Enter`, shopping cart, inline quantity controls, percentage or flat `$` discount toggle, configurable tax calculation, and payment method selection (`cash`, `card`, `online`).
- Inline **Quick-Add Customer Modal** so cashiers can register a new customer without leaving an active checkout cart.
- Printable receipt preview modal and downloadable PDF invoice (`INV-*`).

### 2.6 Sales History, Invoice Generation & Full Cancellation Reversal
- Multi-filter sales log (search by invoice number, customer, payment method, status, and date range) with KPI summary cards and client-side CSV export.
- **Transactional Sale Void / Cancellation (`PUT /api/sales/:id/cancel`)**: Atomically marks a completed sale as `cancelled`, restores each item's quantity to `Product.stock`, records `sale_return` (`VOID-INV-*`) entries in the `Inventory` ledger, decrements the customer's `totalSpending` and `totalOrders`, and logs a system notification and audit entry.

### 2.7 Customer Relationship Management (CRM)
- Tracks customer contact profiles (`name`, `phone`, `email`, `address`) and lifetime value metrics (`totalOrders`, `totalSpending`).
- Purchase history modal displaying every completed invoice for a customer.

### 2.8 Supplier Management & Virtual Catalog Synchronization
- Maintains vendor records (`name`, `company`, `phone`, `email`, `address`, `totalPurchases`).
- Uses a Mongoose virtual populate (`productsSupplied`) linked to `Product.supplier` so a supplier's product list stays synchronized without manual array maintenance.
- **Purchase History Deletion Guard**: Suppliers with existing Purchase Orders cannot be deleted, preventing orphaned procurement records.

### 2.9 Procurement & Purchase Order (`PO`) Lifecycle
- Supports multi-line Purchase Orders (`PO-*`) in `ordered` or immediate `received` status, tracking `paymentStatus` (`pending`, `partial`, `paid`).
- **Idempotent Stock Application (`inventoryApplied`)**: Transitioning a PO from `ordered` to `received` (`PUT /api/purchases/:id/status`) runs `applyPurchaseStockIncrease` once, incrementing `Product.stock`, recalculating AVCO unit cost, creating `purchase` ledger entries, and incrementing `Supplier.totalPurchases`. Received or cancelled POs are locked against status reversal.

### 2.10 Executive Dashboard & Real-Time KPIs
- Consolidates 7 top-level KPIs (`Total Sales Revenue`, `Today's Sales Revenue & Count`, `Monthly Revenue`, `Total Active Products`, `Low Stock Products`, `Total Active Customers`, `Pending Purchase Orders`) with **Recharts** visualizations:
  - **30-Day Daily Sales Trend** (Area/Line Chart)
  - **Top 5 Selling Products** by quantity and revenue (Bar Chart / Table)
  - **Revenue by Category** distribution (Pie/Donut Chart)

### 2.11 Business Intelligence Reports & Multi-Format Export Suite
- 6 analytical report tabs (**Sales**, **Product Sales**, **Inventory Valuation**, **Profit & Margin**, **Top Customers**, **Supplier Spend**) with date-range, category, product, customer, supplier, and payment filters.
- Every report supports **Excel (`.xlsx`)** and **PDF (`.pdf`)** downloads, plus a consolidated **Executive Monthly Business Report PDF** (`/api/reports/monthly/export/pdf`).

### 2.12 System Notifications & Forensic Activity Log
- Real-time unread notification badge in the top navigation bar tracking `low_stock`, `sale_completed`, `sale_cancelled`, `purchase_ordered`, `purchase_received`, and `stock_adjustment` events.
- Admin-only **Activity Log** capturing user identity, role, action verb, target entity, entity ID, details, IP address, and timestamp.

### 2.13 Production App Shell, Collapsible Sidebar, Command Palette, Lenis Smooth Scroll & Motion System
- **Collapsible Sidebar Navigation (`272px` Expanded $\leftrightarrow$ `78px` Compact Icon Rail)**: Grouped into 5 semantic domains (`Overview`, `Catalog & Stock`, `Sales & CRM`, `Procurement`, `Administration & System`) with `localStorage` state persistence, floating hover tooltips when collapsed, and `Ctrl+B` / `⌘B` keyboard toggle.
- **Global Command Palette (`Ctrl+K` / `⌘K`) & Keyboard Shortcuts**: Spotlight modal providing instant search across all 13 modules, quick operational actions, live product catalog lookup, and `Alt+1`–`Alt+5` workspace hotkeys.
- **Live Topbar Notification Popover**: Unread count badge paired with an inline quick-read popover drawer and cross-component `notifications-updated` custom event synchronization.
- **Lenis Smooth Scrolling & Emil Kowalski Motion System**: Inertial scroll container (`useLenis.js`) with `data-lenis-prevent` overlay isolation, hardware-accelerated custom cubic-bezier curves (`--ease-out`, `--ease-drawer`), tactile `:active` button scaling (`scale(0.97)`), `tabular-nums` financial alignment, and full `prefers-reduced-motion` compliance.

---

## 3. System Architecture & Cross-Module Data Flow

### 3.1 High-Level 3-Tier System Architecture

```mermaid
flowchart TB
    subgraph Client["Frontend Tier — React 18 + Vite 5 + Lenis (Port 3000)"]
        SHELL["Production App Shell (Layout.jsx + useLenis.js)\nCollapsible Rail (Ctrl+B) | Command Palette (Ctrl+K) | Notification Popover"]
        UI["15 Responsive Pages & Modals\n(Dashboard, POS, Inventory, Products, Sales, CRM, Reports)"]
        CTX["AuthContext + ProtectedRoute RBAC\n(JWT Persistence & Role Guards)"]
        AX["Axios Service Layer (src/services/api.js)\nRequest Bearer Interceptor & 401 Auto-Logout"]
        CSV["Client CSV Engine (src/utils/exportCsv.js)\nUTF-8 BOM + Formula Injection Guard"]
    end

    subgraph Server["Backend API Tier — Node.js + Express 4 (Port 5000)"]
        MW["Security & Pipeline Middleware\nCORS | JSON 1MB Limit | Auth Rate Limiter | JWT protect/authorize | Multer Upload"]
        CTRL["13 Domain Controllers\nAuth | User | Product | Category | Inventory | Sale | Purchase | Customer | Supplier | Dashboard | Report | Notification | ActivityLog"]
        EXP["Server Export Engines\npdfExport.js (pdfkit-table) & excelExport.js (SheetJS xlsx)"]
        ERR["Centralized Error Handler (middleware/errorHandler.js)\nCastError (404) | Duplicate Key 11000 (400) | ValidationError (400)"]
    end

    subgraph Storage["Persistence Tier — MongoDB 8 + Local File Storage"]
        DB[("MongoDB Database\n10 Indexed Mongoose Collections")]
        FS[("Static Disk Storage\nbackend/uploads/ (nosniff headers)")]
    end

    SHELL --> UI
    UI --> CTX
    UI --> AX
    UI --> CSV
    AX -->|"/api/* (Vite Proxy or VITE_API_URL)"| MW
    MW --> CTRL
    CTRL --> EXP
    CTRL --> DB
    CTRL --> FS
    CTRL --> ERR
```

### 3.2 End-to-End Operational & Accounting Data Flow

The diagram below shows how procurement, warehouse stock movements, moving average cost valuation, POS checkouts, sale reversals, and BI reporting interact across collections:

```mermaid
flowchart LR
    SUP["Supplier\n(totalPurchases)"]
    PO["Purchase Order\n(status: ordered -> received)"]
    PROD["Product Catalog\n(stock, cost [AVCO], price, minStock)"]
    LEDGER["Immutable Inventory Ledger\n(previousStock -> currentStock, unitCost)"]
    POS["POS Checkout / Sale\n(items[].cost snapshot, total)"]
    VOID["Sale Cancellation\n(PUT /api/sales/:id/cancel)"]
    CUST["Customer CRM\n(totalOrders, totalSpending)"]
    NOTIF["Notifications & ActivityLog\n(Low Stock, Sale, PO, Audit)"]
    BI["Dashboard & BI Reports\n(P&L, Valuation, PDF/XLSX/CSV)"]

    SUP -->|"1. Create PO"| PO
    PO -->|"2. Receive PO\n(+Stock & Recalculate AVCO Cost)"| PROD
    PO -->|"3. Log type: 'purchase'"| LEDGER
    PO -->|"4. Increment totalPurchases"| SUP

    PROD <-->|"5. Warehouse Ops\n(stock_in [AVCO], stock_out, damaged, adjust)"| LEDGER
    POS -->|"6. Atomic Stock Deduction\n(stock >= qty) & Snapshot item.cost"| PROD
    POS -->|"7. Log type: 'sale'"| LEDGER
    POS -->|"8. Increment Orders & Spending"| CUST

    VOID -->|"9. Restore Stock (+qty)\n& Log type: 'sale_return'"| PROD
    VOID -->|"10. Append VOID-INV entry"| LEDGER
    VOID -->|"11. Decrement Orders & Spending"| CUST

    PROD -->|"12. stock <= minimumStock"| NOTIF
    PROD --> BI
    LEDGER --> BI
    POS --> BI
    CUST --> BI
    SUP --> BI
```

---

## 4. Complete Technology Stack & Dependencies

### 4.1 Backend Dependencies (`backend/package.json`)

| Package | Version | Category | Architectural Role in InventoryHub |
| :--- | :--- | :--- | :--- |
| `express` | `^4.21.0` | Web Framework | Core HTTP server, RESTful routing, static `/uploads` serving, and middleware pipeline. |
| `mongoose` | `^8.6.0` | ODM / Database | Schema modeling, compound/text indexing, virtuals (`isLowStock`, `productsSupplied`), and aggregation pipelines. |
| `jsonwebtoken` | `^9.0.2` | Authentication | Signs and verifies stateless `HS256` Bearer tokens containing `{ id }` payload. |
| `bcryptjs` | `^2.4.3` | Cryptography | Salted password hashing (`10` salt rounds) via Mongoose `pre('save')` hook and `comparePassword` instance method. |
| `express-validator` | `^7.2.0` | Input Validation | Declarative request body sanitization and validation on `/api/auth/*` and `/api/users/*` routes. |
| `multer` | `^1.4.5-lts.1` | File Uploads | Multipart form-data handling for product images with extension filtering (`.jpg`, `.jpeg`, `.png`, `.webp`) and `5 MB` size limit. |
| `pdfkit` | `^0.15.0` | PDF Generation | Core PDF document stream generator for sales invoices and business reports. |
| `pdfkit-table` | `^0.1.99` | PDF Tables | Extends `pdfkit` with formatted multi-column tables, headers, dividers, and summary rows in `utils/pdfExport.js`. |
| `xlsx` | `^0.18.5` | Excel Export | SheetJS library for generating auto-sized `.xlsx` buffers in `utils/excelExport.js`. |
| `cors` | `^2.8.5` | Security | Cross-Origin Resource Sharing middleware configured with origin allowlisting and credentials support. |
| `dotenv` | `^16.4.5` | Configuration | Loads environment variables from `backend/.env` into `process.env`. |
| `nodemon` | `^3.1.4` | Dev Tooling | Development file watcher (`npm run dev`) that restarts the Node process on code changes. |

### 4.2 Frontend Dependencies (`frontend/package.json`)

| Package | Version | Category | Architectural Role in InventoryHub |
| :--- | :--- | :--- | :--- |
| `react` | `^18.3.1` | UI Library | Component-based declarative UI with hooks (`useState`, `useEffect`, `useMemo`, `useCallback`, `useContext`, `useRef`). |
| `react-dom` | `^18.3.1` | DOM Renderer | Mounts the React 18 root tree into `index.html` (`#root`). |
| `react-router-dom` | `^6.26.1` | Client Routing | Declarative SPA routing (`Routes`, `Route`, `Outlet`, `Navigate`, `NavLink`), `ProtectedRoute`, and URL query sync. |
| `axios` | `^1.7.5` | HTTP Client | Centralized API client (`src/services/api.js`) with JWT Bearer injection and `401` auto-redirect interceptor. |
| `lenis` | `^1.1.13` | Smooth Scroll Engine | Hardware-accelerated inertial scrolling (`src/hooks/useLenis.js`) with `data-lenis-prevent` modal/drawer isolation and `prefers-reduced-motion` compliance. |
| `recharts` | `^2.12.7` | Data Visualization | Responsive SVG charts (`ResponsiveContainer`, `AreaChart`, `BarChart`, `PieChart`, `LineChart`) on Dashboard and Reports. |
| `react-toastify` | `^10.0.5` | Notifications | Non-blocking toast alerts (`toast.success`, `toast.error`, `toast.warning`, `toast.info`) for user feedback. |
| `react-icons` | `^5.3.0` | Iconography | Feather (`react-icons/fi`) vector icons across navigation rails, command palette, KPI cards, tables, and action buttons. |
| `vite` | `^5.4.2` | Build Tool / Bundler | ES module dev server (port `3000`) with `/api` and `/uploads` proxy to `http://localhost:5000` and Rollup production bundler. |
| `@vitejs/plugin-react` | `^4.3.1` | Vite Plugin | Enables Fast Refresh (HMR) and automatic JSX runtime compilation. |

---

## 5. Exhaustive Repository Directory Structure

```text
inventory-sales-management/
├── backend/                                      # Node.js + Express + Mongoose REST API Server
│   ├── config/
│   │   └── db.js                                 # MongoDB connection manager + Windows SRV DNS resolver fallback
│   ├── controllers/                              # 13 Domain Route Controllers
│   │   ├── activityLog.controller.js             # Paginated system audit trail queries (Admin)
│   │   ├── auth.controller.js                    # Register, Login, GetMe, ForgotPassword, ResetPassword
│   │   ├── category.controller.js                # Category CRUD + product count aggregation + delete guard
│   │   ├── customer.controller.js                # Customer CRUD, CRM KPI stats, and customer purchase history
│   │   ├── dashboard.controller.js               # Real-time executive KPIs, 30-day sales, top products, category revenue
│   │   ├── inventory.controller.js               # Forensic ledger, stats, Stock-In (AVCO), Stock-Out, Damaged, Adjust (OCC), Auto-PO
│   │   ├── notification.controller.js            # Unread count, list, mark read, mark all read, delete notification
│   │   ├── product.controller.js                 # Product CRUD, SKU normalization, opening_stock ledger creation, stock lock
│   │   ├── purchase.controller.js                # Purchase Order creation, status transitions, idempotent AVCO stock receipt
│   │   ├── report.controller.js                  # 6 analytical reports + Monthly Business Report + PDF/Excel streaming
│   │   ├── sale.controller.js                    # POS checkout, atomic stock deduction, PDF invoice, sale cancellation reversal
│   │   ├── supplier.controller.js                # Supplier CRUD, virtual productsSupplied, purchase summary, delete guard
│   │   └── user.controller.js                    # Staff/Admin management, profile update, self-lockout & history delete guards
│   ├── middleware/                               # Express Request Pipeline Middleware
│   │   ├── auth.js                               # JWT verification (`protect`) & role guard (`authorize(...roles)`)
│   │   ├── errorHandler.js                       # Centralized error normalizer (CastError, 11000 duplicate key, ValidationError)
│   │   └── upload.js                             # Multer diskStorage configuration (`uploads/`, 5MB limit, image MIME/ext filter)
│   ├── models/                                   # 10 Mongoose Data Models
│   │   ├── ActivityLog.js                        # Audit log schema (`user`, `action`, `entity`, `entityId`, `details`, `ipAddress`)
│   │   ├── Category.js                           # Product category schema (`name`, `description`, `isActive`)
│   │   ├── Customer.js                           # CRM customer schema (`name`, `phone`, `email`, `address`, `totalSpending`, `totalOrders`)
│   │   ├── Inventory.js                          # Immutable stock movement ledger (`type`, `quantity`, `previousStock`, `currentStock`, `unitCost`, `idempotencyKey`)
│   │   ├── Notification.js                       # Alert schema (`user`, `type`, `title`, `message`, `isRead`, `referenceId`)
│   │   ├── Product.js                            # Catalog item schema (`name`, `sku`, `category`, `price`, `cost`, `stock`, `minimumStock`, `supplier`, `isLowStock` virtual)
│   │   ├── Purchase.js                           # Supplier PO schema (`orderNumber`, `supplier`, `items`, `totalCost`, `status`, `paymentStatus`, `inventoryApplied`)
│   │   ├── Sale.js                               # POS invoice schema (`invoiceNumber`, `customer`, `items` with `cost` snapshot, `subtotal`, `discount`, `tax`, `total`, `status`)
│   │   ├── Supplier.js                           # Vendor schema (`name`, `company`, `phone`, `email`, `totalPurchases`, `productsSupplied` virtual)
│   │   └── User.js                               # Account schema (`name`, `email`, `password` bcrypt hash, `role`, `isActive`, reset tokens)
│   ├── routes/                                   # 13 Modular Express Routers
│   │   ├── activityLog.routes.js                 # `/api/activity-log`
│   │   ├── auth.routes.js                        # `/api/auth`
│   │   ├── category.routes.js                    # `/api/categories`
│   │   ├── customer.routes.js                    # `/api/customers`
│   │   ├── dashboard.routes.js                   # `/api/dashboard`
│   │   ├── inventory.routes.js                   # `/api/inventory`
│   │   ├── notification.routes.js                # `/api/notifications`
│   │   ├── product.routes.js                     # `/api/products`
│   │   ├── purchase.routes.js                    # `/api/purchases`
│   │   ├── report.routes.js                      # `/api/reports`
│   │   ├── sale.routes.js                        # `/api/sales`
│   │   ├── supplier.routes.js                    # `/api/suppliers`
│   │   └── user.routes.js                        # `/api/users`
│   ├── uploads/                                  # Uploaded product images served statically at `/uploads/*`
│   ├── utils/                                    # Export & Document Formatting Utilities
│   │   ├── excelExport.js                        # SheetJS `.xlsx` buffer builder with automatic column width calculation
│   │   └── pdfExport.js                          # `pdfkit-table` generators for Sales Invoices, Tabular Reports, and Monthly Executive Report
│   ├── .env.example                              # Template environment variables for backend
│   ├── package.json                              # Backend dependencies and npm scripts (`start`, `dev`, `seed`)
│   ├── seeder.js                                 # Idempotent database seeder for Admin/Staff users and default Categories
│   └── server.js                                 # Express application entry point, CORS, rate limiter, route mounting
│
├── frontend/                                     # React 18 + Vite 5 Single-Page Application
│   ├── src/
│   │   ├── assets/                               # Static frontend assets
│   │   ├── components/                           # Reusable Application Shell & Layout Components
│   │   │   ├── Layout.css                        # Collapsible sidebar (`272px` <-> `78px`), command palette (`Ctrl+K`), notification popover, and motion styles
│   │   │   ├── Layout.jsx                        # Production app shell: 5-domain collapsible sidebar, `Ctrl+K` spotlight palette, live notification popover, and hotkeys
│   │   │   └── PageHeader.jsx                    # Standardized page header component (`title`, `subtitle`, `actions`)
│   │   ├── context/
│   │   │   └── AuthContext.jsx                   # Global React context providing `user`, `loading`, `login`, `logout`, and `/auth/me` hydration
│   │   ├── hooks/
│   │   │   ├── useDebounce.js                    # Generic debounce hook (`300ms-350ms`) preventing API thrashing on search inputs
│   │   │   └── useLenis.js                       # Lenis smooth scroll lifecycle hook with route-change reset and `prefers-reduced-motion` guard
│   │   ├── pages/                                # 15 Application Views & Feature Modules
│   │   │   ├── ActivityLog.jsx                   # Admin forensic audit trail viewer with action & entity filters
│   │   │   ├── Auth.css                          # Split-screen styling for Login, ForgotPassword, and ResetPassword
│   │   │   ├── Categories.jsx                    # Category management table + modal + product count badges
│   │   │   ├── Customers.jsx                     # Customer CRM directory, KPI cards, purchase history drawer, CSV export
│   │   │   ├── Dashboard.jsx                     # Executive KPI dashboard with Recharts visualizations & quick actions
│   │   │   ├── ForgotPassword.jsx                # Self-service password reset request page (+ dev-mode instant reset link)
│   │   │   ├── Inventory.css                     # Dedicated styling for the forensic inventory control center
│   │   │   ├── Inventory.jsx                     # 3-tab Warehouse Control Center (Ledger, Stock Catalog, Low-Stock Alerts) + 4 operation modals + 6-metric Audit Modal
│   │   │   ├── Login.jsx                         # Split-screen login portal with password visibility toggle & demo quick-fill
│   │   │   ├── Notifications.jsx                 # System alert feed with type filtering, mark-read, and delete actions
│   │   │   ├── POS.jsx                           # Cashier Point-of-Sale terminal, cart calculator, quick customer creation, receipt modal
│   │   │   ├── Products.jsx                      # Product catalog manager with image upload, filters, and low-stock badges
│   │   │   ├── Purchases.jsx                     # Purchase Order manager, multi-item PO builder, status workflow (`ordered` -> `received`)
│   │   │   ├── Reports.jsx                       # 6-tab BI reporting suite + Monthly Executive PDF export + Recharts charts
│   │   │   ├── ResetPassword.jsx                 # Token-validated password reset form with strength indicator
│   │   │   ├── Sales.jsx                         # Sales invoice history, detail modal, PDF download, and sale cancellation (`VOID`)
│   │   │   ├── Suppliers.jsx                     # Supplier CRM directory, supplied products virtual view, PO history drawer
│   │   │   └── Users.jsx                         # Admin staff & user management portal with role/status controls
│   │   ├── services/
│   │   │   └── api.js                            # Axios instance with Bearer token request interceptor & 401 response interceptor
│   │   ├── utils/
│   │   │   └── exportCsv.js                      # Client-side UTF-8 BOM CSV generator with OWASP formula-injection escaping
│   │   ├── App.jsx                               # Root router defining public auth routes, `ProtectedRoute` RBAC wrappers, and `AuthenticatedLayout`
│   │   ├── index.css                             # Global design system tokens, Emil Kowalski motion variables (`--ease-out`, `--ease-drawer`), `tabular-nums`, and modal styles
│   │   └── main.jsx                              # React 18 DOM root with `BrowserRouter`, `AuthProvider`, and `ToastContainer`
│   ├── index.html                                # SPA HTML entry point (`Inter` font + `#root`)
│   ├── package.json                              # Frontend dependencies and Vite scripts (`dev`, `build`, `preview`)
│   └── vite.config.js                            # Vite dev server config (port 3000 + `/api` and `/uploads` proxy to port 5000)
│
└── README.md                                     # Complete 18-Section System Architecture & Operations Manual
```

---

## 6. Environment Variables Reference (`.env`)

### 6.1 Backend Environment Variables (`backend/.env`)

Create `backend/.env` by copying `backend/.env.example`. The table below lists every supported backend environment variable:

| Variable Name | Required | Default / Fallback | Example Value | Architectural Purpose & Security Notes |
| :--- | :---: | :--- | :--- | :--- |
| `PORT` | No | `5000` | `5000` | TCP port on which the Express HTTP server listens. |
| `MONGODB_URI` | **Yes** | *(Throws startup error if missing)* | `mongodb://localhost:27017/inventory-sales` or `mongodb+srv://user:pass@cluster.mongodb.net/inventory-sales` | MongoDB connection string. Supports both local MongoDB instances and MongoDB Atlas SRV clusters. |
| `JWT_SECRET` | **Yes** | *(Required for signing/verifying JWTs)* | `super_secret_64_char_random_hex_string_here` | Secret key used to sign and verify `HS256` JSON Web Tokens. Use at least 256 bits of entropy in production. |
| `JWT_EXPIRE` | No | `7d` | `7d` | Token validity duration (e.g., `1d`, `7d`, `12h`) passed to `jwt.sign()`. |
| `NODE_ENV` | No | `development` | `development` or `production` | Controls CORS strictness, seeder safety guards, and whether `/api/auth/forgot-password` returns `resetUrl` in the JSON response. |
| `FRONTEND_URL` | No | `http://localhost:3000` | `http://localhost:3000` | Allowed CORS origin and base URL used when constructing password reset links (`${FRONTEND_URL}/reset-password/${token}`). |
| `DISABLE_PUBLIC_DNS` | No | `false` | `false` or `true` | When connecting via `mongodb+srv://`, `config/db.js` configures public DNS (`8.8.8.8`, `8.8.4.4`, `1.1.1.1`) to prevent Windows SRV lookup failures. Set to `true` to use OS-default DNS only. |
| `SEED_ADMIN_PASSWORD` | No | `admin123` | `admin123` | Overrides the default password assigned to `admin@example.com` when running `npm run seed`. |
| `SEED_STAFF_PASSWORD` | No | `staff123` | `staff123` | Overrides the default password assigned to `staff@example.com` when running `npm run seed`. |

#### Example `backend/.env` File:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/inventory-sales
JWT_SECRET=9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e9d8c7b6a5f4e3d2c1b0a9f8e
JWT_EXPIRE=7d
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
DISABLE_PUBLIC_DNS=false
SEED_ADMIN_PASSWORD=admin123
SEED_STAFF_PASSWORD=staff123
```

### 6.2 Frontend Environment Variables (`frontend/.env`)

| Variable Name | Required | Default / Fallback | Example Value | Architectural Purpose & Notes |
| :--- | :---: | :--- | :--- | :--- |
| `VITE_API_URL` | No | `/api` | `/api` (local dev proxy) or `https://api.yourdomain.com/api` | Base URL used by Axios (`frontend/src/services/api.js`). In local development, leaving it unset or `/api` routes requests through the Vite dev server proxy (`vite.config.js`). |

---

## 7. Step-by-Step Installation & Local Development Setup Guide

### 7.1 Prerequisites
Install the following tools on your workstation before starting:
- **Node.js**: `v18.0.0` or higher (`v20 LTS` recommended); verify with `node -v`
- **npm**: `v9.0.0` or higher; verify with `npm -v`
- **MongoDB**: Either a local **MongoDB Community Server (`v6.0+` / `v7.0+` / `v8.0+`)** running on `mongodb://localhost:27017` or a cloud **MongoDB Atlas** cluster (`mongodb+srv://...`).

### 7.2 Step 1: Clone or Extract the Repository
```bash
git clone https://github.com/SohaibAhmadUsmani/inventory-sales-management.git
cd inventory-sales-management
```

### 7.3 Step 2: Configure, Install & Seed the Backend (`Port 5000`)
Open a terminal in the repository root and run:

```bash
cd backend

# 1. Create your .env file from the template
cp .env.example .env
# (On Windows PowerShell: Copy-Item .env.example .env)

# 2. Edit .env and set your MONGODB_URI and JWT_SECRET

# 3. Install backend dependencies
npm install

# 4. Seed initial Admin & Staff accounts and 5 default Categories
npm run seed

# 5. Start the Express backend in development mode (with Nodemon auto-reload)
npm run dev
```

Expected console output upon startup:
```text
MongoDB Connected: localhost
Server running on port 5000
```

### 7.4 Step 3: Configure & Start the Frontend (`Port 3000`)
Open a **second terminal** in the repository root and run:

```bash
cd frontend

# 1. Install frontend dependencies
npm install

# 2. Launch the Vite development server
npm run dev
```

Expected console output:
```text
  VITE v5.4.2  ready in 420 ms

  ➜  Local:   http://localhost:3000/
  ➜  Network: use --host to expose
```

> [!TIP]
> **Automatic API & Image Proxy in Development**: `frontend/vite.config.js` proxies both `/api` and `/uploads` requests from `http://localhost:3000` to `http://localhost:5000`. You do not need to hardcode `http://localhost:5000` in your frontend code during local development.

---

## 8. Database Seeder & Default Login Credentials

Running `npm run seed` inside `backend/` executes `backend/seeder.js`.

### 8.1 Default Seeded User Accounts

| Account Role | Name | Email Address | Default Password | Env Override Variable | Access Scope |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Administrator** | `Admin` | `admin@example.com` | `admin123` | `SEED_ADMIN_PASSWORD` | Full access to all 15 frontend views and all 12 backend API modules. |
| **Operational Staff** | `Staff` | `staff@example.com` | `staff123` | `SEED_STAFF_PASSWORD` | Access to Dashboard, Products (view), Categories (view), Inventory (full ledger & warehouse stock ops), POS Checkout, Sales History (including invoice & cancel), Customers CRM, and Notifications. |

### 8.2 Default Seeded Product Categories
When the `categories` collection is empty, `seeder.js` provisions 5 baseline categories:
1. **Electronics**
2. **Clothing**
3. **Groceries**
4. **Stationery**
5. **Furniture**

### 8.3 Seeder Safety Flags & Production Protection
- **Production Guard**: If `NODE_ENV=production`, `node seeder.js` refuses to run unless passed the `--force` flag (`node seeder.js --force`), preventing accidental data wipes in production environments.
- **Permission Resilience**: If the MongoDB database user lacks `deleteMany` privileges on a shared Atlas cluster, `seeder.js` catches the permission error, logs a warning, and checks `User.findOne({ email: 'admin@example.com' })` and `Category.countDocuments()` before inserting.

---

## 9. Role-Based Access Control (RBAC) Permission Matrix

InventoryHub enforces RBAC at **two layers**:
1. **Frontend Route & UI Layer**: `ProtectedRoute` in `frontend/src/App.jsx` and `NAV_SECTIONS` / command palette filtering in `frontend/src/components/Layout.jsx`.
2. **Backend Middleware Layer**: `protect` (verifies JWT and checks `req.user.isActive === true`) and `authorize(...roles)` in `backend/middleware/auth.js`.

| Module / Capability | Frontend Route | Backend Endpoint(s) | Admin (`admin`) | Staff (`staff`) | Notes & Business Rules |
| :--- | :--- | :--- | :---: | :---: | :--- |
| **Authentication & Session** | `/login`, `/forgot-password`, `/reset-password/:token` | `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/forgot-password`, `POST /api/auth/reset-password/:token` | ✅ | ✅ | Public login/reset; `/api/auth/me` requires valid Bearer JWT. |
| **Self Profile Update** | *(Topbar / Profile)* | `PUT /api/users/profile` | ✅ | ✅ | Any authenticated user can update their own name, email, phone, or password. |
| **Executive Dashboard** | `/` | `GET /api/dashboard` | ✅ | ✅ | Real-time KPIs, 30-day sales chart, top 5 products, category revenue breakdown. |
| **Product Catalog (Read)** | `/products` | `GET /api/products`, `GET /api/products/:id`, `GET /api/products/low-stock` | ✅ | ✅ | Staff can browse, search, filter, and export catalog CSV; Admin sees Create/Edit/Delete buttons. |
| **Product Catalog (Write)** | `/products` | `POST /api/products`, `PUT /api/products/:id`, `DELETE /api/products/:id` | ✅ | ❌ | Admin only. `PUT` strips `stock` to enforce warehouse ledger integrity; `DELETE` blocks if `stock > 0`. |
| **Categories (Read)** | `/categories` | `GET /api/categories` | ✅ | ✅ | Returns active categories enriched with live `productCount`. |
| **Categories (Write)** | `/categories` | `POST /api/categories`, `PUT /api/categories/:id`, `DELETE /api/categories/:id` | ✅ | ❌ | Admin only. `DELETE` blocks if active products are still assigned to the category. |
| **Inventory Ledger & KPIs** | `/inventory` | `GET /api/inventory`, `/stats`, `/current-stock`, `/low-stock`, `/product/:productId`, `/export-*` | ✅ | ✅ | Full forensic visibility and multi-format exports (CSV, Excel, PDF) for both roles. |
| **Warehouse Stock Operations** | `/inventory` | `POST /api/inventory/stock-in`, `/stock-out`, `/damaged`, `/adjust`, `/create-draft-po` | ✅ | ✅ | Both Admin and Staff can execute physical warehouse receipts, dispatches, write-offs, cycle counts, and draft PO generation. |
| **POS Checkout & Sales** | `/pos`, `/sales` | `POST /api/sales`, `GET /api/sales`, `GET /api/sales/:id`, `GET /api/sales/:id/invoice`, `PUT /api/sales/:id/cancel` | ✅ | ✅ | Both Admin and Staff can ring up sales, download PDF invoices, and cancel/void sales to restore stock. |
| **Customers CRM (Read/Create/Edit)** | `/customers` | `GET /api/customers`, `/stats`, `/:id`, `/:id/purchases`, `POST /api/customers`, `PUT /api/customers/:id` | ✅ | ✅ | Staff can register and update customers during POS or CRM workflows. |
| **Customers CRM (Delete)** | `/customers` | `DELETE /api/customers/:id` | ✅ | ❌ | Only Admin can soft-delete (`isActive: false`) a customer record. |
| **Suppliers CRM** | `/suppliers` | `GET /api/suppliers/*`, `POST /api/suppliers`, `PUT /api/suppliers/:id`, `DELETE /api/suppliers/:id` | ✅ | ❌ *(Read API open for dropdowns)* | Frontend `/suppliers` page and all write endpoints are restricted to Admin. |
| **Purchase Orders (`PO`)** | `/purchases` | `GET /api/purchases/*`, `POST /api/purchases`, `PUT /api/purchases/:id/status` | ✅ | ❌ | Frontend `/purchases` page and PO creation/receipt transitions are restricted to Admin. |
| **Users & Staff Management** | `/users` | `POST /api/auth/register`, `GET /api/users`, `GET /api/users/:id`, `PUT /api/users/:id`, `DELETE /api/users/:id` | ✅ | ❌ | Strictly Admin-only. Includes self-demotion and self-deletion lockouts. |
| **BI Reports & Exports** | `/reports` | `GET /api/reports/*` (19 endpoints) | ✅ | ❌ | Strictly Admin-only. Covers all 6 report domains + Monthly Executive PDF. |
| **System Notifications** | `/notifications` | `GET /api/notifications`, `PUT /read-all`, `PUT /:id/read`, `DELETE /:id` | ✅ | ✅ | Admins see all system-wide notifications; Staff see notifications targeted to them or broadcast (`user: null`). |
| **Forensic Activity Log** | `/activity-log` | `GET /api/activity-log` | ✅ | ❌ | Strictly Admin-only audit trail of all user actions and IP addresses. |

---

## 10. Detailed Guide to All Frontend Pages & Workflows

InventoryHub's frontend (`frontend/src/`) pairs a keyboard-driven **Production App Shell** (`Layout.jsx`, `Layout.css`, `useLenis.js`, `index.css`) with **15 view components** (3 public authentication views and 12 authenticated workspace modules).

### 10.0 Production App Shell, Collapsible Sidebar, Command Palette, Lenis Smooth Scroll & Motion System

The authenticated workspace shell (`frontend/src/components/Layout.jsx`, `frontend/src/components/Layout.css`, `frontend/src/hooks/useLenis.js`, and `frontend/src/index.css`) is built around four core architectural subsystems:

#### 1. Collapsible Sidebar Navigation (`272px` Expanded $\leftrightarrow$ `78px` Compact Icon Rail)
- **Dual-Width Rail Geometry**: Transitions between a full `272px` navigation drawer and a `78px` compact icon rail using `cubic-bezier(0.32, 0.72, 0, 1)` (`--ease-drawer`).
- **5 Semantic Navigation Domains**:
  1. `Overview` (Dashboard)
  2. `Catalog & Stock` (Products, Categories, Inventory Control)
  3. `Sales & CRM` (POS Terminal, Sales History, Customers)
  4. `Procurement` (Suppliers, Purchase Orders)
  5. `Administration & System` (Users & Staff, BI Reports, Notifications, Activity Log)
- **Persistent State & Instant Tooltips**: Sidebar expansion state persists across sessions in `localStorage` (`sidebar_collapsed`). When collapsed to `78px`, hovering any navigation icon renders a floating tooltip with the module name and unread count badge.
- **Keyboard & Header Toggle**: Operators can toggle the sidebar at any time via `Ctrl+B` (`⌘B` on macOS) or the rail collapse button.

#### 2. Global Command Palette (`Ctrl+K` / `⌘K`) & Keyboard Shortcuts
- **Spotlight Modal**: Pressing `Ctrl+K` or `⌘K` (or clicking the topbar search trigger) opens a modal command palette with debounced multi-source search:
  - **All 13 Workspace Modules**: Instant filtering across every role-permitted navigation destination.
  - **Quick Operational Actions**: Direct triggers for common workflows (e.g., launching a new POS checkout, opening the product catalog, inspecting low-stock alerts, or jumping to BI reports).
  - **Direct Product Catalog Search**: Queries `/api/products?search=...` live inside the palette, showing product SKU, stock badge, and retail price for one-stroke navigation.
- **Global Keyboard Shortcuts**:

| Shortcut | Scope | Action |
| :--- | :--- | :--- |
| `Ctrl+K` / `⌘K` | Global | Open or close the Global Command Palette spotlight modal. |
| `Ctrl+B` / `⌘B` | Global | Toggle the sidebar between `272px` expanded mode and `78px` compact icon rail. |
| `Alt+1` | Workspace | Navigate directly to **Dashboard** (`/`). |
| `Alt+2` | Workspace | Navigate directly to **POS Terminal** (`/pos`). |
| `Alt+3` | Workspace | Navigate directly to **Inventory Control** (`/inventory`). |
| `Alt+4` | Workspace | Navigate directly to **Products Catalog** (`/products`). |
| `Alt+5` | Workspace | Navigate directly to **Sales History** (`/sales`). |
| `↑` / `↓` / `Enter` / `Esc` | Command Palette & Popovers | Cycle through spotlight results, execute the active item, or dismiss overlays. |

#### 3. Live Topbar Notification Popover
- **Real-Time Unread Badge**: Polls `/api/notifications` and listens for the custom window event `notifications-updated` so any stock alert, sale cancellation, or notification action updates the topbar counter immediately.
- **Quick-Read Popover Drawer**: Clicking the bell icon opens an anchored popover displaying recent alerts with severity icons, relative timestamps, one-click **Mark as Read**, **Mark All Read**, and a footer link to the full `/notifications` center.

#### 4. Lenis Smooth Scrolling & Emil Kowalski Motion System
- **Lenis Smooth Scroll Hook (`frontend/src/hooks/useLenis.js`)**: Attaches a `Lenis` instance to the `.main-content` scroll container, driving smooth inertial scrolling via `requestAnimationFrame` and automatically resetting scroll position (`scrollTo(0, { immediate: true })`) on route transitions.
- **Emil Kowalski Motion Curves & Tactile Feedback (`frontend/src/index.css`)**:
  - `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)` for snappy UI micro-interactions, hover elevations, popover reveals, and modal entrances.
  - `--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1)` (iOS-grade sheet curve) for sidebar rail transitions and slide-over drawers.
  - Tactile `:active` button compression (`transform: scale(0.97)`) across interactive controls.
- **Financial & Numeric Alignment (`tabular-nums`)**: Enforces `font-variant-numeric: tabular-nums` on KPI metrics, prices, stock quantities, and ledger tables so digits align vertically without horizontal jitter during live updates.
- **Overlay Scroll Isolation (`data-lenis-prevent`)**: Applied to modal bodies, command palette results, and the notification popover list so wheel and touch scrolling stay contained inside the active overlay.
- **Reduced-Motion Accessibility (`prefers-reduced-motion: reduce`)**: Automatically disables the Lenis `requestAnimationFrame` loop in `useLenis.js` and collapses CSS animations/transitions in `index.css` and `Layout.css` for users who prefer reduced motion.

---

### 10.1 `Login.jsx` (`/login`)
- **Purpose**: Split-screen authentication gateway with a left brand summary panel and right credential form.
- **Capabilities**:
  - Email normalization and client-side validation before network dispatch.
  - Show/hide password toggle and direct link to `/forgot-password`.
  - **1-Click Demo Credential Fillers**: Quick-fill buttons for **Admin** (`admin@example.com` / `admin123`) and **Staff** (`staff@example.com` / `staff123`).
  - Redirects back to the originally requested protected route (`location.state.from`) upon login.

### 10.2 `ForgotPassword.jsx` (`/forgot-password`) & `ResetPassword.jsx` (`/reset-password/:token`)
- **Purpose**: Self-service cryptographic password recovery flow.
- **Capabilities**:
  - Submitting an email on `/forgot-password` calls `POST /api/auth/forgot-password`.
  - In development mode (`NODE_ENV !== 'production'`), the UI renders a **Development Reset Link Card** for testing the token flow without an external SMTP server.
  - `/reset-password/:token` validates password length (`>= 6` characters), confirms matching passwords, submits `POST /api/auth/reset-password/:token`, logs the user in with the new JWT, and redirects to `/`.

### 10.3 `Dashboard.jsx` (`/`)
- **Purpose**: Store performance, stock health, and revenue velocity overview.
- **Capabilities**:
  - **7 KPI Summary Cards**: Total Revenue, Today's Sales (with invoice count), Monthly Revenue, Active Products, Low Stock Alerts, Active Customers, and Pending Purchase Orders.
  - **30-Day Sales Revenue Chart**: Interactive Recharts `AreaChart` / `LineChart` plotting daily revenue (`total`) and transaction count (`count`).
  - **Revenue by Category Chart**: Recharts `PieChart` showing category revenue share.
  - **Top 5 Selling Products Table**: Ranked by units sold (`totalQuantity`) and revenue (`totalRevenue`).

### 10.4 `Products.jsx` (`/products`)
- **Purpose**: Master product catalog management and pricing control.
- **Capabilities**:
  - Debounced search (`name` or `SKU`), Category dropdown filter, Supplier filter, Price range (`minPrice`, `maxPrice`), and Low-Stock toggle (`lowStock=true`).
  - **Add / Edit Product Modal (Admin)**: Supports multipart image upload (`image` preview), SKU auto-uppercase, Category & Supplier binding, Cost (`$`), Retail Price (`$`), and Minimum Stock alert threshold.
  - **Audit Lock Indicator**: When editing an existing product, the `stock` field is locked from direct edits so all stock changes flow through `/inventory`.
  - **Client-Side CSV Export**: Exports filtered catalog rows via `exportCsv.js`.

### 10.5 `Categories.jsx` (`/categories`)
- **Purpose**: Taxonomy management for organizing products and category-level reporting.
- **Capabilities**:
  - Displays each active category's name, description, live `productCount` badge, and creation date.
  - Admin modal for creating and editing categories.
  - **Referential Delete Guard**: Attempting to delete a category that still contains active products returns a descriptive error advising the admin to reassign or deactivate those products first.

### 10.6 `Inventory.jsx` (`/inventory`): Warehouse & Forensic Control Center
- **Purpose**: Operational hub for warehouse movements, stock valuation, cycle count reconciliation, and automated procurement.
- **Capabilities**:
  - **4 Real-Time KPI Cards**: Total Stocked Units (across active SKUs), Critical Low/Out-of-Stock Count, Movements Logged Today, and Total Portfolio Asset Valuation (`Cost` vs `Retail` value + Stock Accuracy Rate `%`).
  - **3 Operational Views (Tabs)**:
    1. **Forensic Movement Ledger**: Paginated transaction history with filters for Vector Type (`all`, `inbound`, `outbound`, `stock_in`, `stock_out`, `sale`, `purchase`, `damaged`, `adjustment`, `sale_return`), Category, Supplier, Date Range (`startDate`, `endDate`), and debounced search (`Product Name`, `SKU`, `Reference ID`, `Notes`).
    2. **Current Stock Catalog**: Live stock-on-hand view with status filters (`in_stock`, `low_stock`, `out_of_stock`), unit cost, total cost valuation, retail valuation, and 1-click action buttons.
    3. **Low Stock Replenishment Alerts**: Prioritized deficit table showing current stock, `minimumStock`, exact unit deficit, primary supplier, and a **1-Click "Generate Draft POs"** button (`POST /api/inventory/create-draft-po`).
  - **4 Warehouse Action Modals**:
    - **Receive Stock (`Stock In`)**: Captures quantity, unit cost (triggers live Moving Average Cost recalculation), supplier, reference code, and notes.
    - **Dispatch Stock (`Stock Out`)**: Captures outbound quantity (validated against available stock), reference code, and notes.
    - **Damage / Spoilage Write-Off (`Damaged`)**: Captures write-off quantity, standardized reason (`Damaged in warehouse`, `Expired / Spoiled`, `Transit breakage`, `Defective return`), and notes.
    - **Cycle Count Reconciliation (`Adjust Stock`)**: Captures physical counted quantity, sends `expectedStock` for Optimistic Concurrency Control, computes live delta (`+` / `-`), and records the reconciliation reason.
  - **6-Metric Forensic Stock Audit Modal**: Clicking any product opens its mathematical audit breakdown (`Opening Stock + Inbound - Sold - Damaged + Adjustments = Expected Stock` vs `Actual Stock`) and chronological movement timeline.
  - **3 Server-Side Ledger Exports**: Download buttons for **CSV** (`/api/inventory/export-csv`), **Excel `.xlsx`** (`/api/inventory/export-excel`), and **Audit PDF** (`/api/inventory/export-pdf`).

### 10.7 `POS.jsx` (`/pos`): Point of Sale Terminal
- **Purpose**: Cashier checkout screen.
- **Capabilities**:
  - **Product Grid & Barcode/SKU Scanner Support**: Search by product name or SKU; pressing `Enter` on an exact SKU match or single search result adds the item to the cart. Out-of-stock items (`stock === 0`) are badged and disabled.
  - **Interactive Cart & Guardrails**: Increment/decrement quantities with automatic cap at `product.stock`, per-line subtotals, and 1-click cart clear.
  - **Flexible Discount & Tax Calculator**: Toggle discount between **Flat Dollar (`$`)** and **Percentage (`%`)** (clamped so discount never exceeds subtotal), plus tax input and live grand total calculation.
  - **Walk-In or Registered Customer Binding**: Searchable customer selector plus an inline **"+ New Customer" Modal** (`POST /api/customers`) that immediately selects the newly created customer.
  - **Post-Checkout Receipt Modal**: Displays the generated `INV-*` invoice summary with **Print Receipt** (`window.print()`) and **Download Official PDF Invoice** (`/api/sales/:id/invoice`).

### 10.8 `Sales.jsx` (`/sales`)
- **Purpose**: Historical sales ledger, invoice inspection, and sale cancellation/void processing.
- **Capabilities**:
  - **4 Summary KPI Cards**: Total Filtered Invoices, Gross Revenue, Average Order Value, and Completed vs Cancelled counts.
  - **Multi-Dimension Filters**: Search by `invoiceNumber`, filter by Customer, Payment Method (`cash`, `card`, `online`), Status (`completed`, `cancelled`, `returned`), and Date Range (`startDate`, `endDate`).
  - **Invoice Detail Modal**: Displays line-by-line items, SKU, quantity, unit price, subtotal, discount, tax, total, cashier (`createdBy`), and customer details.
  - **Sale Cancellation (`Void Sale`)**: Clicking **Cancel Sale** on any `completed` invoice calls `PUT /api/sales/:id/cancel`, restoring item quantities to inventory and reversing customer spend metrics.
  - **Exports**: Per-invoice PDF download (`/api/sales/:id/invoice`) and bulk CSV export of filtered sales.

### 10.9 `Customers.jsx` (`/customers`)
- **Purpose**: Customer directory and lifetime value (LTV) analytics.
- **Capabilities**:
  - **4 CRM KPI Cards** (`/api/customers/stats`): Total Customers, Active Buyers (`totalOrders > 0`), New This Month, and Total Lifetime Revenue (`totalLifetimeValue`).
  - Debounced search across `name`, `phone`, and `email`, plus client-side CSV export.
  - **Customer Purchase History Modal**: Lists all completed invoices (`GET /api/customers/:id/purchases`) for the selected customer.

### 10.10 `Suppliers.jsx` (`/suppliers`): Admin Only
- **Purpose**: Vendor directory, supplied catalog tracking, and procurement spend analysis.
- **Capabilities**:
  - **4 Supplier KPI Cards** (`/api/suppliers/stats`): Total Suppliers, Active Suppliers, Total Procurement Spend, and Pending POs.
  - **Supplier Detail & PO History Modal**: Shows the supplier's virtually populated `productsSupplied` list (`name`, `sku`) alongside historical Purchase Orders (`GET /api/suppliers/:id/purchases`) and payment status breakdown (`paid`, `pending`, `partial`).
  - **Delete Protection**: Blocks deletion if the supplier is linked to existing Purchase Orders.

### 10.11 `Purchases.jsx` (`/purchases`): Admin Only
- **Purpose**: Purchase Order (`PO`) lifecycle management and inbound stock receiving.
- **Capabilities**:
  - Filter POs by Supplier, Order Status (`ordered`, `received`, `cancelled`), Payment Status (`pending`, `partial`, `paid`), and Purchase Date range.
  - **Multi-Item PO Builder Modal**: Select supplier, purchase date, initial status (`ordered` or immediate `received`), payment status, and add multiple product lines with custom inbound unit `cost` and `quantity`.
  - **1-Click "Mark as Received" Workflow**: Transitioning an `ordered` PO to `received` (`PUT /api/purchases/:id/status`) increments product stock, recalculates each item's Moving Average Cost (`AVCO`), writes `purchase` records to the Inventory Ledger, and updates supplier spend.

### 10.12 `Users.jsx` (`/users`): Admin Only
- **Purpose**: Staff and administrator account provisioning and access control.
- **Capabilities**:
  - **4 Staff KPI Cards**: Total Users, Active Users, Admins, and Staff Members.
  - Search by name, email, or phone, and filter by Role (`admin`, `staff`).
  - **Add User Modal**: Calls `POST /api/auth/register` to create new Admin or Staff accounts.
  - **Edit User Modal & Quick Status Toggle**: Update name, email, phone, role, active status, or reset password. Includes UI and API lockouts preventing an Admin from demoting, deactivating, or deleting their own account (`You` badge).

### 10.13 `Reports.jsx` (`/reports`): Admin Only
- **Purpose**: Multi-dimensional Business Intelligence (BI) reporting and document generation.
- **Capabilities**:
  - **6 Interactive Report Tabs**:
    1. **Sales Report**: Grouped by `day`, `week`, or `month` with revenue trend chart and summary totals.
    2. **Product Sales Report**: Ranked product performance by units sold and revenue, filterable by Product and Category.
    3. **Inventory Valuation Report**: Stock-on-hand, unit cost, retail price, total cost asset value, and total retail value by Category.
    4. **Profit & Margin Report**: Daily Revenue vs COGS Cost vs Net Profit (`Revenue - Cost`) with bar/line comparison.
    5. **Customer Report**: Top 10 customers by lifetime spending, or single-customer invoice breakdown when filtered by a specific customer.
    6. **Supplier Report**: Total procurement spend and PO count ranked by supplier.
  - **Per-Tab Export Buttons**: Download the active report as **Excel (`.xlsx`)** or **PDF (`.pdf`)**.
  - **Executive Monthly Business Report PDF**: Month/Year selector that generates a multi-table executive brief (`GET /api/reports/monthly/export/pdf`).

### 10.14 `Notifications.jsx` (`/notifications`) & `ActivityLog.jsx` (`/activity-log`)
- **`Notifications.jsx`**: Displays system alerts (`low_stock`, `sale_completed`, `sale_cancelled`, `purchase_ordered`, `purchase_received`, `stock_adjustment`) with **Mark as Read**, **Mark All as Read**, and **Delete** actions. Dispatches a custom `notifications-updated` window event so the topbar bell badge and popover stay synchronized.
- **`ActivityLog.jsx` (Admin Only)**: Paginated audit table showing User, Role badge, Action verb (`Logged in`, `Created`, `Updated`, `Deleted`, `Cancelled`, `Stock In`, `Stock Out`, `Damaged Stock`, `Stock Adjustment`), Entity type, Detailed description, and Timestamp.

---

## 11. Complete REST API Reference (All 12 Modules & Endpoints)

All API routes are mounted under `/api` in `backend/server.js`. Protected endpoints require the HTTP header:
```http
Authorization: Bearer <jwt_token>
```

### 11.1 Authentication Module (`/api/auth`) (`backend/routes/auth.routes.js`)

| Method | Endpoint | Auth / Role | Request Body / Params | Response Summary |
| :---: | :--- | :---: | :--- | :--- |
| `POST` | `/api/auth/register` | `protect`, `authorize('admin')` | `{ name, email, password, role?, phone? }` | `201 Created`: `{ success, token, user }` + logs `Registered` in `ActivityLog`. |
| `POST` | `/api/auth/login` | Public *(Rate Limited: 30/15m)* | `{ email, password }` | `200 OK`: `{ success, token, user }` + logs `Logged in` in `ActivityLog`. |
| `GET` | `/api/auth/me` | `protect` (Admin, Staff) | *(None)* | `200 OK`: `{ success, user }` (current authenticated user profile). |
| `POST` | `/api/auth/forgot-password` | Public *(Rate Limited: 30/15m)* | `{ email }` | `200 OK`: `{ success, message, resetUrl? (dev only) }`. Stores SHA-256 token hash with 15m expiry. |
| `POST` | `/api/auth/reset-password/:token` | Public | Param: `:token`, Body: `{ password }` | `200 OK`: `{ success, message, token, user }`. Updates password and clears reset token fields. |

#### Example: `POST /api/auth/login`
```json
// Request Body
{
  "email": "admin@example.com",
  "password": "admin123"
}

// Response (200 OK)
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "_id": "66f1a2b3c4d5e6f7a8b9c0d1",
    "id": "66f1a2b3c4d5e6f7a8b9c0d1",
    "name": "Admin",
    "email": "admin@example.com",
    "role": "admin",
    "phone": "",
    "avatar": "",
    "isActive": true,
    "createdAt": "2026-09-01T10:00:00.000Z"
  }
}
```

---

### 11.2 Users & Staff Module (`/api/users`) (`backend/routes/user.routes.js`)

| Method | Endpoint | Auth / Role | Query / Request Body | Response Summary |
| :---: | :--- | :---: | :--- | :--- |
| `PUT` | `/api/users/profile` | `protect` (Admin, Staff) | `{ name?, email?, phone?, password? }` | `200 OK`: Updates the authenticated user's own profile & password. |
| `GET` | `/api/users` | `protect`, `authorize('admin')` | Query: `?search=&role=&status=&page=1&limit=100` | `200 OK`: `{ success, count, total, page, totalPages, users }`. |
| `GET` | `/api/users/:id` | `protect`, `authorize('admin')` | Param: `:id` | `200 OK`: `{ success, user }`. |
| `PUT` | `/api/users/:id` | `protect`, `authorize('admin')` | `{ name?, email?, phone?, role?, isActive?, password? }` | `200 OK`: Updates user. Blocks self-deactivation and self-demotion. |
| `DELETE` | `/api/users/:id` | `protect`, `authorize('admin')` | Param: `:id` | `200 OK`: Hard-deletes user if no history exists, or soft-deactivates (`isActive: false`) if linked to Sales, Inventory, or Purchases. Blocks self-delete. |

---

### 11.3 Products Module (`/api/products`) (`backend/routes/product.routes.js`)

| Method | Endpoint | Auth / Role | Query / Request Body | Response Summary |
| :---: | :--- | :---: | :--- | :--- |
| `GET` | `/api/products` | `protect` (Admin, Staff) | Query: `?search=&category=&supplier=&minPrice=&maxPrice=&lowStock=&page=1&limit=20` | `200 OK`: `{ success, count, total, totalPages, page, products }` (with populated `category` and `supplier`). |
| `GET` | `/api/products/low-stock` | `protect` (Admin, Staff) | *(None)* | `200 OK`: `{ success, count, products }` where `stock <= minimumStock`. |
| `GET` | `/api/products/:id` | `protect` (Admin, Staff) | Param: `:id` | `200 OK`: `{ success, product }`. |
| `POST` | `/api/products` | `protect`, `authorize('admin')` | `multipart/form-data`: `name`, `sku`, `category`, `price`, `cost`, `stock`, `minimumStock`, `supplier?`, `description?`, `image?` | `201 Created`: Creates product, writes `opening_stock` (`OPN-<SKU>`) to `Inventory`, and triggers `low_stock` notification if `stock <= minimumStock`. |
| `PUT` | `/api/products/:id` | `protect`, `authorize('admin')` | `multipart/form-data`: product fields (`stock` is stripped/locked) | `200 OK`: Updates product metadata/pricing without altering `stock`. |
| `DELETE` | `/api/products/:id` | `protect`, `authorize('admin')` | Param: `:id` | `200 OK`: Soft-deactivates product (`isActive: false`). Returns `400` if `stock > 0`. |

---

### 11.4 Categories Module (`/api/categories`) (`backend/routes/category.routes.js`)

| Method | Endpoint | Auth / Role | Request Body / Params | Response Summary |
| :---: | :--- | :---: | :--- | :--- |
| `GET` | `/api/categories` | `protect` (Admin, Staff) | *(None)* | `200 OK`: `{ success, count, categories }` including live `productCount` per category. |
| `POST` | `/api/categories` | `protect`, `authorize('admin')` | `{ name, description? }` | `201 Created`: `{ success, category }`. Reactivates if a soft-deleted category with the same name exists. |
| `PUT` | `/api/categories/:id` | `protect`, `authorize('admin')` | `{ name?, description?, isActive? }` | `200 OK`: `{ success, category }`. |
| `DELETE` | `/api/categories/:id` | `protect`, `authorize('admin')` | Param: `:id` | `200 OK`: Soft-deletes category (`isActive: false`). Returns `400` if active products reference it. |

---

### 11.5 Inventory & Warehouse Module (`/api/inventory`) (`backend/routes/inventory.routes.js`)

| Method | Endpoint | Auth / Role | Query / Request Body | Response Summary |
| :---: | :--- | :---: | :--- | :--- |
| `GET` | `/api/inventory/stats` | `protect` (Admin, Staff) | *(None)* | `200 OK`: `{ success, stats: { totalStockedItems, totalProductCount, criticalLowStock, outOfStockCount, movementsToday, unitsMovedToday, totalPortfolioValue, totalRetailValue, accuracyRate } }`. |
| `GET` | `/api/inventory` | `protect` (Admin, Staff) | Query: `?page=1&limit=10&type=&product=&category=&supplier=&search=&startDate=&endDate=` | `200 OK`: Paginated forensic movement ledger with computed `differential`, `trxCode`, and populated `product`, `supplier`, `performedBy`. |
| `GET` | `/api/inventory/current-stock` | `protect` (Admin, Staff) | Query: `?category=&search=&status=&page=1&limit=50` | `200 OK`: Catalog stock view enriched with `stockStatus`, `stockValue`, and `retailValue`. |
| `GET` | `/api/inventory/low-stock` | `protect` (Admin, Staff) | *(None)* | `200 OK`: `{ success, count, alerts }` with `deficit` and `isOutOfStock`. |
| `GET` | `/api/inventory/product/:productId` | `protect` (Admin, Staff) | Param: `:productId` | `200 OK`: `{ success, product, audit: { openingStock, totalInbound, totalSold, totalDamaged, totalAdjustments, expectedStock, auditDiscrepancy, isAudited, valuationCost, valuationRetail }, history }`. |
| `GET` | `/api/inventory/export-csv` | `protect` (Admin, Staff) | Same filter queries as `GET /api/inventory` | `200 OK` (`text/csv`): Streams sanitized CSV movement ledger (up to 2,000 rows). |
| `GET` | `/api/inventory/export-excel` | `protect` (Admin, Staff) | Same filter queries as `GET /api/inventory` | `200 OK` (`.xlsx`): Streams formatted Excel movement ledger workbook. |
| `GET` | `/api/inventory/export-pdf` | `protect` (Admin, Staff) | Same filter queries as `GET /api/inventory` | `200 OK` (`application/pdf`): Streams forensic movement audit PDF report. |
| `POST` | `/api/inventory/stock-in` | `protect`, `authorize('admin', 'staff')` | `{ productId, quantity, unitCost?, supplierId?, reference?, notes?, idempotencyKey? }` | `201 Created`: Increments stock, recalculates Moving Average Cost (`AVCO`), logs `stock_in` ledger entry & `ActivityLog`. |
| `POST` | `/api/inventory/stock-out` | `protect`, `authorize('admin', 'staff')` | `{ productId, quantity, reference?, notes?, idempotencyKey? }` | `201 Created`: Atomically deducts stock (`stock >= qty`), logs `stock_out` ledger entry, triggers low-stock alert if needed. |
| `POST` | `/api/inventory/damaged` | `protect`, `authorize('admin', 'staff')` | `{ productId, quantity, reason?, notes?, idempotencyKey? }` | `201 Created`: Atomically deducts damaged/expired units (`DMG-*`), logs `damaged` ledger entry. |
| `POST` | `/api/inventory/adjust` | `protect`, `authorize('admin', 'staff')` | `{ productId, newQuantity, expectedStock?, reason?, notes?, idempotencyKey? }` | `201 Created`: Reconciles stock to `newQuantity` (`ADJ-*`). Returns `409 Conflict` if `expectedStock` mismatches current stock. |
| `POST` | `/api/inventory/batch-check-alerts` | `protect` (Admin, Staff) | *(None)* | `200 OK`: Scans all active products and creates a consolidated `low_stock` notification. |
| `POST` | `/api/inventory/create-draft-po` | `protect`, `authorize('admin', 'staff')` | *(None)* | `201 Created`: Groups all low-stock products by supplier and generates `ordered` Purchase Orders (`PO-*`). |

#### Example: `POST /api/inventory/stock-in`
```json
// Request Body
{
  "productId": "66f1a2b3c4d5e6f7a8b9c0d5",
  "quantity": 25,
  "unitCost": 42.50,
  "supplierId": "66f1a2b3c4d5e6f7a8b9c0e1",
  "reference": "TRX-IN-9042",
  "notes": "Quarterly restock shipment"
}

// Response (201 Created)
{
  "success": true,
  "message": "Successfully received 25 units of Wireless Barcode Scanner.",
  "record": {
    "_id": "66f1b999c4d5e6f7a8b9c111",
    "product": "66f1a2b3c4d5e6f7a8b9c0d5",
    "supplier": "66f1a2b3c4d5e6f7a8b9c0e1",
    "type": "stock_in",
    "quantity": 25,
    "unitCost": 42.5,
    "previousStock": 10,
    "currentStock": 35,
    "reference": "TRX-IN-9042",
    "notes": "Quarterly restock shipment",
    "performedBy": "66f1a2b3c4d5e6f7a8b9c0d1",
    "createdAt": "2026-09-25T02:30:00.000Z"
  }
}
```

---

### 11.6 Sales & POS Module (`/api/sales`) (`backend/routes/sale.routes.js`)

| Method | Endpoint | Auth / Role | Query / Request Body | Response Summary |
| :---: | :--- | :---: | :--- | :--- |
| `GET` | `/api/sales` | `protect` (Admin, Staff) | Query: `?search=&customer=&paymentMethod=&status=&startDate=&endDate=&page=1&limit=20` | `200 OK`: `{ success, count, total, totalPages, page, sales }`. |
| `GET` | `/api/sales/daily` | `protect` (Admin, Staff) | Query: `?startDate=&endDate=` | `200 OK`: Daily aggregated revenue & transaction count for completed sales. |
| `GET` | `/api/sales/:id` | `protect` (Admin, Staff) | Param: `:id` | `200 OK`: `{ success, sale }` with populated `customer` and `createdBy`. |
| `GET` | `/api/sales/:id/invoice` | `protect` (Admin, Staff) | Param: `:id` | `200 OK` (`application/pdf`): Streams downloadable PDF invoice (`INV-*.pdf`). |
| `POST` | `/api/sales` | `protect` (Admin, Staff) | `{ customerId?, items: [{ productId, quantity }], discount?, tax?, paymentMethod, paymentStatus?, notes? }` | `201 Created`: Validates & atomically deducts stock, snapshots item `cost`, creates `Sale`, logs `sale` in `Inventory`, updates `Customer` stats. |
| `PUT` | `/api/sales/:id/cancel` | `protect`, `authorize('admin', 'staff')` | Param: `:id` | `200 OK`: Marks sale `cancelled`, restores stock to `Product`, writes `sale_return` (`VOID-INV-*`) to `Inventory`, and decrements customer spend/orders. |

#### Example: `POST /api/sales`
```json
// Request Body
{
  "customerId": "66f1a2b3c4d5e6f7a8b9c0f2",
  "items": [
    { "productId": "66f1a2b3c4d5e6f7a8b9c0d5", "quantity": 2 }
  ],
  "discount": 5.00,
  "tax": 8.50,
  "paymentMethod": "card",
  "paymentStatus": "paid",
  "notes": "Express checkout"
}
```

---

### 11.7 Customers CRM Module (`/api/customers`) (`backend/routes/customer.routes.js`)

| Method | Endpoint | Auth / Role | Query / Request Body | Response Summary |
| :---: | :--- | :---: | :--- | :--- |
| `GET` | `/api/customers/stats` | `protect` (Admin, Staff) | *(None)* | `200 OK`: `{ success, stats: { total, active, newThisMonth, totalLifetimeValue } }`. |
| `GET` | `/api/customers` | `protect` (Admin, Staff) | Query: `?search=&page=1&limit=20` | `200 OK`: `{ success, count, total, totalPages, page, customers }`. |
| `GET` | `/api/customers/:id` | `protect` (Admin, Staff) | Param: `:id` | `200 OK`: `{ success, customer }`. |
| `GET` | `/api/customers/:id/purchases` | `protect` (Admin, Staff) | Param: `:id` | `200 OK`: `{ success, count, sales }` (all completed sales for this customer). |
| `POST` | `/api/customers` | `protect` (Admin, Staff) | `{ name, phone?, email?, address? }` | `201 Created`: `{ success, customer }`. |
| `PUT` | `/api/customers/:id` | `protect` (Admin, Staff) | `{ name?, phone?, email?, address? }` | `200 OK`: `{ success, customer }`. |
| `DELETE` | `/api/customers/:id` | `protect`, `authorize('admin')` | Param: `:id` | `200 OK`: Soft-deletes customer (`isActive: false`). |

---

### 11.8 Suppliers Module (`/api/suppliers`) (`backend/routes/supplier.routes.js`)

| Method | Endpoint | Auth / Role | Query / Request Body | Response Summary |
| :---: | :--- | :---: | :--- | :--- |
| `GET` | `/api/suppliers/stats` | `protect` (Admin, Staff) | *(None)* | `200 OK`: `{ success, stats: { total, active, totalSpend, pendingPOs } }`. |
| `GET` | `/api/suppliers` | `protect` (Admin, Staff) | Query: `?search=&page=1&limit=20` | `200 OK`: `{ success, count, total, totalPages, page, suppliers }`. |
| `GET` | `/api/suppliers/:id` | `protect` (Admin, Staff) | Param: `:id` | `200 OK`: `{ success, supplier }` with virtual `productsSupplied` (`name`, `sku`). |
| `GET` | `/api/suppliers/:id/purchases` | `protect` (Admin, Staff) | Param: `:id` | `200 OK`: `{ success, count, purchases, summary: { totalCost, paid, pending, partial } }`. |
| `POST` | `/api/suppliers` | `protect`, `authorize('admin')` | `{ name, company?, phone?, email?, address? }` | `201 Created`: `{ success, supplier }`. |
| `PUT` | `/api/suppliers/:id` | `protect`, `authorize('admin')` | `{ name?, company?, phone?, email?, address? }` | `200 OK`: `{ success, supplier }`. |
| `DELETE` | `/api/suppliers/:id` | `protect`, `authorize('admin')` | Param: `:id` | `200 OK`: Soft-deletes supplier (`isActive: false`). Returns `400` if purchase history exists. |

---

### 11.9 Purchases (`PO`) Module (`/api/purchases`) (`backend/routes/purchase.routes.js`)

| Method | Endpoint | Auth / Role | Query / Request Body | Response Summary |
| :---: | :--- | :---: | :--- | :--- |
| `GET` | `/api/purchases` | `protect` (Admin, Staff) | Query: `?supplier=&status=&paymentStatus=&startDate=&endDate=&page=1&limit=20` | `200 OK`: `{ success, count, total, totalPages, page, purchases }`. |
| `GET` | `/api/purchases/:id` | `protect` (Admin, Staff) | Param: `:id` | `200 OK`: `{ success, purchase }` with populated `supplier` and `createdBy`. |
| `POST` | `/api/purchases` | `protect`, `authorize('admin')` | `{ supplierId, items: [{ productId, quantity, cost }], purchaseDate?, paymentStatus?, status?, notes? }` | `201 Created`: Generates `PO-*`. If `status === 'received'`, immediately applies stock increase, recalculates AVCO cost, and updates supplier spend. |
| `PUT` | `/api/purchases/:id/status` | `protect`, `authorize('admin')` | `{ status?, paymentStatus?, notes? }` | `200 OK`: Transitions PO status. When transitioning `ordered -> received`, applies stock & AVCO cost once (`inventoryApplied = true`). Blocks reverting `received` or `cancelled` POs. |

---

### 11.10 Dashboard Module (`/api/dashboard`) (`backend/routes/dashboard.routes.js`)

| Method | Endpoint | Auth / Role | Query Params | Response Summary |
| :---: | :--- | :---: | :--- | :--- |
| `GET` | `/api/dashboard` | `protect` (Admin, Staff) | *(None)* | `200 OK`: `{ success, dashboard: { totalSales, todaySales, todaySalesCount, totalProducts, lowStockProducts, totalCustomers, pendingOrders, monthlyRevenue, dailySales, topProducts, revenueByCategory } }`. |

---

### 11.11 Business Intelligence Reports Module (`/api/reports`) (`backend/routes/report.routes.js`)

All `/api/reports/*` endpoints are protected by `protect` and `authorize('admin')`.

| Method | Endpoint | Supported Query Filters | Output Format & Summary |
| :---: | :--- | :--- | :--- |
| `GET` | `/api/reports/sales` | `?startDate=&endDate=&groupBy=day\|week\|month&customer=&paymentMethod=&status=` | `JSON`: `{ success, sales, summary: { totalRevenue, totalSales, avgSale } }` |
| `GET` | `/api/reports/sales/export/excel` | Same as `/api/reports/sales` | `.xlsx` binary stream (`Sales_Report.xlsx`) |
| `GET` | `/api/reports/sales/export/pdf` | Same as `/api/reports/sales` | `.pdf` binary stream (`Sales_Report.pdf`) |
| `GET` | `/api/reports/products` | `?startDate=&endDate=&product=&category=` | `JSON`: `{ success, productSales }` ranked by revenue |
| `GET` | `/api/reports/products/export/excel` | Same as `/api/reports/products` | `.xlsx` binary stream (`Product_Sales_Report.xlsx`) |
| `GET` | `/api/reports/products/export/pdf` | Same as `/api/reports/products` | `.pdf` binary stream (`Product_Sales_Report.pdf`) |
| `GET` | `/api/reports/inventory` | `?category=` | `JSON`: `{ success, products, summary: { totalProducts, totalStockValue, totalRetailValue, lowStockCount, outOfStockCount } }` |
| `GET` | `/api/reports/inventory/export/excel` | `?category=` | `.xlsx` binary stream (`Inventory_Report.xlsx`) |
| `GET` | `/api/reports/inventory/export/pdf` | `?category=` | `.pdf` binary stream (`Inventory_Report.pdf`) |
| `GET` | `/api/reports/profit` | `?startDate=&endDate=&product=&category=` | `JSON`: `{ success, profitData, summary: { totalRevenue, totalCost, totalProfit } }` (uses historical `items.cost` with fallback) |
| `GET` | `/api/reports/profit/export/excel` | Same as `/api/reports/profit` | `.xlsx` binary stream (`Profit_Report.xlsx`) |
| `GET` | `/api/reports/profit/export/pdf` | Same as `/api/reports/profit` | `.pdf` binary stream (`Profit_Report.pdf`) |
| `GET` | `/api/reports/customers` | `?customer=` | `JSON`: Top 10 customers by spend, or single customer invoice history if `?customer=` is set |
| `GET` | `/api/reports/customers/export/excel` | `?customer=` | `.xlsx` binary stream (`Customer_Report.xlsx`) |
| `GET` | `/api/reports/customers/export/pdf` | `?customer=` | `.pdf` binary stream (`Customer_Report.pdf`) |
| `GET` | `/api/reports/suppliers` | `?startDate=&endDate=&supplier=` | `JSON`: `{ success, supplierPurchases }` ranked by total PO spend |
| `GET` | `/api/reports/suppliers/export/excel` | Same as `/api/reports/suppliers` | `.xlsx` binary stream (`Supplier_Purchases_Report.xlsx`) |
| `GET` | `/api/reports/suppliers/export/pdf` | Same as `/api/reports/suppliers` | `.pdf` binary stream (`Supplier_Purchases_Report.pdf`) |
| `GET` | `/api/reports/monthly/export/pdf` | `?month=1..12&year=YYYY` | `.pdf` binary stream: Executive Monthly Business Report (`Monthly_Business_Report_<Month_Year>.pdf`) |

---

### 11.12 Notifications & Activity Log Modules (`/api/notifications` & `/api/activity-log`)

| Method | Endpoint | Auth / Role | Query / Params | Response Summary |
| :---: | :--- | :---: | :--- | :--- |
| `GET` | `/api/notifications` | `protect` (Admin, Staff) | *(None)* | `200 OK`: `{ success, count, unreadCount, notifications }` (latest 50 alerts). |
| `PUT` | `/api/notifications/read-all` | `protect` (Admin, Staff) | *(None)* | `200 OK`: Marks all unread notifications in the user's scope as `isRead: true`. |
| `PUT` | `/api/notifications/:id/read` | `protect` (Admin, Staff) | Param: `:id` | `200 OK`: Marks single notification as `isRead: true`. |
| `DELETE` | `/api/notifications/:id` | `protect` (Admin, Staff) | Param: `:id` | `200 OK`: Deletes notification document. |
| `GET` | `/api/activity-log` | `protect`, `authorize('admin')` | Query: `?user=&action=&entity=&page=1&limit=20` | `200 OK`: `{ success, count, total, totalPages, page, logs }` with populated `user` (`name`, `role`). |

---

## 12. Database Schema & Entity-Relationship Reference (All 10 Mongoose Models)

### 12.1 Complete Entity-Relationship Diagram (`erDiagram`)

```mermaid
erDiagram
    USER ||--o{ SALE : "creates (createdBy)"
    USER ||--o{ PURCHASE : "creates (createdBy)"
    USER ||--o{ INVENTORY : "performs (performedBy)"
    USER ||--o{ ACTIVITY_LOG : "triggers (user)"
    USER ||--o{ NOTIFICATION : "receives (user)"

    CATEGORY ||--o{ PRODUCT : "classifies (category)"
    SUPPLIER ||--o{ PRODUCT : "supplies (supplier)"
    SUPPLIER ||--o{ PURCHASE : "fulfills (supplier)"
    SUPPLIER ||--o{ INVENTORY : "delivers (supplier)"

    CUSTOMER ||--o{ SALE : "places (customer)"

    PRODUCT ||--o{ INVENTORY : "tracks (product)"
    PRODUCT ||--o{ SALE_ITEM : "sold in (items.product)"
    PRODUCT ||--o{ PURCHASE_ITEM : "ordered in (items.product)"

    SALE ||--|{ SALE_ITEM : "contains (items)"
    PURCHASE ||--|{ PURCHASE_ITEM : "contains (items)"

    USER {
        ObjectId _id PK
        String name
        String email UK
        String password "select: false (bcrypt)"
        String role "admin | staff"
        String phone
        String avatar
        Boolean isActive
        String resetPasswordToken
        Date resetPasswordExpire
    }

    PRODUCT {
        ObjectId _id PK
        String name
        String sku UK
        String description
        ObjectId category FK
        Number price
        Number cost "AVCO Moving Average"
        Number stock
        Number minimumStock
        String image
        ObjectId supplier FK
        Boolean isActive
    }

    CATEGORY {
        ObjectId _id PK
        String name UK
        String description
        Boolean isActive
    }

    INVENTORY {
        ObjectId _id PK
        ObjectId product FK
        ObjectId supplier FK
        String type "12 movement vectors"
        Number quantity
        Number previousStock
        Number currentStock
        Number unitCost
        String reference
        ObjectId referenceId
        String referenceModel
        String reason
        String notes
        Boolean isVoided
        String idempotencyKey UK
        ObjectId performedBy FK
    }

    SALE {
        ObjectId _id PK
        String invoiceNumber UK
        ObjectId customer FK
        Array items "embedded SaleItem[]"
        Number subtotal
        Number discount
        Number tax
        Number total
        String paymentMethod "cash | card | online"
        String paymentStatus "paid | pending | partial"
        String status "completed | returned | cancelled"
        ObjectId createdBy FK
    }

    PURCHASE {
        ObjectId _id PK
        String orderNumber UK
        ObjectId supplier FK
        Array items "embedded PurchaseItem[]"
        Number totalCost
        Date purchaseDate
        String paymentStatus "paid | pending | partial"
        String status "ordered | received | cancelled"
        Boolean inventoryApplied
        ObjectId createdBy FK
    }

    CUSTOMER {
        ObjectId _id PK
        String name
        String phone
        String email
        String address
        Number totalSpending
        Number totalOrders
        Boolean isActive
    }

    SUPPLIER {
        ObjectId _id PK
        String name
        String company
        String phone
        String email
        String address
        Number totalPurchases
        Boolean isActive
    }

    NOTIFICATION {
        ObjectId _id PK
        ObjectId user FK
        String type
        String title
        String message
        Boolean isRead
        ObjectId referenceId
    }

    ACTIVITY_LOG {
        ObjectId _id PK
        ObjectId user FK
        String action
        String entity
        ObjectId entityId
        String details
        String ipAddress
    }
```

### 12.2 Field-by-Field Schema Reference & Database Indexes

#### 1. `User` (`backend/models/User.js`)
| Field | Type | Constraints / Defaults | Description |
| :--- | :--- | :--- | :--- |
| `name` | `String` | `required: true, trim: true` | Full display name of the staff or admin user. |
| `email` | `String` | `required: true, unique: true, lowercase: true` | Unique login email address. |
| `password` | `String` | `required: true, minlength: 6, select: false` | Bcrypt hash (10 rounds via `pre('save')` hook). Excluded from queries by default. |
| `role` | `String` | `enum: ['admin', 'staff'], default: 'staff'` | RBAC role governing route and UI permissions. |
| `phone` | `String` | `default: ''` | Contact phone number. |
| `avatar` | `String` | `default: ''` | Optional avatar URL/path. |
| `isActive` | `Boolean` | `default: true` | Account status; `false` blocks login and active JWTs. |
| `resetPasswordToken` | `String` | Optional | SHA-256 hash of the password reset token. |
| `resetPasswordExpire` | `Date` | Optional | Expiration timestamp (`Date.now() + 15m`) for password reset. |

#### 2. `Product` (`backend/models/Product.js`)
- **Indexes**: `{ name: 'text', sku: 'text' }`, `{ category: 1, isActive: 1 }`, `{ supplier: 1, isActive: 1 }`, `{ stock: 1, minimumStock: 1 }`.
- **Virtuals**: `isLowStock` (`this.stock <= this.minimumStock`).

| Field | Type | Constraints / Defaults | Description |
| :--- | :--- | :--- | :--- |
| `name` | `String` | `required: true, trim: true` | Product title. |
| `sku` | `String` | `required: true, unique: true, uppercase: true, trim: true` | Unique Stock Keeping Unit identifier. |
| `description` | `String` | `default: '', trim: true` | Product specification/notes. |
| `category` | `ObjectId` | `ref: 'Category', required: true` | Foreign key to `Category`. |
| `price` | `Number` | `required: true, min: 0` | Unit retail selling price (`$`). |
| `cost` | `Number` | `required: true, min: 0` | Unit cost price (`$`), maintained via Moving Average Cost (`AVCO`). |
| `stock` | `Number` | `required: true, default: 0, min: 0` | Current physical units on hand. |
| `minimumStock` | `Number` | `required: true, default: 5, min: 0` | Reorder threshold triggering low-stock alerts and draft POs. |
| `image` | `String` | `default: ''` | Relative path to uploaded product image (`uploads/...`). |
| `supplier` | `ObjectId` | `ref: 'Supplier', default: null` | Primary vendor supplying this product. |
| `isActive` | `Boolean` | `default: true` | Soft-delete flag. |

#### 3. `Category` (`backend/models/Category.js`)
| Field | Type | Constraints / Defaults | Description |
| :--- | :--- | :--- | :--- |
| `name` | `String` | `required: true, unique: true, trim: true` | Unique category name. |
| `description` | `String` | `default: ''` | Optional category summary. |
| `isActive` | `Boolean` | `default: true` | Soft-delete flag. |

#### 4. `Inventory` (`backend/models/Inventory.js`)
- **Indexes**: `{ product: 1, createdAt: -1 }`, `{ type: 1, createdAt: -1 }`, `{ product: 1, type: 1, createdAt: -1 }`, `{ supplier: 1, createdAt: -1 }`, `{ createdAt: -1 }`, `{ idempotencyKey: 1 (unique, sparse) }`.

| Field | Type | Constraints / Defaults | Description |
| :--- | :--- | :--- | :--- |
| `product` | `ObjectId` | `ref: 'Product', required: true, index: true` | Target product for this stock movement. |
| `supplier` | `ObjectId` | `ref: 'Supplier', default: null, index: true` | Associated supplier (for `stock_in` and `purchase` movements). |
| `type` | `String` | `enum: ['opening_stock', 'stock_in', 'stock_out', 'damaged', 'expired', 'adjustment', 'sale', 'purchase', 'sale_return', 'purchase_return', 'transfer_in', 'transfer_out']` | Movement classification vector. |
| `quantity` | `Number` | `required: true, min: 0` (`>= 0.001` for non-opening/adjustment) | Absolute unit quantity moved. |
| `previousStock` | `Number` | `required: true` | Product balance prior to the transaction. |
| `currentStock` | `Number` | `required: true` | Product balance following the transaction. |
| `unitCost` | `Number` | `default: 0` | Unit cost recorded at the time of the movement. |
| `reference` | `String` | `default: ''` | Human-readable transaction code (`OPN-*`, `TRX-*`, `DMG-*`, `ADJ-*`, `INV-*`, `VOID-INV-*`, `PO-*`). |
| `referenceId` | `ObjectId` | `default: null` | Foreign key to originating `Sale`, `Purchase`, or `Product`. |
| `referenceModel` | `String` | `enum: ['Sale', 'Purchase', 'Product', null]` | Polymorphic model discriminator. |
| `reason` | `String` | `default: ''` | Structured reason for damage write-offs or cycle count adjustments. |
| `notes` | `String` | `default: ''` | Free-text audit notes. |
| `isVoided` | `Boolean` | `default: false, index: true` | Flag indicating whether the movement was voided. |
| `idempotencyKey` | `String` | `unique: true, sparse: true` | Optional client-generated key preventing duplicate movement creation on network retries. |
| `performedBy` | `ObjectId` | `ref: 'User', required: true` | User who authorized the movement. |

#### 5. `Sale` (`backend/models/Sale.js`)
- **Indexes**: `{ status: 1, createdAt: -1 }`, `{ customer: 1, createdAt: -1 }`, `{ createdAt: -1 }`.

| Field | Type | Constraints / Defaults | Description |
| :--- | :--- | :--- | :--- |
| `invoiceNumber` | `String` | `required: true, unique: true` | Unique generated invoice identifier (`INV-<TIMESTAMP36>-<RAND>`). |
| `customer` | `ObjectId` | `ref: 'Customer', default: null` | Linked customer (`null` for walk-in customers). |
| `items` | `[SaleItem]` | Non-empty array of `{ product, name, sku, price, cost, quantity, total }` | Line items sold; `cost` snapshots historical AVCO unit cost at checkout. |
| `subtotal` | `Number` | `required: true, min: 0` | Sum of `items[].total` before discount and tax. |
| `discount` | `Number` | `default: 0, min: 0` | Discount amount (`$`) deducted from subtotal. |
| `tax` | `Number` | `default: 0, min: 0` | Tax amount (`$`) added to net subtotal. |
| `total` | `Number` | `required: true, min: 0` | Final payable amount (`subtotal - discount + tax`). |
| `paymentMethod` | `String` | `enum: ['cash', 'card', 'online'], required: true` | Tender type used at checkout. |
| `paymentStatus` | `String` | `enum: ['paid', 'pending', 'partial'], default: 'paid'` | Settlement status. |
| `status` | `String` | `enum: ['completed', 'returned', 'cancelled'], default: 'completed'` | Lifecycle state of the sale. |
| `notes` | `String` | `default: ''` | Optional cashier notes. |
| `createdBy` | `ObjectId` | `ref: 'User', required: true` | Cashier/Admin who processed the checkout. |

#### 6. `Purchase` (`backend/models/Purchase.js`)
- **Indexes**: `{ supplier: 1, createdAt: -1 }`, `{ status: 1, purchaseDate: -1 }`.

| Field | Type | Constraints / Defaults | Description |
| :--- | :--- | :--- | :--- |
| `orderNumber` | `String` | `required: true, unique: true` | Unique Purchase Order code (`PO-<TIMESTAMP36>-<RAND>`). |
| `supplier` | `ObjectId` | `ref: 'Supplier', required: true` | Vendor fulfilling the order. |
| `items` | `[PurchaseItem]` | Non-empty array of `{ product, name, quantity, cost, total }` | Ordered products and inbound unit costs. |
| `totalCost` | `Number` | `required: true, min: 0` | Sum of all `items[].total`. |
| `purchaseDate` | `Date` | `required: true` | Order date. |
| `paymentStatus` | `String` | `enum: ['paid', 'pending', 'partial'], default: 'pending'` | Vendor payment settlement state. |
| `status` | `String` | `enum: ['ordered', 'received', 'cancelled'], default: 'ordered'` | Fulfillment state. |
| `inventoryApplied` | `Boolean` | `default: false` | Idempotency guard so stock and AVCO cost are applied once upon receipt. |
| `notes` | `String` | `default: ''` | PO notes (e.g., auto-draft replenishment note). |
| `createdBy` | `ObjectId` | `ref: 'User', required: true` | User who created the PO. |

#### 7. `Customer` (`backend/models/Customer.js`) & 8. `Supplier` (`backend/models/Supplier.js`)
- **`Customer` Fields**: `name` (`required`), `phone`, `email`, `address`, `totalSpending` (`Number, default: 0`), `totalOrders` (`Number, default: 0`), `isActive` (`Boolean, default: true`).
- **`Supplier` Fields**: `name` (`required`), `company`, `phone`, `email`, `address`, `totalPurchases` (`Number, default: 0`), `isActive` (`Boolean, default: true`), plus virtual `productsSupplied` (`ref: 'Product', localField: '_id', foreignField: 'supplier'`).

#### 9. `Notification` (`backend/models/Notification.js`) & 10. `ActivityLog` (`backend/models/ActivityLog.js`)
- **`Notification` Fields**: `user` (`ObjectId, default: null`), `type` (`enum: ['low_stock', 'sale_completed', 'sale_cancelled', 'purchase_received', 'purchase_ordered', 'stock_adjustment', 'info']`), `title`, `message`, `isRead` (`Boolean, default: false`), `referenceId`. Indexed on `{ user: 1, isRead: 1, createdAt: -1 }`.
- **`ActivityLog` Fields**: `user` (`ObjectId, required`), `action` (`String`), `entity` (`String`), `entityId` (`ObjectId`), `details` (`String`), `ipAddress` (`String`). Indexed on `{ createdAt: -1 }` and `{ user: 1, createdAt: -1 }`.

---

## 13. Core Accounting, Inventory & Transactional Business Logic

### 13.1 Moving Weighted Average Cost (AVCO / MAC) Valuation Formula

Whenever new units enter the warehouse with a positive unit cost ($C_{\text{in}} > 0$), either via manual **Stock In** (`POST /api/inventory/stock-in`) or when a **Purchase Order** is marked `received` (`applyPurchaseStockIncrease` in `backend/controllers/purchase.controller.js`), InventoryHub recalculates `Product.cost` using the **Moving Weighted Average Cost** formula:

$$\text{New Unit Cost} = \begin{cases} \text{round}_2(C_{\text{in}}), & \text{if } Q_{\text{prev}} \le 0 \\[8pt] \text{round}_2\!\left(\dfrac{(Q_{\text{prev}} \times C_{\text{prev}}) + (Q_{\text{in}} \times C_{\text{in}})}{Q_{\text{prev}} + Q_{\text{in}}}\right), & \text{if } Q_{\text{prev}} > 0 \end{cases}$$

Where:
- $Q_{\text{prev}}$ = `previousStock` (existing units on hand before receipt)
- $C_{\text{prev}}$ = `product.cost` (existing moving average unit cost)
- $Q_{\text{in}}$ = inbound quantity received
- $C_{\text{in}}$ = inbound unit acquisition cost

> [!IMPORTANT]
> **Why AVCO Matters**: If a store holds `10` units bought at `\$10.00` (`\$100.00` value) and receives `10` new units bought at `\$14.00` (`\$140.00` value), overwriting `cost = \$14.00` would inflate inventory valuation to `\$280.00`. With AVCO, `Product.cost` becomes `\$12.00` (`\$240.00 / 20 units`), keeping asset valuation exact.

---

### 13.2 Immutable Inventory Ledger, Idempotency & Optimistic Concurrency Control (OCC)

1. **Continuous Stock Chain (`previousStock` $\rightarrow$ `currentStock`)**:
   Every `Inventory` document records the state transition. For any product, the forensic audit endpoint (`GET /api/inventory/product/:productId`) verifies:
   $$\text{Expected Stock} = Q_{\text{opening}} + \sum Q_{\text{inbound}} - \sum Q_{\text{sold/out}} - \sum Q_{\text{damaged}} + \sum \Delta_{\text{adjustments}}$$
   $$\text{Audit Discrepancy} = Q_{\text{current}} - \text{Expected Stock}$$
   When `auditDiscrepancy === 0`, the SKU is marked `isAudited: true`.

2. **Idempotency Deduplication (`idempotencyKey`)**:
   `Inventory` defines a sparse unique index on `idempotencyKey`. If a warehouse scanner or browser retries a `POST /api/inventory/stock-in`, `stock-out`, `damaged`, or `adjust` request with the same `idempotencyKey`, the controller returns the existing ledger record (`200 OK` with `idempotentReplay: true`) without double-counting stock.

3. **Optimistic Concurrency Control (`expectedStock`) on Cycle Counts**:
   When a warehouse operator opens the **Adjust Stock** modal, the UI captures the product's current `stock` as `expectedStock`. When `POST /api/inventory/adjust` executes, it runs an atomic conditional update:
   ```javascript
   Product.findOneAndUpdate(
     { _id: productId, stock: Number(expectedStock) },
     { $set: { stock: countedQty } },
     { new: false }
   );
   ```
   If a POS checkout or another staff member changed the product's stock while the modal was open, the query returns `null` and the API responds with `409 Conflict`, preventing silent overwrites of concurrent transactions.

---

### 13.3 Automated Low-Stock Replenishment PO Generation

`POST /api/inventory/create-draft-po` automates procurement for all active products where `stock <= minimumStock`:
1. Queries all low-stock products and populates their assigned `supplier`.
2. Checks for existing open (`status: 'ordered'`) Purchase Orders containing those products to avoid duplicate orders.
3. Calculates the recommended replenishment order quantity for each SKU using a safety buffer formula:
   $$Q_{\text{reorder}} = \max(1, Q_{\text{min}} - Q_{\text{stock}}) + \max\!\left(5, \lceil 0.5 \times Q_{\text{min}} \rceil\right)$$
4. Groups items by `supplier._id` (falling back to the primary active supplier if a product has no explicit supplier linked) and creates one `ordered` `Purchase` (`PO-*`) per supplier.

---

### 13.4 POS Checkout, Historical COGS Snapshot & Sale Cancellation Reversal

- **Atomic Checkout & Rollback Safety (`POST /api/sales`)**:
  - For each cart item, the controller runs an atomic conditional decrement:
    ```javascript
    Product.findOneAndUpdate(
      { _id: item.product, stock: { $gte: item.quantity } },
      { $inc: { stock: -item.quantity } },
      { new: true }
    );
    ```
  - If any line item fails the `$gte` check due to a concurrent checkout, the controller rolls back (`$inc: { stock: +deducted.quantity }`) all previously deducted items in the loop and returns `400 Bad Request`.
  - Each `SaleItem` stores `cost: product.cost || 0`. The Profit Report (`GET /api/reports/profit`) uses `$ifNull: ['$items.cost', { $ifNull: ['$productInfo.cost', 0] }]` so historical profit margins stay unchanged when future supplier costs shift.
- **Full Cancellation Reversal (`PUT /api/sales/:id/cancel`)**:
  - Marks `sale.status = 'cancelled'`.
  - Iterates through `sale.items`, atomically increments `Product.stock` by `+item.quantity`, and writes a `sale_return` ledger entry (`reference: VOID-INV-...`).
  - If a customer was attached to the sale, decrements `Customer.totalSpending` by `-sale.total` (floored at `0`) and `Customer.totalOrders` by `-1` (floored at `0`).

---

## 14. Multi-Format Reporting & Export Engine (PDF, Excel, CSV)

InventoryHub includes three document export pipelines:

| Format | Engine / File | Execution Tier | Capabilities & Formatting Details |
| :--- | :--- | :---: | :--- |
| **PDF (`.pdf`)** | `pdfkit` + `pdfkit-table` (`backend/utils/pdfExport.js`) | Server-Side Stream | Generates 3 document types streamed directly to `res` with `Content-Type: application/pdf`:<br>1. `generateInvoicePDF`: POS customer invoice receipt.<br>2. `generateReportPDF`: A4 tabular report with generation timestamp, date range, active filter pills, bold headers, and bold summary `TOTAL` row.<br>3. `generateMonthlyBusinessReportPDF`: Multi-section executive summary covering revenue, cost, profit, low-stock count, new customers, top selling products table, and category revenue table. |
| **Excel (`.xlsx`)** | SheetJS `xlsx` (`backend/utils/excelExport.js`) | Server-Side Buffer | `exportReportToExcel` converts JSON rows + optional `totals` footer row into an OpenXML spreadsheet buffer (`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`) with dynamic column width auto-sizing (`ws['!cols']` capped at `40ch`). |
| **CSV (`.csv`)** | Native Blob (`frontend/src/utils/exportCsv.js` & `inventory.controller.js`) | Client-Side & Server-Side | Prepends UTF-8 Byte Order Mark (`\uFEFF`) so Microsoft Excel opens currency symbols and international characters cleanly. Escapes embedded quotes (`""`), wraps multiline/comma fields, and blocks OWASP CSV Formula Injection by prefixing cells starting with `=`, `+`, `-`, or `@` with a single quote (`'`). |

---

## 15. Security, Input Validation & Error Handling Architecture

1. **Stateless JWT HS256 & Active-Account Enforcement (`backend/middleware/auth.js`)**:
   - Extracts Bearer token from `Authorization` header, verifies signature against `process.env.JWT_SECRET`, and loads the user from MongoDB.
   - Rejects requests (`401 Unauthorized`) if the user has been deactivated (`!req.user.isActive`), even if their JWT has not expired.
2. **Password Hashing & Token Digesting**:
   - User passwords are hashed with `bcryptjs` (`10` rounds) and marked `select: false` at the schema level.
   - Password reset tokens are hashed with `crypto.createHash('sha256')` before database storage so raw reset tokens are never stored in MongoDB.
3. **Sliding-Window Authentication Rate Limiter (`backend/server.js`)**:
   - Protects `/api/auth/login` and `/api/auth/forgot-password` against credential stuffing and brute-force attacks (`30 requests` per `15-minute` window per IP).
4. **NoSQL / ReDoS Regex Sanitization**:
   - All user-supplied search strings passed to MongoDB `$regex` queries across controllers (`inventory`, `product`, `sale`, `customer`, `supplier`, `user`, `activityLog`) are sanitized via `escapeRegex(str)` (`str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')`), blocking Regular Expression Denial of Service (ReDoS) and regex injection.
5. **Hardened File Uploads & Static Serving (`backend/middleware/upload.js` & `server.js`)**:
   - Multer validates both file extension (`.jpg`, `.jpeg`, `.png`, `.webp`) and MIME type (`image/jpeg`, `image/png`, `image/webp`), enforces a `5 MB` file size cap, and generates collision-safe filenames.
   - Static `/uploads` responses include `X-Content-Type-Options: nosniff` to prevent browser MIME-sniffing attacks.
6. **Centralized Error Handling (`backend/middleware/errorHandler.js`)**:
   - Intercepts uncaught controller errors and normalizes Mongoose `CastError` (`404 Resource not found`), MongoDB `11000` duplicate key errors (`400 Duplicate value entered for <field>`), and Mongoose `ValidationError` (`400` joined field messages) into consistent `{ success: false, message }` JSON payloads.

---

## 16. Git Workflow & Multi-Developer Feature Branch Integration

InventoryHub was built using a **Feature-Branch $\rightarrow$ `development` $\rightarrow$ `main`** Git workflow across 8 engineering streams:

| Branch Name | Module Owner / Stream | Primary Functional Scope Delivered |
| :--- | :--- | :--- |
| `feature/ayyan-authentication` | Authentication & RBAC | JWT login, registration, forgot/reset password flow, `AuthContext`, `ProtectedRoute`, and `Users.jsx` staff administration. |
| `Maira/product-management` | Catalog & Categories | `Product` and `Category` models, CRUD controllers, Multer image uploads, SKU validation, and `Products.jsx` / `Categories.jsx`. |
| `Maira/ui-consistency` | Design System & Shell | Shared `Layout.jsx`, `Layout.css`, `PageHeader.jsx`, `useLenis.js`, collapsible rail, command palette (`Ctrl+K`), and motion tokens in `index.css`. |
| `muzammil/Inventory-Management` | Warehouse & Accounting | Forensic `Inventory` ledger, Moving Average Cost (`AVCO`), atomic Stock-In/Out/Damaged/Adjust (OCC), 6-metric Audit Modal, and Auto-Draft PO engine. |
| `feature/Namra/pos-sales-management` | POS Terminal & Sales | `POS.jsx` checkout terminal, cart discount/tax engine, `Sale` controller, PDF invoice generation, and `Sales.jsx` cancellation reversal. |
| `feature/Shanza/customer-supplier-management` | Customer & Supplier CRM | `Customers.jsx` and `Suppliers.jsx` directories, CRM KPI cards, virtual `productsSupplied`, and purchase history drawers. |
| `Aiman/feature/Purchase-Management` | Procurement & POs | `Purchase` model and controller, `Purchases.jsx` multi-item PO builder, and idempotent stock receipt transitions (`ordered` $\rightarrow$ `received`). |
| `Khadija/dashboard` | Executive BI & Reports | `Dashboard.jsx` Recharts analytics, `Reports.jsx` 6-tab reporting suite, Monthly Executive PDF report, `Notifications.jsx`, and `ActivityLog.jsx`. |

---

## 17. Production Build & Deployment Guide

### 17.1 Building the Frontend for Production
```bash
cd frontend
npm run build
```
This compiles and minifies the React application into `frontend/dist/` with hashed static assets. Preview the production build locally using:
```bash
npm run preview
```

### 17.2 Production Environment Checklist
Before deploying to a cloud host (AWS EC2, DigitalOcean, Render, Railway, or VPS):
1. Set `NODE_ENV=production` in `backend/.env`.
2. Set a 64-character random hex `JWT_SECRET`.
3. Set `FRONTEND_URL=https://inventory.yourdomain.com` so CORS allowlisting and password reset links target your production domain.
4. Back `backend/uploads/` with a persistent volume so product images survive container restarts.

### 17.3 Running with PM2 + Nginx Reverse Proxy (Recommended VPS Setup)

**Start Backend with PM2:**
```bash
cd backend
npm install --omit=dev
pm2 start server.js --name "inventoryhub-api"
pm2 save
```

**Sample Nginx Configuration (`/etc/nginx/sites-available/inventoryhub`):**
```nginx
server {
    listen 80;
    server_name inventory.yourdomain.com;

    # Serve built React SPA static files
    root /var/www/inventory-sales-management/frontend/dist;
    index index.html;

    # Client-side React Router fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy REST API requests to Express backend
    location /api/ {
        proxy_pass http://127.0.0.1:5000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Proxy uploaded product images
    location /uploads/ {
        proxy_pass http://127.0.0.1:5000/uploads/;
        expires 7d;
        add_header X-Content-Type-Options "nosniff";
    }
}
```

---

## 18. Troubleshooting & FAQ

### Q1: `Error: querySrv ECONNREFUSED _mongodb._tcp.<cluster>.mongodb.net` on Windows
- **Cause**: Some Windows ISP/router DNS resolvers fail to resolve MongoDB Atlas `SRV` records (`mongodb+srv://`).
- **Solution**: `backend/config/db.js` overrides Node's DNS resolvers to Google/Cloudflare DNS (`8.8.8.8`, `8.8.4.4`, `1.1.1.1`) whenever `MONGODB_URI` starts with `mongodb+srv://`. Verify `DISABLE_PUBLIC_DNS` is **not** set to `true` in `backend/.env`, and check that your IP address is allowlisted in **MongoDB Atlas $\rightarrow$ Network Access**.

### Q2: Uploaded product images return `404` or fail to render in development
- **Cause**: Product images are stored relative to `backend/uploads/` (e.g., `uploads/1727210000000-item.png`).
- **Solution**: Confirm the backend server is running on port `5000` and access the frontend via the Vite dev server (`http://localhost:3000`), which proxies `/uploads` to `http://localhost:5000` in `frontend/vite.config.js`.

### Q3: Why can't I edit the `Stock` quantity inside the Edit Product modal?
- **By Design**: To keep the warehouse ledger auditable, `PUT /api/products/:id` strips `req.body.stock`. To change stock levels, open **Inventory (`/inventory`)** and run **Stock In**, **Stock Out**, **Damaged**, or **Adjust Stock (Cycle Count)**.

### Q4: Why does deleting a Product, Category, Supplier, or User return an error or deactivate instead of deleting?
- **Referential Integrity Guards**:
  - **Product**: Cannot be deactivated while `stock > 0`. Write off or dispatch remaining stock first.
  - **Category**: Cannot be deleted while active products are assigned to it.
  - **Supplier**: Cannot be deleted if historical Purchase Orders reference the supplier.
  - **User**: If a user has historical Sales, Inventory movements, or Purchase Orders, `DELETE /api/users/:id` performs a **soft deactivation** (`isActive: false`) so historical invoices and ledger entries keep their `createdBy` / `performedBy` attribution.

### Q5: Port `5000` or `3000` is already in use (`EADDRINUSE`)
- **Solution**: Change `PORT=5001` in `backend/.env` and update the proxy target in `frontend/vite.config.js`, or stop the conflicting process:
  ```powershell
  # Windows PowerShell: Find and stop process on port 5000
  Get-NetTCPConnection -LocalPort 5000 | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
  ```

---

<div align="center">
  <b>InventoryHub: Full-Stack Inventory & Sales Management System</b><br/>
  Built with Node.js, Express, MongoDB, Mongoose, React 18, Vite & Lenis
</div>
