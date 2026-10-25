import { Router, Request, Response } from 'express';
import { db } from '../db/db.js';
import { requireAuth, requireCustomer } from '../middleware/auth.js';

const router = Router();

// GET /api/orders - List orders (Customers see own, Admins see all)
router.get('/', requireAuth, (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const isAdmin = user.role === 'admin' || user.role === 'studio';

    let query: string;
    let params: any[];

    if (isAdmin) {
      query = `
        SELECT o.id, o.customer_id AS customerId, o.painting_id AS paintingId, o.price, o.status,
               o.created_at AS createdAt, o.updated_at AS updatedAt,
               u.name AS customerName, u.email AS customerEmail,
               p.title AS paintingTitle, p.artist AS paintingArtist, p.image_url AS paintingImageUrl
        FROM orders o
        JOIN users u ON o.customer_id = u.id
        JOIN paintings p ON o.painting_id = p.id
        ORDER BY o.created_at DESC
      `;
      params = [];
    } else {
      query = `
        SELECT o.id, o.customer_id AS customerId, o.painting_id AS paintingId, o.price, o.status,
               o.created_at AS createdAt, o.updated_at AS updatedAt,
               p.title AS paintingTitle, p.artist AS paintingArtist, p.image_url AS paintingImageUrl
        FROM orders o
        JOIN paintings p ON o.painting_id = p.id
        WHERE o.customer_id = ?
        ORDER BY o.created_at DESC
      `;
      params = [user.id];
    }

    const orders = db.prepare(query).all(...params);
    return res.status(200).json({ orders });
  } catch (err: any) {
    console.error('Error fetching orders:', err);
    return res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// GET /api/orders/:id - Get specific order
router.get('/:id', requireAuth, (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const isAdmin = user.role === 'admin' || user.role === 'studio';

    const order = db.prepare(`
      SELECT o.id, o.customer_id AS customerId, o.painting_id AS paintingId, o.price, o.status,
             o.created_at AS createdAt, o.updated_at AS updatedAt,
             u.name AS customerName, u.email AS customerEmail,
             p.title AS paintingTitle, p.artist AS paintingArtist, p.image_url AS paintingImageUrl
      FROM orders o
      JOIN users u ON o.customer_id = u.id
      JOIN paintings p ON o.painting_id = p.id
      WHERE o.id = ?
    `).get(req.params.id) as any;

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // RBAC: Customer asking for someone else's record gets 404
    if (!isAdmin && order.customerId !== user.id) {
      return res.status(404).json({ error: 'Order not found' });
    }

    return res.status(200).json({ order });
  } catch (err: any) {
    console.error('Error fetching order:', err);
    return res.status(500).json({ error: 'Failed to fetch order' });
  }
});

// PUT /api/orders/:id/cancel - Cancel order (Customers only, own order only)
router.put('/:id/cancel', requireAuth, (req: Request, res: Response) => {
  const user = req.user!;
  const isAdmin = user.role === 'admin' || user.role === 'studio';

  // Rule: Cancel an order: Customer: Yes (only what they own), Admin: No
  if (isAdmin) {
    return res.status(403).json({ error: 'Administrators cannot cancel customer orders' });
  }

  const orderId = req.params.id;

  try {
    db.exec('BEGIN IMMEDIATE');

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as any;

    if (!order) {
      db.exec('ROLLBACK');
      return res.status(404).json({ error: 'Order not found' });
    }

    // RBAC: Customer asking for someone else's record gets 404
    if (order.customer_id !== user.id) {
      db.exec('ROLLBACK');
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.status === 'cancelled') {
      db.exec('ROLLBACK');
      return res.status(400).json({ error: 'This order has already been cancelled' });
    }

    // Cancel order
    db.prepare(`
      UPDATE orders
      SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(orderId);

    // Restore painting availability
    db.prepare(`
      UPDATE paintings
      SET status = 'available', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(order.painting_id);

    db.exec('COMMIT');

    const updatedOrder = db.prepare(`
      SELECT o.id, o.customer_id AS customerId, o.painting_id AS paintingId, o.price, o.status,
             o.updated_at AS updatedAt, p.title AS paintingTitle
      FROM orders o
      JOIN paintings p ON o.painting_id = p.id
      WHERE o.id = ?
    `).get(orderId);

    return res.status(200).json({
      message: 'Order cancelled successfully and painting is now available again',
      order: updatedOrder,
    });
  } catch (err: any) {
    try {
      db.exec('ROLLBACK');
    } catch {
      // ignore
    }
    console.error('Error cancelling order:', err);
    return res.status(500).json({ error: 'Failed to cancel order' });
  }
});

export default router;
