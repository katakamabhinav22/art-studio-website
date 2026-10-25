import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { db, initDatabase } from './db.js';

interface SeedPainting {
  id: string;
  title: string;
  artist: string;
  description: string;
  price: number;
  imageUrl: string;
  status: 'available' | 'sold';
}

interface SeedItem {
  id: string;
  name: string;
}

interface SeedGlaze {
  id: string;
  name: string;
}

interface SeedData {
  currency: string;
  paintings: SeedPainting[];
  potteryItems: SeedItem[];
  glazes: SeedGlaze[];
  mural: {
    ratePerSqFt: number;
  };
  studioAccount: {
    email: string;
    password: string;
    role: string;
  };
}

export async function runSeed(customSeedPath?: string, cleanDatabase = false) {
  initDatabase();

  const seedPath = customSeedPath || process.env.SEED_DATA_PATH || path.resolve(process.cwd(), 'seedData/seed.json');

  if (!fs.existsSync(seedPath)) {
    throw new Error(`Seed file not found at: ${seedPath}`);
  }

  const raw = fs.readFileSync(seedPath, 'utf-8');
  const seed: SeedData = JSON.parse(raw);

  db.exec('BEGIN IMMEDIATE');

  try {
    if (cleanDatabase) {
      db.exec(`
        DELETE FROM orders;
        DELETE FROM wall_bookings;
        DELETE FROM pottery_requests;
        DELETE FROM paintings;
        DELETE FROM pottery_items;
        DELETE FROM pottery_glazes;
        DELETE FROM users;
      `);
    }
    // 1. Settings
    const upsertSetting = db.prepare(`
      INSERT INTO settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `);
    upsertSetting.run('currency', seed.currency || 'INR');
    upsertSetting.run('mural_rate_per_sqft', String(seed.mural?.ratePerSqFt || 150));

    // 2. Studio Admin Account
    const adminEmail = seed.studioAccount.email.toLowerCase();
    const adminPasswordHash = await bcrypt.hash(seed.studioAccount.password, 10);
    const adminRole = seed.studioAccount.role === 'studio' ? 'studio' : 'admin';

    const existingAdmin = db.prepare('SELECT id FROM users WHERE email = ?').get(adminEmail) as { id: string } | undefined;

    if (existingAdmin) {
      db.prepare(`
        UPDATE users SET password = ?, role = ? WHERE email = ?
      `).run(adminPasswordHash, adminRole, adminEmail);
    } else {
      const adminId = 'admin-studio-001';
      db.prepare(`
        INSERT INTO users (id, name, email, password, role)
        VALUES (?, ?, ?, ?, ?)
      `).run(adminId, 'Studio Administrator', adminEmail, adminPasswordHash, adminRole);
    }

    // 3. Pottery Items
    const upsertPotteryItem = db.prepare(`
      INSERT INTO pottery_items (id, name) VALUES (?, ?)
      ON CONFLICT(id) DO UPDATE SET name = excluded.name
    `);
    for (const item of seed.potteryItems) {
      upsertPotteryItem.run(item.id, item.name);
    }

    // 4. Glazes
    const upsertGlaze = db.prepare(`
      INSERT INTO pottery_glazes (id, name) VALUES (?, ?)
      ON CONFLICT(id) DO UPDATE SET name = excluded.name
    `);
    for (const glaze of seed.glazes) {
      upsertGlaze.run(glaze.id, glaze.name);
    }

    // 5. Paintings
    const upsertPainting = db.prepare(`
      INSERT INTO paintings (id, title, artist, description, price, image_url, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        artist = excluded.artist,
        description = excluded.description,
        price = excluded.price,
        image_url = excluded.image_url,
        status = excluded.status
    `);
    for (const p of seed.paintings) {
      upsertPainting.run(
        p.id,
        p.title,
        p.artist,
        p.description,
        p.price,
        p.imageUrl,
        p.status
      );
    }

    db.exec('COMMIT');
    console.log(`[SEED] Successfully seeded database from ${seedPath}`);
    console.log(`[SEED] Admin account ready: ${adminEmail} (password: ${seed.studioAccount.password})`);
    console.log(`[SEED] Seeded ${seed.paintings.length} paintings, ${seed.potteryItems.length} pottery items, ${seed.glazes.length} glazes.`);
  } catch (err) {
    db.exec('ROLLBACK');
    console.error('[SEED] Error during seeding:', err);
    throw err;
  }
}

// If run directly via node/tsx
if (process.argv[1] && process.argv[1].endsWith('seed.ts')) {
  runSeed().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
