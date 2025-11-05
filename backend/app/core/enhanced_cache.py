"""
Enhanced Cache Module with Memory Management
Provides advanced caching with memory limits, eviction policies, and performance monitoring.
"""

import os
import psutil
import gc
import time
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from collections import OrderedDict
from threading import Lock
import logging

logger = logging.getLogger(__name__)


class MemoryMonitor:
    """Monitor system and cache memory usage."""

    @staticmethod
    def get_memory_usage() -> Dict[str, float]:
        """Get current memory usage statistics."""
        try:
            # Get process memory info
            process = psutil.Process(os.getpid())
            memory_info = process.memory_info()

            # Get system memory info
            system_memory = psutil.virtual_memory()

            return {
                "process_rss_mb": memory_info.rss
                / 1024
                / 1024,  # Resident Set Size in MB
                "process_vms_mb": memory_info.vms
                / 1024
                / 1024,  # Virtual Memory Size in MB
                "system_total_gb": system_memory.total / 1024 / 1024 / 1024,
                "system_available_gb": system_memory.available / 1024 / 1024 / 1024,
                "system_used_percent": system_memory.percent,
                "system_free_gb": system_memory.free / 1024 / 1024 / 1024,
            }
        except Exception as e:
            logger.error(f"Error getting memory usage: {e}")
            return {
                "process_rss_mb": 0,
                "process_vms_mb": 0,
                "system_total_gb": 0,
                "system_available_gb": 0,
                "system_used_percent": 0,
                "system_free_gb": 0,
            }

    @staticmethod
    def get_cache_memory_estimate(cache_size: int, avg_entry_size: int = 1024) -> float:
        """Estimate memory usage of cache entries."""
        return (cache_size * avg_entry_size) / 1024 / 1024  # Convert to MB


class CacheEntry:
    """Represents a cache entry with metadata."""

    def __init__(self, key: str, value: Any, ttl: int, access_time: datetime = None):
        self.key = key
        self.value = value
        self.ttl = ttl
        self.created_at = datetime.now()
        self.last_accessed = access_time or datetime.now()
        self.access_count = 1
        self.size_bytes = self._calculate_size()

    def _calculate_size(self) -> int:
        """Calculate approximate size of the entry in bytes."""
        try:
            import pickle

            # Estimate size using pickle
            return len(pickle.dumps(self.value))
        except Exception:
            # Fallback to basic estimation
            return len(str(self.value).encode("utf-8")) + 200  # Add overhead

    def is_expired(self) -> bool:
        """Check if the cache entry has expired."""
        return datetime.now() > self.created_at + timedelta(seconds=self.ttl)

    def access(self) -> None:
        """Record access to this cache entry."""
        self.last_accessed = datetime.now()
        self.access_count += 1

    def get_age_seconds(self) -> float:
        """Get age of entry in seconds."""
        return (datetime.now() - self.created_at).total_seconds()


