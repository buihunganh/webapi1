import os

from flask import Blueprint, current_app, jsonify, render_template, request, send_from_directory

from models.supabase_client import get_supabase
from models.products import get_all_products, update_product_image_url
from models.orders import create_order, get_all_orders, update_order_status
from models.users import get_all_users, get_user_by_email, hash_password, insert_user, verify_password

customer_bp = Blueprint('customer', __name__)


def _resolve_role(role_id: int) -> str:
    if role_id == 1:
        return 'admin'
    if role_id == 2:
        return 'shipper'
    return 'customer'


def _serialize_auth_user(user: dict) -> dict:
    role_id = int(user.get('roleid') or 3)
    return {
        "id": user.get('userid'),
        "name": user.get('fullname'),
        "email": user.get('email'),
        "phone": user.get('phone'),
        "role": _resolve_role(role_id),
        "role_id": role_id,
    }

@customer_bp.route('/')
@customer_bp.route('/index.html')
def homepage_file():
    """Serve root landing page first."""
    return render_template('index.html')


@customer_bp.route('/customer')
def customer_portal():
    """Customer portal page."""
    return render_template('customer/customer.html')


@customer_bp.route('/api/health', methods=['GET'])
def api_health():
    """Health check app + database."""
    try:
        sb = get_supabase()
        ping = sb.table('products').select('productid').limit(1).execute()
        return jsonify({"ok": True, "database": "supabase", "rows_checked": len(ping.data or [])}), 200
    except Exception as exc:
        return jsonify({"ok": False, "error": str(exc)}), 500


@customer_bp.route('/api/config', methods=['GET'])
def api_config():
    """Expose non-secret frontend config values."""
    supabase_url = os.getenv('SUPABASE_URL')
    publishable_key = os.getenv('SUPABASE_PUBLISHABLE_KEY')

    if not supabase_url or not publishable_key:
        return jsonify({"ok": False, "error": "Supabase config is missing"}), 500

    return jsonify({
        "ok": True,
        "supabase_url": supabase_url,
        "supabase_publishable_key": publishable_key,
    }), 200


@customer_bp.route('/api/users', methods=['GET'])
def api_users():
    """List users for quick API checks."""
    limit = request.args.get('limit', default=20, type=int)
    limit = max(1, min(limit, 500))
    data = get_all_users(limit)
    return jsonify({"count": len(data), "items": data}), 200


@customer_bp.route('/api/products', methods=['GET'])
def api_products():
    """List products for quick API checks."""
    limit = request.args.get('limit', default=20, type=int)
    limit = max(1, min(limit, 500))

    data = get_all_products()[:limit]
    return jsonify({"count": len(data), "items": data}), 200


@customer_bp.route('/api/products/<int:product_id>/image', methods=['POST'])
def api_update_product_image(product_id):
    """Persist uploaded product image URL."""
    payload = request.get_json(silent=True) or {}
    image_url = (payload.get('image_url') or '').strip()

    if not image_url:
        return jsonify({"ok": False, "error": "image_url is required"}), 400

    try:
        ok = update_product_image_url(product_id, image_url)
        if not ok:
            return jsonify({"ok": False, "error": "Product not found or update failed"}), 404
        return jsonify({"ok": True, "product_id": product_id, "image_url": image_url}), 200
    except Exception as exc:
        return jsonify({"ok": False, "error": str(exc)}), 500


@customer_bp.route('/api/orders', methods=['GET'])
def api_orders():
    """List orders for quick API checks."""
    limit = request.args.get('limit', default=20, type=int)
    limit = max(1, min(limit, 500))

    data = get_all_orders(limit)
    return jsonify({"count": len(data), "items": data}), 200


@customer_bp.route('/api/orders', methods=['POST'])
def api_create_order():
    """Create a new order directly from the storefront checkout."""
    payload = request.get_json(silent=True) or {}

    try:
        customer_id = int(payload.get('customer_id') or 0)
    except (TypeError, ValueError):
        customer_id = 0

    items = payload.get('items') or []
    if customer_id <= 0:
        return jsonify({"ok": False, "error": "customer_id is required"}), 400
    if not isinstance(items, list) or not items:
        return jsonify({"ok": False, "error": "items must be a non-empty list"}), 400

    shipping_fee = payload.get('shipping_fee')
    promotion_code = payload.get('promotion_code')
    delivery_phone = (payload.get('delivery_phone') or '').strip() or None
    delivery_address = (payload.get('delivery_address') or '').strip() or None
    city = (payload.get('city') or '').strip() or None
    notes = (payload.get('notes') or '').strip() or None
    payment_method = (payload.get('payment_method') or 'cod').strip().lower()
    customer_name = (payload.get('customer_name') or '').strip() or None
    lat = payload.get('latitude')
    lng = payload.get('longitude')
    estimated_eta = payload.get('estimated_eta')

    address_id = payload.get('address_id')
    try:
        address_id = int(address_id) if address_id is not None else None
    except (TypeError, ValueError):
        address_id = None

    try:
        order_summary = create_order(
            customer_id=customer_id,
            items=items,
            shipping_fee=shipping_fee,
            promotion_code=promotion_code,
            delivery_phone=delivery_phone,
            address_id=address_id,
            delivery_address=delivery_address,
            city=city,
            notes=notes,
            payment_method=payment_method,
            customer_name=customer_name,
            lat=lat,
            lng=lng,
            estimated_eta=estimated_eta,
        )
        return jsonify({"ok": True, "order": order_summary}), 201
    except ValueError as exc:
        return jsonify({"ok": False, "error": str(exc)}), 400
    except Exception:
        current_app.logger.exception('Failed to create order')
        return jsonify({"ok": False, "error": "Failed to create order"}), 500


