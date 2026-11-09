const {
  Booking,
  connect,
  disconnect,
  createEvent,
  createUsers,
  book,
  availableTickets,
  waitFor,
} = require('./helpers');

beforeAll(connect);
afterAll(disconnect);

const countBookings = (eventId) => Booking.countDocuments({ eventId });

describe('Overselling (the main point of the project)', () => {
  it('never sells more tickets than exist: 50 users, 10 tickets', async () => {
    const eventId = await createEvent(10);
    const users = await createUsers(50);

    const results = await Promise.all(users.map((u) => book(eventId, u.token)));
    const statuses = results.map((r) => r.statusCode);

    expect(statuses.filter((s) => s === 202)).toHaveLength(10);
    expect(statuses.filter((s) => s === 400)).toHaveLength(40);

    // the worker saves the accepted bookings in MongoDB
    expect(await waitFor(async () => (await countBookings(eventId)) === 10)).toBe(true);
    expect(await availableTickets(eventId)).toBe(0);
  });

  it('multi-ticket bookings are atomic: 30 users x 3 tickets on 10 tickets', async () => {
    const eventId = await createEvent(10);
    const users = await createUsers(30);

    const results = await Promise.all(users.map((u) => book(eventId, u.token, 3)));
    const accepted = results.filter((r) => r.statusCode === 202).length;

    expect(accepted).toBe(3); // floor(10 / 3)
    expect(await availableTickets(eventId)).toBe(1); // never negative
    expect(await waitFor(async () => (await countBookings(eventId)) === 3)).toBe(true);
  });
});

describe('Rule 1: a booking has 1 to 4 tickets', () => {
  it.each([0, 5, -1, 'abc'])('rejects quantity %p and takes no ticket', async (quantity) => {
    const eventId = await createEvent(10);
    const [user] = await createUsers(1);

    const res = await book(eventId, user.token, quantity);

    expect(res.statusCode).toBeGreaterThanOrEqual(400);
    expect(res.statusCode).toBeLessThan(500);
    expect(await availableTickets(eventId)).toBe(10);
  });

  it('accepts 4 tickets', async () => {
    const eventId = await createEvent(10);
    const [user] = await createUsers(1);

    const res = await book(eventId, user.token, 4);

    expect(res.statusCode).toBe(202);
    expect(await availableTickets(eventId)).toBe(6);
  });
});

describe('Rule 2: one active booking per user per event', () => {
  it('answers 409 when the user already has a saved booking', async () => {
    const eventId = await createEvent(10);
    const [user] = await createUsers(1);

    expect((await book(eventId, user.token)).statusCode).toBe(202);
    expect(await waitFor(async () => (await countBookings(eventId)) === 1)).toBe(true);

    const second = await book(eventId, user.token);
    expect(second.statusCode).toBe(409);
    expect(await availableTickets(eventId)).toBe(9);
  });

  it('the unique index holds when the same user sends requests at the same time', async () => {
    const eventId = await createEvent(10);
    const [user] = await createUsers(1);

    const results = await Promise.all(
      Array.from({ length: 5 }, () => book(eventId, user.token)),
    );
    results.forEach((r) => expect([202, 409]).toContain(r.statusCode));

    // eventually: 1 booking, and every extra ticket went back to the stock
    const settled = await waitFor(
      async () =>
        (await countBookings(eventId)) === 1 &&
        (await availableTickets(eventId)) === 9,
      { timeout: 15000 },
    );
    expect(settled).toBe(true);
  });
});

describe('Idempotency-Key', () => {
  it('the same key twice returns the same answer and takes one ticket', async () => {
    const eventId = await createEvent(10);
    const [user] = await createUsers(1);
    const key = 'same-key-for-both';

    const first = await book(eventId, user.token, 1, key);
    const second = await book(eventId, user.token, 1, key);

    expect(first.statusCode).toBe(202);
    expect(second.statusCode).toBe(202);
    expect(second.body).toEqual(first.body);

    expect(await waitFor(async () => (await countBookings(eventId)) === 1)).toBe(true);
    expect(await availableTickets(eventId)).toBe(9);
  });
});

describe('Auth and rate limit', () => {
  it('rejects a booking without a token', async () => {
    const eventId = await createEvent(10);
    const res = await book(eventId, null);
    expect(res.statusCode).toBe(401);
    expect(await availableTickets(eventId)).toBe(10);
  });

  it('rejects a booking with a bad token', async () => {
    const eventId = await createEvent(10);
    const res = await book(eventId, 'not-a-real-token');
    expect(res.statusCode).toBe(401);
  });

  it('answers 429 after 20 booking requests in a minute from one user', async () => {
    const eventId = await createEvent(1000);
    const [user] = await createUsers(1);

    const statuses = [];
    for (let i = 0; i < 25; i++) {
      statuses.push((await book(eventId, user.token)).statusCode);
    }

    expect(statuses.indexOf(429)).toBeGreaterThanOrEqual(20);
  });
});
