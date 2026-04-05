from models.supabase_client import get_supabase

def get_all_products():
    """SELECT tất cả sản phẩm đang không bị xóa mềm từ bảng Products"""
    sb = get_supabase()
    response = sb.table('products').select('*').execute()
    data = response.data or []
    
    # Filter out products that have been "soft deleted"
    return [p for p in data if not (p.get('description') or '').startswith('DELETED::')]

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


def update_product_metadata(product_id, **kwargs):
    """Update product fields (name, price, description, etc.)"""
    sb = get_supabase()
    
    # Map category name to ID
    category_map = {
        'noodles': 1,
        'pizza': 2,
        'beverages': 3,
        'sides': 4,
    }
    
    # Build update dict with only non-None values
    # Only columns that exist in DB: productid, categoryid, productname,
    # description, price, stockquantity, imageurl, isactive, createdat
    updates = {}
    
    if 'name' in kwargs and kwargs['name']:
        updates['productname'] = kwargs['name']
    
    if 'price' in kwargs and kwargs['price'] is not None:
        updates['price'] = float(kwargs['price'])
    
    if 'description' in kwargs and kwargs['description'] is not None:
        updates['description'] = kwargs['description']
    
    # emoji/tags columns do NOT exist in DB — store emoji in imageurl instead
    if 'emoji' in kwargs and kwargs['emoji']:
        emoji_val = str(kwargs['emoji'])
        if not emoji_val.startswith('http'):
            updates['imageurl'] = emoji_val
    
    if 'image_url' in kwargs and kwargs['image_url']:
        updates['imageurl'] = kwargs['image_url']
    
    # 'tags' column does not exist in DB — skip silently
    
    if 'is_active' in kwargs and kwargs['is_active'] is not None:
        updates['isactive'] = bool(kwargs['is_active'])
    
    # Handle category - convert string to numeric ID if needed
    if 'category_id' in kwargs and kwargs['category_id'] is not None:
        category_id = kwargs['category_id']
        if isinstance(category_id, str):
            category_id = category_map.get(category_id.lower(), 1)
        updates['categoryid'] = int(category_id)
    
    if not updates:
        return True  # Nothing to update
    
    try:
        resp = sb.table('products').update(updates).eq('productid', product_id).execute()
        return bool(resp.data)
    except Exception as e:
        print(f"Error updating product: {e}")
        raise


def create_product(**kwargs):
    """Create a new product."""
    sb = get_supabase()
    
    # Map category name to ID
    category_map = {
        'noodles': 1,
        'pizza': 2,
        'beverages': 3,
        'sides': 4,
    }
    
    # Get values with defaults
    productname = kwargs.get('name') or 'Unnamed Product'
    price = kwargs.get('price') or 0
    description = kwargs.get('description') or ''
    emoji = kwargs.get('emoji') or ''  # stored in imageurl as fallback
    is_active = kwargs.get('is_active', True)
    stock_quantity = kwargs.get('stock_quantity', 100)
    
    # Handle category
    category_id = kwargs.get('category_id', 1)
    if isinstance(category_id, str):
        category_id = category_map.get(category_id.lower(), 1)
    
    # Use emoji as imageurl placeholder if no real image
    image_url = kwargs.get('image_url') or ''
    if not image_url and emoji and not emoji.startswith('http'):
        image_url = emoji
    
    # Build insert data — ONLY columns that exist in the actual DB schema
    insert_data = {
        'productname': productname,
        'price': float(price),
        'description': description,
        'categoryid': int(category_id),
        'imageurl': image_url,
        'isactive': bool(is_active),
        'stockquantity': int(stock_quantity),
    }
    
    try:
        resp = sb.table('products').insert(insert_data).execute()
        if resp.data and len(resp.data) > 0:
            return resp.data[0]
        return None
    except Exception as e:
        print(f"Error creating product: {e}")
        raise

def delete_product(product_id):
    """Delete a product. Hard deletes if possible, otherwise soft-deletes so old orders don't break."""
    sb = get_supabase()
    try:
        # Step 1: Attempt Hard delete the product directly
        # This will ONLY succeed if no old orders/combos reference it
        resp = sb.table('products').delete().eq('productid', product_id).execute()
        return True, "Product deleted completely (Hard delete)"
    except Exception as e:
        # Step 2: If it fails (Foreign Key constraint from past orders), doing a Soft Delete
        try:
            # Fetch current description to append the flag
            p_data = sb.table('products').select('description').eq('productid', product_id).execute().data
            current_desc = p_data[0].get('description') or '' if p_data else ''
            
            # Hide it from API lists by using magic prefix DELETED::
            if not current_desc.startswith('DELETED::'):
                new_desc = f"DELETED::{current_desc}"
            else:
                new_desc = current_desc
                
            sb.table('products').update({
                'isactive': False,
                'description': new_desc
            }).eq('productid', product_id).execute()
            
            return True, "Hệ thống đã chọn Xóa Thẻ (Soft-delete) vì nó nằm trong đơn hàng cũ để tránh lỗi hóa đơn!"
        except Exception as e2:
            print(f"Error soft deleting product: {e2}")
            return False, f"Failed to delete: {str(e2)}"

