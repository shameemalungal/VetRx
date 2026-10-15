-- AlterTable
ALTER TABLE "Owner" ADD COLUMN     "alternatePhones" TEXT[] DEFAULT ARRAY[]::TEXT[];
