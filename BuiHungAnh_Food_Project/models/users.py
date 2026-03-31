import hashlib
from typing import Any, Optional

from models.supabase_client import get_supabase

ROLE_NAME_TO_ID = {
    'admin': 1,
    'shipper': 2,
    'customer': 3,
}


def _normalize_role_id(role: Any = None) -> Optional[int]:
    """Convert role input (int/str) to RoleID or None."""
    if role is None:
        return None
    if isinstance(role, (int, float)):
        role_int = int(role)
        return role_int if role_int in ROLE_NAME_TO_ID.values() else None
    role_name = str(role).strip().lower()
    return ROLE_NAME_TO_ID.get(role_name)


def hash_password(plain_password):
    """Hash mật khẩu bằng SHA-256 để lưu DB."""
    return hashlib.sha256(plain_password.encode('utf-8')).hexdigest()


def verify_password(input_password, stored_hash):
    """Kiểm tra mật khẩu nhập vào với dữ liệu đang có trong DB."""
    if not stored_hash:
        return False

    input_sha = hash_password(input_password)

    # Dữ liệu mới: SHA-256
    if stored_hash == input_sha:
        return True

    # Fallback demo cũ trong seed
    demo_map = {
        'hashed_admin': 'admin123',
        'hashed_shipper': 'shipper123',
        'hashed_customer': 'customer123',
    }
    if stored_hash in demo_map:
        return input_password == demo_map[stored_hash]

    return False

def get_all_users(limit: int = 500):
    """SELECT tất cả người dùng từ bảng Users (legacy helper)."""
    return get_users(limit=limit)


def get_users(limit: int = 500, role: Any = None):
    """Flexible SELECT theo role / limit từ bảng Users."""
    sb = get_supabase()
    query = sb.table('users').select('userid,fullname,email,phone,roleid,isactive,createdat').order('userid', desc=True).limit(limit)
    role_id = _normalize_role_id(role)
    if role_id is not None:
        query = query.eq('roleid', role_id)
    response = query.execute()
    return response.data or []

def insert_user(full_name, email, password_hash, role_id=3, phone=None):
    """INSERT người dùng mới vào bảng Users"""
    sb = get_supabase()
    payload = {
        'fullname': full_name,
        'email': email,
        'phone': phone,
        'passwordhash': password_hash,
        'roleid': role_id,
    }
    response = sb.table('users').insert(payload).execute()
    inserted = (response.data or [])
    if not inserted:
        raise RuntimeError('Failed to insert user')
    return int(inserted[0]['userid'])


def get_user_by_email(email):
    """SELECT 1 người dùng theo email"""
    sb = get_supabase()
    response = sb.table('users').select('userid,fullname,email,phone,passwordhash,roleid,isactive').eq('email', email).limit(1).execute()
    rows = response.data or []
    return rows[0] if rows else None


def get_user_by_id(user_id: int):
    sb = get_supabase()
    response = sb.table('users').select('userid,fullname,email,phone,roleid,isactive,createdat').eq('userid', user_id).limit(1).execute()
    rows = response.data or []
    return rows[0] if rows else None


def update_user(user_id: int, **fields):
    """Update user fields; silently ignore empty payloads."""
    allowed = {'fullname', 'phone', 'roleid', 'isactive', 'passwordhash', 'email'}
    payload = {k: v for k, v in fields.items() if k in allowed and v is not None}
    if not payload:
        return False
    sb = get_supabase()
    response = sb.table('users').update(payload).eq('userid', user_id).execute()
    return bool(response.data)


def set_user_active(user_id: int, is_active: bool):
    sb = get_supabase()
    response = sb.table('users').update({'isactive': is_active}).eq('userid', user_id).execute()
    return bool(response.data)
