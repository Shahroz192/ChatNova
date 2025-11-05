"""
Cache Module for AI Chat Pro
This module provides caching functionality using in-memory cache with memory management,
eviction policies, and performance monitoring for database queries and LLM responses.
"""

from typing import Optional, List
from app.models.message import Message
import logging
import hashlib

# Import enhanced cache with memory management
from app.core.enhanced_cache import enhanced_cache_manager

logger = logging.getLogger(__name__)


class CacheManager:
    """
    Cache manager for the AI Chat Pro application with enhanced memory management
    Handles both database query caching and LLM response caching using in-memory cache
    """

    def __init__(self):
        # Use the enhanced cache manager with memory management
        self.cache = enhanced_cache_manager.cache
        self.enhanced_manager = enhanced_cache_manager

    def get_chat_history(
        self, user_id: int, skip: int, limit: int, session_id: Optional[int] = None
    ) -> Optional[List[dict]]:
        """
        Get chat history from cache with memory management
        """
        if session_id:
            cache_key = f"chat_history:{user_id}:session:{session_id}:{skip}:{limit}"
        else:
            cache_key = f"chat_history:{user_id}:{skip}:{limit}"
        try:
            return self.cache.get(cache_key)
        except Exception as e:
            logger.error(f"Error retrieving from cache: {e}")
        return None

    def set_chat_history(
        self,
        user_id: int,
        skip: int,
        limit: int,
        messages: List[Message],
        ttl: int = 300,
        session_id: Optional[int] = None,
    ):
        """
        Set chat history in cache with TTL and memory management
        """
        if session_id:
            cache_key = f"chat_history:{user_id}:session:{session_id}:{skip}:{limit}"
        else:
            cache_key = f"chat_history:{user_id}:{skip}:{limit}"
        try:
            # Convert messages to JSON serializable format
            messages_json = [msg.__dict__ for msg in messages]
            self.cache.set(cache_key, messages_json, ttl)
        except Exception as e:
            logger.error(f"Error setting cache: {e}")

    def invalidate_user_history(self, user_id: int, session_id: Optional[int] = None):
        """
        Invalidate all cached history for a user, optionally for a specific session
        """
        try:
            if session_id:
                # Invalidate only session-specific cache
                cache_key = f"chat_history:{user_id}:session:{session_id}:*"
                keys_to_delete = [
                    k for k in self.cache._cache.keys() if k.startswith(cache_key)
                ]
            else:
                # Invalidate all chat history keys for the user
                cache_key = f"chat_history:{user_id}:"
                keys_to_delete = [
                    k for k in self.cache._cache.keys() if k.startswith(cache_key)
                ]

            for key in keys_to_delete:
                self.cache.delete(key)
        except Exception as e:
            logger.error(f"Error invalidating user history cache: {e}")

    def invalidate_session_history(self, session_id: int):
        """
        Invalidate all cached history for a specific session
        """
        try:
            cache_key = f"chat_history:*:session:{session_id}:*:*"
            keys_to_delete = [
                k for k in self.cache._cache.keys() if cache_key.replace("*", "") in k
            ]

            for key in keys_to_delete:
                self.cache.delete(key)
        except Exception as e:
            logger.error(f"Error invalidating session history cache: {e}")

    def get_llm_response(self, user_id: int, content: str, model: str) -> Optional[str]:
        """
        Get LLM response from cache
        """
        # Create a cache key based on user_id, content, and model (hashed to avoid long keys)
        content_hash = hashlib.md5(f"{content}:{model}".encode()).hexdigest()
        cache_key = f"llm_response:{user_id}:{content_hash}"

        try:
            return self.cache.get(cache_key)
        except Exception as e:
            logger.error(f"Error retrieving LLM response from cache: {e}")

        return None

    def set_llm_response(
        self, user_id: int, content: str, model: str, response: str, ttl: int = 3600
    ):
        """
        Set LLM response in cache with TTL and memory management
        """
        content_hash = hashlib.md5(f"{content}:{model}".encode()).hexdigest()
        cache_key = f"llm_response:{user_id}:{content_hash}"

        try:
            self.cache.set(cache_key, response, ttl)
        except Exception as e:
            logger.error(f"Error setting LLM response in cache: {e}")

    def invalidate_llm_responses_for_user(self, user_id: int):
        """
        Invalidate all cached LLM responses for a user
        """
        try:
            cache_key = f"llm_response:{user_id}:"
            keys_to_delete = [
                k for k in self.cache._cache.keys() if k.startswith(cache_key)
            ]

            for key in keys_to_delete:
                self.cache.delete(key)
        except Exception as e:
            logger.error(f"Error invalidating LLM responses cache: {e}")

    def invalidate_all_user_data(self, user_id: int):
        """
        Invalidate all cached data for a user (both chat history and LLM responses)
        """
        self.invalidate_user_history(user_id)
        self.invalidate_llm_responses_for_user(user_id)

    # Enhanced methods with memory management and monitoring

    def get_cache_statistics(self) -> dict:
        """
        Get comprehensive cache statistics including memory usage.
        """
        try:
            return self.enhanced_manager.get_cache_stats()
        except Exception as e:
            logger.error(f"Error getting cache statistics: {e}")
            return {}

    def optimize_cache_performance(self) -> dict:
        """
        Optimize cache performance by cleaning up expired entries and optimizing memory usage.
        """
        try:
            return self.enhanced_manager.optimize_cache()
        except Exception as e:
            logger.error(f"Error optimizing cache: {e}")
            return {}

    def force_cache_cleanup(self) -> dict:
        """
        Force cleanup of expired cache entries and return cleanup statistics.
        """
        try:
            return self.enhanced_manager.force_cleanup()
        except Exception as e:
            logger.error(f"Error forcing cache cleanup: {e}")
            return {}

    def clear_all_cache(self):
        """
        Clear all cache data including chat history and LLM responses.
        """
        try:
            self.enhanced_manager.clear_cache()
            logger.info("All cache data cleared")
        except Exception as e:
            logger.error(f"Error clearing cache: {e}")


# Global cache instance (backwards compatible)
cache_manager = CacheManager()
