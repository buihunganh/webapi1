import re
from dataclasses import dataclass
from typing import Any

from flask import g, jsonify, request, session

from models.users import get_user_by_email, get_user_by_id

ROLE_ID_TO_NAME = {
    1: 'admin',
    2: 'shipper',
    3: 'customer',
}

PHONE_REGEX = re.compile(r'^\+?[0-9]{9,15}$')


@dataclass
class APIError(Exception):
    status_code: int
    message: str
    error_code: str
    details: Any = None


def role_name_from_id(role_id: int | None) -> str:
    try:
        return ROLE_ID_TO_NAME.get(int(role_id or 3), 'customer')
    except (TypeError, ValueError):
        return 'customer'


def api_error(message: str, error_code: str, status_code: int, details: Any = None):
    payload = {
        'success': False,
        'message': message,
        'error_code': error_code,
    }
    if details is not None:
        payload['details'] = details
    return jsonify(payload), status_code


def require_non_empty_name(full_name: str) -> str:
    name = (full_name or '').strip()
    if not name:
        raise APIError(400, 'Full name is required', 'VALIDATION_ERROR', {'field': 'full_name'})
    if len(name) > 120:
        raise APIError(400, 'Full name is too long', 'VALIDATION_ERROR', {'field': 'full_name', 'max_length': 120})
    return name


def normalize_phone(phone: str | None) -> str | None:
    if phone is None:
        return None
    value = (phone or '').strip().replace(' ', '')
    if not value:
        return None
    if not PHONE_REGEX.match(value):
        raise APIError(400, 'Invalid phone format', 'VALIDATION_ERROR', {'field': 'phone'})
    return value


def _extract_user_lookup() -> tuple[int | None, str | None]:
    user_id = request.headers.get('X-User-Id') or request.args.get('user_id')
    email = request.headers.get('X-User-Email') or request.args.get('email')

    auth_header = request.headers.get('Authorization', '')
    if auth_header.lower().startswith('bearer '):
        token = auth_header[7:].strip()
        if token:
            # Backward-compatible fallback for lightweight clients.
            if token.isdigit() and not user_id:
                user_id = token
            elif '@' in token and not email:
                email = token

    parsed_user_id = None
    if user_id is not None:
        try:
            parsed_user_id = int(user_id)
        except (TypeError, ValueError):
            raise APIError(400, 'Invalid user_id', 'INVALID_USER_ID')
        if parsed_user_id <= 0:
            raise APIError(400, 'Invalid user_id', 'INVALID_USER_ID')

    normalized_email = (email or '').strip().lower() or None
    return parsed_user_id, normalized_email


def get_current_user(required: bool = True) -> dict | None:
    if hasattr(g, 'current_user'):
        return g.current_user

    session_user = session.get('user') if isinstance(session.get('user'), dict) else None
    lookup_id, lookup_email = _extract_user_lookup()

    if lookup_id is None and lookup_email is None and session_user:
        lookup_id = session_user.get('user_id')
        lookup_email = (session_user.get('email') or '').strip().lower() or None

    if lookup_id is None and lookup_email is None:
        if required:
            raise APIError(401, 'Authentication required', 'UNAUTHORIZED')
        g.current_user = None
        return None

    user = None
    if lookup_id is not None:
        user = get_user_by_id(int(lookup_id))
    if user is None and lookup_email:
        user = get_user_by_email(lookup_email)

    if not user:
        raise APIError(401, 'Invalid authentication context', 'UNAUTHORIZED')

    if not bool(user.get('isactive', True)):
        raise APIError(403, 'Account is inactive', 'ACCOUNT_INACTIVE')

    user['role_name'] = role_name_from_id(user.get('roleid'))
    g.current_user = user
    return user


def assert_order_access(order: dict, current_user: dict):
    role = current_user.get('role_name') or role_name_from_id(current_user.get('roleid'))
    user_id = int(current_user.get('userid') or 0)
    order_customer_id = int(order.get('customerid') or 0)
    order_shipper_id = int(order.get('shipperid') or 0)

    if role == 'admin':
        return

    if role == 'customer':
        if order_customer_id != user_id:
            raise APIError(403, 'You do not have access to this order', 'FORBIDDEN')
        return

    if role == 'shipper':
        # Preserve existing policy: shipper can see assigned orders and pending queue.
        if order_shipper_id == user_id or (order.get('orderstatus') == 'pending'):
            return
        raise APIError(403, 'You do not have access to this order', 'FORBIDDEN')

    raise APIError(403, 'You do not have access to this order', 'FORBIDDEN')
