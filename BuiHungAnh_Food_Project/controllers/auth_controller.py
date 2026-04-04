from flask import Blueprint, session, redirect, url_for, jsonify
from models.users import get_user_by_email, insert_user, update_user

auth_bp = Blueprint('auth', __name__)


def handle_social_login(user_info, provider_name):
    """Xử lý logic sau khi nhận user_info từ nhà cung cấp (Facebook, Google)."""
    email = user_info.get('email')
    name = user_info.get('name')

    if not email:
        return jsonify({"ok": False, "error": f"Email is required from {provider_name}"}), 400

    # Kiểm tra user đã tồn tại chưa
    user = get_user_by_email(email)

    if user:
        # Cập nhật nếu cần
        if user['fullname'] != name or user['email'] != email:
            update_user(user['userid'], fullname=name, email=email)
            user = get_user_by_email(email)  # Lấy lại sau update
    else:
        # Tạo mới
        user_id = insert_user(full_name=name, email=email, password_hash='')
        user = get_user_by_email(email)

    # Lưu vào session
    session['user'] = {
        'user_id': user['userid'],
        'full_name': user['fullname'],
        'email': user['email'],
        'role_id': user['roleid']
    }

    # Set local storage using script block
    return f"""
    <html>
    <head>
        <script>
            localStorage.setItem('shisa_current_user_email', '{user['email']}');
            localStorage.setItem('shisa_current_user', JSON.stringify({{
                "id": "{user['userid']}",
                "name": "{user['fullname']}",
                "email": "{user['email']}",
                "role": "customer",
                "role_id": 3
            }}));
            window.location.href = '/';
        </script>
    </head>
    <body>Redirecting...</body>
    </html>
    """