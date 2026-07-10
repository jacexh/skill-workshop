CREATE TABLE `order_record` (
  `id` varchar(36) NOT NULL,
  `customer_id` varchar(36) NOT NULL,
  `status` tinyint unsigned NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
