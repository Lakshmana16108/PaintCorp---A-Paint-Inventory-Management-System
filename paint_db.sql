CREATE DATABASE IF NOT EXISTS paint_inventory;
USE paint_inventory;

SET FOREIGN_KEY_CHECKS=0;
DROP TABLE IF EXISTS payments, order_items, orders, warehouse_stock, stock_transactions, inventory,
purchase_items, purchase_orders, products, suppliers, customers, password_reset_otps, users;
SET FOREIGN_KEY_CHECKS=1;

-- 1. USERS TABLE
CREATE TABLE users (
 id INT AUTO_INCREMENT PRIMARY KEY,
 name VARCHAR(255) NOT NULL,
 email VARCHAR(255) NOT NULL UNIQUE,
 password VARCHAR(255) NOT NULL,
 role VARCHAR(50) NOT NULL DEFAULT 'Staff',
 mobile VARCHAR(20) NOT NULL,
 username VARCHAR(100) NOT NULL UNIQUE,
 avatar LONGTEXT DEFAULT NULL,
 two_factor_enabled TINYINT(1) DEFAULT 0,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 2. PASSWORD RESET OTPS TABLE
CREATE TABLE password_reset_otps (
 id INT AUTO_INCREMENT PRIMARY KEY,
 user_id INT NOT NULL,
 otp_hash VARCHAR(255) NOT NULL,
 expires_at TIMESTAMP NOT NULL,
 attempts INT DEFAULT 0,
 used TINYINT(1) DEFAULT 0,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 3. PRODUCTS CATALOG TABLE
CREATE TABLE products (
 id VARCHAR(50) PRIMARY KEY,
 name VARCHAR(180) NOT NULL,
 brand VARCHAR(100) NOT NULL,
 category VARCHAR(100) NOT NULL,
 color VARCHAR(80) NOT NULL,
 finish VARCHAR(50) NOT NULL,
 price DECIMAL(10,2) NOT NULL,
 quantity INT NOT NULL DEFAULT 0,
 status VARCHAR(30) DEFAULT 'In Stock',
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 4. WAREHOUSE STOCK TABLE
CREATE TABLE warehouse_stock (
 id INT AUTO_INCREMENT PRIMARY KEY,
 paint_id VARCHAR(50) NOT NULL,
 paint_name VARCHAR(180) NOT NULL,
 brand VARCHAR(100) NOT NULL,
 warehouse VARCHAR(100) NOT NULL,
 quantity INT NOT NULL DEFAULT 0,
 min_quantity INT NOT NULL DEFAULT 15,
 status VARCHAR(30) DEFAULT 'In Stock',
 FOREIGN KEY (paint_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 5. ORDERS TABLE
CREATE TABLE orders (
 id VARCHAR(50) PRIMARY KEY,
 customer_name VARCHAR(150) NOT NULL,
 customer_phone VARCHAR(20) NOT NULL,
 customer_address VARCHAR(255),
 paint_name VARCHAR(255),
 paint_id VARCHAR(50),
 quantity INT NOT NULL DEFAULT 1,
 price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
 total_amount DECIMAL(10,2) DEFAULT NULL,
 order_date VARCHAR(30),
 status VARCHAR(30) DEFAULT 'Pending',
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 6. ORDER ITEMS TABLE
CREATE TABLE order_items (
 id INT AUTO_INCREMENT PRIMARY KEY,
 order_id VARCHAR(50) NOT NULL,
 paint_id VARCHAR(50),
 paint_name VARCHAR(180) NOT NULL,
 quantity INT NOT NULL DEFAULT 1,
 price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 7. STOCK TRANSACTIONS TABLE
CREATE TABLE IF NOT EXISTS stock_transactions (
 id INT AUTO_INCREMENT PRIMARY KEY,
 paint_id VARCHAR(50) NOT NULL,
 paint_name VARCHAR(180) NOT NULL,
 warehouse VARCHAR(100) NOT NULL,
 previous_stock INT NOT NULL,
 added_quantity INT NOT NULL,
 new_stock INT NOT NULL,
 added_by VARCHAR(150) NOT NULL,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (paint_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- =========================================================
-- SEED DATA (Synchronized from PaintCorp Production Dataset)
-- =========================================================

-- Seed Users
INSERT INTO users (id, name, email, password, role, mobile, username, avatar, two_factor_enabled) VALUES
(1, 'PaintCorp Administrator', 'admin@paintcorp.com', '$2a$10$1S2yAggPWbEjCcKtOoBhjuc.bSWSHM./DXvdVLke45l2p/AlBxWnK', 'Administrator', '9876543210', 'erp_admin', '', 0),
(2, 'Arun Kumar', 'arun.kumar@paintcorp.com', '$2a$10$1S2yAggPWbEjCcKtOoBhjuc.bSWSHM./DXvdVLke45l2p/AlBxWnK', 'Manager', '9842156732', 'arun_manager', '', 1),
(3, 'Priya Raj', 'priya.raj@paintcorp.com', '$2a$10$1S2yAggPWbEjCcKtOoBhjuc.bSWSHM./DXvdVLke45l2p/AlBxWnK', 'Staff', '9791543287', 'priya_staff', '', 0),
(4, 'Suresh Balan', 'suresh.balan@paintcorp.com', '$2a$10$1S2yAggPWbEjCcKtOoBhjuc.bSWSHM./DXvdVLke45l2p/AlBxWnK', 'Warehouse Manager', '9894567123', 'suresh_warehouse', '', 0),
(5, 'Divya Krishnan', 'divya.krishnan@paintcorp.com', '$2a$10$1S2yAggPWbEjCcKtOoBhjuc.bSWSHM./DXvdVLke45l2p/AlBxWnK', 'Sales', '9361024587', 'divya_sales', '', 0),
(6, 'M.Lakshmana Perumal', 'perumalmlakshmana5@gmail.com', '$2a$10$zqNMTECGHMwcwWWvpQcCw.D9IIj8yxRzzWQr86O3rzj/FRyzMz5YS', 'Staff', '+919486721134', 'perumalmlakshmana5_753', '', 0),
(7, 'Lakshmana Perumal', 'plakshmana22@gmail.com', '$2a$10$zqNMTECGHMwcwWWvpQcCw.D9IIj8yxRzzWQr86O3rzj/FRyzMz5YS', 'Administrator', '+919486721134', 'plakshmana22_admin', '', 0);

-- Seed Products (20 products)
INSERT INTO products (id, name, brand, category, color, finish, price, quantity, status) VALUES
('PNT001', 'WeatherShield Exterior Emulsion', 'Dulux', 'Exterior', 'Brilliant White', 'Semi-Gloss', 3850.00, 96, 'In Stock'),
('PNT002', 'Weathershield Powerflexx', 'Asian Paints', 'Exterior', 'Pearl White', 'Matt', 4280.00, 71, 'In Stock'),
('PNT003', 'Royale Health Shield', 'Asian Paints', 'Interior', 'Ivory Mist', 'Matt', 3425.00, 68, 'In Stock'),
('PNT004', 'EasyClean Interior Emulsion', 'Dulux', 'Interior', 'Soft Beige', 'Satin', 2980.00, 54, 'In Stock'),
('PNT005', 'Nippon Spot-less Plus', 'Nippon', 'Interior', 'Moon White', 'Matt', 3150.00, 37, 'In Stock'),
('PNT006', 'Luxury Emulsion', 'Berger', 'Interior', 'Cream Pearl', 'Matt', 2760.00, 21, 'Low Stock'),
('PNT007', 'Super Premium Enamel', 'Nippon', 'Wood & Metal', 'Forest Green', 'Gloss', 2495.00, 16, 'Low Stock'),
('PNT008', 'WoodTech Wood Finish', 'Asian Paints', 'Wood & Metal', 'Teak Brown', 'Gloss', 1890.00, 42, 'In Stock'),
('PNT009', 'Luxol Hi-Gloss Enamel', 'Berger', 'Wood & Metal', 'Royal Blue', 'High Gloss', 2150.00, 9, 'Low Stock'),
('PNT010', 'Acrylic Wall Primer', 'Asian Paints', 'Primer', 'White', 'Matt', 1680.00, 75, 'In Stock'),
('PNT011', 'Interior Wall Primer', 'Dulux', 'Primer', 'Neutral White', 'Matt', 1540.00, 63, 'In Stock'),
('PNT012', 'UltraHide Water Based Primer', 'Nippon', 'Primer', 'White', 'Matt', 1425.00, 5, 'Low Stock'),
('PNT013', 'DampBlock Waterproofing', 'Dr. Fixit', 'Waterproofing', 'Cement Grey', 'Matt', 3650.00, 48, 'In Stock'),
('PNT014', 'Roofseal Waterproof Coating', 'Berger', 'Waterproofing', 'Terracotta', 'Matt', 3290.00, 12, 'Low Stock'),
('PNT015', 'Apex Ultima', 'Asian Paints', 'Exterior', 'Terracotta Red', 'Satin', 4750.00, 105, 'In Stock'),
('PNT016', 'Apex Ultima Protek', 'Asian Paints', 'Exterior', 'Mountain Grey', 'Matt', 4920.00, 7, 'Low Stock'),
('PNT017', 'Dulux Promise Interior', 'Dulux', 'Interior', 'Lemon Yellow', 'Matt', 2650.00, 31, 'In Stock'),
('PNT018', 'Nippon Weatherbond', 'Nippon', 'Exterior', 'Ocean Blue', 'Semi-Gloss', 3980.00, 0, 'Out of Stock'),
('PNT019', 'Berger WeatherCoat', 'Berger', 'Exterior', 'Sandstone', 'Matt', 3890.00, 28, 'In Stock'),
('PNT020', 'Metal Shield Anti-Rust', 'Berger', 'Wood & Metal', 'Dark Grey', 'Gloss', 1790.00, 18, 'Low Stock');

-- Seed Warehouse Stock (26 records)
INSERT INTO warehouse_stock (id, paint_id, paint_name, brand, warehouse, quantity, min_quantity, status) VALUES
(1, 'PNT001', 'WeatherShield Exterior Emulsion', 'Dulux', 'Central Warehouse - Tirunelveli', 36, 25, 'In Stock'),
(2, 'PNT002', 'Weathershield Powerflexx', 'Asian Paints', 'Central Warehouse - Tirunelveli', 34, 20, 'In Stock'),
(3, 'PNT003', 'Royale Health Shield', 'Asian Paints', 'Central Warehouse - Tirunelveli', 40, 15, 'In Stock'),
(4, 'PNT004', 'EasyClean Interior Emulsion', 'Dulux', 'Central Warehouse - Tirunelveli', 32, 15, 'In Stock'),
(5, 'PNT007', 'Super Premium Enamel', 'Nippon', 'Central Warehouse - Tirunelveli', 8, 15, 'Low Stock'),
(6, 'PNT010', 'Acrylic Wall Primer', 'Asian Paints', 'Central Warehouse - Tirunelveli', 50, 20, 'In Stock'),
(7, 'PNT013', 'DampBlock Waterproofing', 'Dr. Fixit', 'Central Warehouse - Tirunelveli', 30, 15, 'In Stock'),
(8, 'PNT001', 'WeatherShield Exterior Emulsion', 'Dulux', 'Madurai Depot', 60, 20, 'In Stock'),
(9, 'PNT005', 'Nippon Spot-less Plus', 'Nippon', 'Madurai Depot', 25, 12, 'In Stock'),
(10, 'PNT006', 'Luxury Emulsion', 'Berger', 'Madurai Depot', 12, 15, 'Low Stock'),
(11, 'PNT008', 'WoodTech Wood Finish', 'Asian Paints', 'Madurai Depot', 25, 10, 'In Stock'),
(12, 'PNT011', 'Interior Wall Primer', 'Dulux', 'Madurai Depot', 35, 15, 'In Stock'),
(13, 'PNT015', 'Apex Ultima', 'Asian Paints', 'Madurai Depot', 45, 20, 'In Stock'),
(14, 'PNT002', 'Weathershield Powerflexx', 'Asian Paints', 'Chennai Distribution Centre', 37, 20, 'In Stock'),
(15, 'PNT003', 'Royale Health Shield', 'Asian Paints', 'Chennai Distribution Centre', 28, 15, 'In Stock'),
(16, 'PNT009', 'Luxol Hi-Gloss Enamel', 'Berger', 'Chennai Distribution Centre', 9, 12, 'Low Stock'),
(17, 'PNT014', 'Roofseal Waterproof Coating', 'Berger', 'Chennai Distribution Centre', 12, 15, 'Low Stock'),
(18, 'PNT016', 'Apex Ultima Protek', 'Asian Paints', 'Chennai Distribution Centre', 7, 15, 'Low Stock'),
(19, 'PNT004', 'EasyClean Interior Emulsion', 'Dulux', 'Coimbatore Depot', 22, 12, 'In Stock'),
(20, 'PNT005', 'Nippon Spot-less Plus', 'Nippon', 'Coimbatore Depot', 12, 10, 'In Stock'),
(21, 'PNT010', 'Acrylic Wall Primer', 'Asian Paints', 'Coimbatore Depot', 25, 15, 'In Stock'),
(22, 'PNT018', 'Nippon Weatherbond', 'Nippon', 'Coimbatore Depot', 0, 10, 'Out of Stock'),
(23, 'PNT019', 'Berger WeatherCoat', 'Berger', 'Coimbatore Depot', 28, 12, 'In Stock'),
(24, 'PNT020', 'Metal Shield Anti-Rust', 'Berger', 'Coimbatore Depot', 18, 10, 'In Stock'),
(25, 'PNT012', 'UltraHide Water Based Primer', 'Nippon', 'Central Warehouse - Tirunelveli', 5, 15, 'Low Stock'),
(26, 'PNT017', 'Dulux Promise Interior', 'Dulux', 'Central Warehouse - Tirunelveli', 31, 15, 'In Stock');

-- Seed Orders (27 orders)
INSERT INTO orders (id, customer_name, customer_phone, customer_address, paint_name, paint_id, quantity, price, total_amount, order_date, status) VALUES
('ORD1001', 'S. Murugan Constructions', '+91 98421 56789', 'Palayamkottai, Tirunelveli, Tamil Nadu', 'WeatherShield Exterior Emulsion', 'PNT001', 12, 3850.00, 46200.00, 'Tue Aug 25 2026 00:00:00 GMT+0530 (India Standard Time)', 'Delivered'),
('ORD1002', 'Sri Lakshmi Builders', '+91 97892 31456', 'Vannarpettai, Tirunelveli, Tamil Nadu', 'Apex Ultima', 'PNT015', 18, 4750.00, 85500.00, 'Wed Aug 26 2026 00:00:00 GMT+0530 (India Standard Time)', 'Delivered'),
('ORD1003', 'Ramesh Kumar', '+91 98654 12378', 'Sankar Nagar, Tirunelveli, Tamil Nadu', 'Royale Health Shield', 'PNT003', 6, 3425.00, 20550.00, 'Thu Aug 27 2026 00:00:00 GMT+0530 (India Standard Time)', 'Processing'),
('ORD1004', 'Green Valley Apartments', '+91 99432 78651', 'Maharaja Nagar, Tirunelveli, Tamil Nadu', 'Weathershield Powerflexx', 'PNT002', 15, 4280.00, 64200.00, 'Thu Aug 27 2026 00:00:00 GMT+0530 (India Standard Time)', 'Packed'),
('ORD1005', 'Kannan Electrical & Hardware', '+91 96555 23418', 'Main Road, Nagercoil, Tamil Nadu', 'Super Premium Enamel', 'PNT007', 4, 2495.00, 9980.00, 'Fri Aug 28 2026 00:00:00 GMT+0530 (India Standard Time)', 'Pending'),
('ORD1006', 'Priya Interiors', '+91 97901 45872', 'KK Nagar, Madurai, Tamil Nadu', 'EasyClean Interior Emulsion', 'PNT004', 10, 2980.00, 29800.00, 'Fri Aug 28 2026 00:00:00 GMT+0530 (India Standard Time)', 'Delivered'),
('ORD1007', 'Arunachala Developers', '+91 98430 67125', 'Anna Nagar, Madurai, Tamil Nadu', 'DampBlock Waterproofing', 'PNT013', 8, 3650.00, 29200.00, 'Sat Aug 29 2026 00:00:00 GMT+0530 (India Standard Time)', 'Processing'),
('ORD1008', 'Vasantham Home Solutions', '+91 93606 51248', 'Thirunagar, Madurai, Tamil Nadu', 'Acrylic Wall Primer', 'PNT010', 14, 1680.00, 23520.00, 'Sat Aug 29 2026 00:00:00 GMT+0530 (India Standard Time)', 'Packed'),
('ORD1009', 'Muthu Painting Services', '+91 98847 32619', 'Tambaram, Chennai, Tamil Nadu', 'Luxol Hi-Gloss Enamel', 'PNT009', 5, 2150.00, 10750.00, 'Sun Aug 30 2026 00:00:00 GMT+0530 (India Standard Time)', 'Pending'),
('ORD1010', 'Chennai Metro Contractors', '+91 94442 78516', 'Guindy, Chennai, Tamil Nadu', 'Apex Ultima Protek', 'PNT016', 10, 4920.00, 49200.00, 'Sun Aug 30 2026 00:00:00 GMT+0530 (India Standard Time)', 'Processing'),
('ORD1011', 'Sri Vinayaga Hardware', '+91 97876 45129', 'RS Puram, Coimbatore, Tamil Nadu', 'Berger WeatherCoat', 'PNT019', 7, 3890.00, 27230.00, 'Mon Aug 31 2026 00:00:00 GMT+0530 (India Standard Time)', 'Delivered'),
('ORD1012', 'Lakshmi Home Interiors', '+91 99524 61873', 'Saibaba Colony, Coimbatore, Tamil Nadu', 'Nippon Spot-less Plus', 'PNT005', 9, 3150.00, 28350.00, 'Mon Aug 31 2026 00:00:00 GMT+0530 (India Standard Time)', 'Pending'),
('ORD1013', 'Kaveri Builders', '+91 98427 53168', 'Gandhipuram, Coimbatore, Tamil Nadu', 'WoodTech Wood Finish', 'PNT008', 6, 1890.00, 11340.00, 'Tue Sep 01 2026 00:00:00 GMT+0530 (India Standard Time)', 'Packed'),
('ORD1014', 'Sakthi Engineering Works', '+91 96770 28415', 'Ambattur, Chennai, Tamil Nadu', 'Metal Shield Anti-Rust', 'PNT020', 11, 1790.00, 19690.00, 'Tue Sep 01 2026 00:00:00 GMT+0530 (India Standard Time)', 'Processing'),
('ORD1015', 'Royal Residency', '+91 98944 73216', 'Perungudi, Chennai, Tamil Nadu', 'Interior Wall Primer', 'PNT011', 20, 1540.00, 30800.00, 'Wed Sep 02 2026 00:00:00 GMT+0530 (India Standard Time)', 'Pending'),
('ORD1016', 'Bala Painting Contractors', '+91 97891 62543', 'Melasivapuri, Madurai, Tamil Nadu', 'Luxury Emulsion', 'PNT006', 8, 2760.00, 22080.00, 'Wed Sep 02 2026 00:00:00 GMT+0530 (India Standard Time)', 'Pending'),
('ORD1017', 'Sri Murugan Agencies', '+91 94431 85672', 'Nanguneri, Tirunelveli, Tamil Nadu', 'Roofseal Waterproof Coating', 'PNT014', 5, 3290.00, 16450.00, 'Wed Sep 02 2026 00:00:00 GMT+0530 (India Standard Time)', 'Processing'),
('ORD1018', 'Green Homes Developers', '+91 98421 73465', 'Pallavaram, Chennai, Tamil Nadu', 'WeatherShield Exterior Emulsion', 'PNT001', 20, 3850.00, 77000.00, 'Thu Sep 03 2026 00:00:00 GMT+0530 (India Standard Time)', 'Pending'),
('ORD105', 'M.Lakshmana Perumal', '+919486721134', '5,Gramachavadi Street,Thachanallur,Tirunelveli
Near Ekkali amman temple', 'DampBlock Waterproofing', 'PNT013', 1, 3650.00, 3650.00, 'Mon Sep 07 2026 00:00:00 GMT+0530 (India Standard Time)', 'Pending'),
('ORD131', 'M.Lakshmana Perumal', '+919486721134', '5,Gramachavadi Street,Thachanallur,Tirunelveli
Near Ekkali amman temple', 'Berger WeatherCoat', 'PNT019', 1, 3890.00, 3890.00, 'Mon Sep 28 2026 00:00:00 GMT+0530 (India Standard Time)', 'Delivered'),
('ORD308', 'M.Lakshmana Perumal', '+919486721134', '5,Gramachavadi Street,Thachanallur,Tirunelveli
Near Ekkali amman temple', 'Berger WeatherCoat', 'PNT019', 1, 3890.00, 3890.00, 'Fri Sep 11 2026 00:00:00 GMT+0530 (India Standard Time)', 'Pending'),
('ORD310', 'M.Lakshmana Perumal', '+919486721134', '5,Gramachavadi Street,Thachanallur,Tirunelveli
Near Ekkali amman temple', 'Apex Ultima', 'PNT015', 105, 4750.00, 498750.00, 'Thu Sep 03 2026 00:00:00 GMT+0530 (India Standard Time)', 'Pending'),
('ORD325', 'M.Lakshmana Perumal', '+919486721134', '5,Gramachavadi Street,Thachanallur,Tirunelveli
Near Ekkali amman temple', 'WoodTech Wood Finish', 'PNT008', 32, 1890.00, 60480.00, 'Thu Sep 03 2026 00:00:00 GMT+0530 (India Standard Time)', 'Pending'),
('ORD491', 'M.Lakshmana Perumal', '+919486721134', '5,Gramachavadi Street,Thachanallur,Tirunelveli
Near Ekkali amman temple', 'Luxury Emulsion', 'PNT006', 2, 2760.00, 5520.00, 'Thu Sep 03 2026 00:00:00 GMT+0530 (India Standard Time)', 'Pending'),
('ORD609', 'M.Lakshmana Perumal', '+919486721134', '5,Gramachavadi Street,Thachanallur,Tirunelveli
Near Ekkali amman temple', 'EasyClean Interior Emulsion', 'PNT004', 1, 2980.00, 2980.00, 'Fri Sep 11 2026 00:00:00 GMT+0530 (India Standard Time)', 'Pending'),
('ORD644', 'Muthu Naveen', '1234567890', '5,Gramachavadi Street,Thachanallur,Tirunelveli
Near Ekkali amman temple', 'WeatherShield Exterior Emulsion', 'PNT001', 1, 3850.00, 3850.00, 'Thu Sep 17 2026 00:00:00 GMT+0530 (India Standard Time)', 'Pending'),
('ORD702', 'M.Lakshmana Perumal', '+919486721134', '5,Gramachavadi Street,Thachanallur,Tirunelveli
Near Ekkali amman temple', 'Nippon Spot-less Plus', 'PNT005', 37, 3150.00, 116550.00, 'Thu Sep 03 2026 00:00:00 GMT+0530 (India Standard Time)', 'Pending');

-- Seed Order Items (27 items)
INSERT INTO order_items (id, order_id, paint_id, paint_name, quantity, price) VALUES
(1, 'ORD1001', 'PNT001', 'WeatherShield Exterior Emulsion', 12, 3850.00),
(2, 'ORD1002', 'PNT015', 'Apex Ultima', 18, 4750.00),
(3, 'ORD1003', 'PNT003', 'Royale Health Shield', 6, 3425.00),
(4, 'ORD1004', 'PNT002', 'Weathershield Powerflexx', 15, 4280.00),
(5, 'ORD1005', 'PNT007', 'Super Premium Enamel', 4, 2495.00),
(6, 'ORD1006', 'PNT004', 'EasyClean Interior Emulsion', 10, 2980.00),
(7, 'ORD1007', 'PNT013', 'DampBlock Waterproofing', 8, 3650.00),
(8, 'ORD1008', 'PNT010', 'Acrylic Wall Primer', 14, 1680.00),
(9, 'ORD1009', 'PNT009', 'Luxol Hi-Gloss Enamel', 5, 2150.00),
(10, 'ORD1010', 'PNT016', 'Apex Ultima Protek', 10, 4920.00),
(11, 'ORD1011', 'PNT019', 'Berger WeatherCoat', 7, 3890.00),
(12, 'ORD1012', 'PNT005', 'Nippon Spot-less Plus', 9, 3150.00),
(13, 'ORD1013', 'PNT008', 'WoodTech Wood Finish', 6, 1890.00),
(14, 'ORD1014', 'PNT020', 'Metal Shield Anti-Rust', 11, 1790.00),
(15, 'ORD1015', 'PNT011', 'Interior Wall Primer', 20, 1540.00),
(16, 'ORD1016', 'PNT006', 'Luxury Emulsion', 8, 2760.00),
(17, 'ORD1017', 'PNT014', 'Roofseal Waterproof Coating', 5, 3290.00),
(18, 'ORD1018', 'PNT001', 'WeatherShield Exterior Emulsion', 20, 3850.00),
(19, 'ORD105', 'PNT013', 'DampBlock Waterproofing', 1, 3650.00),
(20, 'ORD131', 'PNT019', 'Berger WeatherCoat', 1, 3890.00),
(21, 'ORD308', 'PNT019', 'Berger WeatherCoat', 1, 3890.00),
(22, 'ORD310', 'PNT015', 'Apex Ultima', 105, 4750.00),
(23, 'ORD325', 'PNT008', 'WoodTech Wood Finish', 32, 1890.00),
(24, 'ORD491', 'PNT006', 'Luxury Emulsion', 2, 2760.00),
(25, 'ORD609', 'PNT004', 'EasyClean Interior Emulsion', 1, 2980.00),
(26, 'ORD644', 'PNT001', 'WeatherShield Exterior Emulsion', 1, 3850.00),
(27, 'ORD702', 'PNT005', 'Nippon Spot-less Plus', 37, 3150.00);
