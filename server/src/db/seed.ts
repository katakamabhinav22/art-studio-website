import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { db, initDatabase, DatabaseAdapter } from './db.js';

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

export async function runSeed(customSeedPath?: string, cleanDatabase = false, adapter: DatabaseAdapter = db) {
  await initDatabase();

  const seedPath = customSeedPath || process.env.SEED_DATA_PATH || path.resolve(process.cwd(), 'seedData/seed.json');

  if (!fs.existsSync(seedPath)) {
    throw new Error(`Seed file not found at: ${seedPath}`);
  }

  const raw = fs.readFileSync(seedPath, 'utf-8');
  const seed: SeedData = JSON.parse(raw);

  await adapter.transaction(async (tx) => {
    if (cleanDatabase) {
      await tx.exec(`
        DELETE FROM orders;
        DELETE FROM wall_bookings;
        DELETE FROM pottery_requests;
        DELETE FROM paintings;
        DELETE FROM pottery_items;
        DELETE FROM pottery_glazes;
        DELETE FROM users;
      `);
    }

    // 1. Settings (safe upsert)
    const upsertSettingSql = `
      INSERT INTO settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `;
    await tx.run(upsertSettingSql, ['currency', seed.currency || 'INR']);
    await tx.run(upsertSettingSql, ['mural_rate_per_sqft', String(seed.mural?.ratePerSqFt || 150)]);

    // 2. Studio Admin Account
    const adminEmail = seed.studioAccount.email.toLowerCase();
    const existingAdmin = await tx.get<{ id: string }>('SELECT id FROM users WHERE email = ?', [adminEmail]);

    if (!existingAdmin) {
      const adminPasswordHash = await bcrypt.hash(seed.studioAccount.password, 10);
      const adminRole = seed.studioAccount.role === 'studio' ? 'studio' : 'admin';
      const adminId = 'admin-studio-001';
      await tx.run(
        'INSERT INTO users (id, name, email, password, role) VALUES (?, ?, ?, ?, ?)',
        [adminId, 'Studio Administrator', adminEmail, adminPasswordHash, adminRole]
      );
    }

    // 3. Pottery Items (safe upsert)
    for (const item of seed.potteryItems) {
      await tx.run(
        `INSERT INTO pottery_items (id, name) VALUES (?, ?)
         ON CONFLICT(id) DO UPDATE SET name = excluded.name`,
        [item.id, item.name]
      );
    }

    // 4. Glazes (safe upsert)
    for (const glaze of seed.glazes) {
      await tx.run(
        `INSERT INTO pottery_glazes (id, name) VALUES (?, ?)
         ON CONFLICT(id) DO UPDATE SET name = excluded.name`,
        [glaze.id, glaze.name]
      );
    }

    // 5. Paintings (safe upsert - preserves sold status in production)
    for (const p of seed.paintings) {
      if (cleanDatabase) {
        // In clean test mode, reset exact initial status
        await tx.run(
          `INSERT INTO paintings (id, title, artist, description, price, image_url, status)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             title = excluded.title,
             artist = excluded.artist,
             description = excluded.description,
             price = excluded.price,
             image_url = excluded.image_url,
             status = excluded.status`,
          [p.id, p.title, p.artist, p.description, p.price, p.imageUrl, p.status]
        );
      } else {
        // In production mode, insert if not exists, or update details without altering live sold status
        await tx.run(
          `INSERT INTO paintings (id, title, artist, description, price, image_url, status)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             title = excluded.title,
             artist = excluded.artist,
             description = excluded.description,
             price = excluded.price,
             image_url = excluded.image_url`,
          [p.id, p.title, p.artist, p.description, p.price, p.imageUrl, p.status]
        );
      }
    }
  });

  console.log(`[SEED] Database verified and seeded from ${seedPath}`);
  console.log(`[SEED] Admin account ready: ${seed.studioAccount.email}`);
  console.log(`[SEED] Verified ${seed.paintings.length} paintings, ${seed.potteryItems.length} pottery items, ${seed.glazes.length} glazes.`);
}

// If run directly via node/tsx
if (process.argv[1] && process.argv[1].endsWith('seed.ts')) {
  runSeed().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
