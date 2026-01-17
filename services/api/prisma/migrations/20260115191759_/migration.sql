-- AlterTable
ALTER TABLE "user_businesses" ADD COLUMN     "avatarUrl" TEXT,
ADD COLUMN     "notifyApp" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyEmail" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "status" TEXT DEFAULT 'Activo',
ADD COLUMN     "visibility" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "user_clients" ADD COLUMN     "avatarUrl" TEXT,
ADD COLUMN     "notifyApp" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyEmail" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "status" TEXT DEFAULT 'Disponible',
ADD COLUMN     "visibility" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "note" TEXT,
    "kind" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Activity_userId_startAt_idx" ON "Activity"("userId", "startAt");

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user_clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
