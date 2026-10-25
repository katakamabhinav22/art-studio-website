import { Router, Request, Response } from 'express';
import crypto from 'node:crypto';
import { db } from '../db/db.js';
import { requireAuth, requireAdmin, requireCustomer } from '../middleware/auth.js';

const router = Router();

// GET /api/paintings - Browse painting catalogue
router.get('/', (req: Request, res: Response) => {
  try {
    const paintings = db.prepare(`
      SELECT id, title, artist, description, price, image_url AS imageUrl, status, created_at AS createdAt
      FROM paintings
      ORDER BY created_at ASC
    `).all();

    return res.status(200).json({ paintings });
  } catch (err: any) {
    console.error('Error fetching paintings:', err);
    return res.status(500).json({ error: 'Failed to fetch paintings' });
  }
});

// GET /api/paintings/:id - Painting details
router.get('/:id', (req: Request, res: Response) => {
  try {
    const painting = db.prepare(`
      SELECT id, title, artist, description, price, image_url AS imageUrl, status, created_at AS createdAt
      FROM paintings
      WHERE id = ?
    `).get(req.params.id);

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
router.post('/', requireAuth, requireAdmin, (req: Request, res: Response) => {
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

    db.prepare(`
      INSERT INTO paintings (id, title, artist, description, price, image_url, status)
      VALUES (?, ?, ?, ?, ?, ?, 'available')
    `).run(paintingId, title.trim(), artist.trim(), description.trim(), Math.round(numPrice), finalImageUrl);

    const created = db.prepare(`
      SELECT id, title, artist, description, price, image_url AS imageUrl, status, created_at AS createdAt
      FROM paintings WHERE id = ?
    `).get(paintingId);

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
router.put('/:id', requireAuth, requireAdmin, (req: Request, res: Response) => {
  try {
    const paintingId = req.params.id;
    const existing = db.prepare('SELECT * FROM paintings WHERE id = ?').get(paintingId) as any;

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

    db.prepare(`
      UPDATE paintings
      SET title = ?, artist = ?, description = ?, price = ?, image_url = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND status = 'available'
    `).run(newTitle, newArtist, newDescription, newPrice, newImageUrl, paintingId);

    const updated = db.prepare(`
      SELECT id, title, artist, description, price, image_url AS imageUrl, status, updated_at AS updatedAt
      FROM paintings WHERE id = ?
    `).get(paintingId);

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
router.post('/:id/purchase', requireAuth, requireCustomer, (req: Request, res: Response) => {
  const paintingId = req.params.id;
  const customerId = req.user!.id;

  try {
    db.exec('BEGIN IMMEDIATE');

    const painting = db.prepare('SELECT * FROM paintings WHERE id = ?').get(paintingId) as any;

    if (!painting) {
      db.exec('ROLLBACK');
      return res.status(404).json({ error: 'Painting not found' });
    }

    if (painting.status !== 'available') {
      db.exec('ROLLBACK');
      return res.status(400).json({ error: 'This painting is already sold and no longer available' });
    }

    // Atomic update
    const updateResult = db.prepare(`
      UPDATE paintings
      SET status = 'sold', updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND status = 'available'
    `).run(paintingId);

    if (updateResult.changes === 0) {
      db.exec('ROLLBACK');
      return res.status(409).json({ error: 'This painting was just purchased by another customer' });
    }

    const orderId = crypto.randomUUID();
    db.prepare(`
      INSERT INTO orders (id, customer_id, painting_id, price, status)
      VALUES (?, ?, ?, ?, 'placed')
    `).run(orderId, customerId, paintingId, painting.price);

    db.exec('COMMIT');

    const createdOrder = db.prepare(`
      SELECT o.id, o.customer_id AS customerId, o.painting_id AS paintingId, o.price, o.status, o.created_at AS createdAt,
             p.title AS paintingTitle, p.artist AS paintingArtist, p.image_url AS paintingImageUrl
      FROM orders o
      JOIN paintings p ON o.painting_id = p.id
      WHERE o.id = ?
    `).get(orderId);

    return res.status(201).json({
      message: 'Painting purchased successfully',
      order: createdOrder,
    });
  } catch (err: any) {
    try {
      db.exec('ROLLBACK');
    } catch {
      // rollback may fail if not inside tx
    }
    console.error('Error during painting purchase:', err);
    return res.status(500).json({ error: 'Failed to process purchase' });
  }
});

export default router;
