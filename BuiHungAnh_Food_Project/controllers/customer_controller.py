from datetime import date, datetime
from decimal import Decimal

from flask import Blueprint, current_app, jsonify, render_template, request, send_from_directory

from models.database import get_connection
from models.orders import update_order_status
from models.users import get_user_by_email, hash_password, insert_user, verify_password

customer_bp = Blueprint('customer', __name__)

@customer_bp.route('/')
@customer_bp.route('/customer')
def index():
    """Xử lý API hiển thị menu, nhận giỏ hàng"""
    return render_template('customer/customer.html')


@customer_bp.route('/index.html')
def homepage_file():
    """Serve root index.html for direct browser access."""
    return send_from_directory(current_app.root_path, 'index.html')


def _serialize_value(value):
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    return value


def _query_rows(sql, params=()):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(sql, params)
    rows = cursor.fetchall()
    columns = [col[0] for col in cursor.description]
    conn.close()

    data = []
    for row in rows:
        item = {}
        for idx, col_name in enumerate(columns):
            item[col_name] = _serialize_value(row[idx])
        data.append(item)
    return data


@customer_bp.route('/api/health', methods=['GET'])
def api_health():
    """Health check app + database."""
    try:
        data = _query_rows("SELECT DB_NAME() AS DatabaseName, @@SERVERNAME AS ServerName")
        return jsonify({"ok": True, "database": data[0]}), 200
    except Exception as exc:
        return jsonify({"ok": False, "error": str(exc)}), 500


@customer_bp.route('/api/users', methods=['GET'])
def api_users():
    """List users for quick API checks."""
    limit = request.args.get('limit', default=20, type=int)
    limit = max(1, min(limit, 200))

    sql = """
        SELECT TOP (?)
            UserID, FullName, Email, Phone, RoleID, IsActive, CreatedAt
        FROM Users
        ORDER BY UserID DESC
    """
    data = _query_rows(sql, (limit,))
    return jsonify({"count": len(data), "items": data}), 200


@customer_bp.route('/api/products', methods=['GET'])
def api_products():
    """List products for quick API checks."""
    limit = request.args.get('limit', default=20, type=int)
    limit = max(1, min(limit, 200))

    sql = """
        SELECT TOP (?)
            ProductID, CategoryID, ProductName, Price, StockQuantity, IsActive, CreatedAt
        FROM Products
        ORDER BY ProductID DESC
    """
    data = _query_rows(sql, (limit,))
    return jsonify({"count": len(data), "items": data}), 200


@customer_bp.route('/api/orders', methods=['GET'])
def api_orders():
    """List orders for quick API checks."""
    limit = request.args.get('limit', default=20, type=int)
    limit = max(1, min(limit, 200))

    sql = """
        SELECT TOP (?)
            OrderID, CustomerID, ShipperID, AddressID, PromotionID,
            DeliveryPhone, SubTotal, ShippingFee, Discount, TotalAmount,
            OrderStatus, OrderDate, DeliveredDate, Notes
        FROM Orders
        ORDER BY OrderID DESC
    """
    data = _query_rows(sql, (limit,))
    return jsonify({"count": len(data), "items": data}), 200


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
        update_order_status(order_id, status)
        return jsonify({"ok": True, "order_id": order_id, "new_status": status}), 200
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

        if not bool(user.IsActive):
            return jsonify({"ok": False, "error": "Account is inactive"}), 403

        if not verify_password(password, user.PasswordHash):
            return jsonify({"ok": False, "error": "Wrong password"}), 401

        role_name = 'customer'
        if user.RoleID == 1:
            role_name = 'admin'
        elif user.RoleID == 2:
            role_name = 'shipper'

        return jsonify({
            "ok": True,
            "user": {
                "id": user.UserID,
                "name": user.FullName,
                "email": user.Email,
                "phone": user.Phone,
                "role": role_name,
                "role_id": user.RoleID,
            }
        }), 200
    except Exception as exc:
        return jsonify({"ok": False, "error": str(exc)}), 500


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
    except Exception as exc:
        return jsonify({"ok": False, "error": str(exc)}), 500
