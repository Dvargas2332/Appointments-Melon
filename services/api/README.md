# API (NestJS + Prisma)

## Local run
```bash
cp .env.example .env
npm install
npm run prisma:migrate
npm run build
node dist/main.js
```

Health:
- GET /health
