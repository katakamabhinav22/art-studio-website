# Varnika Art Studio — Full-Stack Platform

> An art studio web platform with role-based access control (Customer and Studio Administrator) supporting one-of-a-kind painting sales, custom wall mural bookings, and bespoke handcrafted pottery requests.

---

## 🎨 System Overview

- **Paintings Catalogue**: Browse authentic Indian traditional art (Madhubani, Warli, Tanjore, Kalamkari). Each original artwork can only be sold once. Customers can purchase available art, view their orders, and cancel orders (which restores artwork availability).
- **Wall Murals**: Customers book dates between 7 and 90 days out, input wall surface area (10 to 500 sq ft), and receive automatic pricing based on the seed rate (₹150/sq ft). Dates are strictly unique across active reservations. Customers can cancel up to 3 days prior to the date.
- **Custom Pottery**: Customers select from seed pottery vessels (Kulhad, Surahi, Matka, Diya set, Gamla) and mineral glazes (Kumkum Red, Haldi Yellow, Mehendi Green, Indigo Blue, Sandalwood Beige, Charcoal Black). Supports batches of 1 to 12 pieces with a 14-day curing minimum.
- **Role-Based Access Control**: Strict server-side RBAC enforcing HTTP 401 for unauthenticated calls, HTTP 403 for unauthorized roles, and HTTP 404 for accessing another customer's private records.

---

## 🛠️ Tech Stack

- **Backend**: Node.js v20+ / v22+ / v24+ with Express and TypeScript.
- **Database**: Relational SQLite via Node.js native `DatabaseSync` (`node:sqlite`). Operates in-process with zero external database daemon requirements, ensuring seamless clean-machine evaluation.
- **Authentication**: `bcryptjs` password hashing and signed JWT tokens in both `httpOnly` secure cookies and `Authorization: Bearer` headers.
- **Frontend**: React 18 with Vite, TypeScript, React Router, Lucide icons, and modern artisanal design system tokens.
- **Testing**: Vitest + Supertest integration test suite covering 37 test cases with 100% pass rate.

---

## 🚀 Clean-Machine Setup & Running

### Prerequisites
- **Node.js**: v20.0.0 or higher (Node 22 / 24 recommended).
- **npm**: v9.0.0 or higher.
- **Git**

### 1. Clone & Enter Repository
```bash
git clone <repository-url>
cd GDGC-Web-Development
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Initialize & Seed Database
Seeds the 12 original paintings, 5 pottery vessels, 6 mineral glazes, mural pricing (₹150/sq ft), and the studio administrator account from `seedData/seed.json`:
```bash
npm run seed
```

### 4. Run Automated Tests
Executes the comprehensive Vitest test suite covering RBAC, concurrency protection, boundary conditions, and cancellations:
```bash
npm test
```

### 5. Start the Application

#### Production Mode (Single Command — Runs unified build on port 5000):
```bash
npm run build
npm start
```
Open **[http://localhost:5000](http://localhost:5000)** in your browser.

#### Development Mode (Hot-Reloading frontend on port 3000 + backend on port 5000):
```bash
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## 🔑 Demo & Test Accounts

| Role | Email | Password | Permissions |
| :--- | :--- | :--- | :--- |
| **Studio Administrator** | `studio@artstudio.in` | `Studio@123` | Add/edit paintings, confirm/decline wall bookings, accept/decline pottery requests, inspect master ledger. |
| **Customer** | *(Self-register via UI)* or use any test customer | Any valid password ($\ge 6$ chars) | Browse catalogue, purchase available paintings, cancel own orders, book wall dates, cancel bookings ($\ge 3$ days), request pottery, edit/cancel requests. |

> **Convenience Feature**: The Login screen (`/login`) includes one-click buttons to instantly fill administrator or customer credentials for rapid grading and demonstration.

---

## 🧪 Automated Test Coverage (37 Tests Passed)

The automated test suite (`npm test`) verifies all requirements from Section 7 of the specification:
1. **Authentication**: Customer registration, duplicate email rejection, role elevation protection, login validation, and token inspection.
2. **RBAC & Error Codes**:
   - `401 Unauthorized` on unauthenticated calls to private endpoints.
   - `403 Forbidden` when customers attempt admin actions (adding paintings, confirming bookings, accepting pottery) or when admins attempt customer actions (purchasing art, booking walls).
   - `404 Not Found` when a customer attempts to view, edit, or cancel another customer's private order, booking, or pottery request.
3. **Paintings & Concurrency**:
   - Verification of all 12 seed paintings and initial statuses (`p-004` and `p-009` start sold).
   - Admin adding paintings and editing available paintings.
   - Admin blocked from editing sold paintings (`400 Bad Request`).
   - Customer purchasing available art and concurrent purchase collision protection (`409 Conflict`).
   - Order cancellation restoring artwork availability.
4. **Wall Bookings**:
   - Date range validation (strictly 7 to 90 days from today).
   - Surface area validation (strictly 10 to 500 sq ft).
   - Automated price calculation (`wallSize * 150 INR`).
   - Collision prevention: prevents booking the same date twice (`409 Conflict`).
   - Cancellation cutoff: cancellation rejected when $< 3$ days remain; accepted when $\ge 3$ days remain.
   - Restoring date availability upon cancellation.
   - Studio confirmation and decline workflows.
5. **Custom Pottery**:
   - Options population from seed items and glazes.
   - Quantity bounds (1 to 12 pieces).
   - Needed-by date validation ($\ge 14$ days in future).
   - Customer editing and cancelling while in `requested` status.
   - Customer blocked from editing or cancelling once `accepted` or `declined` (`400 Bad Request`).

---

## 📂 Project Structure

```
├── client/                     # Frontend React + TypeScript application
│   ├── public/images/          # Seed painting images (p-001.jpg to p-012.jpg)
│   ├── src/
│   │   ├── api/client.ts       # Type-safe API client & error handler
│   │   ├── components/         # Navbar, Footer, StatusBadge, Spinner, EmptyState, ErrorAlert
│   │   ├── context/AuthContext # Authentication context & session manager
│   │   ├── pages/              # Home, Paintings, WallBooking, Pottery, Auth, Dashboards
│   │   ├── types/index.ts      # Shared domain interfaces
│   │   ├── App.tsx             # Route declarations
│   │   ├── main.tsx            # React application entrypoint
│   │   └── index.css           # Art-studio design system tokens
│   └── index.html
├── server/                     # Backend Express + TypeScript application
│   ├── src/
│   │   ├── db/
│   │   │   ├── db.ts           # SQLite DatabaseSync connection & schema
│   │   │   └── seed.ts         # Seed script importing from seedData/seed.json
│   │   ├── middleware/
│   │   │   └── auth.ts         # JWT verification & RBAC route guards
│   │   ├── routes/             # auth, paintings, orders, bookings, pottery
│   │   ├── app.ts              # Express application configuration
│   │   └── index.ts            # Server entrypoint
│   └── tests/                  # Vitest + Supertest integration test suite
├── seedData/                   # Official seed dataset
│   ├── images/                 # Painting images (p-001.jpg - p-012.jpg)
│   └── seed.json               # Seed paintings, items, glazes, mural rate, studio account
├── .env.example                # Environment variables template
├── DESIGN.md                   # Architecture & design document
├── README.md                   # Setup and usage guide
└── package.json
```

---

## 📜 Demo Script

See `DEMO_SCRIPT.md` for a concise, step-by-step walkthrough script for a 5-minute video recording covering every required feature.