@customer_bp.route('/api/orders/<int:order_id>/status', methods=['POST'])
def api_update_order_status(order_id):
    """Update order status to verify write operation."""
    payload = request.get_json(silent=True) or {}
    status = payload.get('status')
    allowed_statuses = {
        'pending', 'waiting_for_shipper', 'shipping', 'completed', 'cancelled'
    }

    if status not in allowed_statuses:
        return jsonify({
            "ok": False,
            "error": "Invalid status",
            "allowed": sorted(list(allowed_statuses))
        }), 400

    try:
        shipper_id = payload.get('shipper_id')
        update_order_status(order_id, status, shipper_id=shipper_id)
        return jsonify({"ok": True, "order_id": order_id, "new_status": status}), 200
    except Exception as exc:
        return jsonify({"ok": False, "error": str(exc)}), 500


@customer_bp.route('/api/orders/<int:order_id>/location', methods=['POST'])
def api_update_shipper_location(order_id):
    """Endpoint for shippers to update their real-time location (every 5s)."""
    from models.orders import update_shipper_location
    payload = request.get_json(silent=True) or {}
    lat = payload.get('lat')
    lng = payload.get('lng')

    if lat is None or lng is None:
        return jsonify({"ok": False, "error": "lat and lng are required"}), 400

    try:
        ok = update_shipper_location(order_id, float(lat), float(lng))
        if not ok:
            return jsonify({"ok": False, "error": "Order not found"}), 404
        return jsonify({"ok": True}), 200
    except Exception as exc:
        return jsonify({"ok": False, "error": str(exc)}), 500


@customer_bp.route('/api/auth/login', methods=['POST'])
def api_auth_login():
    payload = request.get_json(silent=True) or {}
    email = (payload.get('email') or '').strip().lower()
    password = payload.get('password') or ''

    if not email or not password:
        return jsonify({"ok": False, "error": "Email and password are required"}), 400

    try:
        user = get_user_by_email(email)
        if not user:
            return jsonify({"ok": False, "error": "Account not found"}), 404

        if not bool(user.get('isactive')):
            return jsonify({"ok": False, "error": "Account is inactive"}), 403

        if not verify_password(password, user.get('passwordhash')):
            return jsonify({"ok": False, "error": "Wrong password"}), 401

        return jsonify({
            "ok": True,
            "user": _serialize_auth_user(user)
        }), 200
    except Exception:
        current_app.logger.exception('Login failed')
        return jsonify({"ok": False, "error": "Login failed"}), 500


@customer_bp.route('/api/auth/register', methods=['POST'])
def api_auth_register():
    payload = request.get_json(silent=True) or {}
    full_name = (payload.get('full_name') or '').strip()
    email = (payload.get('email') or '').strip().lower()
    phone = (payload.get('phone') or '').strip() or None
    password = payload.get('password') or ''

    if not full_name or not email or not password:
        return jsonify({"ok": False, "error": "full_name, email, password are required"}), 400

    if len(password) < 8:
        return jsonify({"ok": False, "error": "Password must be at least 8 characters"}), 400

    try:
        existing = get_user_by_email(email)
        if existing:
            return jsonify({"ok": False, "error": "Email already registered"}), 409

        password_hash = hash_password(password)
        new_id = insert_user(full_name, email, password_hash, role_id=3, phone=phone)

        return jsonify({
            "ok": True,
            "user": {
                "id": new_id,
                "name": full_name,
                "email": email,
                "phone": phone,
                "role": 'customer',
                "role_id": 3,
            }
        }), 201
    except Exception:
        current_app.logger.exception('Register failed')
        return jsonify({"ok": False, "error": "Register failed"}), 500


@customer_bp.route('/api/auth/profile', methods=['GET'])
def api_auth_profile():
    """Get app profile by email for role mapping after Supabase auth."""
    email = (request.args.get('email') or '').strip().lower()
    if not email:
        return jsonify({"ok": False, "error": "Email is required"}), 400

    try:
        user = get_user_by_email(email)
        if not user:
            return jsonify({"ok": False, "error": "Profile not found"}), 404
        return jsonify({
            "ok": True,
            "user": _serialize_auth_user(user)
        }), 200
    except Exception:
        current_app.logger.exception('Load profile failed')
        return jsonify({"ok": False, "error": "Failed to load profile"}), 500
