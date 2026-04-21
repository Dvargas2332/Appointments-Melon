-- Drop and recreate foreign keys so deleting a business owner cascades
-- through owned businesses and dependent business records.
ALTER TABLE "Business" DROP CONSTRAINT "Business_ownerId_fkey";
ALTER TABLE "StaffMembership" DROP CONSTRAINT "StaffMembership_businessId_fkey";
ALTER TABLE "StaffMembership" DROP CONSTRAINT "StaffMembership_userId_fkey";
ALTER TABLE "Service" DROP CONSTRAINT "Service_businessId_fkey";
ALTER TABLE "AvailabilityRule" DROP CONSTRAINT "AvailabilityRule_businessId_fkey";
ALTER TABLE "AvailabilityException" DROP CONSTRAINT "AvailabilityException_businessId_fkey";
ALTER TABLE "Appointment" DROP CONSTRAINT "Appointment_businessId_fkey";

ALTER TABLE "Business"
ADD CONSTRAINT "Business_ownerId_fkey"
FOREIGN KEY ("ownerId") REFERENCES "user_businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StaffMembership"
ADD CONSTRAINT "StaffMembership_businessId_fkey"
FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StaffMembership"
ADD CONSTRAINT "StaffMembership_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "user_businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Service"
ADD CONSTRAINT "Service_businessId_fkey"
FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AvailabilityRule"
ADD CONSTRAINT "AvailabilityRule_businessId_fkey"
FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AvailabilityException"
ADD CONSTRAINT "AvailabilityException_businessId_fkey"
FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Appointment"
ADD CONSTRAINT "Appointment_businessId_fkey"
FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
