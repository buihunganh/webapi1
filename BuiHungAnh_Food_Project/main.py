import os
from flask import Flask, jsonify, redirect, url_for, session, render_template
from flask_cors import CORS
from authlib.integrations.flask_client import OAuth
from dotenv import load_dotenv
from controllers.admin_controller import admin_bp
from controllers.admin_api_controller import admin_api_bp
from controllers.shipper_controller import shipper_bp
from controllers.customer_controller import customer_bp
from controllers.auth_controller import auth_bp, handle_social_login

# Load environment variables from .env file
load_dotenv()

# Khởi động Server và nạp các Controllers
app = Flask(__name__)
app.secret_key = os.getenv('FLASK_SECRET_KEY', 'dev-secret-key')  # Bắt buộc để dùng session trong OAuth

# Provide Mapbox token to all templates


@app.context_processor
def inject_mapbox_token():
    return dict(mapbox_access_token=os.getenv('MAPBOX_ACCESS_TOKEN'))


# Enable CORS for all routes (allow frontend to call API)
CORS(app, resources={r"/api/*": {"origins": "*"}})

# OAuth configuration
oauth = OAuth(app)
facebook = oauth.register(
    name='facebook',
    client_id=os.getenv('FACEBOOK_CLIENT_ID'),
    client_secret=os.getenv('FACEBOOK_CLIENT_SECRET'),
    access_token_url='https://graph.facebook.com/oauth/access_token',
    authorize_url='https://www.facebook.com/dialog/oauth',
    api_base_url='https://graph.facebook.com/',
    client_kwargs={'scope': 'public_profile,email'},
)

google = oauth.register(
    name='google',
    client_id=os.getenv('GOOGLE_CLIENT_ID'),
    client_secret=os.getenv('GOOGLE_CLIENT_SECRET'),
    server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
    client_kwargs={'scope': 'openid email profile'},
)

# Đăng ký Blueprints (Controllers)
app.register_blueprint(admin_bp)
app.register_blueprint(admin_api_bp)
app.register_blueprint(shipper_bp)
app.register_blueprint(customer_bp)
app.register_blueprint(auth_bp)

# Facebook OAuth routes
@app.route('/login/facebook')
def login_facebook():
    redirect_uri = url_for('auth_callback', _external=True)
    return facebook.authorize_redirect(redirect_uri)

@app.route('/auth/callback')
def auth_callback():
    token = facebook.authorize_access_token()
    resp = facebook.get('me?fields=id,name,email')
    user_info = resp.json()
    print("User Info:", user_info)
    # Gọi hàm xử lý DB và session
    return handle_social_login(user_info, "Facebook")

@app.route('/login/google')
def login_google():
    redirect_uri = url_for('auth_callback_google', _external=True)
    return google.authorize_redirect(redirect_uri)

@app.route('/auth/callback/google')
def auth_callback_google():
    token = google.authorize_access_token()
    user_info = token.get('userinfo')
    if not user_info:
        user_info = google.parse_id_token(token, None)
    print("Google User Info:", user_info)
    return handle_social_login(user_info, "Google")

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
    app.logger.exception('Unhandled exception', exc_info=e)
    return jsonify({"ok": False, "error": "Internal server error"}), 500


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5500)
