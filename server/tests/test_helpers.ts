import request from 'supertest';
import { app } from '../src/app.js';
import { runSeed } from '../src/db/seed.js';

export function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function setupTestEnvironment() {
  await runSeed(undefined, true);
}

export async function loginAsAdmin(): Promise<{ token: string; user: any }> {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: 'studio@artstudio.in', password: 'Studio@123' });
  return { token: res.body.token, user: res.body.user };
}

export async function registerCustomer(name: string, email: string, password = 'Password@123'): Promise<{ token: string; user: any }> {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name, email, password });
  return { token: res.body.token, user: res.body.user };
}
