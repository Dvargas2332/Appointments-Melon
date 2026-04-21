# Etapa de dependencias
FROM node:20-alpine AS builder

WORKDIR /app

# Copiamos archivos de configuración
COPY package*.json ./
COPY tsconfig.json ./
COPY prisma ./prisma/

# Instalamos TODAS las dependencias para poder construir
RUN npm install

# Copiamos el código fuente
COPY src ./src/

# Generamos el cliente de Prisma y construimos el proyecto
RUN npx prisma generate
RUN npm run build

# --- Etapa de producción ---
FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000

# Comando para correr migraciones y encender la app
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
