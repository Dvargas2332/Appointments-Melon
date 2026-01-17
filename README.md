# Appointment (Schedly)

Schedly es una aplicación moderna de gestión y reserva de citas diseñada para conectar negocios y clientes en un solo flujo simple e intuitivo.

## Monorepo
- `apps/app`     – Expo React Native (TypeScript) una sola app: el usuario elige modo Cliente o Empresa.
- `services/api` – NestJS (TypeScript) API + Prisma (PostgreSQL).

## Requisitos
- Node.js 20+
- npm 10+ (workspaces)
- PostgreSQL (local vía Docker, o Supabase/RDS)

## Inicio rápido (local)
1) Instalar dependencias:
```bash
npm install
```

2) Levantar Postgres local:
```bash
docker compose up -d db
```

3) Configurar variables:
```bash
cp services/api/.env.example services/api/.env
```

4) Migrar Prisma y generar cliente:
```bash
npm run prisma:migrate
```

5) Correr API:
```bash
npm run api:dev
```

6) Correr app móvil:
```bash
npm run app:dev
```

## Notas de despliegue (alto nivel)
- `services/api` se puede desplegar como contenedor (ECS Fargate/Elastic Beanstalk).
- Base de datos en PostgreSQL (RDS/Supabase).
- Ajustar `DATABASE_URL` y secretos en las variables de entorno del servicio.
