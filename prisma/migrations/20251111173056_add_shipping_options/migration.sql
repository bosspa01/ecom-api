-- AlterTable
ALTER TABLE `order` ADD COLUMN `shippingCost` DOUBLE NOT NULL DEFAULT 35,
    ADD COLUMN `shippingMethod` VARCHAR(191) NULL DEFAULT 'bangkok_standard';
