"""
Memory Profiler for AI Chat Pro
This module provides memory usage monitoring and profiling for the application
"""

import tracemalloc
import psutil
import os
import time
import threading
from typing import List, Optional
from dataclasses import dataclass
from datetime import datetime
import gc


@dataclass
class MemorySnapshot:
    """Store memory usage snapshot"""

    timestamp: datetime
    rss_memory_mb: float  # Resident Set Size (physical memory)
    vms_memory_mb: float  # Virtual Memory Size
    percent_memory: float
    tracemalloc_top_stats: Optional[List] = None


class MemoryProfiler:
    """Memory profiler to monitor and analyze memory usage"""

    def __init__(self):
        self.snapshots: List[MemorySnapshot] = []
        self.monitoring = False
        self.monitor_thread = None
        self.process = psutil.Process(os.getpid())

    def start_tracemalloc(self):
        """Start tracemalloc for detailed memory tracking"""
        tracemalloc.start()

    def stop_tracemalloc(self):
        """Stop tracemalloc"""
        if tracemalloc.is_tracing():
            tracemalloc.stop()

    def take_snapshot(self, include_tracemalloc=True) -> MemorySnapshot:
        """Take a memory usage snapshot"""
        # Get system memory info
        memory_info = self.process.memory_info()
        memory_percent = self.process.memory_percent()

        # Get tracemalloc stats if available
        tracemalloc_stats = None
        if tracemalloc.is_tracing() and include_tracemalloc:
            try:
                snapshot = tracemalloc.take_snapshot()
                tracemalloc_stats = snapshot.statistics("lineno")
            except Exception:
                pass  # tracemalloc might not be active

        snapshot = MemorySnapshot(
            timestamp=datetime.now(),
            rss_memory_mb=memory_info.rss / 1024 / 1024,  # Convert to MB
            vms_memory_mb=memory_info.vms / 1024 / 1024,  # Convert to MB
            percent_memory=memory_percent,
            tracemalloc_top_stats=tracemalloc_stats,
        )

        self.snapshots.append(snapshot)
        return snapshot

    def start_monitoring(self, interval: float = 1.0):
        """Start continuous memory monitoring"""
        if not self.monitoring:
            self.monitoring = True
            self.monitor_thread = threading.Thread(
                target=self._monitor_loop, args=(interval,)
            )
            self.monitor_thread.daemon = True
            self.monitor_thread.start()

    def stop_monitoring(self):
        """Stop continuous memory monitoring"""
        self.monitoring = False
        if self.monitor_thread:
            self.monitor_thread.join()

    def _monitor_loop(self, interval: float):
        """Internal monitoring loop"""
        while self.monitoring:
            try:
                self.take_snapshot(
                    include_tracemalloc=False
                )  # Skip tracemalloc for performance
                time.sleep(interval)
            except Exception:
                # Stop monitoring if there's an error
                self.monitoring = False
                break

    def get_peak_memory(self) -> float:
        """Get the peak memory usage in MB"""
        if not self.snapshots:
            return 0.0
        return max(s.rss_memory_mb for s in self.snapshots)

    def get_average_memory(self) -> float:
        """Get the average memory usage in MB"""
        if not self.snapshots:
            return 0.0
        return sum(s.rss_memory_mb for s in self.snapshots) / len(self.snapshots)

    def get_memory_trend(self) -> List[float]:
        """Get memory usage trend over time"""
        return [s.rss_memory_mb for s in self.snapshots]

    def get_memory_growth_rate(self) -> float:
        """Get the memory growth rate (MB per snapshot)"""
        if len(self.snapshots) < 2:
            return 0.0

        time_diff = (
            self.snapshots[-1].timestamp - self.snapshots[0].timestamp
        ).total_seconds()
        memory_diff = self.snapshots[-1].rss_memory_mb - self.snapshots[0].rss_memory_mb

        if time_diff > 0:
            return memory_diff / time_diff
        return 0.0

    def force_garbage_collection(self):
        """Force garbage collection and return number of collected objects"""
        collected = gc.collect()
        return collected

    def get_top_memory_consumers(self, limit: int = 10) -> List:
        """Get top memory consumers from tracemalloc"""
        if not tracemalloc.is_tracing():
            return []

        try:
            snapshot = tracemalloc.take_snapshot()
            top_stats = snapshot.statistics("lineno")
            return top_stats[:limit]
        except Exception:
            return []

    def reset_snapshots(self):
        """Reset all memory snapshots"""
        self.snapshots.clear()


# Global memory profiler instance
memory_profiler = MemoryProfiler()


def profile_memory_usage(func):
    """Decorator to profile memory usage of a function"""
    import functools

    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        # Take snapshot before
        before_snapshot = memory_profiler.take_snapshot()

        result = func(*args, **kwargs)

        # Take snapshot after
        after_snapshot = memory_profiler.take_snapshot()

        memory_diff = after_snapshot.rss_memory_mb - before_snapshot.rss_memory_mb
        print(f"Memory usage change for {func.__name__}: {memory_diff:+.2f} MB")

        return result

    return wrapper
