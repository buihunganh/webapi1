/*
  PostgreSQL schema for Supabase - SHISAFOOD
  Converted from SQL Server schema in database.sql
  Note: Run this in Supabase SQL Editor.
*/

/* =========================================================
   Drop objects (safe re-run)
========================================================= */
DROP VIEW IF EXISTS vw_DailyRevenue;

DROP TABLE IF EXISTS OrderCombos CASCADE;
DROP TABLE IF EXISTS OrderDetails CASCADE;
DROP TABLE IF EXISTS Payments CASCADE;
DROP TABLE IF EXISTS Orders CASCADE;
DROP TABLE IF EXISTS ComboItems CASCADE;
DROP TABLE IF EXISTS Combos CASCADE;
DROP TABLE IF EXISTS ProductReviews CASCADE;
DROP TABLE IF EXISTS WishlistItems CASCADE;
DROP TABLE IF EXISTS Wishlists CASCADE;
DROP TABLE IF EXISTS Promotions CASCADE;
DROP TABLE IF EXISTS Products CASCADE;
DROP TABLE IF EXISTS Categories CASCADE;
DROP TABLE IF EXISTS UserAddresses CASCADE;
DROP TABLE IF EXISTS Users CASCADE;
DROP TABLE IF EXISTS Roles CASCADE;

/* =========================================================
   Identity / User
========================================================= */
CREATE TABLE Roles (
    RoleID INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    RoleName VARCHAR(30) NOT NULL UNIQUE
);

