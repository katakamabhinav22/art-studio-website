import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { db } from '../src/db/db.js';
import { setupTestEnvironment, loginAsAdmin, registerCustomer, addDays } from './test_helpers.js';

describe('Wall Painting Booking & Cancellation Tests', () => {
  let adminToken: string;
  let customerToken: string;
  let customer2Token: string;

  beforeAll(async () => {
    await setupTestEnvironment();

    const admin = await loginAsAdmin();
    adminToken = admin.token;

    const c1 = await registerCustomer('Booking Customer 1', `wall_c1_${Date.now()}@example.com`);
    customerToken = c1.token;

    const c2 = await registerCustomer('Booking Customer 2', `wall_c2_${Date.now()}@example.com`);
    customer2Token = c2.token;
  });

  it('calculates price accurately (wallSize * 150) and creates booking', async () => {
    const targetDate = addDays(14);
    const wallSize = 100;
    const expectedPrice = 100 * 150; // 15,000 INR

    const res = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        bookingDate: targetDate,
        wallSizeSqFt: wallSize,
        address: '742 Evergreen Terrace, Springfield',
      });

    expect(res.status).toBe(201);
    expect(res.body.booking).toBeDefined();
    expect(res.body.booking.price).toBe(expectedPrice);
    expect(res.body.booking.ratePerSqFt).toBe(150);
    expect(res.body.booking.status).toBe('requested');
  });

  it('rejects booking date less than 7 days from today', async () => {
    const invalidDate = addDays(5); // only 5 days away

    const res = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        bookingDate: invalidDate,
        wallSizeSqFt: 50,
        address: 'Near Studio',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('between 7 and 90 days');
  });

  it('rejects booking date more than 90 days from today', async () => {
    const invalidDate = addDays(95); // 95 days away

    const res = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        bookingDate: invalidDate,
        wallSizeSqFt: 50,
        address: 'Far Future Lane',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('between 7 and 90 days');
  });

  it('rejects wall size less than 10 sq ft', async () => {
    const res = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        bookingDate: addDays(20),
        wallSizeSqFt: 8, // too small
        address: 'Small Wall',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('between 10 and 500');
  });

  it('rejects wall size greater than 500 sq ft', async () => {
    const res = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        bookingDate: addDays(20),
        wallSizeSqFt: 550, // too large
        address: 'Giant Wall',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('between 10 and 500');
  });

  it('prevents duplicate bookings on the same date', async () => {
    const date = addDays(35);

    // First booking on date
    const res1 = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        bookingDate: date,
        wallSizeSqFt: 50,
        address: 'First Address',
      });
    expect(res1.status).toBe(201);

    // Second booking on exact same date by another customer
    const res2 = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${customer2Token}`)
      .send({
        bookingDate: date,
        wallSizeSqFt: 75,
        address: 'Second Address',
      });

    expect(res2.status).toBe(409);
    expect(res2.body.error).toMatch(/already.*booked/i);
  });

  it('allows customer to cancel booking when >= 3 days away', async () => {
    const date = addDays(21);

    const bookRes = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        bookingDate: date,
        wallSizeSqFt: 40,
        address: 'Cancellable Address',
      });
    expect(bookRes.status).toBe(201);
    const bookingId = bookRes.body.booking.id;

    // Cancel booking (21 days away > 3 days)
    const cancelRes = await request(app)
      .put(`/api/bookings/${bookingId}/cancel`)
      .set('Authorization', `Bearer ${customerToken}`);

    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.booking.status).toBe('cancelled');

    // Date can now be booked by customer 2!
    const rebookRes = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${customer2Token}`)
      .send({
        bookingDate: date,
        wallSizeSqFt: 45,
        address: 'New Customer Address',
      });
    expect(rebookRes.status).toBe(201);
  });

  it('rejects cancellation when less than 3 days before the date', async () => {
    // We insert a booking directly into DB with booking_date = addDays(2) to test cutoff rule
    const shortNoticeDate = addDays(2);
    const bookingId = 'test-short-notice-booking';
    const c1 = db.prepare("SELECT id FROM users WHERE email LIKE 'wall_c1_%'").get() as any;

    db.prepare(`
      INSERT INTO wall_bookings (id, customer_id, booking_date, wall_size_sqft, address, rate_per_sqft, price, status)
      VALUES (?, ?, ?, 50, 'Short Notice House', 150, 7500, 'requested')
    `).run(bookingId, c1.id, shortNoticeDate);

    // Customer tries to cancel booking only 2 days away
    const res = await request(app)
      .put(`/api/bookings/${bookingId}/cancel`)
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('until 3 days before');
  });

  it('administrator can confirm and decline bookings', async () => {
    const date = addDays(40);
    const bookRes = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        bookingDate: date,
        wallSizeSqFt: 120,
        address: 'Admin Confirm Lane',
      });
    expect(bookRes.status).toBe(201);
    const bookingId = bookRes.body.booking.id;

    // Admin confirms
    const confirmRes = await request(app)
      .put(`/api/bookings/${bookingId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'confirmed' });

    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.booking.status).toBe('confirmed');

    // Admin declines another booking
    const date2 = addDays(45);
    const bookRes2 = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        bookingDate: date2,
        wallSizeSqFt: 80,
        address: 'Admin Decline Lane',
      });
    expect(bookRes2.status).toBe(201);
    const bookingId2 = bookRes2.body.booking.id;

    const declineRes = await request(app)
      .put(`/api/bookings/${bookingId2}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'declined' });

    expect(declineRes.status).toBe(200);
    expect(declineRes.body.booking.status).toBe('declined');
  });
});
