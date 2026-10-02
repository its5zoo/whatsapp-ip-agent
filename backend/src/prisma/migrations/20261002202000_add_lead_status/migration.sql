-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM (
    'NEW',
    'CONTACTED',
    'QUALIFIED',
    'IN_PROGRESS',
    'ON_HOLD',
    'CONVERTED',
    'NOT_INTERESTED',
    'CLOSED'
);

-- AlterTable
ALTER TABLE "leads" ADD COLUMN "status" "LeadStatus" NOT NULL DEFAULT 'NEW';
