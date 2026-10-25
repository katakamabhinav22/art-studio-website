import { Router, Request, Response } from 'express';
import crypto from 'node:crypto';
import { db } from '../db/db.js';
import { requireAuth, requireAdmin, requireCustomer } from '../middleware/auth.js';

const router = Router();

function getTodayMidnight(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function parseNeededDate(dateStr: string): Date | null {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const parts = dateStr.split('-').map(Number);
  const d = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
  return isNaN(d.getTime()) ? null : d;
}

function getDaysDiff(targetDate: Date): number {
  const today = getTodayMidnight();
  const diffMs = targetDate.getTime() - today.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

// GET /api/pottery/options - List items and glazes from seed data
router.get('/options', (req: Request, res: Response) => {
  try {
    const items = db.prepare('SELECT id, name FROM pottery_items ORDER BY id ASC').all();
    const glazes = db.prepare('SELECT id, name FROM pottery_glazes ORDER BY id ASC').all();

    return res.status(200).json({ items, glazes });
  } catch (err: any) {
    console.error('Error fetching pottery options:', err);
    return res.status(500).json({ error: 'Failed to fetch pottery options' });
  }
});

// GET /api/pottery - List pottery requests
router.get('/', requireAuth, (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const isAdmin = user.role === 'admin' || user.role === 'studio';

    let requests: any[];

    if (isAdmin) {
      requests = db.prepare(`
        SELECT pr.id, pr.customer_id AS customerId, pr.item_id AS itemId, pr.glaze_id AS glazeId,
               pr.quantity, pr.needed_by_date AS neededByDate, pr.status,
               pr.created_at AS createdAt, pr.updated_at AS updatedAt,
               pi.name AS itemName, pg.name AS glazeName,
               u.name AS customerName, u.email AS customerEmail
        FROM pottery_requests pr
        JOIN pottery_items pi ON pr.item_id = pi.id
        JOIN pottery_glazes pg ON pr.glaze_id = pg.id
        JOIN users u ON pr.customer_id = u.id
        ORDER BY pr.needed_by_date ASC, pr.created_at DESC
      `).all();
    } else {
      requests = db.prepare(`
        SELECT pr.id, pr.customer_id AS customerId, pr.item_id AS itemId, pr.glaze_id AS glazeId,
               pr.quantity, pr.needed_by_date AS neededByDate, pr.status,
               pr.created_at AS createdAt, pr.updated_at AS updatedAt,
               pi.name AS itemName, pg.name AS glazeName
        FROM pottery_requests pr
        JOIN pottery_items pi ON pr.item_id = pi.id
        JOIN pottery_glazes pg ON pr.glaze_id = pg.id
        WHERE pr.customer_id = ?
        ORDER BY pr.needed_by_date ASC, pr.created_at DESC
      `).all(user.id);
    }

    return res.status(200).json({ requests });
  } catch (err: any) {
    console.error('Error fetching pottery requests:', err);
    return res.status(500).json({ error: 'Failed to fetch pottery requests' });
  }
});

// GET /api/pottery/:id - Single pottery request
router.get('/:id', requireAuth, (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const isAdmin = user.role === 'admin' || user.role === 'studio';

    const reqData = db.prepare(`
      SELECT pr.id, pr.customer_id AS customerId, pr.item_id AS itemId, pr.glaze_id AS glazeId,
             pr.quantity, pr.needed_by_date AS neededByDate, pr.status,
             pr.created_at AS createdAt, pr.updated_at AS updatedAt,
             pi.name AS itemName, pg.name AS glazeName,
             u.name AS customerName, u.email AS customerEmail
      FROM pottery_requests pr
      JOIN pottery_items pi ON pr.item_id = pi.id
      JOIN pottery_glazes pg ON pr.glaze_id = pg.id
      JOIN users u ON pr.customer_id = u.id
      WHERE pr.id = ?
    `).get(req.params.id) as any;

    if (!reqData) {
      return res.status(404).json({ error: 'Pottery request not found' });
    }

    if (!isAdmin && reqData.customerId !== user.id) {
      return res.status(404).json({ error: 'Pottery request not found' });
    }

    return res.status(200).json({ request: reqData });
  } catch (err: any) {
    console.error('Error fetching pottery request:', err);
    return res.status(500).json({ error: 'Failed to fetch pottery request' });
  }
});

