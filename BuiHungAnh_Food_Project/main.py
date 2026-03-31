from flask import Flask, jsonify
from flask_cors import CORS
from controllers.admin_controller import admin_bp
from controllers.admin_api_controller import admin_api_bp
from controllers.shipper_controller import shipper_bp
from controllers.customer_controller import customer_bp

# Khởi động Server và nạp các Controllers
app = Flask(__name__)

# Enable CORS for all routes (allow frontend to call API)
CORS(app, resources={r"/api/*": {"origins": "*"}})

# Đăng ký Blueprints (Controllers)
app.register_blueprint(admin_bp)
app.register_blueprint(admin_api_bp)
app.register_blueprint(shipper_bp)
app.register_blueprint(customer_bp)

# Error handlers - ensure all errors return JSON
@app.errorhandler(400)
def bad_request(e):
    return jsonify({"ok": False, "error": str(e.description or "Bad Request")}), 400

@app.errorhandler(404)
def not_found(e):
    return jsonify({"ok": False, "error": "Endpoint not found"}), 404

@app.errorhandler(500)
def internal_error(e):
    return jsonify({"ok": False, "error": "Internal server error"}), 500

@app.errorhandler(Exception)
def handle_exception(e):
    return jsonify({"ok": False, "error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5500)
