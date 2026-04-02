from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from typing import Dict, Iterable, List, Tuple

from models.supabase_client import get_supabase

TWOPLACES = Decimal('0.01')
DEFAULT_SHIPPING_FEE = Decimal('2.99')
PAYMENT_METHOD_MAP = {
    'cod': 'Cash',
    'cash': 'Cash',
    'card': 'Card',
    'momo': 'Momo',
    'wallet': 'Momo',
    'bank': 'BankTransfer',
    'banktransfer': 'BankTransfer',
}


def _to_decimal(value, default: Decimal | str = '0') -> Decimal:
    if isinstance(value, Decimal):
        return value
    default_val = Decimal(str(default))
    try:
        return Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return default_val


def _quantize_money(value: Decimal) -> Decimal:
    return value.quantize(TWOPLACES, rounding=ROUND_HALF_UP)


def _format_display_id(order_id: int) -> str:
    return f"#SF-{int(order_id):04d}"


def _parse_iso_datetime(raw_value):
    if not raw_value:
        return None
    if isinstance(raw_value, datetime):
        return raw_value
    try:
        cleaned = str(raw_value).replace('Z', '+00:00')
        return datetime.fromisoformat(cleaned)
    except ValueError:
        return None


def get_all_orders(limit: int = 200):
    """SELECT tất cả đơn hàng từ bảng Orders (kèm khách hàng)."""
    sb = get_supabase()
    response = (
        sb.table('orders')
        .select('*, customer:customerid(fullname,email,phone)')
        .order('orderdate', desc=True)
        .limit(limit)
        .execute()
    )
    return response.data or []


def update_order_status(order_id, status):
    """UPDATE trạng thái đơn hàng"""
    sb = get_supabase()
    response = sb.table('orders').update({'orderstatus': status}).eq('orderid', order_id).execute()
    if not response.data:
        raise RuntimeError(f'Order {order_id} not found or unchanged')


def _fetch_products_map(sb, product_ids: Iterable[int]) -> Dict[int, Dict]:
    ids = {int(pid) for pid in product_ids if int(pid) > 0}
    if not ids:
        return {}
    query = sb.table('products').select('productid, productname, price').in_('productid', list(ids))
    resp = query.execute()
    rows = resp.data or []
    return {int(row['productid']): row for row in rows}


def _ensure_user_address(sb, user_id: int, full_address: str | None, city: str | None, address_id: int | None) -> int | None:
    if address_id:
        return address_id
    if not full_address:
        return None

    existing = (
        sb.table('useraddresses')
        .select('addressid')
        .eq('userid', user_id)
        .eq('fulladdress', full_address)
        .limit(1)
        .execute()
    )
    rows = existing.data or []
    if rows:
        return rows[0]['addressid']

    current = sb.table('useraddresses').select('addressid').eq('userid', user_id).execute()
    set_default = not (current.data or [])
    insert = sb.table('useraddresses').insert({
        'userid': user_id,
        'fulladdress': full_address,
        'city': city,
        'isdefault': set_default,
    }).execute()
    inserted = insert.data or []
    return inserted[0]['addressid'] if inserted else None


def _resolve_promotion(sb, promo_code: str | None, subtotal: Decimal, shipping_fee: Decimal) -> Tuple[int | None, Decimal, Decimal]:
    if not promo_code:
        return None, Decimal('0.00'), shipping_fee

    lookup = (
        sb.table('promotions')
        .select('promotionid, discounttype, discountvalue, minorderamount, isactive, startdate, enddate')
        .eq('code', promo_code.upper())
        .eq('isactive', True)
        .limit(1)
        .execute()
    )
    rows = lookup.data or []
    if not rows:
        raise ValueError('Promotion code không hợp lệ hoặc đã hết hạn')

    promo = rows[0]
    now = datetime.now(timezone.utc)
    start_dt = _parse_iso_datetime(promo.get('startdate'))
    end_dt = _parse_iso_datetime(promo.get('enddate'))
    if start_dt and now < start_dt:
        raise ValueError('Mã khuyến mãi chưa bắt đầu áp dụng')
    if end_dt and now > end_dt:
        raise ValueError('Mã khuyến mãi đã hết hạn')

    min_amount = _to_decimal(promo.get('minorderamount') or '0')
    if subtotal < min_amount:
        raise ValueError('Đơn hàng chưa đạt giá trị tối thiểu cho mã khuyến mãi')

    promo_value = _to_decimal(promo.get('discountvalue') or '0')
    discount_type = str(promo.get('discounttype') or '').lower()
    discount_value = Decimal('0.00')
    adjusted_shipping = shipping_fee

    if discount_type == 'percent':
        discount_value = subtotal * promo_value / Decimal('100')
    elif discount_type == 'flat':
        discount_value = promo_value
    elif discount_type == 'delivery':
        discount_value = shipping_fee if shipping_fee > 0 else promo_value
        adjusted_shipping = Decimal('0.00')
    else:
        raise ValueError('Loại khuyến mãi không được hỗ trợ')

    discount_value = _quantize_money(discount_value)
    adjusted_shipping = _quantize_money(adjusted_shipping)
    max_discount = subtotal + adjusted_shipping
    if discount_value > max_discount:
        discount_value = max_discount

    return promo['promotionid'], discount_value, adjusted_shipping


