-- Update old orderStatus values to new enum values
UPDATE `order` SET `orderStatus` = 'PREPARING' WHERE `orderStatus` NOT IN ('PREPARING', 'SHIPPED', 'DELIVERED');