class MemoryManagedCache:
    """
    Advanced in-memory cache with memory management, LRU eviction, and monitoring.
    """

    def __init__(
        self,
        max_memory_mb: int = 500,
        max_entries: int = 10000,
        cleanup_interval_seconds: int = 300,
        enable_monitoring: bool = True,
    ):
        self.max_memory_mb = max_memory_mb
        self.max_entries = max_entries
        self.cleanup_interval_seconds = cleanup_interval_seconds
        self.enable_monitoring = enable_monitoring

        # Cache storage using OrderedDict for LRU
        self._cache = OrderedDict()
        self._lock = Lock()
        self._memory_monitor = MemoryMonitor()

        # Statistics
        self.stats = {
            "hits": 0,
            "misses": 0,
            "evictions": 0,
            "cleanups": 0,
            "memory_cleanups": 0,
            "total_entries": 0,
            "current_memory_mb": 0.0,
            "total_operations": 0,
        }

        # Cleanup scheduling
        self._last_cleanup = time.time()

        logger.info(
            f"Cache initialized with {max_memory_mb}MB limit and {max_entries} max entries"
        )

    def get(self, key: str) -> Optional[Any]:
        """Get value from cache with memory management."""
        with self._lock:
            self.stats["total_operations"] += 1

            # Periodic cleanup
            self._maybe_cleanup()

            if key not in self._cache:
                self.stats["misses"] += 1
                return None

            entry = self._cache[key]

            # Check if expired
            if entry.is_expired():
                del self._cache[key]
                self.stats["total_entries"] = len(self._cache)
                self.stats["misses"] += 1
                return None

            # Record access and move to end (LRU)
            entry.access()
            self._cache.move_to_end(key)
            self.stats["hits"] += 1

            return entry.value

    def set(self, key: str, value: Any, ttl: int = 300) -> bool:
        """Set value in cache with memory management."""
        with self._lock:
            self.stats["total_operations"] += 1

            # Create new entry
            entry = CacheEntry(key, value, ttl)

            # Check if we need to evict
            self._ensure_memory_space(entry.size_bytes)

            # Add or update entry
            if key in self._cache:
                # Remove old entry
                del self._cache[key]

            self._cache[key] = entry
            self.stats["total_entries"] = len(self._cache)

            return True

    def delete(self, key: str) -> bool:
        """Delete key from cache."""
        with self._lock:
            if key in self._cache:
                del self._cache[key]
                self.stats["total_entries"] = len(self._cache)
                return True
            return False

    def clear(self) -> None:
        """Clear all cache entries."""
        with self._lock:
            self._cache.clear()
            self.stats["total_entries"] = 0
            gc.collect()  # Force garbage collection

    def _ensure_memory_space(self, required_bytes: int) -> None:
        """Ensure there's enough memory for new entry."""
        current_memory_mb = self._get_current_memory_usage()
        required_mb = required_bytes / 1024 / 1024

        # Check memory limits
        if (
            len(self._cache) >= self.max_entries
            or current_memory_mb + required_mb > self.max_memory_mb
        ):
            # Evict entries using LRU
            self._evict_entries(required_mb)

    def _evict_entries(self, required_mb: float) -> None:
        """Evict least recently used entries to make space."""
        evicted_count = 0
        evicted_memory_mb = 0.0

        # Remove expired entries first
        expired_keys = [key for key, entry in self._cache.items() if entry.is_expired()]

        for key in expired_keys:
            entry = self._cache[key]
            evicted_memory_mb += entry.size_bytes / 1024 / 1024
            del self._cache[key]
            evicted_count += 1

        # If still need space, remove LRU entries
        while len(self._cache) > 0 and (
            len(self._cache) >= self.max_entries or evicted_memory_mb < required_mb
        ):
            # Remove least recently used (first item in OrderedDict)
            lru_key, lru_entry = self._cache.popitem(last=False)
            evicted_memory_mb += lru_entry.size_bytes / 1024 / 1024
            evicted_count += 1

            if evicted_count > 1000:  # Safety limit
                break

        self.stats["evictions"] += evicted_count
        self.stats["current_memory_mb"] = self._get_current_memory_usage()

        if evicted_count > 0:
            logger.debug(
                f"Evicted {evicted_count} entries to free {evicted_memory_mb:.2f}MB"
            )

    def _get_current_memory_usage(self) -> float:
        """Calculate current memory usage of cache."""
        total_bytes = sum(entry.size_bytes for entry in self._cache.values())
        return total_bytes / 1024 / 1024  # Convert to MB

    def _maybe_cleanup(self) -> None:
        """Perform periodic cleanup of expired entries."""
        current_time = time.time()

        if current_time - self._last_cleanup < self.cleanup_interval_seconds:
            return

        self._cleanup_expired()
        self._last_cleanup = current_time
        self.stats["cleanups"] += 1

    def _cleanup_expired(self) -> None:
        """Remove expired cache entries."""
        expired_keys = [key for key, entry in self._cache.items() if entry.is_expired()]

        for key in expired_keys:
            del self._cache[key]

        if expired_keys:
            logger.debug(f"Cleaned up {len(expired_keys)} expired entries")

    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        with self._lock:
            current_memory = self._get_current_memory_usage()
            hit_rate = (
                self.stats["hits"] / max(self.stats["hits"] + self.stats["misses"], 1)
            ) * 100

            system_memory = self._memory_monitor.get_memory_usage()

            return {
                **self.stats,
                "current_memory_mb": current_memory,
                "hit_rate_percent": hit_rate,
                "memory_utilization_percent": (current_memory / self.max_memory_mb)
                * 100,
                "entries_utilization_percent": (len(self._cache) / self.max_entries)
                * 100,
                "system_memory": system_memory,
            }

    def force_cleanup(self) -> Dict[str, int]:
        """Force cleanup of expired entries and return cleanup stats."""
        with self._lock:
            before_count = len(self._cache)
            self._cleanup_expired()
            after_count = len(self._cache)
            cleaned_count = before_count - after_count

            self.stats["cleanups"] += 1
            gc.collect()  # Force garbage collection

            return {
                "cleaned_entries": cleaned_count,
                "remaining_entries": after_count,
                "freed_memory_mb": 0,  # Would need more complex calculation
            }

    def optimize(self) -> Dict[str, Any]:
        """Optimize cache by removing expired entries and consolidating memory."""
        with self._lock:
            initial_memory = self._get_current_memory_usage()
            initial_entries = len(self._cache)

            # Clean expired entries
            self._cleanup_expired()

            # Force garbage collection
            gc.collect()

            final_memory = self._get_current_memory_usage()
            final_entries = len(self._cache)

            return {
                "initial_memory_mb": initial_memory,
                "final_memory_mb": final_memory,
                "memory_saved_mb": initial_memory - final_memory,
                "initial_entries": initial_entries,
                "final_entries": final_entries,
                "entries_removed": initial_entries - final_entries,
            }


