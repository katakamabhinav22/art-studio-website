import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import fs from 'node:fs';

import { initDatabase } from './db/db.js';
import { authenticate } from './middleware/auth.js';
import authRoutes from './routes/auth.routes.js';
import paintingsRoutes from './routes/paintings.routes.js';
import ordersRoutes from './routes/orders.routes.js';
import bookingsRoutes from './routes/bookings.routes.js';
import potteryRoutes from './routes/pottery.routes.js';

// Initialize schema on load
initDatabase();

export const app = express();

app.use(cors({
  origin: true,
  credentials: true,
}));

app.use(cookieParser());
app.use(express.json());

// Global auth context extraction
app.use(authenticate);

// Serve static images from seedData/images or client/public/images
const seedImagesPath = path.resolve(process.cwd(), 'seedData/images');
const clientImagesPath = path.resolve(process.cwd(), 'client/public/images');

if (fs.existsSync(seedImagesPath)) {
  app.use('/images', express.static(seedImagesPath));
} else if (fs.existsSync(clientImagesPath)) {
  app.use('/images', express.static(clientImagesPath));
}

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/paintings', paintingsRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/bookings', bookingsRoutes);
app.use('/api/pottery', potteryRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Production: serve built client assets
const distPath = path.resolve(process.cwd(), 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/images')) {
      return next();
    }
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// 404 handler for unknown API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[SERVER ERROR]', err);
  res.status(500).json({ error: 'Internal server error' });
});

export default app;
