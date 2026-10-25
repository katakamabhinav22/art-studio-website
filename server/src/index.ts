import dotenv from 'dotenv';
dotenv.config();

import { app } from './app.js';
import { runSeed } from './db/seed.js';

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    // Automatically seed database on first startup if no paintings exist
    try {
      await runSeed();
    } catch (seedErr) {
      console.warn('[STARTUP] Seed skipped or already applied:', seedErr);
    }

    const server = app.listen(PORT, () => {
      console.log(`===============================================`);
      console.log(`  Art Studio Full-Stack Server is running!`);
      console.log(`  Local URL:  http://localhost:${PORT}`);
      console.log(`  API Health: http://localhost:${PORT}/api/health`);
      console.log(`===============================================`);
    });

    const shutdown = () => {
      console.log('Shutting down server gracefully...');
      server.close(() => {
        process.exit(0);
      });
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (err) {
    console.error('Fatal error starting server:', err);
    process.exit(1);
  }
}

startServer();