class EnhancedCacheManager:
    """
    Enhanced cache manager with memory management and monitoring.
    """

    def __init__(
        self,
        max_memory_mb: int = 500,
        max_entries: int = 10000,
        enable_monitoring: bool = True,
    ):
        self.cache = MemoryManagedCache(
            max_memory_mb=max_memory_mb,
            max_entries=max_entries,
            enable_monitoring=enable_monitoring,
        )
        logger.info("Enhanced cache manager initialized")

    def get_chat_history(
        self, user_id: int, skip: int, limit: int, session_id: Optional[int] = None
    ) -> Optional[List[Dict]]:
        """Get chat history from enhanced cache."""
        if session_id:
            cache_key = f"chat_history:{user_id}:session:{session_id}:{skip}:{limit}"
        else:
            cache_key = f"chat_history:{user_id}:{skip}:{limit}"

        return self.cache.get(cache_key)

    def set_chat_history(
        self,
        user_id: int,
        skip: int,
        limit: int,
        messages: List,
        ttl: int = 300,
        session_id: Optional[int] = None,
    ):
        """Set chat history in enhanced cache."""
        if session_id:
            cache_key = f"chat_history:{user_id}:session:{session_id}:{skip}:{limit}"
        else:
            cache_key = f"chat_history:{user_id}:{skip}:{limit}"

        try:
            # Convert messages to JSON serializable format
            if hasattr(messages[0], "__dict__"):
                messages_json = [msg.__dict__ for msg in messages]
            else:
                messages_json = messages

            self.cache.set(cache_key, messages_json, ttl)
        except Exception as e:
            logger.error(f"Error setting chat history cache: {e}")

    def invalidate_user_history(self, user_id: int, session_id: Optional[int] = None):
        """Invalidate cached history for user/session."""
        try:
            if session_id:
                # Invalidate specific session cache
                cache_key = f"chat_history:{user_id}:session:{session_id}:*"
                keys_to_delete = [
                    k for k in self.cache._cache.keys() if k.startswith(cache_key)
                ]
            else:
                # Invalidate all user history
                cache_key = f"chat_history:{user_id}:"
                keys_to_delete = [
                    k for k in self.cache._cache.keys() if k.startswith(cache_key)
                ]

            for key in keys_to_delete:
                self.cache.delete(key)

        except Exception as e:
            logger.error(f"Error invalidating user history cache: {e}")

    def get_cache_stats(self) -> Dict[str, Any]:
        """Get comprehensive cache statistics."""
        return self.cache.get_stats()

    def optimize_cache(self) -> Dict[str, Any]:
        """Optimize cache performance and memory usage."""
        return self.cache.optimize()

    def force_cleanup(self) -> Dict[str, int]:
        """Force cache cleanup and return statistics."""
        return self.cache.force_cleanup()

    def clear_cache(self):
        """Clear all cached data."""
        self.cache.clear()


# Create global enhanced cache instance
enhanced_cache_manager = EnhancedCacheManager(max_memory_mb=500, max_entries=5000)
