import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import dotenv from 'dotenv';

const require = createRequire(import.meta.url);
const { DatabaseSync } = require('node:sqlite');

dotenv.config();

const dbPath = process.env.DATABASE_PATH || './art_studio.db';

// Ensure directory exists if needed
const dir = path.dirname(dbPath);
if (dir && dir !== '.' && !fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

export const db = new DatabaseSync(dbPath);

export function initDatabase() {
  db.exec('PRAGMA foreign_keys = ON;');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL COLLATE NOCASE,
      password TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('customer', 'studio', 'admin')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS paintings (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      artist TEXT NOT NULL,
      description TEXT NOT NULL,
      price INTEGER NOT NULL CHECK(price > 0),
      image_url TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('available', 'sold')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL REFERENCES users(id),
      painting_id TEXT NOT NULL REFERENCES paintings(id),
      price INTEGER NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('placed', 'cancelled')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS wall_bookings (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL REFERENCES users(id),
      booking_date TEXT NOT NULL,
      wall_size_sqft REAL NOT NULL CHECK(wall_size_sqft >= 10 AND wall_size_sqft <= 500),
      address TEXT NOT NULL,
      rate_per_sqft REAL NOT NULL,
      price REAL NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('requested', 'confirmed', 'declined', 'cancelled')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_wall_bookings_active_date 
    ON wall_bookings(booking_date) 
    WHERE status IN ('requested', 'confirmed');

    CREATE TABLE IF NOT EXISTS pottery_items (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS pottery_glazes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS pottery_requests (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL REFERENCES users(id),
      item_id TEXT NOT NULL REFERENCES pottery_items(id),
      glaze_id TEXT NOT NULL REFERENCES pottery_glazes(id),
      quantity INTEGER NOT NULL CHECK(quantity >= 1 AND quantity <= 12),
      needed_by_date TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('requested', 'accepted', 'declined', 'cancelled')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}

export function closeDatabase() {
  try {
    db.close();
  } catch {
    // Ignore close errors during tests
  }
}
