from models.database import get_connection

def get_all_products():
    """SELECT tất cả sản phẩm từ bảng Products"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM Products")
    rows = cursor.fetchall()
    conn.close()
    return rows

def update_product_stock(product_id, quantity):
    """UPDATE tồn kho bảng Products"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        UPDATE Products
        SET StockQuantity = StockQuantity - ?
        WHERE ProductID = ? AND StockQuantity >= ?
        """,
        (quantity, product_id, quantity)
    )
    conn.commit()
    updated = cursor.rowcount
    conn.close()
    return updated > 0
