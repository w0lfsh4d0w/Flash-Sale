const {
  request,
  app,
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

const pay = (bookingId, token) =>
  request(app)
    .post(`/api/v1/bookings/${bookingId}/pay`)
    .set('Authorization', `Bearer ${token}`);

// Book 1 ticket and wait until the worker has saved it as `reserved`.
async function reservedBooking(totalTickets = 10) {
  const eventId = await createEvent(totalTickets);
  const [user] = await createUsers(1);
  expect((await book(eventId, user.token)).statusCode).toBe(202);
  expect(
    await waitFor(async () => (await Booking.countDocuments({ eventId })) === 1),
  ).toBe(true);
  const booking = await Booking.findOne({ eventId });
  return { eventId, user, booking };
}

describe('Rule 3: reservations and payment', () => {
  it('a new booking is reserved with an expiry about 5 minutes ahead', async () => {
    const { booking } = await reservedBooking();

    expect(booking.status).toBe('reserved');
    const minutes = (booking.expiresAt - Date.now()) / 60000;
    expect(minutes).toBeGreaterThan(4);
    expect(minutes).toBeLessThanOrEqual(5);
  });

  it('paying turns reserved into confirmed, and paying twice is refused', async () => {
    const { booking, user } = await reservedBooking();

    const first = await pay(booking._id, user.token);
    expect(first.statusCode).toBe(200);
    expect((await Booking.findById(booking._id)).status).toBe('confirmed');

    const second = await pay(booking._id, user.token);
    expect(second.statusCode).toBe(409);
  });

  it("a user can't pay someone else's booking", async () => {
    const { booking } = await reservedBooking();
    const [other] = await createUsers(1);

    const res = await pay(booking._id, other.token);

    expect(res.statusCode).toBeGreaterThanOrEqual(400);
    expect(res.statusCode).toBeLessThan(500);
    expect((await Booking.findById(booking._id)).status).toBe('reserved');
  });

  it("an expired reservation can't be paid", async () => {
    const { booking, user } = await reservedBooking();
    await Booking.updateOne(
      { _id: booking._id },
      { expiresAt: new Date(Date.now() - 1000) },
    );

    const res = await pay(booking._id, user.token);

    expect(res.statusCode).toBe(409);
    expect((await Booking.findById(booking._id)).status).not.toBe('confirmed');
  });

  it(
    'the expiry job marks it expired and gives the ticket back (waits up to ~45 s)',
    async () => {
      const { eventId, booking } = await reservedBooking(10);
      expect(await availableTickets(eventId)).toBe(9);

      await Booking.updateOne(
        { _id: booking._id },
        { expiresAt: new Date(Date.now() - 1000) },
      );

      const done = await waitFor(
        async () =>
          (await Booking.findById(booking._id)).status === 'expired' &&
          (await availableTickets(eventId)) === 10,
        { timeout: 45000, interval: 500 },
      );

      expect(done).toBe(true);
      // rule 4: never above the total
      expect(await availableTickets(eventId)).toBe(10);
    },
    60000,
  );
});
