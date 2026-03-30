from models.database import get_connection
import hashlib


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

def get_all_users():
    """SELECT tất cả người dùng từ bảng Users"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT u.UserID, u.FullName, u.Email, u.Phone, u.RoleID, u.IsActive, u.CreatedAt
        FROM Users u
        ORDER BY u.UserID DESC
        """
    )
    rows = cursor.fetchall()
    conn.close()
    return rows

def insert_user(full_name, email, password_hash, role_id=3, phone=None):
    """INSERT người dùng mới vào bảng Users"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        INSERT INTO Users (FullName, Email, Phone, PasswordHash, RoleID)
        OUTPUT INSERTED.UserID
        VALUES (?, ?, ?, ?, ?)
        """,
        (full_name, email, phone, password_hash, role_id)
    )
    new_id = int(cursor.fetchone()[0])
    conn.commit()
    conn.close()
    return new_id


def get_user_by_email(email):
    """SELECT 1 người dùng theo email"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT TOP 1 UserID, FullName, Email, Phone, PasswordHash, RoleID, IsActive
        FROM Users
        WHERE Email = ?
        """,
        (email,)
    )
    row = cursor.fetchone()
    conn.close()
    return row
