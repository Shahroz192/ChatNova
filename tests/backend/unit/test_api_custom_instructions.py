from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.schemas.user import UserCreate
from app import crud

def test_update_custom_instructions(client: TestClient, db_session: Session):
    """Test updating custom instructions via API."""
    # Create user
    user_data = {
        "email": "instr_api_test@example.com",
        "password": "TestPassword123",
    }
    user_in = UserCreate(**user_data)
    crud.user.create(db_session, obj_in=user_in)

    # Login
    login_data = {"username": user_data["email"], "password": user_data["password"]}
    login_response = client.post("/api/v1/auth/login", data=login_data)
    assert login_response.status_code == 200

    # Update instructions
    instructions = "Always speak like a pirate."
    response = client.patch(
        "/api/v1/users/me/instructions",
        json={"custom_instructions": instructions}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["custom_instructions"] == instructions

    # Verify via get
    get_response = client.get("/api/v1/users/me")
    assert get_response.status_code == 200
    assert get_response.json()["custom_instructions"] == instructions
