/*
  FINAL DATABASE SCHEMA - SHISAFOOD
  Target: SQL Server
  Covers: users, roles, addresses, products, categories, combos, promotions,
          orders, order details, order combos, payments, reviews, wishlist.
*/

IF DB_ID(N'BuiHungAnhFood_v3') IS NULL
BEGIN
    CREATE DATABASE BuiHungAnhFood_v3;
END
GO

USE BuiHungAnhFood_v3;
GO

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

/* =========================================================
   Drop objects (safe re-run)
========================================================= */
IF OBJECT_ID('dbo.vw_DailyRevenue', 'V') IS NOT NULL DROP VIEW dbo.vw_DailyRevenue;
GO

IF OBJECT_ID('dbo.OrderCombos', 'U') IS NOT NULL DROP TABLE dbo.OrderCombos;
IF OBJECT_ID('dbo.OrderDetails', 'U') IS NOT NULL DROP TABLE dbo.OrderDetails;
IF OBJECT_ID('dbo.Payments', 'U') IS NOT NULL DROP TABLE dbo.Payments;
IF OBJECT_ID('dbo.Orders', 'U') IS NOT NULL DROP TABLE dbo.Orders;
IF OBJECT_ID('dbo.ComboItems', 'U') IS NOT NULL DROP TABLE dbo.ComboItems;
IF OBJECT_ID('dbo.Combos', 'U') IS NOT NULL DROP TABLE dbo.Combos;
IF OBJECT_ID('dbo.ProductReviews', 'U') IS NOT NULL DROP TABLE dbo.ProductReviews;
IF OBJECT_ID('dbo.WishlistItems', 'U') IS NOT NULL DROP TABLE dbo.WishlistItems;
IF OBJECT_ID('dbo.Wishlists', 'U') IS NOT NULL DROP TABLE dbo.Wishlists;
IF OBJECT_ID('dbo.Promotions', 'U') IS NOT NULL DROP TABLE dbo.Promotions;
IF OBJECT_ID('dbo.Products', 'U') IS NOT NULL DROP TABLE dbo.Products;
IF OBJECT_ID('dbo.Categories', 'U') IS NOT NULL DROP TABLE dbo.Categories;
IF OBJECT_ID('dbo.UserAddresses', 'U') IS NOT NULL DROP TABLE dbo.UserAddresses;
IF OBJECT_ID('dbo.Users', 'U') IS NOT NULL DROP TABLE dbo.Users;
IF OBJECT_ID('dbo.Roles', 'U') IS NOT NULL DROP TABLE dbo.Roles;
GO

/* =========================================================
   Identity / User
========================================================= */
CREATE TABLE dbo.Roles (
    RoleID INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    RoleName VARCHAR(30) NOT NULL,
    CONSTRAINT UQ_Roles_RoleName UNIQUE (RoleName)
);
GO

CREATE TABLE dbo.Users (
    UserID INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    FullName NVARCHAR(120) NOT NULL,
    Email VARCHAR(150) NOT NULL,
    Phone VARCHAR(15) NULL,
    PasswordHash VARCHAR(255) NOT NULL,
    RoleID INT NOT NULL,
    IsActive BIT NOT NULL CONSTRAINT DF_Users_IsActive DEFAULT (1),
    CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_Users_CreatedAt DEFAULT (SYSDATETIME()),
    CONSTRAINT FK_Users_Roles FOREIGN KEY (RoleID) REFERENCES dbo.Roles(RoleID),
    CONSTRAINT UQ_Users_Email UNIQUE (Email)
);
GO

CREATE UNIQUE INDEX IX_Users_Phone_NotNull
ON dbo.Users(Phone)
WHERE Phone IS NOT NULL;
GO

CREATE TABLE dbo.UserAddresses (
    AddressID INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    UserID INT NOT NULL,
    FullAddress NVARCHAR(255) NOT NULL,
    City NVARCHAR(100) NULL,
    IsDefault BIT NOT NULL CONSTRAINT DF_UserAddresses_IsDefault DEFAULT (0),
    CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_UserAddresses_CreatedAt DEFAULT (SYSDATETIME()),
    CONSTRAINT FK_UserAddresses_Users FOREIGN KEY (UserID) REFERENCES dbo.Users(UserID)
);
GO

/* =========================================================
   Catalog
========================================================= */
CREATE TABLE dbo.Categories (
    CategoryID INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    CategoryName NVARCHAR(100) NOT NULL,
    CONSTRAINT UQ_Categories_Name UNIQUE (CategoryName)
);
GO

