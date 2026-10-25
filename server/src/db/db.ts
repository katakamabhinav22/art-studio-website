import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import dotenv from 'dotenv';
import pg from 'pg';

const require = createRequire(import.meta.url);
const { DatabaseSync } = require('node:sqlite');

dotenv.config();

const { Pool } = pg;

export interface QueryResultInfo {
  changes: number;
}

export interface DatabaseAdapter {
  isPostgres: boolean;
  init(): Promise<void>;
  get<T = any>(sql: string, params?: any[]): Promise<T | undefined>;
  all<T = any>(sql: string, params?: any[]): Promise<T[]>;
  run(sql: string, params?: any[]): Promise<QueryResultInfo>;
  exec(sql: string): Promise<void>;
  transaction<T>(callback: (tx: DatabaseAdapter) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export function convertPlaceholders(sql: string): string {
  let paramIndex = 1;
  return sql.replace(/\?/g, () => `$${paramIndex++}`);
}

class PostgresAdapter implements DatabaseAdapter {
  isPostgres = true;
  private pool: pg.Pool;
  private client?: pg.PoolClient; // for transactions

  constructor(connectionString: string, client?: pg.PoolClient) {
    if (client) {
      this.client = client;
      this.pool = null as any;
    } else {
      const isLocal = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');
      this.pool = new Pool({
        connectionString,
        ssl: isLocal ? false : { rejectUnauthorized: false },
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      });
    }
  }

  async init(): Promise<void> {
    await this.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('customer', 'studio', 'admin')),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS paintings (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        artist TEXT NOT NULL,
        description TEXT NOT NULL,
        price INTEGER NOT NULL CHECK(price > 0),
        image_url TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('available', 'sold')),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        customer_id TEXT NOT NULL REFERENCES users(id),
        painting_id TEXT NOT NULL REFERENCES paintings(id),
        price INTEGER NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('placed', 'cancelled')),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS wall_bookings (
        id TEXT PRIMARY KEY,
        customer_id TEXT NOT NULL REFERENCES users(id),
        booking_date TEXT NOT NULL,
        wall_size_sqft NUMERIC NOT NULL CHECK(wall_size_sqft >= 10 AND wall_size_sqft <= 500),
        address TEXT NOT NULL,
        rate_per_sqft NUMERIC NOT NULL,
        price NUMERIC NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('requested', 'confirmed', 'declined', 'cancelled')),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
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
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
  }

  private async queryInternal(sql: string, params: any[] = []): Promise<pg.QueryResult<any>> {
    const pgSql = convertPlaceholders(sql);
    if (this.client) {
      return this.client.query(pgSql, params);
    }
    return this.pool.query(pgSql, params);
  }

  async get<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
    const res = await this.queryInternal(sql, params);
    return res.rows[0];
  }

  async all<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    const res = await this.queryInternal(sql, params);
    return res.rows;
  }

  async run(sql: string, params: any[] = []): Promise<QueryResultInfo> {
    const res = await this.queryInternal(sql, params);
    return { changes: res.rowCount ?? 0 };
  }

  async exec(sql: string): Promise<void> {
    if (this.client) {
      await this.client.query(sql);
    } else {
      await this.pool.query(sql);
    }
  }

  async transaction<T>(callback: (tx: DatabaseAdapter) => Promise<T>): Promise<T> {
    if (this.client) {
      return callback(this);
    }
    const client = await this.pool.connect();
    const txAdapter = new PostgresAdapter('', client);
    try {
      await client.query('BEGIN');
      const result = await callback(txAdapter);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch {}
      throw err;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
    }
  }
}

class SQLiteAdapter implements DatabaseAdapter {
  isPostgres = false;
  private sqlite: any;

  constructor(dbPath: string) {
    const dir = path.dirname(dbPath);
    if (dir && dir !== '.' && !fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.sqlite = new DatabaseSync(dbPath);
  }

  async init(): Promise<void> {
    this.sqlite.exec('PRAGMA foreign_keys = ON;');
    this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
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

  async get<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
    const stmt = this.sqlite.prepare(sql);
    return stmt.get(...params);
  }

  async all<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    const stmt = this.sqlite.prepare(sql);
    return stmt.all(...params);
  }

  async run(sql: string, params: any[] = []): Promise<QueryResultInfo> {
    const stmt = this.sqlite.prepare(sql);
    const info = stmt.run(...params);
    return { changes: info.changes ?? 0 };
  }

  async exec(sql: string): Promise<void> {
    this.sqlite.exec(sql);
  }

  async transaction<T>(callback: (tx: DatabaseAdapter) => Promise<T>): Promise<T> {
    this.sqlite.exec('BEGIN IMMEDIATE');
    try {
      const result = await callback(this);
      this.sqlite.exec('COMMIT');
      return result;
    } catch (err) {
      try {
        this.sqlite.exec('ROLLBACK');
      } catch {}
      throw err;
    }
  }

  async close(): Promise<void> {
    try {
      this.sqlite.close();
    } catch {}
  }
}

// Global active database instance
const databaseUrl = process.env.DATABASE_URL;
const sqlitePath = process.env.DATABASE_PATH || './art_studio.db';

export const db: DatabaseAdapter = databaseUrl
  ? new PostgresAdapter(databaseUrl)
  : new SQLiteAdapter(sqlitePath);

export async function initDatabase(): Promise<void> {
  await db.init();
}

export async function closeDatabase(): Promise<void> {
  await db.close();
}
