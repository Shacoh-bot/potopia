-- CreateEnum
CREATE TYPE "tcg"."TcgCardLayout" AS ENUM ('normal', 'fullart');

-- AlterTable
ALTER TABLE "tcg"."cards" ADD COLUMN     "layout" "tcg"."TcgCardLayout" NOT NULL DEFAULT 'normal';
