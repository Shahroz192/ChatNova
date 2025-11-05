"""
Performance Profiling Tools for AI Chat Pro
This module provides performance monitoring, profiling, and bottleneck detection
for the FastAPI backend with LangChain integration.
"""

import time
import asyncio
import cProfile
import pstats
import io
import psutil
import os
from functools import wraps
from contextlib import contextmanager
from typing import List
from pydantic import BaseModel
import logging

# Set up logging for performance monitoring
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class PerformanceMetrics(BaseModel):
    """Model to store performance metrics"""

    endpoint: str
    method: str
    execution_time: float
    cpu_percent: float
    memory_mb: float
    db_queries: int = 0
    llm_calls: int = 0
    request_size: int = 0
    response_size: int = 0
    timestamp: float = time.time()


class Profiler:
    """Main profiler class for monitoring application performance"""

    def __init__(self):
        self.metrics: List[PerformanceMetrics] = []
        self.profiler = cProfile.Profile()
        self.active = True
        self.cpu_monitor = CPUMonitor()

    def start_profiling(self):
        """Start the profiler"""
        if self.active:
            self.profiler.enable()

    def stop_profiling(self):
        """Stop the profiler"""
        if self.active:
            self.profiler.disable()

    def get_profile_stats(self, sort_by="cumulative", limit=20) -> str:
        """Get profiling statistics"""
        s = io.StringIO()
        ps = pstats.Stats(self.profiler, stream=s)
        ps.sort_stats(sort_by)
        ps.print_stats(limit)
        return s.getvalue()

    def add_metrics(self, metrics: PerformanceMetrics):
        """Add performance metrics"""
        self.metrics.append(metrics)

    def get_recent_metrics(self, limit: int = 100) -> List[PerformanceMetrics]:
        """Get recent performance metrics"""
        return self.metrics[-limit:]

    def reset_metrics(self):
        """Reset stored metrics"""
        self.metrics = []


class CPUMonitor:
    """CPU monitoring class"""

    def __init__(self):
        self.process = psutil.Process(os.getpid())

    def get_cpu_percent(self) -> float:
        """Get current CPU percentage"""
        return self.process.cpu_percent()

    def get_memory_mb(self) -> float:
        """Get current memory usage in MB"""
        return self.process.memory_info().rss / 1024 / 1024


class RequestProfiler:
    """Request-level profiler for FastAPI endpoints"""

    def __init__(self, profiler: Profiler):
        self.profiler = profiler

    def profile_endpoint(self, endpoint: str, method: str):
        """Decorator to profile specific endpoints"""

        def decorator(func):
            @wraps(func)
            async def async_wrapper(*args, **kwargs):
                return await self._profile_async_request(
                    func, endpoint, method, *args, **kwargs
                )

            @wraps(func)
            def sync_wrapper(*args, **kwargs):
                return self._profile_sync_request(
                    func, endpoint, method, *args, **kwargs
                )

            # Return appropriate wrapper based on function type
            if asyncio.iscoroutinefunction(func):
                return async_wrapper
            else:
                return sync_wrapper

        return decorator

    async def _profile_async_request(
        self, func, endpoint: str, method: str, *args, **kwargs
    ):
        """Profile async request"""
        start_time = time.time()
        start_cpu = self.profiler.cpu_monitor.get_cpu_percent()
        start_memory = self.profiler.cpu_monitor.get_memory_mb()

        try:
            result = await func(*args, **kwargs)
            return result
        finally:
            end_time = time.time()
            execution_time = end_time - start_time
            end_cpu = self.profiler.cpu_monitor.get_cpu_percent()
            end_memory = self.profiler.cpu_monitor.get_memory_mb()

            # Calculate average CPU and memory during execution
            avg_cpu = (start_cpu + end_cpu) / 2
            peak_memory = max(start_memory, end_memory)

            metrics = PerformanceMetrics(
                endpoint=endpoint,
                method=method,
                execution_time=execution_time,
                cpu_percent=avg_cpu,
                memory_mb=peak_memory,
            )

            self.profiler.add_metrics(metrics)
            logger.info(
                f"PROFILE: {method} {endpoint} took {execution_time:.3f}s, "
                f"CPU: {avg_cpu:.1f}%, Memory: {peak_memory:.1f}MB"
            )

    def _profile_sync_request(self, func, endpoint: str, method: str, *args, **kwargs):
        """Profile sync request"""
        start_time = time.time()
        start_cpu = self.profiler.cpu_monitor.get_cpu_percent()
        start_memory = self.profiler.cpu_monitor.get_memory_mb()

        try:
            result = func(*args, **kwargs)
            return result
        finally:
            end_time = time.time()
            execution_time = end_time - start_time
            end_cpu = self.profiler.cpu_monitor.get_cpu_percent()
            end_memory = self.profiler.cpu_monitor.get_memory_mb()

            # Calculate average CPU and memory during execution
            avg_cpu = (start_cpu + end_cpu) / 2
            peak_memory = max(start_memory, end_memory)

            metrics = PerformanceMetrics(
                endpoint=endpoint,
                method=method,
                execution_time=execution_time,
                cpu_percent=avg_cpu,
                memory_mb=peak_memory,
            )

            self.profiler.add_metrics(metrics)
            logger.info(
                f"PROFILE: {method} {endpoint} took {execution_time:.3f}s, "
                f"CPU: {avg_cpu:.1f}%, Memory: {peak_memory:.1f}MB"
            )