// POST /api/pottery - Customer creates pottery request
router.post('/', requireAuth, requireCustomer, (req: Request, res: Response) => {
  try {
    const { itemId, glazeId, quantity, neededByDate } = req.body;

    // Validate item
    const item = db.prepare('SELECT id, name FROM pottery_items WHERE id = ?').get(itemId);
    if (!item) {
      return res.status(400).json({ error: 'Invalid pottery item selected from seed data' });
    }

    // Validate glaze
    const glaze = db.prepare('SELECT id, name FROM pottery_glazes WHERE id = ?').get(glazeId);
    if (!glaze) {
      return res.status(400).json({ error: 'Invalid glaze selected from seed data' });
    }

    // Validate quantity: between 1 and 12
    const qty = Number(quantity);
    if (isNaN(qty) || !Number.isInteger(qty) || qty < 1 || qty > 12) {
      return res.status(400).json({ error: 'Quantity must be an integer between 1 and 12' });
    }

    // Validate needed-by date: at least 14 days in future
    if (!neededByDate || typeof neededByDate !== 'string') {
      return res.status(400).json({ error: 'Needed-by date is required (YYYY-MM-DD)' });
    }

    const parsedDate = parseNeededDate(neededByDate);
    if (!parsedDate) {
      return res.status(400).json({ error: 'Invalid date format for needed-by date. Use YYYY-MM-DD' });
    }

    const diffDays = getDaysDiff(parsedDate);
    if (diffDays < 14) {
      return res.status(400).json({
        error: `Needed-by date must be at least 14 days in the future (selected date is ${diffDays} day(s) away)`,
      });
    }

    const requestId = crypto.randomUUID();
    db.prepare(`
      INSERT INTO pottery_requests (id, customer_id, item_id, glaze_id, quantity, needed_by_date, status)
      VALUES (?, ?, ?, ?, ?, ?, 'requested')
    `).run(requestId, req.user!.id, itemId, glazeId, qty, neededByDate);

    const created = db.prepare(`
      SELECT pr.id, pr.customer_id AS customerId, pr.item_id AS itemId, pr.glaze_id AS glazeId,
             pr.quantity, pr.needed_by_date AS neededByDate, pr.status, pr.created_at AS createdAt,
             pi.name AS itemName, pg.name AS glazeName
      FROM pottery_requests pr
      JOIN pottery_items pi ON pr.item_id = pi.id
      JOIN pottery_glazes pg ON pr.glaze_id = pg.id
      WHERE pr.id = ?
    `).get(requestId);

    return res.status(201).json({
      message: 'Pottery request submitted successfully',
      request: created,
    });
  } catch (err: any) {
    console.error('Error creating pottery request:', err);
    return res.status(500).json({ error: 'Failed to create pottery request' });
  }
});

// PUT /api/pottery/:id - Customer edits pottery request (only while requested)
router.put('/:id', requireAuth, (req: Request, res: Response) => {
  const user = req.user!;
  const isAdmin = user.role === 'admin' || user.role === 'studio';

  // Rule: Cancel/edit an order, booking or request: Customer: Yes (only what they own), Admin: No
  if (isAdmin) {
    return res.status(403).json({ error: 'Administrators cannot edit customer requests' });
  }

  const requestId = req.params.id;

  try {
    const existing = db.prepare('SELECT * FROM pottery_requests WHERE id = ?').get(requestId) as any;

    if (!existing) {
      return res.status(404).json({ error: 'Pottery request not found' });
    }

    if (existing.customer_id !== user.id) {
      return res.status(404).json({ error: 'Pottery request not found' });
    }

    // Business rule: A customer can edit or cancel a request only while it is still requested
    if (existing.status !== 'requested') {
      return res.status(400).json({
        error: `Requests can only be edited or cancelled while in 'requested' status (current status: '${existing.status}')`,
      });
    }

    const { itemId, glazeId, quantity, neededByDate } = req.body;

    const newItemId = itemId !== undefined ? itemId : existing.item_id;
    const newGlazeId = glazeId !== undefined ? glazeId : existing.glaze_id;
    const newQty = quantity !== undefined ? Number(quantity) : existing.quantity;
    const newNeededDate = neededByDate !== undefined ? neededByDate : existing.needed_by_date;

    const item = db.prepare('SELECT id FROM pottery_items WHERE id = ?').get(newItemId);
    if (!item) return res.status(400).json({ error: 'Invalid pottery item' });

    const glaze = db.prepare('SELECT id FROM pottery_glazes WHERE id = ?').get(newGlazeId);
    if (!glaze) return res.status(400).json({ error: 'Invalid glaze' });

    if (isNaN(newQty) || !Number.isInteger(newQty) || newQty < 1 || newQty > 12) {
      return res.status(400).json({ error: 'Quantity must be an integer between 1 and 12' });
    }

    const parsedDate = parseNeededDate(newNeededDate);
    if (!parsedDate) {
      return res.status(400).json({ error: 'Invalid needed-by date format (YYYY-MM-DD)' });
    }

    const diffDays = getDaysDiff(parsedDate);
    if (diffDays < 14) {
      return res.status(400).json({
        error: `Needed-by date must be at least 14 days in the future (${diffDays} days away)`,
      });
    }

    db.prepare(`
      UPDATE pottery_requests
      SET item_id = ?, glaze_id = ?, quantity = ?, needed_by_date = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND status = 'requested'
    `).run(newItemId, newGlazeId, newQty, newNeededDate, requestId);

    const updated = db.prepare(`
      SELECT pr.id, pr.customer_id AS customerId, pr.item_id AS itemId, pr.glaze_id AS glazeId,
             pr.quantity, pr.needed_by_date AS neededByDate, pr.status, pr.updated_at AS updatedAt,
             pi.name AS itemName, pg.name AS glazeName
      FROM pottery_requests pr
      JOIN pottery_items pi ON pr.item_id = pi.id
      JOIN pottery_glazes pg ON pr.glaze_id = pg.id
      WHERE pr.id = ?
    `).get(requestId);

    return res.status(200).json({
      message: 'Pottery request updated successfully',
      request: updated,
    });
  } catch (err: any) {
    console.error('Error updating pottery request:', err);
    return res.status(500).json({ error: 'Failed to update pottery request' });
  }
});

