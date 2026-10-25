import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { setupTestEnvironment } from './test_helpers.js';

describe('Authentication & Authorization Tests', () => {
  beforeAll(async () => {
    await setupTestEnvironment();
  });

  it('allows a new customer to register with valid details', async () => {
    const email = `testuser_${Date.now()}@example.com`;
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Jane Doe',
        email,
        password: 'Password123',
      });

    expect(res.status).toBe(201);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe(email);
    expect(res.body.user.role).toBe('customer');
    expect(res.body.token).toBeDefined();
  });

  it('rejects registration with duplicate email', async () => {
    const email = `dup_${Date.now()}@example.com`;
    await request(app)
      .post('/api/auth/register')
      .send({ name: 'User 1', email, password: 'Password123' });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'User 2', email, password: 'Password456' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('already exists');
  });

  it('never allows public registration to create administrator accounts', async () => {
    const email = `sneaky_${Date.now()}@example.com`;
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Hacker',
        email,
        password: 'Password123',
        role: 'admin', // attempt to elevate role
      });

    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('customer'); // strictly enforced as customer
  });

  it('allows seeded studio administrator to login', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'studio@artstudio.in',
        password: 'Studio@123',
      });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(['studio', 'admin']).toContain(res.body.user.role);
  });

  it('rejects login with wrong password (401)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'studio@artstudio.in',
        password: 'WrongPassword',
      });

    expect(res.status).toBe(401);
    expect(res.body.error).toContain('Invalid email or password');
  });

  it('allows logging out and clearing session cookie', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(200);
  });

  it('returns current user with valid token on /api/auth/me', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'studio@artstudio.in', password: 'Studio@123' });

    const token = loginRes.body.token;

    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.user.email).toBe('studio@artstudio.in');
  });
});
