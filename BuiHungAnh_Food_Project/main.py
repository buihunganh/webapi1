from flask import Flask
from controllers.admin_controller import admin_bp
from controllers.shipper_controller import shipper_bp
from controllers.customer_controller import customer_bp

# Khởi động Server và nạp các Controllers
app = Flask(__name__)

# Đăng ký Blueprints (Controllers)
app.register_blueprint(admin_bp)
app.register_blueprint(shipper_bp)
app.register_blueprint(customer_bp)

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5500)