// PUT /api/pottery/:id/cancel - Customer cancels pottery request (only while requested)
router.put('/:id/cancel', requireAuth, (req: Request, res: Response) => {
  const user = req.user!;
  const isAdmin = user.role === 'admin' || user.role === 'studio';

  if (isAdmin) {
    return res.status(403).json({ error: 'Administrators cannot cancel customer requests' });
  }

  const requestId = req.params.id;

  try {
    const existing = db.prepare('SELECT * FROM pottery_requests WHERE id = ?').get(requestId) as any;

    if (!existing) {
      return res.status(404).json({ error: 'Pottery request not found' });
    }

    if (existing.customer_id !== user.id) {
      return res.status(404).json({ error: 'Pottery request not found' });
    }

    // Business rule: A customer can edit or cancel a request only while it is still requested
    if (existing.status !== 'requested') {
      return res.status(400).json({
        error: `Requests can only be edited or cancelled while in 'requested' status (current status: '${existing.status}')`,
      });
    }

    db.prepare(`
      UPDATE pottery_requests
      SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(requestId);

    const updated = db.prepare(`
      SELECT id, customer_id AS customerId, status, updated_at AS updatedAt
      FROM pottery_requests WHERE id = ?
    `).get(requestId);

    return res.status(200).json({
      message: 'Pottery request cancelled successfully',
      request: updated,
    });
  } catch (err: any) {
    console.error('Error cancelling pottery request:', err);
    return res.status(500).json({ error: 'Failed to cancel pottery request' });
  }
});

// PUT /api/pottery/:id/status - Studio accepts or declines request (Admin only)
router.put('/:id/status', requireAuth, requireAdmin, (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    const requestId = req.params.id;

    if (!['accepted', 'declined'].includes(status)) {
      return res.status(400).json({ error: "Status must be 'accepted' or 'declined'" });
    }

    const existing = db.prepare('SELECT * FROM pottery_requests WHERE id = ?').get(requestId) as any;
    if (!existing) {
      return res.status(404).json({ error: 'Pottery request not found' });
    }

    if (existing.status === 'cancelled') {
      return res.status(400).json({ error: 'Cannot update status of a cancelled request' });
    }

    db.prepare(`
      UPDATE pottery_requests
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(status, requestId);

    const updated = db.prepare(`
      SELECT pr.id, pr.customer_id AS customerId, pr.item_id AS itemId, pr.glaze_id AS glazeId,
             pr.quantity, pr.needed_by_date AS neededByDate, pr.status, pr.updated_at AS updatedAt,
             pi.name AS itemName, pg.name AS glazeName,
             u.name AS customerName, u.email AS customerEmail
      FROM pottery_requests pr
      JOIN pottery_items pi ON pr.item_id = pi.id
      JOIN pottery_glazes pg ON pr.glaze_id = pg.id
      JOIN users u ON pr.customer_id = u.id
      WHERE pr.id = ?
    `).get(requestId);

    return res.status(200).json({
      message: `Pottery request ${status} successfully`,
      request: updated,
    });
  } catch (err: any) {
    console.error('Error updating pottery request status:', err);
    return res.status(500).json({ error: 'Failed to update pottery status' });
  }
});

export default router;
