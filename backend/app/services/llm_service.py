import logging
from typing import Optional

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_cerebras import ChatCerebras
from langchain_groq import ChatGroq
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import decrypt_api_key
from app.crud.user import user_api_key


class LLMService:
    def __init__(self):
        # Mapping of providers to their API key parameter names
        self.provider_configs = {
            "Google": {"api_key_param": "google_api_key"},
            "Cerebras": {"api_key_param": "cerebras_api_key"},
            "Groq": {"api_key_param": "groq_api_key"},
        }

        self.llm_configs = {
            "gemini-2.5-flash": {
                "class": ChatGoogleGenerativeAI,
                "model": "gemini-2.5-flash",
                "provider": "Google",
            },
            "zai-glm-4.7": {
                "class": ChatCerebras,
                "model": "zai-glm-4.7",
                "provider": "Cerebras",
            },
            "moonshotai/kimi-k2-instruct-0905": {
                "class": ChatGroq,
                "model": "moonshotai/kimi-k2-instruct-0905",
                "provider": "Groq",
            },
        }

    def get_provider_key(
        self, provider: str, user_id: Optional[int] = None, db: Optional[Session] = None
    ) -> Optional[str]:
        """Get API key for a specific provider."""
        if provider not in self.provider_configs:
            return None

        # Check user DB key first (BYOK)
        if user_id and db:
            user_key_obj = user_api_key.get_by_user_and_model(
                db, user_id=user_id, model_name=provider
            )
            if user_key_obj:
                try:
                    return decrypt_api_key(user_key_obj.encrypted_key)
                except Exception as e:
                    logging.error(
                        f"Error decrypting API key for user {user_id}, provider {provider}: {e}"
                    )

        # Fallback to env vars
        env_map = {
            "Google": settings.GOOGLE_API_KEY,
            "Cerebras": settings.CEREBRAS_API_KEY,
            "Groq": settings.GROQ_API_KEY,
        }
        return env_map.get(provider)

    def get_llm(
        self,
        model_name: str,
        user_id: Optional[int] = None,
        db: Optional[Session] = None,
        streaming: bool = False,
    ):
        if model_name not in self.llm_configs:
            return None

        config = self.llm_configs[model_name]
        provider = config["provider"]
        llm_class = config["class"]
        model = config["model"]

        api_key = self.get_provider_key(provider, user_id, db)
        if not api_key:
            return None

        provider_config = self.provider_configs[provider]
        api_key_param = provider_config["api_key_param"]

        kwargs = {api_key_param: api_key}
        if streaming:
            kwargs["streaming"] = True

        return llm_class(
            model=model,
            **kwargs,
        )

    def get_llm_by_provider(self, provider: str, api_key: str):
        """Get LLM instance for a provider with a provided API key (for validation)."""
        if provider not in self.provider_configs:
            return None

        config = self.provider_configs[provider]
        api_key_param = config["api_key_param"]

        # Get the model name for this provider
        model_name = None
        for name, cfg in self.llm_configs.items():
            if cfg.get("provider") == provider:
                model_name = name
                break

        if not model_name:
            return None

        llm_config = self.llm_configs[model_name]
        llm_class = llm_config["class"]
        model = llm_config["model"]

        kwargs = {api_key_param: api_key}
        return llm_class(model=model, **kwargs)

    def get_available_models(
        self,
        user_id: Optional[int] = None,
        db: Optional[Session] = None,
    ):
        available = []
        for model_name, config in self.llm_configs.items():
            provider = config["provider"]
            if self.get_provider_key(provider, user_id, db):
                available.append(model_name)
        return available


llm_service = LLMService()
