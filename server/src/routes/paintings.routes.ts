import { Router, Request, Response } from 'express';
import crypto from 'node:crypto';
import { db } from '../db/db.js';
import { requireAuth, requireAdmin, requireCustomer, ApiHttpError } from '../middleware/auth.js';

const router = Router();

// GET /api/paintings - Browse painting catalogue
router.get('/', async (req: Request, res: Response) => {
  try {
    const paintings = await db.all(`
      SELECT id, title, artist, description, price, image_url AS "imageUrl", status, created_at AS "createdAt"
      FROM paintings
      ORDER BY created_at ASC
    `);

    return res.status(200).json({ paintings });
  } catch (err: any) {
    console.error('Error fetching paintings:', err);
    return res.status(500).json({ error: 'Failed to fetch paintings' });
  }
});

// GET /api/paintings/:id - Painting details
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const painting = await db.get(`
      SELECT id, title, artist, description, price, image_url AS "imageUrl", status, created_at AS "createdAt"
      FROM paintings
      WHERE id = ?
    `, [req.params.id]);

    if (!painting) {
      return res.status(404).json({ error: 'Painting not found' });
    }

    return res.status(200).json({ painting });
  } catch (err: any) {
    console.error('Error fetching painting details:', err);
    return res.status(500).json({ error: 'Failed to fetch painting details' });
  }
});

// POST /api/paintings - Add new painting (Admin only)
router.post('/', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { title, artist, description, price, imageUrl } = req.body;

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return res.status(400).json({ error: 'Title is required' });
    }
    if (!artist || typeof artist !== 'string' || artist.trim().length === 0) {
      return res.status(400).json({ error: 'Artist is required' });
    }
    if (!description || typeof description !== 'string' || description.trim().length === 0) {
      return res.status(400).json({ error: 'Description is required' });
    }
    const numPrice = Number(price);
    if (isNaN(numPrice) || numPrice <= 0) {
      return res.status(400).json({ error: 'Price must be a positive number' });
    }

    const paintingId = `p-${crypto.randomUUID().slice(0, 8)}`;
    const finalImageUrl = imageUrl && typeof imageUrl === 'string' && imageUrl.trim().length > 0 
      ? imageUrl.trim() 
      : 'images/placeholder.jpg';

    await db.run(`
      INSERT INTO paintings (id, title, artist, description, price, image_url, status)
      VALUES (?, ?, ?, ?, ?, ?, 'available')
    `, [paintingId, title.trim(), artist.trim(), description.trim(), Math.round(numPrice), finalImageUrl]);

    const created = await db.get(`
      SELECT id, title, artist, description, price, image_url AS "imageUrl", status, created_at AS "createdAt"
      FROM paintings WHERE id = ?
    `, [paintingId]);

    return res.status(201).json({
      message: 'Painting added successfully',
      painting: created,
    });
  } catch (err: any) {
    console.error('Error adding painting:', err);
    return res.status(500).json({ error: 'Failed to add painting' });
  }
});

// PUT /api/paintings/:id - Edit painting (Admin only, only while available)
router.put('/:id', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const paintingId = req.params.id;
    const existing = await db.get<any>('SELECT * FROM paintings WHERE id = ?', [paintingId]);

    if (!existing) {
      return res.status(404).json({ error: 'Painting not found' });
    }

    // Business rule: Administrators can edit paintings only while they are available
    if (existing.status !== 'available') {
      return res.status(400).json({ error: 'Cannot edit a painting that has already been sold' });
    }

    const { title, artist, description, price, imageUrl } = req.body;

    const newTitle = title !== undefined ? String(title).trim() : existing.title;
    const newArtist = artist !== undefined ? String(artist).trim() : existing.artist;
    const newDescription = description !== undefined ? String(description).trim() : existing.description;
    const newPrice = price !== undefined ? Math.round(Number(price)) : existing.price;
    const newImageUrl = imageUrl !== undefined ? String(imageUrl).trim() : existing.image_url;

    if (!newTitle) return res.status(400).json({ error: 'Title cannot be empty' });
    if (!newArtist) return res.status(400).json({ error: 'Artist cannot be empty' });
    if (!newDescription) return res.status(400).json({ error: 'Description cannot be empty' });
    if (isNaN(newPrice) || newPrice <= 0) return res.status(400).json({ error: 'Price must be a positive number' });

    await db.run(`
      UPDATE paintings
      SET title = ?, artist = ?, description = ?, price = ?, image_url = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND status = 'available'
    `, [newTitle, newArtist, newDescription, newPrice, newImageUrl, paintingId]);

    const updated = await db.get(`
      SELECT id, title, artist, description, price, image_url AS "imageUrl", status, updated_at AS "updatedAt"
      FROM paintings WHERE id = ?
    `, [paintingId]);

    return res.status(200).json({
      message: 'Painting updated successfully',
      painting: updated,
    });
  } catch (err: any) {
    console.error('Error updating painting:', err);
    return res.status(500).json({ error: 'Failed to update painting' });
  }
});

// POST /api/paintings/:id/purchase - Customer purchases available painting
router.post('/:id/purchase', requireAuth, requireCustomer, async (req: Request, res: Response) => {
  const paintingId = req.params.id;
  const customerId = req.user!.id;
  const orderId = crypto.randomUUID();

  try {
    let createdOrder: any;

    await db.transaction(async (tx) => {
      const painting = await tx.get<any>('SELECT * FROM paintings WHERE id = ?', [paintingId]);

      if (!painting) {
        throw new ApiHttpError(404, 'Painting not found');
      }

      if (painting.status !== 'available') {
        throw new ApiHttpError(400, 'This painting is already sold and no longer available');
      }

      // Atomic update
      const updateResult = await tx.run(`
        UPDATE paintings
        SET status = 'sold', updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND status = 'available'
      `, [paintingId]);

      if (updateResult.changes === 0) {
        throw new ApiHttpError(409, 'This painting was just purchased by another customer');
      }

      await tx.run(`
        INSERT INTO orders (id, customer_id, painting_id, price, status)
        VALUES (?, ?, ?, ?, 'placed')
      `, [orderId, customerId, paintingId, painting.price]);

      createdOrder = await tx.get(`
        SELECT o.id, o.customer_id AS "customerId", o.painting_id AS "paintingId", o.price, o.status, o.created_at AS "createdAt",
               p.title AS "paintingTitle", p.artist AS "paintingArtist", p.image_url AS "paintingImageUrl"
        FROM orders o
        JOIN paintings p ON o.painting_id = p.id
        WHERE o.id = ?
      `, [orderId]);
    });

    return res.status(201).json({
      message: 'Painting purchased successfully',
      order: createdOrder,
    });
  } catch (err: any) {
    if (err instanceof ApiHttpError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('Error during painting purchase:', err);
    return res.status(500).json({ error: 'Failed to process purchase' });
  }
});

export default router;