CREATE TABLE dbo.Products (
    ProductID INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    CategoryID INT NOT NULL,
    ProductName NVARCHAR(120) NOT NULL,
    Description NVARCHAR(600) NULL,
    Price DECIMAL(18,2) NOT NULL,
    StockQuantity INT NOT NULL CONSTRAINT DF_Products_StockQuantity DEFAULT (0),
    ImageURL VARCHAR(500) NULL,
    IsActive BIT NOT NULL CONSTRAINT DF_Products_IsActive DEFAULT (1),
    CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_Products_CreatedAt DEFAULT (SYSDATETIME()),
    CONSTRAINT FK_Products_Categories FOREIGN KEY (CategoryID) REFERENCES dbo.Categories(CategoryID),
    CONSTRAINT CK_Products_Price CHECK (Price >= 0),
    CONSTRAINT CK_Products_Stock CHECK (StockQuantity >= 0)
);
GO

/* =========================================================
   Combo
========================================================= */
CREATE TABLE dbo.Combos (
    ComboID INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    ComboCode VARCHAR(50) NOT NULL,
    ComboName NVARCHAR(120) NOT NULL,
    Description NVARCHAR(400) NULL,
    Price DECIMAL(18,2) NOT NULL,
    IsActive BIT NOT NULL CONSTRAINT DF_Combos_IsActive DEFAULT (1),
    CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_Combos_CreatedAt DEFAULT (SYSDATETIME()),
    CONSTRAINT UQ_Combos_Code UNIQUE (ComboCode),
    CONSTRAINT CK_Combos_Price CHECK (Price >= 0)
);
GO

CREATE TABLE dbo.ComboItems (
    ComboItemID INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    ComboID INT NOT NULL,
    ProductID INT NOT NULL,
    Quantity INT NOT NULL,
    CONSTRAINT FK_ComboItems_Combos FOREIGN KEY (ComboID) REFERENCES dbo.Combos(ComboID),
    CONSTRAINT FK_ComboItems_Products FOREIGN KEY (ProductID) REFERENCES dbo.Products(ProductID),
    CONSTRAINT CK_ComboItems_Quantity CHECK (Quantity > 0)
);
GO

/* =========================================================
   Promotion
========================================================= */
CREATE TABLE dbo.Promotions (
    PromotionID INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    Code VARCHAR(30) NOT NULL,
    DiscountType VARCHAR(20) NOT NULL,
    DiscountValue DECIMAL(18,2) NOT NULL,
    MinOrderAmount DECIMAL(18,2) NOT NULL CONSTRAINT DF_Promotions_MinOrder DEFAULT (0),
    IsActive BIT NOT NULL CONSTRAINT DF_Promotions_IsActive DEFAULT (1),
    StartDate DATETIME2 NULL,
    EndDate DATETIME2 NULL,
    CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_Promotions_CreatedAt DEFAULT (SYSDATETIME()),
    CONSTRAINT UQ_Promotions_Code UNIQUE (Code),
    CONSTRAINT CK_Promotions_Type CHECK (DiscountType IN ('percent','flat','delivery')),
    CONSTRAINT CK_Promotions_Value CHECK (DiscountValue >= 0)
);
GO

/* =========================================================
   Wishlist + Reviews
========================================================= */
CREATE TABLE dbo.Wishlists (
    WishlistID INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    UserID INT NOT NULL,
    CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_Wishlists_CreatedAt DEFAULT (SYSDATETIME()),
    CONSTRAINT FK_Wishlists_Users FOREIGN KEY (UserID) REFERENCES dbo.Users(UserID),
    CONSTRAINT UQ_Wishlists_User UNIQUE (UserID)
);
GO

CREATE TABLE dbo.WishlistItems (
    WishlistItemID INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    WishlistID INT NOT NULL,
    ProductID INT NOT NULL,
    CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_WishlistItems_CreatedAt DEFAULT (SYSDATETIME()),
    CONSTRAINT FK_WishlistItems_Wishlists FOREIGN KEY (WishlistID) REFERENCES dbo.Wishlists(WishlistID),
    CONSTRAINT FK_WishlistItems_Products FOREIGN KEY (ProductID) REFERENCES dbo.Products(ProductID),
    CONSTRAINT UQ_WishlistItems UNIQUE (WishlistID, ProductID)
);
GO

CREATE TABLE dbo.ProductReviews (
    ReviewID INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    ProductID INT NOT NULL,
    UserID INT NOT NULL,
    Stars TINYINT NOT NULL,
    ReviewText NVARCHAR(1000) NOT NULL,
    CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_ProductReviews_CreatedAt DEFAULT (SYSDATETIME()),
    IsVisible BIT NOT NULL CONSTRAINT DF_ProductReviews_IsVisible DEFAULT (1),
    CONSTRAINT FK_ProductReviews_Products FOREIGN KEY (ProductID) REFERENCES dbo.Products(ProductID),
    CONSTRAINT FK_ProductReviews_Users FOREIGN KEY (UserID) REFERENCES dbo.Users(UserID),
    CONSTRAINT CK_ProductReviews_Stars CHECK (Stars BETWEEN 1 AND 5)
);
GO

