-- AlterTable
ALTER TABLE "menus" ADD COLUMN "lastAnnouncedAt" TIMESTAMPTZ(6),
ADD COLUMN "lastAnnouncedBy" UUID;
