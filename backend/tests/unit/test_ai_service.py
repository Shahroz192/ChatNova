from unittest.mock import MagicMock, patch
from app.services.llm_service import LLMService

def test_get_available_models():
    service = LLMService()
    with patch.object(service, "get_provider_key", side_effect=lambda p, u, d: "key" if p == "Google" else None):
        models = service.get_available_models(1, MagicMock())
        assert "gemini-2.5-flash" in models
