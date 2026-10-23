// Usage:
//    node scripts/loadtest.js --smoke    (small trial run, just to check the script works)
//    node scripts/loadtest.js stage1     (the real run; the argument is only a label for the result file)

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const autocannon = require('autocannon');
const mongoose = require('mongoose');

const Event = require('../models/eventModel');
const Booking = require('../models/bookingModel');

// ---- Test settings: DO NOT change these between stages ----
const TOTAL_TICKETS = 1000;
const AMOUNT = 5000; // total number of requests
const CONNECTIONS = 200; // concurrent connections
const PRICE_CENTS = 5000;
// -----------------------------------------------------------

const API_URL = process.env.API_URL || 'http://localhost:3000';
const MONGO_URI =
  process.env.MONGO_URI || 'mongodb://localhost:27017/flash-sale';

const args = process.argv.slice(2);
const SMOKE = args.includes('--smoke');
const label = args.find((a) => !a.startsWith('--')) || 'stage1';

const amount = SMOKE ? 50 : AMOUNT;
const connections = SMOKE ? 5 : CONNECTIONS;

// A valid MongoDB ObjectId is 24 hex characters (12 random bytes)
const randomObjectId = () => crypto.randomBytes(12).toString('hex');

// 1) Create a fresh event for this run
async function createEvent() {
  // Fixed route prefix to match app.use('/api/v1/events', eventRouter)
  const res = await fetch(`${API_URL}/api/v1/events`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: `loadtest-${Date.now()}`,
      totalTickets: TOTAL_TICKETS,
      priceCents: PRICE_CENTS,
    }),
  });

  if (!res.ok) {
    throw new Error(
      `Could not create event: ${res.status} ${await res.text()}`,
    );
  }

  const json = await res.json();
  return json.data.event._id;
}

// 2) Fire the requests
function runLoad(eventId) {
  // Fixed route prefix to match app.use('/api/v1/events', eventRouter)
  const bookingPath = `/api/v1/events/${eventId}/book`;

  return autocannon({
    url: `${API_URL}${bookingPath}`,
    connections,
    amount,
    requests: [
      {
        method: 'POST',
        path: bookingPath,
        headers: { 'content-type': 'application/json' },
        // runs before EVERY request, so every request gets a different userId
        setupRequest: (request) => {
          request.body = JSON.stringify({
            userId: randomObjectId(),
            quantity: 1,
          });
          return request;
        },
      },
    ],
  });
}

async function main() {
  await mongoose.connect(MONGO_URI);

  const eventId = await createEvent();
  console.log(
    `Event ${eventId} created. Running ${amount} requests on ${connections} connections...`,
  );

  const result = await runLoad(eventId);
  process.stdout.write(autocannon.printResult(result));

  // 3) Verify what really happened in the database
  const agg = await Booking.aggregate([
    { $match: { eventId: new mongoose.Types.ObjectId(eventId) } },
    {
      $group: {
        _id: null,
        bookings: { $sum: 1 },
        tickets: { $sum: '$quantity' },
      },
    },
  ]);
  const { bookings = 0, tickets = 0 } = agg[0] || {};
  const event = await Event.findById(eventId);

  const stats = result.statusCodeStats || {};
  const created201 = Number(stats['201']?.count || 0);
  const rejected400 = Number(stats['400']?.count || 0);

  const summary = {
    label,
    smoke: SMOKE,
    eventId,
    settings: { totalTickets: TOTAL_TICKETS, amount, connections },
    reqPerSec: result.requests.average,
    avgLatencyMs: result.latency.average,
    p99LatencyMs: result.latency.p99,
    durationSec: result.duration,
    errors: result.errors,
    timeouts: result.timeouts,
    non2xx: result.non2xx,
    created201,
    rejected400,
    bookingsInDb: bookings,
    ticketsBookedInDb: tickets,
    availableTicketsFinal: event.availableTickets,
    oversold: Math.max(0, tickets - TOTAL_TICKETS),
    // 0 means the stock counter matches the bookings; above 0 means lost updates
    stockMismatch: tickets + event.availableTickets - TOTAL_TICKETS,
  };

  console.log('\n=== SUMMARY ===');
  console.log(summary);

  // 4) Save the raw result
  const dir = path.join(__dirname, '..', 'results');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(
    dir,
    `${label}${SMOKE ? '-smoke' : ''}-${Date.now()}.json`,
  );
  fs.writeFileSync(file, JSON.stringify({ summary, raw: result }, null, 2));
  console.log(`Saved to ${file}`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});