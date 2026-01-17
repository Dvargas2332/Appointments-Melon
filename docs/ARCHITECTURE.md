# Architecture (MVP)

- Single mobile app (Expo React Native) with two modes: Customer and Business.
- Single API (NestJS) with Prisma + PostgreSQL.
- All scheduling/collision logic lives in the API.

## Key design rules
- Store appointment times in UTC
- Render times in Asia/Tokyo on clients
- Booking is validated server-side to prevent double-booking
