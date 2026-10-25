import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { setupTestEnvironment, loginAsAdmin, registerCustomer, addDays } from './test_helpers.js';

describe('RBAC & HTTP 401 / 403 / 404 Status Tests', () => {
  let adminToken: string;
  let customer1Token: string;
  let customer1Id: string;
  let customer2Token: string;
  let customer2Id: string;

  beforeAll(async () => {
    await setupTestEnvironment();

    const admin = await loginAsAdmin();
    adminToken = admin.token;

    const c1 = await registerCustomer('Customer One', `cust1_${Date.now()}@example.com`);
    customer1Token = c1.token;
    customer1Id = c1.user.id;

    const c2 = await registerCustomer('Customer Two', `cust2_${Date.now()}@example.com`);
    customer2Token = c2.token;
    customer2Id = c2.user.id;
  });

  it('unauthenticated requests receive HTTP 401', async () => {
    // 1. Orders
    const resOrders = await request(app).get('/api/orders');
    expect(resOrders.status).toBe(401);

    // 2. Bookings
    const resBookings = await request(app).get('/api/bookings');
    expect(resBookings.status).toBe(401);

    // 3. Pottery
    const resPottery = await request(app).get('/api/pottery');
    expect(resPottery.status).toBe(401);

    // 4. Painting add
    const resAddPainting = await request(app).post('/api/paintings').send({ title: 'T' });
    expect(resAddPainting.status).toBe(401);

    // 5. Auth me
    const resMe = await request(app).get('/api/auth/me');
    expect(resMe.status).toBe(401);
  });

  it('customer requesting administrator actions receives HTTP 403', async () => {
    // Customer cannot add a painting
    const resAdd = await request(app)
      .post('/api/paintings')
      .set('Authorization', `Bearer ${customer1Token}`)
      .send({
        title: 'Unauthorized Painting',
        artist: 'Customer',
        description: 'Test',
        price: 5000,
      });
    expect(resAdd.status).toBe(403);

    // Customer cannot edit a painting
    const resEdit = await request(app)
      .put('/api/paintings/p-001')
      .set('Authorization', `Bearer ${customer1Token}`)
      .send({ price: 1000 });
    expect(resEdit.status).toBe(403);

    // Customer cannot confirm or decline a booking
    const resConfirmBooking = await request(app)
      .put('/api/bookings/fake-id/status')
      .set('Authorization', `Bearer ${customer1Token}`)
      .send({ status: 'confirmed' });
    expect(resConfirmBooking.status).toBe(403);

    // Customer cannot accept or decline a pottery request
    const resAcceptPottery = await request(app)
      .put('/api/pottery/fake-id/status')
      .set('Authorization', `Bearer ${customer1Token}`)
      .send({ status: 'accepted' });
    expect(resAcceptPottery.status).toBe(403);
  });

  it('administrator performing customer actions receives HTTP 403', async () => {
    // Admin cannot buy a painting
    const resBuy = await request(app)
      .post('/api/paintings/p-001/purchase')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(resBuy.status).toBe(403);

    // Admin cannot book a wall painting date
    const resBook = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        bookingDate: addDays(15),
        wallSizeSqFt: 50,
        address: '123 Admin Lane',
      });
    expect(resBook.status).toBe(403);

    // Admin cannot request custom pottery
    const resPottery = await request(app)
      .post('/api/pottery')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        itemId: 'i-01',
        glazeId: 'g-01',
        quantity: 2,
        neededByDate: addDays(20),
      });
    expect(resPottery.status).toBe(403);

    // Admin cannot cancel a customer order
    const resCancelOrder = await request(app)
      .put('/api/orders/fake-id/cancel')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(resCancelOrder.status).toBe(403);

    // Admin cannot cancel a customer booking
    const resCancelBooking = await request(app)
      .put('/api/bookings/fake-id/cancel')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(resCancelBooking.status).toBe(403);

    // Admin cannot cancel a customer pottery request
    const resCancelPottery = await request(app)
      .put('/api/pottery/fake-id/cancel')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(resCancelPottery.status).toBe(403);
  });

  it('customer requesting another customer private record receives HTTP 404', async () => {
    // Customer 1 buys painting p-002
    const buyRes = await request(app)
      .post('/api/paintings/p-002/purchase')
      .set('Authorization', `Bearer ${customer1Token}`);
    expect(buyRes.status).toBe(201);
    const orderId = buyRes.body.order.id;

    // Customer 2 attempts to view Customer 1's order -> must receive HTTP 404!
    const getRes = await request(app)
      .get(`/api/orders/${orderId}`)
      .set('Authorization', `Bearer ${customer2Token}`);
    expect(getRes.status).toBe(404);

    // Customer 2 attempts to cancel Customer 1's order -> must receive HTTP 404!
    const cancelRes = await request(app)
      .put(`/api/orders/${orderId}/cancel`)
      .set('Authorization', `Bearer ${customer2Token}`);
    expect(cancelRes.status).toBe(404);

    // Customer 1 creates a booking
    const bookRes = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${customer1Token}`)
      .send({
        bookingDate: addDays(25),
        wallSizeSqFt: 60,
        address: 'Customer 1 House',
      });
    expect(bookRes.status).toBe(201);
    const bookingId = bookRes.body.booking.id;

    // Customer 2 attempts to view Customer 1's booking -> must receive HTTP 404!
    const getBookingRes = await request(app)
      .get(`/api/bookings/${bookingId}`)
      .set('Authorization', `Bearer ${customer2Token}`);
    expect(getBookingRes.status).toBe(404);

    // Customer 2 attempts to cancel Customer 1's booking -> must receive HTTP 404!
    const cancelBookingRes = await request(app)
      .put(`/api/bookings/${bookingId}/cancel`)
      .set('Authorization', `Bearer ${customer2Token}`);
    expect(cancelBookingRes.status).toBe(404);

    // Customer 1 creates a pottery request
    const potRes = await request(app)
      .post('/api/pottery')
      .set('Authorization', `Bearer ${customer1Token}`)
      .send({
        itemId: 'i-01',
        glazeId: 'g-01',
        quantity: 3,
        neededByDate: addDays(30),
      });
    expect(potRes.status).toBe(201);
    const potteryId = potRes.body.request.id;

    // Customer 2 attempts to view Customer 1's pottery request -> must receive HTTP 404!
    const getPotteryRes = await request(app)
      .get(`/api/pottery/${potteryId}`)
      .set('Authorization', `Bearer ${customer2Token}`);
    expect(getPotteryRes.status).toBe(404);

    // Customer 2 attempts to edit Customer 1's pottery request -> must receive HTTP 404!
    const editPotteryRes = await request(app)
      .put(`/api/pottery/${potteryId}`)
      .set('Authorization', `Bearer ${customer2Token}`)
      .send({ quantity: 5 });
    expect(editPotteryRes.status).toBe(404);

    // Customer 2 attempts to cancel Customer 1's pottery request -> must receive HTTP 404!
    const cancelPotteryRes = await request(app)
      .put(`/api/pottery/${potteryId}/cancel`)
      .set('Authorization', `Bearer ${customer2Token}`);
    expect(cancelPotteryRes.status).toBe(404);
  });
});
