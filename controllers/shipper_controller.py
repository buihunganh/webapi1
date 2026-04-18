from flask import Blueprint, render_template

shipper_bp = Blueprint('shipper', __name__)

@shipper_bp.route('/shipper/workspace')
def workspace():
    """Xử lý API nhận đơn, cập nhật trạng thái"""
    return render_template('shipper/workspace.html')