/* =========================================================
   Orders + Payments
========================================================= */
CREATE TABLE dbo.Orders (
    OrderID INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    CustomerID INT NOT NULL,
    ShipperID INT NULL,
    AddressID INT NULL,
    PromotionID INT NULL,
    OrderDate DATETIME2 NOT NULL CONSTRAINT DF_Orders_OrderDate DEFAULT (SYSDATETIME()),
    DeliveredDate DATETIME2 NULL,
    DeliveryPhone VARCHAR(15) NULL,
    SubTotal DECIMAL(18,2) NOT NULL,
    ShippingFee DECIMAL(18,2) NOT NULL CONSTRAINT DF_Orders_ShippingFee DEFAULT (0),
    Discount DECIMAL(18,2) NOT NULL CONSTRAINT DF_Orders_Discount DEFAULT (0),
    TotalAmount AS ((SubTotal + ShippingFee) - Discount),
    OrderStatus VARCHAR(30) NOT NULL CONSTRAINT DF_Orders_OrderStatus DEFAULT ('pending'),
    Notes NVARCHAR(255) NULL,
    CONSTRAINT FK_Orders_Customer FOREIGN KEY (CustomerID) REFERENCES dbo.Users(UserID),
    CONSTRAINT FK_Orders_Shipper FOREIGN KEY (ShipperID) REFERENCES dbo.Users(UserID),
    CONSTRAINT FK_Orders_Address FOREIGN KEY (AddressID) REFERENCES dbo.UserAddresses(AddressID),
    CONSTRAINT FK_Orders_Promotion FOREIGN KEY (PromotionID) REFERENCES dbo.Promotions(PromotionID),
    CONSTRAINT CK_Orders_SubTotal CHECK (SubTotal >= 0),
    CONSTRAINT CK_Orders_ShippingFee CHECK (ShippingFee >= 0),
    CONSTRAINT CK_Orders_Discount CHECK (Discount >= 0),
    CONSTRAINT CK_Orders_Status CHECK (OrderStatus IN ('pending','waiting_for_shipper','shipping','completed','cancelled'))
);
GO

CREATE TABLE dbo.OrderDetails (
    OrderDetailID INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    OrderID INT NOT NULL,
    ProductID INT NOT NULL,
    Quantity INT NOT NULL,
    UnitPrice DECIMAL(18,2) NOT NULL,
    CONSTRAINT FK_OrderDetails_Orders FOREIGN KEY (OrderID) REFERENCES dbo.Orders(OrderID),
    CONSTRAINT FK_OrderDetails_Products FOREIGN KEY (ProductID) REFERENCES dbo.Products(ProductID),
    CONSTRAINT CK_OrderDetails_Quantity CHECK (Quantity > 0),
    CONSTRAINT CK_OrderDetails_UnitPrice CHECK (UnitPrice >= 0)
);
GO

CREATE TABLE dbo.OrderCombos (
    OrderComboID INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    OrderID INT NOT NULL,
    ComboID INT NOT NULL,
    Quantity INT NOT NULL,
    UnitPrice DECIMAL(18,2) NOT NULL,
    CONSTRAINT FK_OrderCombos_Orders FOREIGN KEY (OrderID) REFERENCES dbo.Orders(OrderID),
    CONSTRAINT FK_OrderCombos_Combos FOREIGN KEY (ComboID) REFERENCES dbo.Combos(ComboID),
    CONSTRAINT CK_OrderCombos_Quantity CHECK (Quantity > 0),
    CONSTRAINT CK_OrderCombos_UnitPrice CHECK (UnitPrice >= 0)
);
GO

CREATE TABLE dbo.Payments (
    PaymentID INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    OrderID INT NOT NULL,
    Amount DECIMAL(18,2) NOT NULL,
    Method VARCHAR(20) NOT NULL,
    Status VARCHAR(20) NOT NULL CONSTRAINT DF_Payments_Status DEFAULT ('unpaid'),
    PaidAt DATETIME2 NULL,
    CONSTRAINT FK_Payments_Orders FOREIGN KEY (OrderID) REFERENCES dbo.Orders(OrderID),
    CONSTRAINT CK_Payments_Amount CHECK (Amount >= 0),
    CONSTRAINT CK_Payments_Method CHECK (Method IN ('Cash','Card','BankTransfer','Momo')),
    CONSTRAINT CK_Payments_Status CHECK (Status IN ('unpaid','paid','failed','refunded'))
);
GO

