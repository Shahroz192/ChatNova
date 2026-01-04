from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock

def test_validate_provider_key_success(authenticated_client: TestClient):
    """Test validating a provider key using a mock to avoid real API calls."""
    
    # Mock the ai_service to avoid real network calls and key validation logic in LLM
    with patch("app.services.ai_chat.ai_service.get_llm_by_provider") as mock_get_llm:
        # Setup mock LLM
        mock_llm = MagicMock()
        mock_llm.invoke.return_value = "Success response"
        mock_get_llm.return_value = mock_llm
        
        provider = "Google"
        fake_key = "fake_google_key_12345"
        
        response = authenticated_client.post(
            f"/api/v1/chat/models/test/{provider}",
            json={"encrypted_key": fake_key}
        )
        
        # Check that it succeeded
        assert response.status_code == 200
        assert response.json()["status"] == "success"
        
        # Verify get_llm_by_provider was called with the RAW key, not decrypted/modified
        mock_get_llm.assert_called_once()
        args, _ = mock_get_llm.call_args
        assert args[0] == provider
        assert args[1] == fake_key

def test_validate_provider_key_no_decryption_error(authenticated_client: TestClient):
    """
    Test that validates the fix: passing a raw key should NOT trigger 
    'Invalid key format' error (which came from decrypt_api_key).
    """
    
    with patch("app.services.ai_chat.ai_service.get_llm_by_provider") as mock_get_llm:
        mock_llm = MagicMock()
        mock_llm.invoke.side_effect = Exception("LLM API Error")
        mock_get_llm.return_value = mock_llm
        
        provider = "Google"
        fake_key = "fake_raw_key_not_encrypted"
        
        response = authenticated_client.post(
            f"/api/v1/chat/models/test/{provider}",
            json={"encrypted_key": fake_key}
        )
        
        # It should fail with 400, but NOT because of key format
        assert response.status_code == 400
        error_detail = response.json()["detail"]
        
        # The key check is that it is NOT "Invalid key format: ..."
        assert "Invalid key format" not in error_detail
        assert "API call failed" in error_detail
