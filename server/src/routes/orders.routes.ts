import { Router, Request, Response } from 'express';
import { db } from '../db/db.js';
import { requireAuth, ApiHttpError } from '../middleware/auth.js';

const router = Router();

// GET /api/orders - List orders (Customers see own, Admins see all)
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const isAdmin = user.role === 'admin' || user.role === 'studio';

    let query: string;
    let params: any[];

    if (isAdmin) {
      query = `
        SELECT o.id, o.customer_id AS "customerId", o.painting_id AS "paintingId", o.price, o.status,
               o.created_at AS "createdAt", o.updated_at AS "updatedAt",
               u.name AS "customerName", u.email AS "customerEmail",
               p.title AS "paintingTitle", p.artist AS "paintingArtist", p.image_url AS "paintingImageUrl"
        FROM orders o
        JOIN users u ON o.customer_id = u.id
        JOIN paintings p ON o.painting_id = p.id
        ORDER BY o.created_at DESC
      `;
      params = [];
    } else {
      query = `
        SELECT o.id, o.customer_id AS "customerId", o.painting_id AS "paintingId", o.price, o.status,
               o.created_at AS "createdAt", o.updated_at AS "updatedAt",
               p.title AS "paintingTitle", p.artist AS "paintingArtist", p.image_url AS "paintingImageUrl"
        FROM orders o
        JOIN paintings p ON o.painting_id = p.id
        WHERE o.customer_id = ?
        ORDER BY o.created_at DESC
      `;
      params = [user.id];
    }

    const orders = await db.all(query, params);
    return res.status(200).json({ orders });
  } catch (err: any) {
    console.error('Error fetching orders:', err);
    return res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// GET /api/orders/:id - Get specific order
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const isAdmin = user.role === 'admin' || user.role === 'studio';

    const order = await db.get<any>(`
      SELECT o.id, o.customer_id AS "customerId", o.painting_id AS "paintingId", o.price, o.status,
             o.created_at AS "createdAt", o.updated_at AS "updatedAt",
             u.name AS "customerName", u.email AS "customerEmail",
             p.title AS "paintingTitle", p.artist AS "paintingArtist", p.image_url AS "paintingImageUrl"
      FROM orders o
      JOIN users u ON o.customer_id = u.id
      JOIN paintings p ON o.painting_id = p.id
      WHERE o.id = ?
    `, [req.params.id]);

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
router.put('/:id/cancel', requireAuth, async (req: Request, res: Response) => {
  const user = req.user!;
  const isAdmin = user.role === 'admin' || user.role === 'studio';

  // Rule: Cancel an order: Customer: Yes (only what they own), Admin: No
  if (isAdmin) {
    return res.status(403).json({ error: 'Administrators cannot cancel customer orders' });
  }

  const orderId = req.params.id;

  try {
    let updatedOrder: any;

    await db.transaction(async (tx) => {
      const order = await tx.get<any>('SELECT * FROM orders WHERE id = ?', [orderId]);

      if (!order) {
        throw new ApiHttpError(404, 'Order not found');
      }

      // RBAC: Customer asking for someone else's record gets 404
      if (order.customer_id !== user.id) {
        throw new ApiHttpError(404, 'Order not found');
      }

      if (order.status === 'cancelled') {
        throw new ApiHttpError(400, 'This order has already been cancelled');
      }

      // Cancel order
      await tx.run(`
        UPDATE orders
        SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [orderId]);

      // Restore painting availability
      await tx.run(`
        UPDATE paintings
        SET status = 'available', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [order.painting_id]);

      updatedOrder = await tx.get(`
        SELECT o.id, o.customer_id AS "customerId", o.painting_id AS "paintingId", o.price, o.status,
               o.updated_at AS "updatedAt", p.title AS "paintingTitle"
        FROM orders o
        JOIN paintings p ON o.painting_id = p.id
        WHERE o.id = ?
      `, [orderId]);
    });

    return res.status(200).json({
      message: 'Order cancelled successfully and painting is now available again',
      order: updatedOrder,
    });
  } catch (err: any) {
    if (err instanceof ApiHttpError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('Error cancelling order:', err);
    return res.status(500).json({ error: 'Failed to cancel order' });
  }
});

export default router;
