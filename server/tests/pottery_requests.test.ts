import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { setupTestEnvironment, loginAsAdmin, registerCustomer, addDays } from './test_helpers.js';

describe('Custom Pottery Requests & Status Management Tests', () => {
  let adminToken: string;
  let customerToken: string;

  beforeAll(async () => {
    await setupTestEnvironment();

    const admin = await loginAsAdmin();
    adminToken = admin.token;

    const c = await registerCustomer('Pottery Customer', `pot_${Date.now()}@example.com`);
    customerToken = c.token;
  });

  it('fetches pottery items and glazes populated from seed data', async () => {
    const res = await request(app).get('/api/pottery/options');
    expect(res.status).toBe(200);
    expect(res.body.items).toBeDefined();
    expect(res.body.glazes).toBeDefined();

    expect(res.body.items.length).toBe(5);
    expect(res.body.glazes.length).toBe(6);

    const kulhad = res.body.items.find((i: any) => i.id === 'i-01');
    expect(kulhad.name).toBe('Kulhad (clay cup)');

    const redGlaze = res.body.glazes.find((g: any) => g.id === 'g-01');
    expect(redGlaze.name).toBe('Kumkum Red');
  });

  it('customer creates pottery request with valid seed item and glaze', async () => {
    const res = await request(app)
      .post('/api/pottery')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        itemId: 'i-01',
        glazeId: 'g-03',
        quantity: 6,
        neededByDate: addDays(20),
      });

    expect(res.status).toBe(201);
    expect(res.body.request).toBeDefined();
    expect(res.body.request.itemName).toBe('Kulhad (clay cup)');
    expect(res.body.request.glazeName).toBe('Mehendi Green');
    expect(res.body.request.quantity).toBe(6);
    expect(res.body.request.status).toBe('requested');
  });

  it('rejects invalid pottery item not in seed data', async () => {
    const res = await request(app)
      .post('/api/pottery')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        itemId: 'invalid-item-999',
        glazeId: 'g-01',
        quantity: 4,
        neededByDate: addDays(20),
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Invalid pottery item');
  });

  it('rejects invalid glaze not in seed data', async () => {
    const res = await request(app)
      .post('/api/pottery')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        itemId: 'i-02',
        glazeId: 'invalid-glaze-999',
        quantity: 4,
        neededByDate: addDays(20),
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Invalid glaze');
  });

  it('rejects quantity outside 1 to 12', async () => {
    // 0 is invalid
    const resZero = await request(app)
      .post('/api/pottery')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        itemId: 'i-01',
        glazeId: 'g-01',
        quantity: 0,
        neededByDate: addDays(20),
      });
    expect(resZero.status).toBe(400);
    expect(resZero.body.error).toContain('between 1 and 12');

    // 13 is invalid
    const res13 = await request(app)
      .post('/api/pottery')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        itemId: 'i-01',
        glazeId: 'g-01',
        quantity: 13,
        neededByDate: addDays(20),
      });
    expect(res13.status).toBe(400);
    expect(res13.body.error).toContain('between 1 and 12');
  });

  it('rejects needed-by date less than 14 days away', async () => {
    const res = await request(app)
      .post('/api/pottery')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        itemId: 'i-02',
        glazeId: 'g-02',
        quantity: 2,
        neededByDate: addDays(10), // only 10 days away
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('at least 14 days');
  });

  it('customer can edit request while status is requested', async () => {
    const createRes = await request(app)
      .post('/api/pottery')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        itemId: 'i-03',
        glazeId: 'g-04',
        quantity: 4,
        neededByDate: addDays(18),
      });
    expect(createRes.status).toBe(201);
    const reqId = createRes.body.request.id;

    // Customer edits
    const editRes = await request(app)
      .put(`/api/pottery/${reqId}`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        itemId: 'i-04', // change to Diya set
        quantity: 10,
        neededByDate: addDays(25),
      });

    expect(editRes.status).toBe(200);
    expect(editRes.body.request.itemName).toBe('Diya set');
    expect(editRes.body.request.quantity).toBe(10);
  });

  it('customer can cancel request while status is requested', async () => {
    const createRes = await request(app)
      .post('/api/pottery')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        itemId: 'i-05',
        glazeId: 'g-05',
        quantity: 2,
        neededByDate: addDays(22),
      });
    expect(createRes.status).toBe(201);
    const reqId = createRes.body.request.id;

    const cancelRes = await request(app)
      .put(`/api/pottery/${reqId}/cancel`)
      .set('Authorization', `Bearer ${customerToken}`);

    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.request.status).toBe('cancelled');
  });

  it('studio accepts request and customer is blocked from editing or cancelling', async () => {
    const createRes = await request(app)
      .post('/api/pottery')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        itemId: 'i-02',
        glazeId: 'g-06',
        quantity: 5,
        neededByDate: addDays(28),
      });
    expect(createRes.status).toBe(201);
    const reqId = createRes.body.request.id;

    // Studio accepts request
    const acceptRes = await request(app)
      .put(`/api/pottery/${reqId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'accepted' });

    expect(acceptRes.status).toBe(200);
    expect(acceptRes.body.request.status).toBe('accepted');

    // Customer attempts to edit accepted request -> must be rejected with 400!
    const editRes = await request(app)
      .put(`/api/pottery/${reqId}`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ quantity: 12 });

    expect(editRes.status).toBe(400);
    expect(editRes.body.error).toContain('only be edited or cancelled while in \'requested\' status');

    // Customer attempts to cancel accepted request -> must be rejected with 400!
    const cancelRes = await request(app)
      .put(`/api/pottery/${reqId}/cancel`)
      .set('Authorization', `Bearer ${customerToken}`);

    expect(cancelRes.status).toBe(400);
    expect(cancelRes.body.error).toContain('only be edited or cancelled while in \'requested\' status');
  });

  it('studio declines request and customer cannot cancel or edit it', async () => {
    const createRes = await request(app)
      .post('/api/pottery')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        itemId: 'i-01',
        glazeId: 'g-01',
        quantity: 1,
        neededByDate: addDays(30),
      });
    expect(createRes.status).toBe(201);
    const reqId = createRes.body.request.id;

    // Studio declines request
    const declineRes = await request(app)
      .put(`/api/pottery/${reqId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'declined' });

    expect(declineRes.status).toBe(200);
    expect(declineRes.body.request.status).toBe('declined');

    // Customer attempts to cancel declined request -> must be rejected with 400!
    const cancelRes = await request(app)
      .put(`/api/pottery/${reqId}/cancel`)
      .set('Authorization', `Bearer ${customerToken}`);

    expect(cancelRes.status).toBe(400);
  });
});