# Global profiler instance
profiler = Profiler()
request_profiler = RequestProfiler(profiler)


# Context manager for profiling code blocks
@contextmanager
def profile_block(name: str = "unnamed"):
    """Context manager to profile a code block"""
    start_time = time.time()
    start_cpu = profiler.cpu_monitor.get_cpu_percent()
    start_memory = profiler.cpu_monitor.get_memory_mb()

    try:
        profiler.start_profiling()
        yield
    finally:
        profiler.stop_profiling()
        end_time = time.time()
        execution_time = end_time - start_time
        end_cpu = profiler.cpu_monitor.get_cpu_percent()
        end_memory = profiler.cpu_monitor.get_memory_mb()

        # Calculate average CPU and memory during execution
        avg_cpu = (start_cpu + end_cpu) / 2
        peak_memory = max(start_memory, end_memory)

        logger.info(
            f"BLOCK_PROFILE: {name} took {execution_time:.3f}s, "
            f"CPU: {avg_cpu:.1f}%, Memory: {peak_memory:.1f}MB"
        )


def profile_function(func):
    """Decorator to profile any function"""

    @wraps(func)
    async def async_wrapper(*args, **kwargs):
        start_time = time.time()
        start_cpu = profiler.cpu_monitor.get_cpu_percent()
        start_memory = profiler.cpu_monitor.get_memory_mb()

        try:
            profiler.start_profiling()
            result = await func(*args, **kwargs)
            return result
        finally:
            profiler.stop_profiling()
            end_time = time.time()
            execution_time = end_time - start_time
            end_cpu = profiler.cpu_monitor.get_cpu_percent()
            end_memory = profiler.cpu_monitor.get_memory_mb()

            # Calculate average CPU and memory during execution
            avg_cpu = (start_cpu + end_cpu) / 2
            peak_memory = max(start_memory, end_memory)

            logger.info(
                f"FUNC_PROFILE: {func.__name__} took {execution_time:.3f}s, "
                f"CPU: {avg_cpu:.1f}%, Memory: {peak_memory:.1f}MB"
            )

    @wraps(func)
    def sync_wrapper(*args, **kwargs):
        start_time = time.time()
        start_cpu = profiler.cpu_monitor.get_cpu_percent()
        start_memory = profiler.cpu_monitor.get_memory_mb()

        try:
            profiler.start_profiling()
            result = func(*args, **kwargs)
            return result
        finally:
            profiler.stop_profiling()
            end_time = time.time()
            execution_time = end_time - start_time
            end_cpu = profiler.cpu_monitor.get_cpu_percent()
            end_memory = profiler.cpu_monitor.get_memory_mb()

            # Calculate average CPU and memory during execution
            avg_cpu = (start_cpu + end_cpu) / 2
            peak_memory = max(start_memory, end_memory)

            logger.info(
                f"FUNC_PROFILE: {func.__name__} took {execution_time:.3f}s, "
                f"CPU: {avg_cpu:.1f}%, Memory: {peak_memory:.1f}MB"
            )

    if asyncio.iscoroutinefunction(func):
        return async_wrapper
    else:
        return sync_wrapper
