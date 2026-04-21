# 📅 Appointment — Melon
 
[![TypeScript](https://img.shields.io/badge/TypeScript-97%25-blue)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/Licencia-Propietaria-red)](./LICENSE)
[![Platform](https://img.shields.io/badge/Platform-iOS%20%7C%20Android-lightgrey)](https://expo.dev)
[![Backend](https://img.shields.io/badge/Backend-NestJS-red)](https://nestjs.com/)
[![Database](https://img.shields.io/badge/Database-PostgreSQL-blue)](https://www.postgresql.org/)
 
**Melon** es una aplicación móvil moderna para la gestión y reserva de citas, diseñada para conectar negocios y clientes en un solo flujo simple e intuitivo.
 
> 📱 **[Ver demo en Expo →](https://expo.dev/preview/update?message=demo+melon&updateRuntimeVersion=0.1.0&createdAt=2026-04-11T20%3A12%3A19.807Z&slug=melon&projectId=7b2a1627-3bee-4a94-af6d-6fc5dcbd58a9&group=152d35c7-ae9e-4d64-9e48-946176f7dbf6)**
 
> Escanea el QR con **Expo Go** para probar la app en tu celular.
 
---
 
## ✨ Características
 
- 👤 **Modo dual** — el usuario elige entre modo Cliente o modo Empresa desde la misma app
- 📆 **Reserva de citas** — flujo simple e intuitivo para agendar y gestionar citas
- 🏢 **Panel de empresa** — gestión de disponibilidad, clientes y agenda
- 🔔 **Notificaciones** — recordatorios automáticos de citas
- 🔐 **Autenticación segura** — OAuth + JWT
 
---
 
## 🛠️ Stack Tecnológico
 
| Capa | Tecnología |
|---|---|
| App Móvil | Expo React Native (TypeScript) |
| Backend API | NestJS (TypeScript) |
| Base de datos | PostgreSQL via Prisma |
| Autenticación | OAuth 2.0 + JWT |
| Contenedores | Docker + Docker Compose |
| Arquitectura | Monorepo (npm workspaces) |
 
---
 
## 📁 Estructura del Monorepo
 
```
Appointment./
├── apps/
│   └── app/          # Expo React Native — App móvil
├── services/
│   └── api/          # NestJS API + Prisma
├── docs/             # Documentación
├── docker-compose.yml
└── package.json      # Workspace root
```
 
---
 
## ⚙️ Requisitos
 
- Node.js 20+
- npm 10+ (workspaces)
- PostgreSQL (local vía Docker, o Supabase/RDS)
 
---
 
## 🚀 Inicio rápido (local)
 
**1. Instalar dependencias:**
```bash
npm install
```
 
**2. Levantar Postgres local:**
```bash
docker compose up -d db
```
 
**3. Configurar variables de entorno:**
```bash
cp services/api/.env.example services/api/.env
```
 
Para OAuth en la app móvil, crea un archivo `.env` en la raíz:
```env
EXPO_PUBLIC_API_BASE_URL=http://localhost:3000
EXPO_PUBLIC_OAUTH_ISSUER=your-oauth-provider-url
EXPO_PUBLIC_OAUTH_CLIENT_ID=your-client-id
EXPO_PUBLIC_OAUTH_AUDIENCE=your-api-audience
EXPO_PUBLIC_OAUTH_EXCHANGE_URL=http://localhost:3000/auth/oauth/exchange
```
 
**4. Migrar base de datos:**
```bash
npm run prisma:migrate
```
 
**5. Correr el backend:**
```bash
npm run api:dev
```
 
**6. Correr la app móvil:**
```bash
npm run app:dev
```
 
---
 
## 🌐 Deploy
 
**Backend (API):**
- Desplegado en Fly.io
- Base de datos en PostgreSQL (Supabase/RDS)
- Ajustar `DATABASE_URL` y secretos en las variables de entorno
 
**App Móvil:**
- Publicada en Expo — disponible vía QR con Expo Go
- Build nativo con EAS para distribución en App Store / Google Play
 
---
 
## 👨‍💻 Autor
 
**Diego Alonso Vargas Almengor**
- GitHub: [@Dvargas2332](https://github.com/Dvargas2332)
- LinkedIn: [Diego Vargas](https://www.linkedin.com/in/diego-vargas-almengor-5ba024240/)
- Email: vargas.almengor@gmail.com
 
---
 
## 📄 Licencia — Propietaria
 
**© 2025-2026 Diego Alonso Vargas Almengor. Todos los derechos reservados.**
 
El código de este repositorio es propietario. No se concede licencia para usar, copiar, modificar ni distribuir sin consentimiento escrito del titular. Para usos comerciales o cualquier redistribución se requiere un acuerdo previo y por escrito.
 
Ver archivo [LICENSE](./LICENSE) para los términos completos.