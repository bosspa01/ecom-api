/*
  Warnings:

  - You are about to drop the column `updatedAt` on the `message` table. All the data in the column will be lost.
  - You are about to alter the column `status` on the `ticket` table. The data in that column could be lost. The data in that column will be cast from `Enum(EnumId(0))` to `VarChar(191)`.

*/
-- DropForeignKey
ALTER TABLE `message` DROP FOREIGN KEY `Message_ticketId_fkey`;

-- DropForeignKey
ALTER TABLE `message` DROP FOREIGN KEY `Message_userId_fkey`;

-- DropForeignKey
ALTER TABLE `ticket` DROP FOREIGN KEY `Ticket_userId_fkey`;

-- DropIndex
DROP INDEX `Message_ticketId_fkey` ON `message`;

-- DropIndex
DROP INDEX `Message_userId_fkey` ON `message`;

-- DropIndex
DROP INDEX `Ticket_userId_fkey` ON `ticket`;

-- AlterTable
ALTER TABLE `message` DROP COLUMN `updatedAt`;

-- AlterTable
ALTER TABLE `order` ADD COLUMN `couponId` INTEGER NULL;

-- AlterTable
ALTER TABLE `ticket` MODIFY `title` VARCHAR(191) NOT NULL,
    MODIFY `status` VARCHAR(191) NOT NULL DEFAULT 'OPEN',
    ALTER COLUMN `updatedAt` DROP DEFAULT;

-- CreateTable
CREATE TABLE `SaleCoupon` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `couponCode` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `discountType` VARCHAR(191) NOT NULL,
    `discountValue` DOUBLE NOT NULL,
    `maxUses` INTEGER NOT NULL,
    `currentUses` INTEGER NOT NULL DEFAULT 0,
    `expirationDate` DATETIME(3) NOT NULL,
    `minimumOrderAmount` DOUBLE NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SaleCoupon_couponCode_key`(`couponCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Order` ADD CONSTRAINT `Order_couponId_fkey` FOREIGN KEY (`couponId`) REFERENCES `SaleCoupon`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Ticket` ADD CONSTRAINT `Ticket_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Message` ADD CONSTRAINT `Message_ticketId_fkey` FOREIGN KEY (`ticketId`) REFERENCES `Ticket`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Message` ADD CONSTRAINT `Message_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
