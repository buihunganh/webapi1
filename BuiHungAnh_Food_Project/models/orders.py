import queue
from models.supabase_client import get_supabase

order_queue = queue.Queue()

def get_all_orders():
    """SELECT tất cả đơn hàng từ bảng Orders"""
    sb = get_supabase()
    response = sb.table('orders').select('*').execute()
    return response.data or []

def add_order_to_queue(order_id):
    """Xử lý bảng Orders và hàng đợi (Queue) tài xế"""
    order_queue.put(order_id)

def update_order_status(order_id, status):
    """UPDATE trạng thái đơn hàng"""
    sb = get_supabase()
    response = sb.table('orders').update({'orderstatus': status}).eq('orderid', order_id).execute()
    if not response.data:
        raise RuntimeError(f'Order {order_id} not found or unchanged')
