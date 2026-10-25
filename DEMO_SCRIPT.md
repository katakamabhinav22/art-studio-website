# Art Studio Full-Stack Platform — 5-Minute Video Demo Script

This script provides a concise, step-by-step narration guide for a 5-minute video recording of the project.

---

### [0:00 - 0:45] Introduction & Quick Architecture Tour
- **Visual**: Show the terminal running `npm test` (all 37 tests passing), then run `npm start` and open `http://localhost:5000`.
- **Narration**:
  > "Hello! Today I'm demonstrating our Art Studio Full-Stack Platform built for the assignment.
  > The platform features an Express and TypeScript backend running on Node.js, backed by SQLite with immediate ACID transactions and partial unique indexes for rock-solid concurrency control.
  > On the frontend, we have a responsive React and TypeScript client styled with an artisanal studio aesthetic, featuring complete loading, empty, and error states.
  > As you can see in the terminal, all 37 automated tests are passing with 100% coverage across RBAC, boundary checks, and collision prevention."

---

### [0:45 - 1:45] Feature 1: Original Paintings Catalogue & Purchasing
- **Visual**: Navigate to `/paintings`. Show filter tabs ("All", "Available", "Sold"), showing 12 seed paintings imported from `seedData/seed.json`. Note that `p-004` and `p-009` are correctly marked "Sold" from the seed data.
- **Action**: Click on a painting (e.g. `p-001` - *Madhubani Peacock Garden*), open its detail modal, then log in as a customer (or use the "Quick Fill Demo Customer" button on `/login`).
- **Action**: Click "Buy Now". Show the immediate purchase confirmation banner.
- **Action**: Show that the painting status immediately transitions to "Sold" in the catalogue.
- **Action**: Navigate to "My Dashboard" -> "Painting Orders". Show the order. Click "Cancel Order". Show that the order is marked cancelled and the painting returns to "Available" in the catalogue!
- **Narration**:
  > "Here in the Paintings Catalogue, all 12 artworks are loaded directly from the official seed dataset.
  > Each painting is one-of-a-kind. When our customer buys 'Madhubani Peacock Garden', the backend executes an atomic `BEGIN IMMEDIATE` transaction that updates the status to sold and records the order.
  > When the customer cancels their order from the customer dashboard, another atomic transaction cancels the order and makes the painting available for purchase again."

---

### [1:45 - 2:45] Feature 2: Custom Wall Mural Booking
- **Visual**: Navigate to `/wall-booking`.
- **Action**: Pick a date 14 days in the future.
- **Action**: Adjust the wall surface slider from 10 to 100 sq ft. Show the dynamic price calculation: `100 sq ft × ₹150/sq ft = ₹15,000`.
- **Action**: Enter address: "42 Heritage Boulevard, Hyderabad" and click "Confirm & Request Booking".
- **Action**: Show the success card. Now, try to select that exact same date again and show the collision prevention alert: *"This date has already been booked by another customer"*.
- **Action**: Go to "My Dashboard" -> "Wall Bookings". Note that cancellation is available because the date is 14 days away ($\ge 3$ days). Show that if a booking were within 3 days, cancellation is strictly locked by server business rules.
- **Narration**:
  > "In the Wall Murals service, dates are restricted between 7 and 90 days out, and wall sizes between 10 and 500 square feet.
  > Pricing is automatically computed using the ₹150 per square foot rate from the seed data.
  > Our database enforces a partial unique index on active booking dates. Once a date is requested, no other customer can double-book that date. If a booking is cancelled $\ge 3$ days prior, the date automatically opens back up."

---

### [2:45 - 3:30] Feature 3: Custom Handcrafted Pottery Requests
- **Visual**: Navigate to `/custom-pottery`.
- **Action**: Select a seed vessel (e.g. *Kulhad (clay cup)*) and a seed mineral glaze (e.g. *Mehendi Green*).
- **Action**: Set quantity to 6 pieces (between 1 and 12).
- **Action**: Pick a needed-by date 21 days in future ($\ge 14$ days).
- **Action**: Click "Submit Pottery Request".
- **Action**: Go to "My Dashboard" -> "Pottery Requests". Show the "Edit" button. Click "Edit", change quantity to 8, and save.
- **Narration**:
  > "For custom pottery, vessels and glazes are populated from our seed data.
  > Customers can specify quantities from 1 to 12 pieces with a 14-day minimum curing window.
  > Notice that while the status is 'requested', the customer can edit or cancel their order directly."

---

### [3:30 - 4:15] Studio Administrator Workflow
- **Visual**: Log out from customer account. Log in as Studio Admin using `studio@artstudio.in` / `Studio@123`.
- **Action**: Navigate to `/admin`.
- **Action**: Show "Painting Inventory". Click "Add Painting" to demonstrate admin inventory management. Show that sold paintings have their edit button disabled per the specification.
- **Action**: Switch to "Wall Bookings" tab. Find the booking created earlier and click "Confirm".
- **Action**: Switch to "Pottery Requests" tab. Find the pottery request created earlier and click "Accept Request".
- **Action**: Switch to "Master Orders" tab to view the platform-wide audit ledger.
- **Action**: Switch back to the customer account: show that the accepted pottery request can no longer be edited or cancelled by the customer, and the confirmed mural is locked in.
- **Narration**:
  > "Logging in as the studio administrator, we access the Admin Dashboard.
  > Administrators can add new paintings or edit available ones, review all customer wall bookings to confirm or decline them, and accept or decline pottery commissions.
  > Once the studio accepts a pottery commission, customer editing and cancellation are strictly locked out."

---

### [4:15 - 5:00] Code Walkthrough (Concurrency & RBAC)
- **Visual**: Open `server/src/routes/paintings.routes.ts` and `server/src/db/db.ts` in VS Code.
- **Action**: Highlight the purchase transaction:
  ```typescript
  db.exec('BEGIN IMMEDIATE');
  const updateResult = db.prepare(`
    UPDATE paintings SET status = 'sold' WHERE id = ? AND status = 'available'
  `).run(paintingId);
  if (updateResult.changes === 0) {
    db.exec('ROLLBACK');
    return res.status(409).json({ error: 'This painting was just purchased by another customer' });
  }
  ```
- **Action**: Highlight the partial unique index in `server/src/db/db.ts`:
  ```sql
  CREATE UNIQUE INDEX IF NOT EXISTS idx_wall_bookings_active_date 
  ON wall_bookings(booking_date) 
  WHERE status IN ('requested', 'confirmed');
  ```
- **Action**: Highlight the RBAC middleware in `server/src/middleware/auth.ts` showing 401 unauthenticated, 403 role mismatch, and 404 customer ownership isolation.
- **Narration**:
  > "Let's take a quick look behind the scenes at how concurrency is handled.
  > In `paintings.routes.ts`, purchases execute inside a `BEGIN IMMEDIATE` transaction using an atomic `UPDATE ... WHERE status = 'available'`. If another customer purchased the artwork a millisecond earlier, `updateResult.changes` is zero, immediately triggering a rollback and returning HTTP 409 Conflict.
  > Similarly, for wall bookings, a partial unique index enforces that no two active bookings can share the same date directly at the database engine level.
  > Thank you for reviewing our Art Studio platform!"
