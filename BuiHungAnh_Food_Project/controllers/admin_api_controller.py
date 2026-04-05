from flask import Blueprint, jsonify, request

from models.users import (
    ROLE_NAME_TO_ID,
    get_user_by_email,
    get_user_by_id,
    get_users,
    hash_password,
    insert_user,
    set_user_active,
    update_user,
)

admin_api_bp = Blueprint('admin_api', __name__, url_prefix='/api/admin')

ROLE_ID_TO_NAME = {v: k for k, v in ROLE_NAME_TO_ID.items()}


def _serialize_user(row):
    if not row:
        return None
    return {
        "id": row.get('userid'),
        "name": row.get('fullname'),
        "email": row.get('email'),
        "phone": row.get('phone'),
        "role_id": row.get('roleid'),
        "role": ROLE_ID_TO_NAME.get(int(row.get('roleid') or 0), 'customer'),
        "is_active": bool(row.get('isactive', True)),
        "created_at": row.get('createdat'),
    }


def _resolve_role(payload):
    role = payload.get('role') or payload.get('role_id') or payload.get('roleId')
    if role is None:
        return None
    if isinstance(role, (int, float)):
        role_id = int(role)
    else:
        role_id = ROLE_NAME_TO_ID.get(str(role).strip().lower())
    if role_id not in ROLE_ID_TO_NAME:
        return None
    return role_id


@admin_api_bp.route('/users', methods=['GET'])
def admin_list_users():
    role = request.args.get('role')
    limit = request.args.get('limit', default=200, type=int)
    limit = max(1, min(limit, 500))
    rows = get_users(limit=limit, role=role)
    return jsonify({
        "ok": True,
        "count": len(rows),
        "items": [_serialize_user(r) for r in rows],
    }), 200


@admin_api_bp.route('/users', methods=['POST'])
def admin_create_user():
    payload = request.get_json(silent=True) or {}
    full_name = (payload.get('full_name') or payload.get('name') or '').strip()
    email = (payload.get('email') or '').strip().lower()
    phone = (payload.get('phone') or '').strip() or None
    password = payload.get('password') or ''
    role_id = _resolve_role(payload) or ROLE_NAME_TO_ID['customer']

    errors = []
    if not full_name:
        errors.append('full_name is required')
    if not email:
        errors.append('email is required')
    if not password:
        errors.append('password is required')
    if role_id not in (ROLE_NAME_TO_ID['customer'], ROLE_NAME_TO_ID['shipper']):
        errors.append('role must be customer or shipper')

    if errors:
        return jsonify({"ok": False, "error": '; '.join(errors)}), 400

    if get_user_by_email(email):
        return jsonify({"ok": False, "error": 'Email already exists'}), 409

    password_hash = hash_password(password)
    try:
        new_id = insert_user(full_name, email, password_hash, role_id=role_id, phone=phone)
        created = get_user_by_id(new_id)
        return jsonify({"ok": True, "user": _serialize_user(created)}), 201
    except Exception as e:
        msg = str(e)
        if "duplicate key value" in msg.lower() or "already exists" in msg.lower():
            if "phone" in msg.lower():
                return jsonify({"ok": False, "error": "Số điện thoại này đã được sử dụng!"}), 409
            return jsonify({"ok": False, "error": "Email hoặc SĐT đã tồn tại!"}), 409
        return jsonify({"ok": False, "error": msg}), 500


@admin_api_bp.route('/users/<int:user_id>', methods=['PUT'])
def admin_update_user(user_id):
    payload = request.get_json(silent=True) or {}
    current = get_user_by_id(user_id)
    if not current:
        return jsonify({"ok": False, "error": 'User not found'}), 404

    role_id = _resolve_role(payload)
    updates = {}
    if payload.get('full_name') or payload.get('name'):
        updates['fullname'] = (payload.get('full_name') or payload.get('name')).strip()
    if 'phone' in payload:
        updates['phone'] = (payload.get('phone') or '').strip() or None
    if isinstance(payload.get('is_active'), bool):
        updates['isactive'] = payload['is_active']
    if role_id is not None:
        updates['roleid'] = role_id
    if payload.get('password'):
        updates['passwordhash'] = hash_password(payload['password'])

    if not updates:
        return jsonify({"ok": False, "error": 'No valid fields to update'}), 400

    update_user(user_id, **updates)
    refreshed = get_user_by_id(user_id)
    return jsonify({"ok": True, "user": _serialize_user(refreshed)}), 200


@admin_api_bp.route('/users/<int:user_id>', methods=['DELETE'])
def admin_delete_user(user_id):
    from models.users import delete_user, get_user_by_id, ROLE_NAME_TO_ID
    current = get_user_by_id(user_id)
    if not current:
        return jsonify({"ok": False, "error": 'User not found'}), 404
    if int(current.get('roleid') or 0) == ROLE_NAME_TO_ID['admin']:
        return jsonify({"ok": False, "error": 'Cannot deactivate admin accounts'}), 400

    success, msg = delete_user(user_id)
    if not success:
        return jsonify({"ok": False, "error": msg}), 500
    return jsonify({"ok": True, "message": msg}), 200

