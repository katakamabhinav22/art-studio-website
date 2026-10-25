import { Router, Request, Response } from 'express';
import crypto from 'node:crypto';
import { db } from '../db/db.js';
import { requireAuth, requireAdmin, requireCustomer, ApiHttpError } from '../middleware/auth.js';

const router = Router();

// Helper to get today at 00:00:00 local time
function getTodayMidnight(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// Helper to parse 'YYYY-MM-DD' into midnight Date
function parseBookingDate(dateStr: string): Date | null {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const parts = dateStr.split('-').map(Number);
  const d = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
  return isNaN(d.getTime()) ? null : d;
}

// Helper to compute day difference: (targetDate - today)
function getDaysDiff(targetDate: Date): number {
  const today = getTodayMidnight();
  const diffMs = targetDate.getTime() - today.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

// GET /api/bookings/rate - Get current wall painting rate
router.get('/rate', async (req: Request, res: Response) => {
  try {
    const rateSetting = await db.get<{ value: string }>("SELECT value FROM settings WHERE key = 'mural_rate_per_sqft'");
    const currencySetting = await db.get<{ value: string }>("SELECT value FROM settings WHERE key = 'currency'");

    const ratePerSqFt = rateSetting ? Number(rateSetting.value) : 150;
    const currency = currencySetting ? currencySetting.value : 'INR';

    return res.status(200).json({ ratePerSqFt, currency });
  } catch (err: any) {
    console.error('Error fetching mural rate:', err);
    return res.status(500).json({ error: 'Failed to fetch mural rate' });
  }
});

// GET /api/bookings/unavailable-dates - Get all dates currently taken
router.get('/unavailable-dates', async (req: Request, res: Response) => {
  try {
    const rows = await db.all<any>(`
      SELECT DISTINCT booking_date AS "bookingDate"
      FROM wall_bookings
      WHERE status IN ('requested', 'confirmed')
      ORDER BY booking_date ASC
    `);

    const dates = rows.map((r) => r.bookingDate);
    return res.status(200).json({ unavailableDates: dates });
  } catch (err: any) {
    console.error('Error fetching unavailable dates:', err);
    return res.status(500).json({ error: 'Failed to fetch unavailable dates' });
  }
});

// GET /api/bookings - List bookings
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const isAdmin = user.role === 'admin' || user.role === 'studio';

    let bookings: any[];

    if (isAdmin) {
      bookings = await db.all(`
        SELECT b.id, b.customer_id AS "customerId", b.booking_date AS "bookingDate",
               b.wall_size_sqft AS "wallSizeSqFt", b.address, b.rate_per_sqft AS "ratePerSqFt",
               b.price, b.status, b.created_at AS "createdAt", b.updated_at AS "updatedAt",
               u.name AS "customerName", u.email AS "customerEmail"
        FROM wall_bookings b
        JOIN users u ON b.customer_id = u.id
        ORDER BY b.booking_date ASC, b.created_at DESC
      `);
    } else {
      bookings = await db.all(`
        SELECT b.id, b.customer_id AS "customerId", b.booking_date AS "bookingDate",
               b.wall_size_sqft AS "wallSizeSqFt", b.address, b.rate_per_sqft AS "ratePerSqFt",
               b.price, b.status, b.created_at AS "createdAt", b.updated_at AS "updatedAt"
        FROM wall_bookings b
        WHERE b.customer_id = ?
        ORDER BY b.booking_date ASC, b.created_at DESC
      `, [user.id]);
    }

    return res.status(200).json({ bookings });
  } catch (err: any) {
    console.error('Error fetching bookings:', err);
    return res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// GET /api/bookings/:id - Single booking
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const isAdmin = user.role === 'admin' || user.role === 'studio';

    const booking = await db.get<any>(`
      SELECT b.id, b.customer_id AS "customerId", b.booking_date AS "bookingDate",
             b.wall_size_sqft AS "wallSizeSqFt", b.address, b.rate_per_sqft AS "ratePerSqFt",
             b.price, b.status, b.created_at AS "createdAt", b.updated_at AS "updatedAt",
             u.name AS "customerName", u.email AS "customerEmail"
      FROM wall_bookings b
      JOIN users u ON b.customer_id = u.id
      WHERE b.id = ?
    `, [req.params.id]);

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (!isAdmin && booking.customerId !== user.id) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    return res.status(200).json({ booking });
  } catch (err: any) {
    console.error('Error fetching booking:', err);
    return res.status(500).json({ error: 'Failed to fetch booking' });
  }
});

