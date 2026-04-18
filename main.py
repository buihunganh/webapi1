import os
from http import HTTPStatus
from flask import Flask, jsonify, redirect, url_for, session, render_template
from flask_cors import CORS
from authlib.integrations.flask_client import OAuth
from dotenv import load_dotenv
from werkzeug.exceptions import HTTPException
from controllers.admin_controller import admin_bp
from controllers.admin_api_controller import admin_api_bp
from controllers.api_common import APIError
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


@app.after_request
def normalize_legacy_api_errors(response):
    from flask import request

    if not request.path.startswith('/api/'):
        return response
    if response.status_code < 400:
        return response
    if response.content_type is None or 'application/json' not in response.content_type.lower():
        return response

    payload = response.get_json(silent=True)
    if not isinstance(payload, dict):
        return response
    if 'success' in payload and 'message' in payload and 'error_code' in payload:
        return response

    message = payload.get('message') or payload.get('error') or 'Request failed'
    mapped = {
        'success': False,
        'message': message,
        'error_code': payload.get('error_code') or STATUS_DEFAULT_ERROR_CODE.get(response.status_code, 'HTTP_ERROR'),
    }
    if 'details' in payload:
        mapped['details'] = payload.get('details')

    response.set_data(jsonify(mapped).get_data())
    return response

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
STATUS_DEFAULT_ERROR_CODE = {
    400: 'VALIDATION_ERROR',
    401: 'UNAUTHORIZED',
    403: 'FORBIDDEN',
    404: 'NOT_FOUND',
    409: 'CONFLICT',
    500: 'INTERNAL_SERVER_ERROR',
}


def _is_api_request() -> bool:
    from flask import request
    return request.path.startswith('/api/')


def _error_payload(message: str, error_code: str, details=None):
    payload = {
        'success': False,
        'message': message,
        'error_code': error_code,
    }
    if details is not None:
        payload['details'] = details
    return payload


@app.errorhandler(APIError)
def handle_api_error(err: APIError):
    return jsonify(_error_payload(err.message, err.error_code, err.details)), err.status_code


@app.errorhandler(HTTPException)
def handle_http_exception(err: HTTPException):
    status = int(getattr(err, 'code', 500) or 500)
    message = str(getattr(err, 'description', '') or HTTPStatus(status).phrase)
    if _is_api_request():
        return jsonify(_error_payload(message, STATUS_DEFAULT_ERROR_CODE.get(status, 'HTTP_ERROR'))), status
    return jsonify(_error_payload(message, STATUS_DEFAULT_ERROR_CODE.get(status, 'HTTP_ERROR'))), status


@app.errorhandler(400)
def bad_request(e):
    return jsonify(_error_payload(str(getattr(e, 'description', '') or 'Bad Request'), 'VALIDATION_ERROR')), 400


@app.errorhandler(404)
def not_found(e):
    return jsonify(_error_payload('Endpoint not found', 'NOT_FOUND')), 404


@app.errorhandler(500)
def internal_error(e):
    return jsonify(_error_payload('Internal server error', 'INTERNAL_SERVER_ERROR')), 500


@app.errorhandler(Exception)
def handle_exception(e):
    app.logger.exception('Unhandled exception', exc_info=e)
    return jsonify(_error_payload('Internal server error', 'INTERNAL_SERVER_ERROR')), 500


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5500)
