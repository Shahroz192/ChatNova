import pytest
from datetime import timedelta, datetime, UTC
from jose import jwt
from unittest.mock import MagicMock, patch
import os
from cryptography.fernet import Fernet

from app.core import security
from app.core.config import settings

def test_password_hashing():
    password = "testpassword"
    hashed = security.get_password_hash(password)
    assert security.verify_password(password, hashed)
    assert not security.verify_password("wrongpassword", hashed)

def test_long_password_hashing():
    # Test > 72 bytes password
    # Bcrypt truncates at 72 bytes. 
    # If we hash "a"*80, it's the same as hashing "a"*72.
    # So verify_password("a"*72 + "something else", hashed) will be TRUE.
    # To test truncation works as intended in our wrapper:
    long_password = "a" * 100
    hashed = security.get_password_hash(long_password)
    assert security.verify_password(long_password, hashed)
    
    # This should ALSO be true because of truncation (both are truncated to same 72 chars)
    assert security.verify_password("a" * 72 + "different", hashed)
    
    # This should be false because the first 72 chars are different
    assert not security.verify_password("b" + "a" * 71, hashed)

def test_create_access_token():
    data = {"sub": "user@example.com"}
    token, jti = security.create_access_token(data)
    
    decoded = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    assert decoded["sub"] == "user@example.com"
    assert decoded["jti"] == jti
    assert "exp" in decoded

def test_create_access_token_with_expiry():
    data = {"sub": "user@example.com"}
    expires = timedelta(minutes=10)
    token, _ = security.create_access_token(data, expires_delta=expires)
    
    decoded = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    # Check if exp is roughly now + 10 mins
    expected_exp = datetime.now(UTC) + expires
    # Allow small difference
    assert abs(decoded["exp"] - expected_exp.timestamp()) < 10

def test_verify_token_valid():
    data = {"sub": "user_id"}
    token, _ = security.create_access_token(data)
    user_id = security.verify_token(token)
    assert user_id == "user_id"

def test_verify_token_invalid():
    assert security.verify_token("invalid_token") is None

def test_verify_token_missing_claims():
    # Create token without sub
    data = {"other": "claim"}
    token = jwt.encode(data, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    assert security.verify_token(token) is None

def test_verify_token_blacklisted():
    data = {"sub": "user_id"}
    token, jti = security.create_access_token(data)
    
    mock_db = MagicMock()
    
    # Patch the is_token_blacklisted function
    with patch("app.core.security.token_blacklist_crud.is_token_blacklisted") as mock_is_blacklisted:
        mock_is_blacklisted.return_value = True
        assert security.verify_token(token, db=mock_db) is None
        mock_is_blacklisted.assert_called_once()

def test_extract_token_jti():
    data = {"sub": "user_id"}
    token, jti = security.create_access_token(data)
    assert security.extract_token_jti(token) == jti

def test_extract_token_jti_invalid():
    assert security.extract_token_jti("invalid") is None

def test_get_token_expires_at():
    data = {"sub": "user_id"}
    expires = timedelta(minutes=10)
    token, _ = security.create_access_token(data, expires_delta=expires)
    
    exp_time = security.get_token_expires_at(token)
    assert exp_time is not None
    # Verify roughly correct time
    expected = datetime.now(UTC) + expires
    assert abs((exp_time - expected).total_seconds()) < 10

def test_get_token_expires_at_invalid():
    assert security.get_token_expires_at("invalid") is None

def test_encryption():
    # Ensure FERNET_KEY is set (it might be mocked or set in environment)
    # The read file showed it reads from settings or env
    
    # We need to make sure a key exists. 
    # If settings.FERNET_KEY is None, we should mock it or set env.
    
    test_key = Fernet.generate_key().decode()
    with patch.object(settings, 'FERNET_KEY', test_key):
        api_key = "test_api_key_123"
        encrypted = security.encrypt_api_key(api_key)
        assert encrypted != api_key
        decrypted = security.decrypt_api_key(encrypted)
        assert decrypted == api_key

def test_encryption_no_key():
    with patch.object(settings, 'FERNET_KEY', None):
        with patch.dict(os.environ, {"FERNET_KEY": ""}):
            with pytest.raises(ValueError):
                security.encrypt_api_key("test")
