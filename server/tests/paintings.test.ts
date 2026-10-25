import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { setupTestEnvironment, loginAsAdmin, registerCustomer } from './test_helpers.js';

describe('Paintings Catalogue, Purchase, and Order Management Tests', () => {
  let adminToken: string;
  let customerToken: string;
  let customer2Token: string;

  beforeAll(async () => {
    await setupTestEnvironment();

    const admin = await loginAsAdmin();
    adminToken = admin.token;

    const c1 = await registerCustomer('Paint Customer', `paint_c1_${Date.now()}@example.com`);
    customerToken = c1.token;

    const c2 = await registerCustomer('Second Customer', `paint_c2_${Date.now()}@example.com`);
    customer2Token = c2.token;
  });

  it('browse catalogue returns all 12 seed paintings with correct fields and initial statuses', async () => {
    const res = await request(app).get('/api/paintings');
    expect(res.status).toBe(200);
    expect(res.body.paintings).toBeDefined();
    expect(res.body.paintings.length).toBe(12);

    // Verify p-001 is available
    const p1 = res.body.paintings.find((p: any) => p.id === 'p-001');
    expect(p1).toBeDefined();
    expect(p1.status).toBe('available');
    expect(p1.title).toBe('Madhubani Peacock Garden');
    expect(p1.price).toBe(6500);

    // Verify p-004 is sold in seed data
    const p4 = res.body.paintings.find((p: any) => p.id === 'p-004');
    expect(p4).toBeDefined();
    expect(p4.status).toBe('sold');
  });

  it('admin can add a new painting', async () => {
    const res = await request(app)
      .post('/api/paintings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Morning Raga in Acrylic',
        artist: 'Vikram Seth',
        description: 'Vibrant sunrise landscape inspired by Hindustani classical raga.',
        price: 8500,
        imageUrl: 'images/placeholder.jpg',
      });

    expect(res.status).toBe(201);
    expect(res.body.painting.title).toBe('Morning Raga in Acrylic');
    expect(res.body.painting.status).toBe('available');
    expect(res.body.painting.id).toBeDefined();
  });

  it('admin can edit an available painting', async () => {
    const res = await request(app)
      .put('/api/paintings/p-003')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Tanjore Lakshmi with Enhanced 24K Gold Leaf',
        price: 26000,
      });

    expect(res.status).toBe(200);
    expect(res.body.painting.title).toBe('Tanjore Lakshmi with Enhanced 24K Gold Leaf');
    expect(res.body.painting.price).toBe(26000);
  });

  it('admin cannot edit a sold painting', async () => {
    const res = await request(app)
      .put('/api/paintings/p-004') // p-004 is sold
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        price: 99999,
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Cannot edit a painting that has already been sold');
  });

  it('customer can purchase an available painting and it becomes sold', async () => {
    // Buy p-005
    const res = await request(app)
      .post('/api/paintings/p-005/purchase')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(201);
    expect(res.body.order).toBeDefined();
    expect(res.body.order.paintingId).toBe('p-005');
    expect(res.body.order.status).toBe('placed');

    // Verify painting is now marked sold in database
    const checkRes = await request(app).get('/api/paintings/p-005');
    expect(checkRes.status).toBe(200);
    expect(checkRes.body.painting.status).toBe('sold');
  });

  it('prevents concurrent / duplicate purchase of an already sold painting', async () => {
    // Customer 2 tries to buy p-005 which was just bought by Customer 1
    const res = await request(app)
      .post('/api/paintings/p-005/purchase')
      .set('Authorization', `Bearer ${customer2Token}`);

    expect([400, 409]).toContain(res.status);
    expect(res.body.error).toMatch(/already sold|not available/i);
  });

  it('customer can cancel their own order, making the painting available again', async () => {
    // Buy p-006 first
    const buyRes = await request(app)
      .post('/api/paintings/p-006/purchase')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(buyRes.status).toBe(201);
    const orderId = buyRes.body.order.id;

    // Check status is sold
    const checkSold = await request(app).get('/api/paintings/p-006');
    expect(checkSold.body.painting.status).toBe('sold');

    // Customer cancels order
    const cancelRes = await request(app)
      .put(`/api/orders/${orderId}/cancel`)
      .set('Authorization', `Bearer ${customerToken}`);

    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.order.status).toBe('cancelled');

    // Check painting is now available again!
    const checkAvailable = await request(app).get('/api/paintings/p-006');
    expect(checkAvailable.status).toBe(200);
    expect(checkAvailable.body.painting.status).toBe('available');

    // Now another customer can purchase it!
    const rebuyRes = await request(app)
      .post('/api/paintings/p-006/purchase')
      .set('Authorization', `Bearer ${customer2Token}`);
    expect(rebuyRes.status).toBe(201);
  });
});
