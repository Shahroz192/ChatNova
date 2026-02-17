"""
Tests for the AI service functionality
"""

from app.services.ai_chat import AIChatService


def test_get_available_models():
    """Test getting available models with mocked AI service"""
    ai_service = AIChatService()

    # Test without user context (should return models that have env vars)
    # Since we're mocking, we just check that the method runs without error
    models = ai_service.get_available_models()
    assert isinstance(models, list)


def test_simple_chat_exists():
    """Test that simple_chat method exists"""
    ai_service = AIChatService()

    # Just verify the method exists and is callable
    assert hasattr(ai_service, "simple_chat")
    assert callable(ai_service.simple_chat)


def test_compare_models_exists():
    """Test that compare_models method exists"""
    ai_service = AIChatService()

    # Just verify the method exists and is callable
    assert hasattr(ai_service, "compare_models")
    assert callable(ai_service.compare_models)
