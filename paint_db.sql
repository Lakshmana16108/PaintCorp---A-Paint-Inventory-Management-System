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
 paint_name VARCHAR(180) NOT NULL,
 paint_id VARCHAR(50),
 quantity INT NOT NULL DEFAULT 1,
 price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
 order_date VARCHAR(30),
 status VARCHAR(30) DEFAULT 'Pending',
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- =========================================================
-- SEED DATA
-- =========================================================

-- Seed Default Admin Account (admin@paintcorp.com / password123)
INSERT INTO users (id, name, email, password, role, mobile, username, avatar, two_factor_enabled) VALUES
(1, 'ERP Admin', 'admin@paintcorp.com', '$2a$10$1S2yAggPWbEjCcKtOoBhjuc.bSWSHM./DXvdVLke45l2p/AlBxWnK', 'Administrator', '1234567890', 'erp_admin', '', 0);

-- Initial Products Data
INSERT INTO products (id, name, brand, category, color, finish, price, quantity, status) VALUES
('PNT001', 'WeatherShield Max', 'Dulux', 'Exterior', 'Arctic White', 'Semi-Gloss', 3679.20, 120, 'In Stock'),
('PNT002', 'Royale Luxury Emulsion', 'Asian Paints', 'Interior', 'Soft Beige', 'Matte', 3160.00, 85, 'In Stock'),
('PNT003', 'Super Premium Enamel', 'Nippon', 'Wood & Metal', 'Forest Green', 'Gloss', 2399.20, 15, 'Low Stock'),
('PNT004', 'Aquashield Waterproofing', 'Berger', 'Exterior', 'Slate Gray', 'Matte', 4320.00, 60, 'In Stock'),
('PNT005', 'EasyClean Stain Resistant', 'Dulux', 'Interior', 'Lemon Yellow', 'Satin', 2799.20, 8, 'Low Stock'),
('PNT006', 'UltraHide Primer', 'Nippon', 'Primer', 'Neutral White', 'Matte', 1960.00, 0, 'Out of Stock'),
('PNT007', 'Apex Ultima Protect', 'Asian Paints', 'Exterior', 'Terracotta Red', 'Satin', 4660.00, 110, 'In Stock');

-- Initial Warehouse Stock Data
INSERT INTO warehouse_stock (id, paint_id, paint_name, brand, warehouse, quantity, min_quantity, status) VALUES
(1, 'PNT001', 'WeatherShield Max', 'Dulux', 'Central Warehouse A', 80, 20, 'In Stock'),
(2, 'PNT001', 'WeatherShield Max', 'Dulux', 'East Wing Depot', 40, 15, 'In Stock'),
(3, 'PNT002', 'Royale Luxury Emulsion', 'Asian Paints', 'Central Warehouse A', 50, 20, 'In Stock'),
(4, 'PNT002', 'Royale Luxury Emulsion', 'Asian Paints', 'South Gate facility', 35, 15, 'In Stock'),
(5, 'PNT003', 'Super Premium Enamel', 'Nippon', 'Central Warehouse A', 5, 20, 'Low Stock'),
(6, 'PNT003', 'Super Premium Enamel', 'Nippon', 'East Wing Depot', 10, 12, 'Low Stock'),
(7, 'PNT004', 'Aquashield Waterproofing', 'Berger', 'Central Warehouse A', 60, 20, 'In Stock'),
(8, 'PNT005', 'EasyClean Stain Resistant', 'Dulux', 'Central Warehouse A', 8, 15, 'Low Stock'),
(9, 'PNT006', 'UltraHide Primer', 'Nippon', 'East Wing Depot', 0, 25, 'Out of Stock'),
(10, 'PNT007', 'Apex Ultima Protect', 'Asian Paints', 'South Gate facility', 110, 30, 'In Stock');

-- Initial Customer Orders Data
INSERT INTO orders (id, customer_name, customer_phone, customer_address, paint_name, paint_id, quantity, price, order_date, status) VALUES
('ORD101', 'Alex Mercer', '+1 (555) 019-2834', '452 Pine St, New York, NY', 'WeatherShield Max', 'PNT001', 10, 3679.20, '2026-08-07', 'Delivered'),
('ORD102', 'Sarah Connor', '+1 (555) 022-9110', '882 Oak Ave, Los Angeles, CA', 'Royale Luxury Emulsion', 'PNT002', 5, 3160.00, '2026-08-08', 'Pending'),
('ORD103', 'Bruce Wayne', '+1 (555) 007-1939', '1007 Mountain Drive, Gotham', 'Aquashield Waterproofing', 'PNT004', 25, 4320.00, '2026-08-08', 'Processing'),
('ORD104', 'Clark Kent', '+1 (555) 045-1234', '344 Clinton St, Metropolis', 'Super Premium Enamel', 'PNT003', 2, 2399.20, '2026-08-08', 'Packed');