CREATE TABLE Users (
    UserID INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    FullName VARCHAR(120) NOT NULL,
    Email VARCHAR(150) NOT NULL UNIQUE,
    Phone VARCHAR(15) NULL,
    PasswordHash VARCHAR(255) NOT NULL,
    RoleID INT NOT NULL REFERENCES Roles(RoleID),
    IsActive BOOLEAN NOT NULL DEFAULT TRUE,
    CreatedAt TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IX_Users_Phone_NotNull
ON Users(Phone)
WHERE Phone IS NOT NULL;

CREATE TABLE UserAddresses (
    AddressID INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    UserID INT NOT NULL REFERENCES Users(UserID),
    FullAddress VARCHAR(255) NOT NULL,
    City VARCHAR(100) NULL,
    IsDefault BOOLEAN NOT NULL DEFAULT FALSE,
    CreatedAt TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

/* =========================================================
   Catalog
========================================================= */
CREATE TABLE Categories (
    CategoryID INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    CategoryName VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE Products (
    ProductID INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    CategoryID INT NOT NULL REFERENCES Categories(CategoryID),
    ProductName VARCHAR(120) NOT NULL,
    Description VARCHAR(600) NULL,
    Price NUMERIC(18,2) NOT NULL CHECK (Price >= 0),
    StockQuantity INT NOT NULL DEFAULT 0 CHECK (StockQuantity >= 0),
    ImageURL VARCHAR(500) NULL,
    IsActive BOOLEAN NOT NULL DEFAULT TRUE,
    CreatedAt TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

/* =========================================================
   Combo
========================================================= */
CREATE TABLE Combos (
    ComboID INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ComboCode VARCHAR(50) NOT NULL UNIQUE,
    ComboName VARCHAR(120) NOT NULL,
    Description VARCHAR(400) NULL,
    Price NUMERIC(18,2) NOT NULL CHECK (Price >= 0),
    IsActive BOOLEAN NOT NULL DEFAULT TRUE,
    CreatedAt TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ComboItems (
    ComboItemID INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ComboID INT NOT NULL REFERENCES Combos(ComboID),
    ProductID INT NOT NULL REFERENCES Products(ProductID),
    Quantity INT NOT NULL CHECK (Quantity > 0)
);

/* =========================================================
   Promotion
========================================================= */
CREATE TABLE Promotions (
    PromotionID INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    Code VARCHAR(30) NOT NULL UNIQUE,
    DiscountType VARCHAR(20) NOT NULL CHECK (DiscountType IN ('percent','flat','delivery')),
    DiscountValue NUMERIC(18,2) NOT NULL CHECK (DiscountValue >= 0),
    MinOrderAmount NUMERIC(18,2) NOT NULL DEFAULT 0,
    IsActive BOOLEAN NOT NULL DEFAULT TRUE,
    StartDate TIMESTAMPTZ NULL,
    EndDate TIMESTAMPTZ NULL,
    CreatedAt TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

/* =========================================================
   Wishlist + Reviews
========================================================= */
CREATE TABLE Wishlists (
    WishlistID INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    UserID INT NOT NULL UNIQUE REFERENCES Users(UserID),
    CreatedAt TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE WishlistItems (
    WishlistItemID INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    WishlistID INT NOT NULL REFERENCES Wishlists(WishlistID),
    ProductID INT NOT NULL REFERENCES Products(ProductID),
    CreatedAt TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (WishlistID, ProductID)
);

CREATE TABLE ProductReviews (
    ReviewID INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ProductID INT NOT NULL REFERENCES Products(ProductID),
    UserID INT NOT NULL REFERENCES Users(UserID),
    Stars SMALLINT NOT NULL CHECK (Stars BETWEEN 1 AND 5),
    ReviewText VARCHAR(1000) NOT NULL,
    CreatedAt TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    IsVisible BOOLEAN NOT NULL DEFAULT TRUE
);

/* =========================================================
   Orders + Payments
========================================================= */
CREATE TABLE Orders (
    OrderID INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    CustomerID INT NOT NULL REFERENCES Users(UserID),
    ShipperID INT NULL REFERENCES Users(UserID),
    AddressID INT NULL REFERENCES UserAddresses(AddressID),
    PromotionID INT NULL REFERENCES Promotions(PromotionID),
    OrderDate TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    DeliveredDate TIMESTAMPTZ NULL,
    DeliveryPhone VARCHAR(15) NULL,
    SubTotal NUMERIC(18,2) NOT NULL CHECK (SubTotal >= 0),
    ShippingFee NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (ShippingFee >= 0),
    Discount NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (Discount >= 0),
    TotalAmount NUMERIC(18,2) GENERATED ALWAYS AS ((SubTotal + ShippingFee) - Discount) STORED,
    OrderStatus VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (OrderStatus IN ('pending','waiting_for_shipper','shipping','completed','cancelled')),
    Notes VARCHAR(255) NULL
);

CREATE TABLE OrderDetails (
    OrderDetailID INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    OrderID INT NOT NULL REFERENCES Orders(OrderID),
    ProductID INT NOT NULL REFERENCES Products(ProductID),
    Quantity INT NOT NULL CHECK (Quantity > 0),
    UnitPrice NUMERIC(18,2) NOT NULL CHECK (UnitPrice >= 0)
);

CREATE TABLE OrderCombos (
    OrderComboID INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    OrderID INT NOT NULL REFERENCES Orders(OrderID),
    ComboID INT NOT NULL REFERENCES Combos(ComboID),
    Quantity INT NOT NULL CHECK (Quantity > 0),
    UnitPrice NUMERIC(18,2) NOT NULL CHECK (UnitPrice >= 0)
);

CREATE TABLE Payments (
    PaymentID INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    OrderID INT NOT NULL REFERENCES Orders(OrderID),
    Amount NUMERIC(18,2) NOT NULL CHECK (Amount >= 0),
    Method VARCHAR(20) NOT NULL CHECK (Method IN ('Cash','Card','BankTransfer','Momo')),
    Status VARCHAR(20) NOT NULL DEFAULT 'unpaid' CHECK (Status IN ('unpaid','paid','failed','refunded')),
    PaidAt TIMESTAMPTZ NULL
);

/* =========================================================
   View
========================================================= */
CREATE VIEW vw_DailyRevenue AS
SELECT
    CAST(o.DeliveredDate AS DATE) AS ReportDate,
    COUNT(DISTINCT o.OrderID) AS TotalOrders,
    SUM(o.SubTotal) AS FoodRevenue,
    SUM(o.ShippingFee) AS ShippingRevenue,
    SUM(o.Discount) AS DiscountAmount,
    SUM(o.TotalAmount) AS NetRevenue
FROM Orders o
JOIN Payments p ON p.OrderID = o.OrderID
WHERE o.OrderStatus = 'completed'
  AND p.Status = 'paid'
GROUP BY CAST(o.DeliveredDate AS DATE);

/* =========================================================
   Seed data
========================================================= */
INSERT INTO Roles (RoleName)
VALUES ('Admin'), ('Shipper'), ('Customer');

INSERT INTO Users (FullName, Email, Phone, PasswordHash, RoleID)
VALUES
('Admin User', 'admin@shisa.com', '0901234567', 'hashed_admin', 1),
('Shipper User', 'shipper@shisa.com', '0987654321', 'hashed_shipper', 2),
('Customer Demo', 'customer@shisa.com', '0911223344', 'hashed_customer', 3);

INSERT INTO UserAddresses (UserID, FullAddress, City, IsDefault)
VALUES
(3, '123 Fire Street, Hoan Kiem', 'Hanoi', TRUE);

INSERT INTO Categories (CategoryName)
VALUES ('Noodles'), ('Pizza'), ('Beverages'), ('Sides');

INSERT INTO Products (CategoryID, ProductName, Description, Price, StockQuantity, IsActive)
VALUES
(1, 'Volcano Noodles', 'Bold spicy noodles.', 14.99, 50, TRUE),
(2, 'Shisa Spicy Pizza', 'Spicy signature pizza.', 16.99, 40, TRUE),
(3, 'Dragon Bubble Tea', 'Bubble tea with unique flavor.', 5.49, 100, TRUE),
(4, 'Volcano Fries', 'Crispy spicy fries.', 5.99, 120, TRUE);

INSERT INTO Combos (ComboCode, ComboName, Description, Price, IsActive)
VALUES
('noodle-drink-combo', 'Noodle + Drink Combo', 'One noodle and one drink.', 17.99, TRUE),
('pizza-party-combo', 'Pizza Party Set', 'Pizza, fries, and drinks.', 29.99, TRUE),
('mega-feast-combo', 'Mega Shisa Feast', 'Big meal combo.', 44.99, TRUE);

INSERT INTO ComboItems (ComboID, ProductID, Quantity)
VALUES
(1, 1, 1),
(1, 3, 1),
(2, 2, 1),
(2, 4, 1),
(3, 1, 1),
(3, 2, 1),
(3, 3, 1),
(3, 4, 1);

INSERT INTO Promotions (Code, DiscountType, DiscountValue, MinOrderAmount, IsActive)
VALUES
('SHISA20', 'percent', 20, 20, TRUE),
('FIRE10', 'flat', 10, 35, TRUE),
('NEWBIE', 'delivery', 2.99, 0, TRUE);

INSERT INTO Wishlists (UserID)
VALUES (3);

INSERT INTO WishlistItems (WishlistID, ProductID)
VALUES (1, 2), (1, 4);

INSERT INTO Orders (CustomerID, ShipperID, AddressID, PromotionID, DeliveryPhone, SubTotal, ShippingFee, Discount, OrderStatus)
VALUES (3, NULL, 1, 1, '0911223344', 32.97, 2.99, 6.59, 'pending');

INSERT INTO OrderDetails (OrderID, ProductID, Quantity, UnitPrice)
VALUES
(1, 1, 1, 14.99),
(1, 3, 1, 5.49),
(1, 4, 2, 5.99);

INSERT INTO OrderCombos (OrderID, ComboID, Quantity, UnitPrice)
VALUES (1, 1, 1, 17.99);

INSERT INTO Payments (OrderID, Amount, Method, Status)
VALUES (1, 29.37, 'Cash', 'unpaid');

INSERT INTO ProductReviews (ProductID, UserID, Stars, ReviewText)
VALUES
(1, 3, 5, 'Amazing spicy flavor!'),
(2, 3, 4, 'Great pizza and crust.');
