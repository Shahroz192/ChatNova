from sqlalchemy.orm import Session
from app import crud
from app.schemas.user import UserCreate, UserUpdate


def test_create_user_with_custom_instructions(db_session: Session):
    """Test creating a new user with custom instructions."""
    # Although create typically doesn't include this field in UserCreate,
    # we might want to ensure the model supports it being null/empty initially.
    user_in = UserCreate(email="instruction_user@example.com", password="Password123")
    user = crud.user.create(db_session, obj_in=user_in)

    assert user.email == user_in.email
    assert hasattr(user, "custom_instructions")
    assert user.custom_instructions is None or user.custom_instructions == ""


def test_update_user_custom_instructions(db_session: Session):
    """Test updating a user's custom instructions."""
    # Create a user first
    user_in = UserCreate(email="update_instr@example.com", password="Password123")
    user = crud.user.create(db_session, obj_in=user_in)

    # Update instructions
    new_instructions = "Always respond in JSON format."
    user_update = UserUpdate(custom_instructions=new_instructions)
    updated_user = crud.user.update(db_session, db_obj=user, obj_in=user_update)

    assert updated_user.custom_instructions == new_instructions

    # Verify persistence
    db_session.refresh(updated_user)
    assert updated_user.custom_instructions == new_instructions


def test_clear_user_custom_instructions(db_session: Session):
    """Test clearing custom instructions."""
    # Create user with instructions (simulate by update first)
    user_in = UserCreate(email="clear_instr@example.com", password="Password123")
    user = crud.user.create(db_session, obj_in=user_in)

    initial_instructions = "Be concise."
    crud.user.update(
        db_session,
        db_obj=user,
        obj_in=UserUpdate(custom_instructions=initial_instructions),
    )

    # Clear instructions
    user_update = UserUpdate(custom_instructions="")
    updated_user = crud.user.update(db_session, db_obj=user, obj_in=user_update)

    assert updated_user.custom_instructions == ""