def create_order(
    *,
    customer_id: int,
    items: List[Dict],
    shipping_fee=None,
    promotion_code: str | None = None,
    delivery_phone: str | None = None,
    address_id: int | None = None,
    delivery_address: str | None = None,
    city: str | None = None,
    notes: str | None = None,
    payment_method: str | None = None,
    customer_name: str | None = None,
):
    if not customer_id:
        raise ValueError('customer_id is required')
    if not items or not isinstance(items, list):
        raise ValueError('items must chứa tối thiểu 1 sản phẩm')

    normalized_items: List[Dict[str, int]] = []
    for raw in items:
        try:
            product_id = int(raw.get('product_id'))
            quantity = int(raw.get('quantity'))
        except (TypeError, ValueError):
            raise ValueError('Mỗi item cần product_id và quantity hợp lệ')
        if product_id <= 0 or quantity <= 0:
            raise ValueError('product_id và quantity phải lớn hơn 0')
        normalized_items.append({'product_id': product_id, 'quantity': quantity})

    sb = get_supabase()
    products_map = _fetch_products_map(sb, (item['product_id'] for item in normalized_items))
    missing = [item['product_id'] for item in normalized_items if item['product_id'] not in products_map]
    if missing:
        raise ValueError(f'Sản phẩm không tồn tại: {", ".join(map(str, missing))}')

    subtotal = Decimal('0.00')
    detail_rows = []
    items_response = []
    for item in normalized_items:
        product_row = products_map[item['product_id']]
        unit_price = _to_decimal(product_row.get('price') or '0')
        line_total = unit_price * item['quantity']
        subtotal += line_total
        detail_rows.append({
            'productid': item['product_id'],
            'quantity': item['quantity'],
            'unitprice': float(_quantize_money(unit_price)),
        })
        items_response.append({
            'product_id': item['product_id'],
            'name': product_row.get('productname') or f'Product {item["product_id"]}',
            'quantity': item['quantity'],
            'unit_price': float(_quantize_money(unit_price)),
        })

    subtotal = _quantize_money(subtotal)
    shipping_decimal = _quantize_money(max(_to_decimal(shipping_fee if shipping_fee is not None else DEFAULT_SHIPPING_FEE, DEFAULT_SHIPPING_FEE), Decimal('0.00')))
    promotion_id, discount_value, adjusted_shipping = _resolve_promotion(sb, promotion_code, subtotal, shipping_decimal)
    total_amount = subtotal + adjusted_shipping - discount_value
    if total_amount < 0:
        total_amount = Decimal('0.00')

    resolved_address_id = _ensure_user_address(sb, customer_id, delivery_address, city, address_id)
    order_payload = {
        'customerid': customer_id,
        'shipperid': None,
        'addressid': resolved_address_id,
        'promotionid': promotion_id,
        'deliveryphone': delivery_phone,
        'subtotal': float(subtotal),
        'shippingfee': float(adjusted_shipping),
        'discount': float(discount_value),
        'orderstatus': 'pending',
        'notes': notes,
    }

    order_resp = sb.table('orders').insert(order_payload).execute()
    created_rows = order_resp.data or []
    if not created_rows:
        raise RuntimeError('Không thể tạo đơn hàng')

    created_order = created_rows[0]
    order_id = created_order['orderid']
    for row in detail_rows:
        row['orderid'] = order_id
    sb.table('orderdetails').insert(detail_rows).execute()

    payment_label = PAYMENT_METHOD_MAP.get(str(payment_method or 'cod').lower(), 'Cash')
    payment_payload = {
        'orderid': order_id,
        'amount': float(_quantize_money(total_amount)),
        'method': payment_label,
        'status': 'unpaid' if payment_label != 'Card' else 'paid',
    }
    sb.table('payments').insert(payment_payload).execute()

    items_summary = ', '.join(f"{item['name']} x{item['quantity']}" for item in items_response)
    return {
        'order_id': order_id,
        'display_id': _format_display_id(order_id),
        'customer_id': customer_id,
        'customer_name': customer_name,
        'promotion_id': promotion_id,
        'subtotal': float(subtotal),
        'shipping_fee': float(adjusted_shipping),
        'discount': float(discount_value),
        'total_amount': float(_quantize_money(total_amount)),
        'items': items_response,
        'items_summary': items_summary,
        'order_date': created_order.get('orderdate'),
        'status': created_order.get('orderstatus', 'pending'),
        'payment': payment_payload,
    }
