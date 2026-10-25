# System Architecture & Design Documentation (DESIGN.md)

This document answers the core architecture questions specified in the Art Studio project brief.

---

### 1. How do login and the two roles work?

The authentication and authorization system uses server-side password hashing with **bcryptjs** (cost factor 10) and signed **JSON Web Tokens (JWT)** issued with an HMAC SHA-256 signature.

#### Authentication Flow
- **Registration (`POST /api/auth/register`)**: Open to the public. To maintain security, the server hard-codes and enforces `role: 'customer'`, discarding any client-provided role fields. Duplicate emails are checked using case-insensitive collation (`NOCASE`).
- **Login (`POST /api/auth/login`)**: Verifies the email and compares the hashed password. Upon success, a signed JWT token is issued and set in an `httpOnly`, `sameSite: 'lax'` cookie, as well as returned in the JSON payload for standard `Authorization: Bearer <token>` header support.
- **Administrator Initialization**: The studio administrator account is initialized through the secure seed script (`server/src/db/seed.ts`), using the credentials provided in `seedData/seed.json` (`studio@artstudio.in` / `Studio@123`). Public registration cannot create administrator accounts.

#### Role-Based Access Control (RBAC)
Every incoming request passes through the `authenticate` middleware, which attaches `req.user` if a valid session exists. Role-specific route guards enforce permissions:
- **Unauthenticated requests** to protected routes receive **HTTP 401 Unauthorized**.
- **Role mismatches** (e.g., customers attempting admin routes such as adding paintings or confirming bookings, or administrators attempting customer actions like purchasing paintings or booking mural dates) receive **HTTP 403 Forbidden**.
- **Customer ownership isolation**: A customer attempting to view, edit, or cancel another customer's private order, wall booking, or custom pottery request receives **HTTP 404 Not Found** (preventing user enumeration and IDOR attacks).
- **Studio Administrators** (`role: 'studio' | 'admin'`) can inspect all orders, bookings, and pottery requests across the platform, and manage inventory and statuses.

---

### 2. Which database was chosen, and why?

We chose **SQLite** via Node.js native `DatabaseSync` (`node:sqlite`).

#### Architectural Reasons:
1. **True ACID Relational Integrity**: SQLite provides complete ACID transactions with immediate write locking (`BEGIN IMMEDIATE`) and strict foreign key constraints (`PRAGMA foreign_keys = ON;`), matching the requirements of an inventory and reservation system.
2. **Zero Clean-Machine Friction**: SQLite operates in-process and writes to a deterministic file (`./art_studio.db`) without requiring external database daemons (e.g. PostgreSQL or MySQL background services). Anyone evaluating this repository on a clean machine can clone and run `npm install && npm start` without local service configuration or environment mismatches.
3. **Database-Level Partial Unique Indexes**: SQLite natively supports partial unique indexes:
   ```sql
   CREATE UNIQUE INDEX idx_wall_bookings_active_date 
   ON wall_bookings(booking_date) 
   WHERE status IN ('requested', 'confirmed');
   ```
   This enforces our business rule that each date can only be booked once across active bookings, while allowing the same date to be booked if an earlier booking was declined or cancelled.

---

### 3. How do you stop two people from taking the same painting or date?

Both concurrency risks are solved at the database and transaction level rather than relying on application memory or frontend checks.

#### A. Preventing Duplicate Painting Purchases
1. When a purchase request arrives (`POST /api/paintings/:id/purchase`), the server initiates an immediate transaction:
   ```sql
   BEGIN IMMEDIATE;
   ```
2. The server executes an atomic conditional update:
   ```sql
   UPDATE paintings
   SET status = 'sold', updated_at = CURRENT_TIMESTAMP
   WHERE id = ? AND status = 'available';
   ```
3. SQLite checks the row condition inside the lock. If two customers click "Buy Now" at the exact same millisecond:
   - The first transaction updates the row and reports `changes: 1`. It creates the order and commits.
   - The second transaction sees `changes: 0`. It immediately rolls back and returns **HTTP 409 Conflict** with the message `"This painting was just purchased by another customer"`.
4. When a customer cancels their order (`PUT /api/orders/:id/cancel`), a transaction marks the order `cancelled` and atomically resets the painting's status back to `available`.

#### B. Preventing Duplicate Booking Dates
1. **Engine-Level Partial Unique Index**: The database enforces:
   ```sql
   CREATE UNIQUE INDEX idx_wall_bookings_active_date 
   ON wall_bookings(booking_date) 
   WHERE status IN ('requested', 'confirmed');
   ```
2. **Transactional Verification**: Inside a `BEGIN IMMEDIATE` transaction, the server queries for an existing active booking on the requested date. If found, it rolls back and returns **HTTP 409 Conflict**.
3. **Race Condition Prevention**: If two concurrent requests bypass the initial query simultaneously, the partial unique index halts the second transaction with `SQLITE_CONSTRAINT_UNIQUE: UNIQUE constraint failed: wall_bookings.booking_date`. The server catches this error and returns **HTTP 409 Conflict**.
4. When a booking is cancelled or declined, its status transitions to `cancelled` or `declined`, automatically releasing the partial index constraint and making the date bookable again.

---

### 4. What was completed, what was omitted, why, and what would be done next?

#### Completed Features
1. **Seed Dataset Integration**: Complete import of supplied `seedData.zip` (`seed.json` paintings `p-001` through `p-012`, pottery items `i-01` to `i-05`, glazes `g-01` to `g-06`, mural rate ₹150/sq ft, and studio admin credentials).
2. **Original Paintings**: Full catalogue, search and status filters, artwork details modal, one-of-a-kind purchase flow with atomic lock, and order cancellation restoring stock availability.
3. **Wall Murals**: Booking engine with 7–90 day boundaries, 10–500 sq ft surface area validation, automated pricing (`sqFt * 150`), date collision prevention, studio confirmation/rejection, and customer cancellation restricted to $\ge 3$ days before the date.
4. **Custom Pottery**: Custom order pipeline selecting from seed items and glazes, 1–12 quantity bounds, needed-by date validation ($\ge 14$ days in future), studio acceptance/rejection, and customer edit/cancel permissions restricted to `requested` status.
5. **Security & RBAC**: HTTP 401 unauthenticated refusal, HTTP 403 role refusal, and HTTP 404 ownership isolation.
6. **Automated Test Suite**: 37 automated integration tests with 100% pass rate.
7. **User Interface**: Clean responsive UI built with React, Vite, and custom art-inspired design tokens, featuring loading spinners, empty states, and dismissible error banners on every view.

#### Omitted Features (per Brief Section 06)
- **Real Payment Gateways**: Stripe / Razorpay processing was omitted as specified; purchases directly create orders.
- **External Notifications**: SMS, email dispatch, and delivery tracking.
- **Cloud File Storage**: File upload pipelines (seed images are bundled locally).
- **Deployment & Containers**: Docker and cloud hosting setups were marked out of scope.

#### What Would Be Done Next
1. **Payment Integration**: Connect Razorpay or Stripe Webhooks with escrow capture on order confirmation.
2. **Email & Calendar Invites**: Dispatch automated `.ics` calendar invites for confirmed wall mural bookings.
3. **Image Upload Pipeline**: Add direct image uploads with S3 / Cloudinary for studio administrators when adding new paintings.