/* =========================================================
   View
========================================================= */
CREATE VIEW dbo.vw_DailyRevenue AS
SELECT
    CAST(o.DeliveredDate AS DATE) AS ReportDate,
    COUNT(DISTINCT o.OrderID) AS TotalOrders,
    SUM(o.SubTotal) AS FoodRevenue,
    SUM(o.ShippingFee) AS ShippingRevenue,
    SUM(o.Discount) AS DiscountAmount,
    SUM(o.TotalAmount) AS NetRevenue
FROM dbo.Orders o
JOIN dbo.Payments p ON p.OrderID = o.OrderID
WHERE o.OrderStatus = 'completed'
  AND p.Status = 'paid'
GROUP BY CAST(o.DeliveredDate AS DATE);
GO

/* =========================================================
   Seed data
========================================================= */
INSERT INTO dbo.Roles (RoleName)
VALUES ('Admin'), ('Shipper'), ('Customer');

INSERT INTO dbo.Users (FullName, Email, Phone, PasswordHash, RoleID)
VALUES
(N'Admin User', 'admin@shisa.com', '0901234567', 'hashed_admin', 1),
(N'Shipper User', 'shipper@shisa.com', '0987654321', 'hashed_shipper', 2),
(N'Customer Demo', 'customer@shisa.com', '0911223344', 'hashed_customer', 3);

INSERT INTO dbo.UserAddresses (UserID, FullAddress, City, IsDefault)
VALUES
(3, N'123 Fire Street, Hoan Kiem', N'Hanoi', 1);

INSERT INTO dbo.Categories (CategoryName)
VALUES (N'Noodles'), (N'Pizza'), (N'Beverages'), (N'Sides');

INSERT INTO dbo.Products (CategoryID, ProductName, Description, Price, StockQuantity, IsActive)
VALUES
(1, N'Volcano Noodles', N'Bold spicy noodles.', 14.99, 50, 1),
(2, N'Shisa Spicy Pizza', N'Spicy signature pizza.', 16.99, 40, 1),
(3, N'Dragon Bubble Tea', N'Bubble tea with unique flavor.', 5.49, 100, 1),
(4, N'Volcano Fries', N'Crispy spicy fries.', 5.99, 120, 1);

INSERT INTO dbo.Combos (ComboCode, ComboName, Description, Price, IsActive)
VALUES
('noodle-drink-combo', N'Noodle + Drink Combo', N'One noodle and one drink.', 17.99, 1),
('pizza-party-combo', N'Pizza Party Set', N'Pizza, fries, and drinks.', 29.99, 1),
('mega-feast-combo', N'Mega Shisa Feast', N'Big meal combo.', 44.99, 1);

INSERT INTO dbo.ComboItems (ComboID, ProductID, Quantity)
VALUES
(1, 1, 1),
(1, 3, 1),
(2, 2, 1),
(2, 4, 1),
(3, 1, 1),
(3, 2, 1),
(3, 3, 1),
(3, 4, 1);

INSERT INTO dbo.Promotions (Code, DiscountType, DiscountValue, MinOrderAmount, IsActive)
VALUES
('SHISA20', 'percent', 20, 20, 1),
('FIRE10', 'flat', 10, 35, 1),
('NEWBIE', 'delivery', 2.99, 0, 1);

INSERT INTO dbo.Wishlists (UserID)
VALUES (3);

INSERT INTO dbo.WishlistItems (WishlistID, ProductID)
VALUES (1, 2), (1, 4);

INSERT INTO dbo.Orders (CustomerID, ShipperID, AddressID, PromotionID, DeliveryPhone, SubTotal, ShippingFee, Discount, OrderStatus)
VALUES (3, NULL, 1, 1, '0911223344', 32.97, 2.99, 6.59, 'pending');

INSERT INTO dbo.OrderDetails (OrderID, ProductID, Quantity, UnitPrice)
VALUES
(1, 1, 1, 14.99),
(1, 3, 1, 5.49),
(1, 4, 2, 5.99);

INSERT INTO dbo.OrderCombos (OrderID, ComboID, Quantity, UnitPrice)
VALUES (1, 1, 1, 17.99);

INSERT INTO dbo.Payments (OrderID, Amount, Method, Status)
VALUES (1, 29.37, 'Cash', 'unpaid');

INSERT INTO dbo.ProductReviews (ProductID, UserID, Stars, ReviewText)
VALUES
(1, 3, 5, N'Amazing spicy flavor!'),
(2, 3, 4, N'Great pizza and crust.');
GO
