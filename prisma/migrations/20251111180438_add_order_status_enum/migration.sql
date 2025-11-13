/*
  Warnings:

  - You are about to alter the column `orderStatus` on the `order` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Enum(EnumId(0))`.

*/
-- Update existing data to match new enum values
UPDATE `order` SET `orderStatus` = 'PREPARING' WHERE `orderStatus` NOT IN ('PREPARING', 'SHIPPED', 'DELIVERED');

-- AlterTable
ALTER TABLE `order` MODIFY `orderStatus` ENUM('PREPARING', 'SHIPPED', 'DELIVERED') NOT NULL DEFAULT 'PREPARING';
