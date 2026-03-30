from models.database import get_connection
import queue

order_queue = queue.Queue()

def get_all_orders():
    """SELECT tất cả đơn hàng từ bảng Orders"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM Orders")
    rows = cursor.fetchall()
    conn.close()
    return rows

def add_order_to_queue(order_id):
    """Xử lý bảng Orders và hàng đợi (Queue) tài xế"""
    order_queue.put(order_id)

def update_order_status(order_id, status):
    """UPDATE trạng thái đơn hàng"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE Orders SET OrderStatus = ? WHERE OrderID = ?",
        (status, order_id)
    )
    conn.commit()
    conn.close()