// POST /api/bookings - Customer books a wall painting
router.post('/', requireAuth, requireCustomer, async (req: Request, res: Response) => {
  try {
    const { bookingDate, wallSizeSqFt, address } = req.body;

    if (!bookingDate || typeof bookingDate !== 'string') {
      return res.status(400).json({ error: 'Booking date is required (YYYY-MM-DD)' });
    }

    const parsedDate = parseBookingDate(bookingDate);
    if (!parsedDate) {
      return res.status(400).json({ error: 'Invalid booking date format. Use YYYY-MM-DD' });
    }

    // Business rule: date between 7 and 90 days from today
    const diffDays = getDaysDiff(parsedDate);
    if (diffDays < 7 || diffDays > 90) {
      return res.status(400).json({
        error: `Booking date must be between 7 and 90 days from today (selected date is ${diffDays} days away)`,
      });
    }

    // Business rule: wall size between 10 and 500 sq ft
    const size = Number(wallSizeSqFt);
    if (isNaN(size) || size < 10 || size > 500) {
      return res.status(400).json({
        error: 'Wall size must be between 10 and 500 square feet',
      });
    }

    if (!address || typeof address !== 'string' || address.trim().length === 0) {
      return res.status(400).json({ error: 'Address is required' });
    }

    // Calculate price using seed rate
    const rateRow = await db.get<{ value: string }>("SELECT value FROM settings WHERE key = 'mural_rate_per_sqft'");
    const rate = rateRow ? Number(rateRow.value) : 150;
    const price = Math.round(size * rate);
    const bookingId = crypto.randomUUID();

    let created: any;

    await db.transaction(async (tx) => {
      // Business rule: Each date can be booked only once
      const existing = await tx.get<any>(`
        SELECT id FROM wall_bookings
        WHERE booking_date = ? AND status IN ('requested', 'confirmed')
      `, [bookingDate]);

      if (existing) {
        throw new ApiHttpError(409, 'This date has already been booked. Please choose another date.');
      }

      await tx.run(`
        INSERT INTO wall_bookings (id, customer_id, booking_date, wall_size_sqft, address, rate_per_sqft, price, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'requested')
      `, [bookingId, req.user!.id, bookingDate, size, address.trim(), rate, price]);

      created = await tx.get(`
        SELECT id, customer_id AS "customerId", booking_date AS "bookingDate",
               wall_size_sqft AS "wallSizeSqFt", address, rate_per_sqft AS "ratePerSqFt",
               price, status, created_at AS "createdAt"
        FROM wall_bookings WHERE id = ?
      `, [bookingId]);
    });

    return res.status(201).json({
      message: 'Wall painting booking requested successfully',
      booking: created,
    });
  } catch (err: any) {
    if (err instanceof ApiHttpError) {
      return res.status(err.status).json({ error: err.message });
    }
    if (err.message && (err.message.includes('UNIQUE constraint failed') || err.message.includes('duplicate key') || err.code === '23505')) {
      return res.status(409).json({
        error: 'This date has already been booked by another customer',
      });
    }
    console.error('Error creating booking:', err);
    return res.status(500).json({ error: 'Failed to create booking' });
  }
});

// PUT /api/bookings/:id/status - Admin confirms or declines booking
router.put('/:id/status', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    const bookingId = req.params.id;

    if (!['confirmed', 'declined'].includes(status)) {
      return res.status(400).json({ error: "Status must be 'confirmed' or 'declined'" });
    }

    const booking = await db.get<any>('SELECT * FROM wall_bookings WHERE id = ?', [bookingId]);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (booking.status === 'cancelled') {
      return res.status(400).json({ error: 'Cannot change status of a cancelled booking' });
    }

    await db.run(`
      UPDATE wall_bookings
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [status, bookingId]);

    const updated = await db.get(`
      SELECT b.id, b.customer_id AS "customerId", b.booking_date AS "bookingDate",
             b.wall_size_sqft AS "wallSizeSqFt", b.address, b.price, b.status,
             b.updated_at AS "updatedAt", u.name AS "customerName", u.email AS "customerEmail"
      FROM wall_bookings b
      JOIN users u ON b.customer_id = u.id
      WHERE b.id = ?
    `, [bookingId]);

    return res.status(200).json({
      message: `Booking has been ${status}`,
      booking: updated,
    });
  } catch (err: any) {
    console.error('Error updating booking status:', err);
    return res.status(500).json({ error: 'Failed to update booking status' });
  }
});

// PUT /api/bookings/:id/cancel - Customer cancels own booking
router.put('/:id/cancel', requireAuth, async (req: Request, res: Response) => {
  const user = req.user!;
  const isAdmin = user.role === 'admin' || user.role === 'studio';

  // Rule: Cancel an order, booking or request: Customer: Yes (only what they own), Admin: No
  if (isAdmin) {
    return res.status(403).json({ error: 'Administrators cannot cancel customer bookings' });
  }

  const bookingId = req.params.id;

  try {
    const booking = await db.get<any>('SELECT * FROM wall_bookings WHERE id = ?', [bookingId]);

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // RBAC: Customer asking for someone else's record gets 404
    if (booking.customer_id !== user.id) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (booking.status === 'cancelled') {
      return res.status(400).json({ error: 'This booking has already been cancelled' });
    }

    if (booking.status === 'declined') {
      return res.status(400).json({ error: 'This booking has already been declined' });
    }

    // Business rule: A customer can cancel until 3 days before the date
    const parsedDate = parseBookingDate(booking.booking_date);
    if (!parsedDate) {
      return res.status(500).json({ error: 'Invalid booking date in record' });
    }

    const diffDays = getDaysDiff(parsedDate);
    if (diffDays < 3) {
      return res.status(400).json({
        error: `Cancellation is only allowed until 3 days before the booking date (${diffDays} day(s) remaining)`,
      });
    }

    await db.run(`
      UPDATE wall_bookings
      SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [bookingId]);

    const updated = await db.get(`
      SELECT id, customer_id AS "customerId", booking_date AS "bookingDate",
             wall_size_sqft AS "wallSizeSqFt", address, price, status, updated_at AS "updatedAt"
      FROM wall_bookings WHERE id = ?
    `, [bookingId]);

    return res.status(200).json({
      message: 'Booking cancelled successfully. The date is now available again.',
      booking: updated,
    });
  } catch (err: any) {
    console.error('Error cancelling booking:', err);
    return res.status(500).json({ error: 'Failed to cancel booking' });
  }
});

export default router;
