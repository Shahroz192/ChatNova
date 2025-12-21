import pytest
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from app import crud
from app.schemas.user import UserCreate, UserUpdate
from app.models.user import User
from app.core.security import get_password_hash


def test_create_user(db_session: Session):
    """Test creating a new user."""
    user_in = UserCreate(email="newuser@example.com", password="Password123")
    user = crud.user.create(db_session, obj_in=user_in)

    assert user.email == user_in.email
    assert user.hashed_password != user_in.password  # Should be hashed
    assert user.id is not None


def test_get_user(db_session: Session, test_user: User):
    """Test retrieving a user by ID."""
    user = crud.user.get(db_session, id=test_user.id)

    assert user is not None
    assert user.id == test_user.id
    assert user.email == test_user.email


def test_get_user_by_email(db_session: Session, test_user: User):
    """Test retrieving a user by email."""
    user = crud.user.get_by_email(db_session, email=test_user.email)

    assert user is not None
    assert user.id == test_user.id
    assert user.email == test_user.email


def test_update_user(db_session: Session, test_user: User):
    """Test updating a user."""
    new_messages_used = 10
    user_update = UserUpdate(messages_used=new_messages_used)
    updated_user = crud.user.update(db_session, db_obj=test_user, obj_in=user_update)

    assert updated_user.messages_used == new_messages_used


def test_delete_user(db_session: Session, test_user: User):
    """Test deleting a user."""
    deleted_user = crud.user.remove(db_session, id=test_user.id)

    assert deleted_user.id == test_user.id

    # Verify the user no longer exists
    user = crud.user.get(db_session, id=test_user.id)
    assert user is None


def test_authenticate_user(db_session: Session):
    """Test user authentication."""
    # Create a user
    user_in = UserCreate(email="authuser@example.com", password="Password123")
    user = crud.user.create(db_session, obj_in=user_in)

    # Authenticate with correct credentials
    authenticated_user = crud.user.authenticate(
        db_session, email=user_in.email, password=user_in.password
    )

    assert authenticated_user is not None
    assert authenticated_user.id == user.id

    # Try to authenticate with wrong password
    wrong_auth = crud.user.authenticate(
        db_session, email=user_in.email, password="wrongpassword"
    )

    assert wrong_auth is None


def test_get_existing_user_by_email(db_session: Session, test_user: User):
    """Test that getting a user by email that already exists returns the existing user."""
    existing_user = crud.user.get_by_email(db_session, email=test_user.email)

    assert existing_user is not None
    assert existing_user.id == test_user.id
    assert existing_user.email == test_user.email
