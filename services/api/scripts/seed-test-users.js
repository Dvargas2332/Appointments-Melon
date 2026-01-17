// Crea usuarios de prueba: admin (negocio) y cliente (cliente)
// Usa upsert para evitar duplicados si ya existen.
const { PrismaClient } = require("@prisma/client");
const { hash } = require("bcryptjs");
require("dotenv").config();

const prisma = new PrismaClient();

async function upsertBusinessUser() {
  const passwordHash = await hash("1234", 10);
  return prisma.userBusiness.upsert({
    where: { email: "admin@yoyakuo.test" },
    update: {
      name: "admin",
      password: passwordHash,
      role: "BUSINESS_OWNER",
    },
    create: {
      name: "admin",
      email: "admin@yoyakuo.test",
      password: passwordHash,
      role: "BUSINESS_OWNER",
    },
  });
}

async function upsertClientUser() {
  const passwordHash = await hash("1234", 10);
  return prisma.userClient.upsert({
    where: { email: "cliente@yoyakuo.test" },
    update: {
      name: "cliente",
      password: passwordHash,
    },
    create: {
      name: "cliente",
      email: "cliente@yoyakuo.test",
      password: passwordHash,
    },
  });
}

async function main() {
  const admin = await upsertBusinessUser();
  const client = await upsertClientUser();
  console.log("Usuarios de prueba listos:");
  console.log({ admin: { id: admin.id, email: admin.email, role: admin.role }, client: { id: client.id, email: client.email } });
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
