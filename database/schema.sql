CREATE DATABASE IF NOT EXISTS control_db
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE control_db;

CREATE TABLE categories (
  id   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(80) NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE products (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  category_id   INT UNSIGNED NULL,
  name          VARCHAR(120) NOT NULL,
  price         DECIMAL(12,2) NOT NULL DEFAULT 0,
  duration_days INT NOT NULL DEFAULT 30,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE accounts (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id INT UNSIGNED NOT NULL,
  email      VARCHAR(150) NOT NULL,
  password   VARCHAR(150) NULL,
  slots      INT NOT NULL DEFAULT 1,
  cost       DECIMAL(12,2) NOT NULL DEFAULT 0,
  status     ENUM('active','suspended') NOT NULL DEFAULT 'active',
  notes      TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id)
) ENGINE=InnoDB;

CREATE TABLE customers (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(120) NOT NULL,
  phone      VARCHAR(30) NULL,
  notes      TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_customers_name (name)
) ENGINE=InnoDB;

CREATE TABLE rentals (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  customer_id  INT UNSIGNED NOT NULL,
  account_id   INT UNSIGNED NOT NULL,
  profile_name VARCHAR(60) NULL,
  pin          VARCHAR(20) NULL,
  price        DECIMAL(12,2) NOT NULL DEFAULT 0,
  start_date   DATE NOT NULL,
  end_date     DATE NOT NULL,
  status       ENUM('active','cancelled') NOT NULL DEFAULT 'active',
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_rentals_end (status, end_date),
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (account_id)  REFERENCES accounts(id)
) ENGINE=InnoDB;

-- Datos de prueba
INSERT INTO categories (name) VALUES ('Video'), ('Música');
INSERT INTO products (category_id, name, price) VALUES
  (1, 'Netflix', 15000), (1, 'Prime Video', 8000), (1, 'Max', 9000), (2, 'Spotify', 10000);
INSERT INTO accounts (product_id, email, password, slots, cost) VALUES
  (1, 'netflix1@correo.com', 'clave123', 4, 40000),
  (2, 'prime1@correo.com',   'clave123', 3, 14000);
INSERT INTO customers (name, phone) VALUES
  ('Ana Pérez', '3001112233'), ('Luis Gómez', '3004445566'), ('María Díaz', '3007778899');
INSERT INTO rentals (customer_id, account_id, profile_name, pin, price, start_date, end_date) VALUES
  (1, 1, 'Perfil 1', '1111', 15000, DATE_SUB(CURDATE(), INTERVAL 32 DAY), DATE_SUB(CURDATE(), INTERVAL 2 DAY)),
  (2, 1, 'Perfil 2', '2222', 15000, DATE_SUB(CURDATE(), INTERVAL 28 DAY), DATE_ADD(CURDATE(), INTERVAL 2 DAY)),
  (3, 2, 'Perfil 1', '3333', 8000,  CURDATE(),                            DATE_ADD(CURDATE(), INTERVAL 30 DAY));


  CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(100) NOT NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

ALTER TABLE customers
  ADD COLUMN email VARCHAR(150) NULL AFTER phone,
  MODIFY phone VARCHAR(30) NOT NULL;

