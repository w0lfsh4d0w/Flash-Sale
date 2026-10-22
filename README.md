# Flash-Sale

A backend API for booking tickets to events, built to survive the moment when thousands of people hit "book" at the same time on a limited number of tickets.

> 🚧 Work in progress. I'm building this stage by stage and measuring every step.

## Why I'm building this

Selling 1,000 tickets to 10,000 people at once looks easy until two requests read "1 ticket left" at the same moment and both buy it. That's called overselling, and it's the problem this project is about.

I'm starting with a naive version on purpose, measuring how bad it gets, and then fixing it step by step with Redis, queues, and Docker. Every stage gets real numbers, so I can prove each change actually helped.

## Business Rules

1. **A booking can have 1 to 4 tickets.** Booking more than one ticket at a time forces the stock check and the decrease to happen as one atomic step, which is where the interesting problems start.
2. **A user can have one active booking per event.** Active means reserved or confirmed. This stops one person from grabbing all the stock, and it means the same request sent twice must not create two bookings.
3. **A reservation expires after 5 minutes.** If the user doesn't pay in time, the tickets go back to the available stock.
4. **Available tickets can never go below 0 or above the total.**

## Data Model

![ERD](docs/Flash_Sale.png)

- **User**: who is booking.
- **Event**: what is being sold, with the total tickets, the available tickets, and the price.
- **Booking**: connects a user to an event, with the quantity, total price, status, and expiry time.

Booking status can be `reserved`, `confirmed`, `expired`, or `cancelled`. All prices are stored as integers in cents, never floats.

Field names in the code are camelCase (`availableTickets`, `priceCents`), while the diagram above uses snake_case.

## API

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/events` | Create an event (`name`, `totalTickets`, `priceCents`) |
| GET | `/events/:id` | Get an event and its available tickets |
| POST | `/events/:id/book` | Book tickets (`userId`, `quantity` from 1 to 4) |

All errors return a consistent JSON response (`status` and `message`).

## Tech Stack

Node.js, Express 5, MongoDB (Mongoose), Redis, BullMQ, Docker.

## Stages

| # | Stage | Status |
|---|-------|--------|
| 1 | Naive booking + baseline numbers | In progress (API done, benchmark next) |
| 2 | Atomic update in MongoDB | Not started |
| 3 | Redis for stock and caching | Not started |
| 4 | BullMQ queues and workers | Not started |
| 5 | Reservations, events, mock payment | Not started |
| 6 | Docker Compose, nginx, CI/CD, deploy | Not started |
| 7 | Tests, logging, final benchmarks | Not started |

## Known limitations (current stage)

- There is no login yet. `userId` comes from the request body and isn't checked against a real user. Authentication comes in stage 5.
- The booking logic is naive on purpose (read, check, write). Overselling under concurrent load is expected, and it's the baseline the next stages improve.
- Only the first rule of the business rules is enforced for now. The others come in later stages.

## How I measure

- The API and MongoDB both run in Docker, and I keep the same setup in every stage so the numbers are comparable.
- I run the benchmark with `NODE_ENV=production` so request logging doesn't affect the results.
- The data is reset before every run, and each result is the average of 3 runs.

## Results

Same test every time: 1,000 tickets, 5,000 concurrent requests, each from a different user.

| Stage | req/sec | p99 latency | Errors | Bookings / Tickets |
|-------|---------|-------------|--------|--------------------|
| 1. Naive | - | - | - | - |
| 2. Mongo atomic | - | - | - | - |
| 3. Redis | - | - | - | - |

## Running the project

```bash
docker compose up --build
```

The API runs on `http://localhost:3000`. Create a `config.env` file first (see `config.example.env`).