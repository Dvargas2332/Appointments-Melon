/*
  Warnings:

  - The values [CUSTOMER] on the enum `UserRole` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the `User` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "UserRole_new" AS ENUM ('BUSINESS_OWNER', 'STAFF');
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TYPE "UserRole" RENAME TO "UserRole_old";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";
COMMIT;

-- DropForeignKey
ALTER TABLE "Appointment" DROP CONSTRAINT "Appointment_customerId_fkey";

-- DropForeignKey
ALTER TABLE "Business" DROP CONSTRAINT "Business_ownerId_fkey";

-- DropForeignKey
ALTER TABLE "StaffMembership" DROP CONSTRAINT "StaffMembership_userId_fkey";

-- DropTable
DROP TABLE "User";

-- Drop old enum no longer in use
DROP TYPE "UserRole_old";

-- CreateTable
CREATE TABLE "user_businesses" (
    "id" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'STAFF',
    "name" TEXT,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_businesses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_clients" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_clients_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_businesses_email_key" ON "user_businesses"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_businesses_phone_key" ON "user_businesses"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "user_clients_email_key" ON "user_clients"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_clients_phone_key" ON "user_clients"("phone");

-- AddForeignKey
ALTER TABLE "Business" ADD CONSTRAINT "Business_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user_businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffMembership" ADD CONSTRAINT "StaffMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user_businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "user_clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
