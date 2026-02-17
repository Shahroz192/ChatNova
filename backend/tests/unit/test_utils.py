from unittest.mock import MagicMock, patch
from app.utils.cookies import set_auth_cookie, clear_auth_cookie
from app.core.config import settings


def test_set_auth_cookie():
    response = MagicMock()
    token = "test_token"

    with patch.object(settings, "ENVIRONMENT", "development"):
        set_auth_cookie(response, token)

        response.set_cookie.assert_called_once()
        args, kwargs = response.set_cookie.call_args
        assert kwargs["key"] == "access_token"
        assert kwargs["value"] == token
        assert kwargs["httponly"] is True
        assert kwargs["secure"] is False  # because environment is development


def test_set_auth_cookie_production():
    response = MagicMock()
    token = "test_token"

    with patch.object(settings, "ENVIRONMENT", "production"):
        set_auth_cookie(response, token)

        _, kwargs = response.set_cookie.call_args
        assert kwargs["secure"] is True


def test_clear_auth_cookie():
    response = MagicMock()
    clear_auth_cookie(response)

    response.set_cookie.assert_called_once()
    _, kwargs = response.set_cookie.call_args
    assert kwargs["key"] == "access_token"
    assert kwargs["value"] == ""
    assert kwargs["max_age"] == 0
