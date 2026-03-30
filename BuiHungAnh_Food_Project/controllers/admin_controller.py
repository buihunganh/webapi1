from flask import Blueprint, render_template

admin_bp = Blueprint('admin', __name__)

@admin_bp.route('/admin/dashboard')
def dashboard():
    """Xử lý API quản lý doanh thu, xếp tài xế"""
    return render_template('admin/dashboard.html')
