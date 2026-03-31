from models.supabase_client import get_supabase

def get_all_products():
    """SELECT tất cả sản phẩm từ bảng Products"""
    sb = get_supabase()
    response = sb.table('products').select('*').execute()
    return response.data or []

def update_product_stock(product_id, quantity):
    """UPDATE tồn kho bảng Products"""
    sb = get_supabase()
    read_resp = sb.table('products').select('stockquantity').eq('productid', product_id).limit(1).execute()
    rows = read_resp.data or []
    if not rows:
        return False

    current_stock = int(rows[0].get('stockquantity') or 0)
    if current_stock < quantity:
        return False

    new_stock = current_stock - quantity
    update_resp = sb.table('products').update({'stockquantity': new_stock}).eq('productid', product_id).execute()
    return bool(update_resp.data)


def update_product_image_url(product_id, image_url):
    """Update product image URL in Products table."""
    sb = get_supabase()
    resp = sb.table('products').update({'imageurl': image_url}).eq('productid', product_id).execute()
    return bool(resp.data)
