import pytest

from main import app


@pytest.fixture()
def client():
    app.config['TESTING'] = True
    with app.test_client() as test_client:
        yield test_client


def test_customer_update_profile_success(client, monkeypatch):
    import controllers.customer_controller as cc

    monkeypatch.setattr(cc, 'get_current_user', lambda required=True: {
        'userid': 3,
        'fullname': 'Customer Demo',
        'email': 'customer@shisa.com',
        'phone': '0911223344',
        'roleid': 3,
        'role_name': 'customer',
        'isactive': True,
    })
    monkeypatch.setattr(cc, 'update_user', lambda user_id, **fields: True)
    monkeypatch.setattr(cc, 'get_user_by_id', lambda user_id: {
        'userid': user_id,
        'fullname': 'Nguyen Van A',
        'email': 'customer@shisa.com',
        'phone': '+84901234567',
        'roleid': 3,
        'isactive': True,
    })

    response = client.put('/api/auth/profile', json={
        'full_name': 'Nguyen Van A',
        'phone': '+84901234567',
    })
    body = response.get_json()

    assert response.status_code == 200
    assert body['success'] is True
    assert body['user']['name'] == 'Nguyen Van A'
    assert body['user']['phone'] == '+84901234567'


def test_customer_update_profile_invalid_phone(client, monkeypatch):
    import controllers.customer_controller as cc

    monkeypatch.setattr(cc, 'get_current_user', lambda required=True: {
        'userid': 3,
        'fullname': 'Customer Demo',
        'email': 'customer@shisa.com',
        'phone': '0911223344',
        'roleid': 3,
        'role_name': 'customer',
        'isactive': True,
    })

    response = client.put('/api/auth/profile', json={
        'full_name': 'Nguyen Van A',
        'phone': 'abc-phone',
    })
    body = response.get_json()

    assert response.status_code == 400
    assert body['success'] is False
    assert body['error_code'] == 'VALIDATION_ERROR'


def test_customer_cannot_update_sensitive_fields(client, monkeypatch):
    import controllers.customer_controller as cc

    monkeypatch.setattr(cc, 'get_current_user', lambda required=True: {
        'userid': 3,
        'fullname': 'Customer Demo',
        'email': 'customer@shisa.com',
        'phone': '0911223344',
        'roleid': 3,
        'role_name': 'customer',
        'isactive': True,
    })

    response = client.put('/api/auth/profile', json={
        'full_name': 'Nguyen Van A',
        'role_id': 1,
    })
    body = response.get_json()

    assert response.status_code == 400
    assert body['success'] is False
    assert body['error_code'] == 'SENSITIVE_FIELDS_NOT_ALLOWED'


def test_customer_get_orders_only_own_orders(client, monkeypatch):
    import controllers.customer_controller as cc

    captured = {}

    def fake_get_orders_for_user(*, user_id, role, limit):
        captured['user_id'] = user_id
        captured['role'] = role
        captured['limit'] = limit
        return [
            {'orderid': 101, 'customerid': 3},
            {'orderid': 102, 'customerid': 3},
        ]

    monkeypatch.setattr(cc, 'get_current_user', lambda required=True: {
        'userid': 3,
        'fullname': 'Customer Demo',
        'email': 'customer@shisa.com',
        'phone': '0911223344',
        'roleid': 3,
        'role_name': 'customer',
        'isactive': True,
    })
    monkeypatch.setattr(cc, 'get_orders_for_user', fake_get_orders_for_user)

    response = client.get('/api/orders?limit=50')
    body = response.get_json()

    assert response.status_code == 200
    assert body['count'] == 2
    assert all(item['customerid'] == 3 for item in body['items'])
    assert captured == {'user_id': 3, 'role': 'customer', 'limit': 50}


def test_customer_access_other_order_forbidden(client, monkeypatch):
    import controllers.customer_controller as cc

    monkeypatch.setattr(cc, 'get_current_user', lambda required=True: {
        'userid': 3,
        'fullname': 'Customer Demo',
        'email': 'customer@shisa.com',
        'phone': '0911223344',
        'roleid': 3,
        'role_name': 'customer',
        'isactive': True,
    })
    monkeypatch.setattr(cc, 'get_order_by_id', lambda order_id: {
        'orderid': order_id,
        'customerid': 9,
        'shipperid': None,
        'orderstatus': 'pending',
    })

    response = client.get('/api/orders/999')
    body = response.get_json()

    assert response.status_code == 403
    assert body['success'] is False
    assert body['error_code'] == 'FORBIDDEN'


def test_admin_can_access_any_order(client, monkeypatch):
    import controllers.customer_controller as cc

    monkeypatch.setattr(cc, 'get_current_user', lambda required=True: {
        'userid': 1,
        'fullname': 'Admin',
        'email': 'admin@shisa.com',
        'phone': '0901234567',
        'roleid': 1,
        'role_name': 'admin',
        'isactive': True,
    })
    monkeypatch.setattr(cc, 'get_order_by_id', lambda order_id: {
        'orderid': order_id,
        'customerid': 9,
        'shipperid': None,
        'orderstatus': 'pending',
        'subtotal': 10,
        'shippingfee': 2,
        'discount': 0,
        'totalamount': 12,
        'customer': {'userid': 9, 'fullname': 'Customer B', 'email': 'b@example.com', 'phone': '0999999999'},
        'address': {'addressid': 1, 'fulladdress': '123 Street', 'city': 'Hanoi'},
    })
    monkeypatch.setattr(cc, 'get_order_items', lambda order_id: [
        {
            'orderdetailid': 1,
            'productid': 2,
            'quantity': 1,
            'unitprice': 10,
            'product': {'productid': 2, 'productname': 'Pizza', 'imageurl': None},
        }
    ])
    monkeypatch.setattr(cc, 'get_order_payment', lambda order_id: {
        'paymentid': 1,
        'amount': 12,
        'method': 'Cash',
        'status': 'unpaid',
        'paidat': None,
    })

    response = client.get('/api/orders/555')
    body = response.get_json()

    assert response.status_code == 200
    assert body['success'] is True
    assert body['data']['order']['id'] == 555
    assert body['data']['customer']['userid'] == 9


def test_not_found_uses_standard_error_schema(client, monkeypatch):
    import controllers.customer_controller as cc

    monkeypatch.setattr(cc, 'get_current_user', lambda required=True: {
        'userid': 1,
        'fullname': 'Admin',
        'email': 'admin@shisa.com',
        'phone': '0901234567',
        'roleid': 1,
        'role_name': 'admin',
        'isactive': True,
    })
    monkeypatch.setattr(cc, 'get_order_by_id', lambda order_id: None)

    response = client.get('/api/orders/4040')
    body = response.get_json()

    assert response.status_code == 404
    assert body['success'] is False
    assert body['message'] == 'Order not found'
    assert body['error_code'] == 'ORDER_NOT_FOUND'
