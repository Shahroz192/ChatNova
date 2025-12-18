"""
AI Service Profiler for AI Chat Pro
This module provides performance monitoring for LangChain operations and LLM calls
"""

import time
import asyncio
import logging
from functools import wraps
from typing import Dict, List, Optional
from dataclasses import dataclass
from datetime import datetime
from contextlib import contextmanager


@dataclass
class LLMCallMetrics:
    """Store LLM call performance metrics"""

    model_name: str
    input_tokens: int
    output_tokens: int
    execution_time: float
    start_time: datetime
    end_time: datetime
    cost_estimate: Optional[float] = None
    error: Optional[str] = None


# Global metrics storage
llm_call_metrics: List[LLMCallMetrics] = []

# Set up logging for AI performance monitoring
ai_logger = logging.getLogger(__name__)
ai_logger.setLevel(logging.INFO)


class AIServiceProfiler:
    """AI service profiler to monitor LLM performance and costs"""

    def __init__(self):
        self.total_calls = 0
        self.total_tokens_processed = 0
        self.models_used: Dict[str, int] = {}

    def profile_llm_call(self, model_name: str, input_text: str, output_text: str = ""):
        """Decorator to profile LLM calls"""

        def decorator(func):
            @wraps(func)
            async def async_wrapper(*args, **kwargs):
                start_time = time.time()

                try:
                    result = await func(*args, **kwargs)
                    execution_time = time.time() - start_time

                    # Estimate tokens (roughly 4 chars per token for English text)
                    input_tokens = len(input_text) // 4
                    output_tokens = len(result) // 4 if isinstance(result, str) else 0
                    self.total_tokens_processed += input_tokens + output_tokens

                    # Track model usage
                    if model_name in self.models_used:
                        self.models_used[model_name] += 1
                    else:
                        self.models_used[model_name] = 1

                    # Calculate rough cost estimate (these are example values - adjust as needed)
                    cost_per_million_input_tokens = {
                        "gemini-2.5-flash": 0.074,  # $0.074 per million input tokens
                        "qwen-3-235b-a22b-instruct-2507": 0.10,  # placeholder
                        "qwen-3-235b-a22b-thinking-2507": 0.10,  # placeholder
                        "moonshotai/kimi-k2-instruct-0905": 0.10,  # placeholder
                    }

                    cost_estimate = None
                    if model_name in cost_per_million_input_tokens:
                        cost_estimate = (
                            input_tokens / 1_000_000
                        ) * cost_per_million_input_tokens[model_name]

                    llm_call_metrics.append(
                        LLMCallMetrics(
                            model_name=model_name,
                            input_tokens=input_tokens,
                            output_tokens=output_tokens,
                            execution_time=execution_time,
                            start_time=datetime.fromtimestamp(start_time),
                            end_time=datetime.fromtimestamp(time.time()),
                            cost_estimate=cost_estimate,
                        )
                    )

                    self.total_calls += 1

                    ai_logger.info(
                        f"LLM_PROFILE: {model_name} call took {execution_time:.3f}s, "
                        f"input: {input_tokens} tokens, output: {output_tokens} tokens"
                    )

                    return result
                except Exception as e:
                    execution_time = time.time() - start_time
                    llm_call_metrics.append(
                        LLMCallMetrics(
                            model_name=model_name,
                            input_tokens=len(input_text) // 4,
                            output_tokens=0,
                            execution_time=execution_time,
                            start_time=datetime.fromtimestamp(start_time),
                            end_time=datetime.fromtimestamp(time.time()),
                            error=str(e),
                        )
                    )
                    self.total_calls += 1
                    raise

            @wraps(func)
            def sync_wrapper(*args, **kwargs):
                start_time = time.time()

                try:
                    result = func(*args, **kwargs)
                    execution_time = time.time() - start_time

                    # Estimate tokens (roughly 4 chars per token for English text)
                    input_tokens = len(input_text) // 4
                    output_tokens = len(result) // 4 if isinstance(result, str) else 0
                    self.total_tokens_processed += input_tokens + output_tokens

                    # Track model usage
                    if model_name in self.models_used:
                        self.models_used[model_name] += 1
                    else:
                        self.models_used[model_name] = 1

                    # Calculate rough cost estimate (these are example values - adjust as needed)
                    cost_per_million_input_tokens = {
                        "gemini-2.5-flash": 0.074,  # $0.074 per million input tokens
                        "qwen-3-235b-a22b-instruct-2507": 0.10,  # placeholder
                        "qwen-3-235b-a22b-thinking-2507": 0.10,  # placeholder
                        "moonshotai/kimi-k2-instruct-0905": 0.10,  # placeholder
                    }

                    cost_estimate = None
                    if model_name in cost_per_million_input_tokens:
                        cost_estimate = (
                            input_tokens / 1_000_000
                        ) * cost_per_million_input_tokens[model_name]

                    llm_call_metrics.append(
                        LLMCallMetrics(
                            model_name=model_name,
                            input_tokens=input_tokens,
                            output_tokens=output_tokens,
                            execution_time=execution_time,
                            start_time=datetime.fromtimestamp(start_time),
                            end_time=datetime.fromtimestamp(time.time()),
                            cost_estimate=cost_estimate,
                        )
                    )

                    self.total_calls += 1

                    ai_logger.info(
                        f"LLM_PROFILE: {model_name} call took {execution_time:.3f}s, "
                        f"input: {input_tokens} tokens, output: {output_tokens} tokens"
                    )

                    return result
                except Exception as e:
                    execution_time = time.time() - start_time
                    llm_call_metrics.append(
                        LLMCallMetrics(
                            model_name=model_name,
                            input_tokens=len(input_text) // 4,
                            output_tokens=0,
                            execution_time=execution_time,
                            start_time=datetime.fromtimestamp(start_time),
                            end_time=datetime.fromtimestamp(time.time()),
                            error=str(e),
                        )
                    )
                    self.total_calls += 1
                    raise

            if asyncio.iscoroutinefunction(func):
                return async_wrapper
            else:
                return sync_wrapper

        return decorator

    def get_slow_llm_calls(self, threshold: float = 10.0) -> List[LLMCallMetrics]:
        """Get LLM calls that took longer than threshold seconds"""
        return [call for call in llm_call_metrics if call.execution_time > threshold]

    def get_average_llm_call_time(self, model_name: Optional[str] = None) -> float:
        """Get average LLM call execution time, optionally for a specific model"""
        if not llm_call_metrics:
            return 0.0

        if model_name:
            calls = [call for call in llm_call_metrics if call.model_name == model_name]
        else:
            calls = llm_call_metrics

        if not calls:
            return 0.0

        return sum(call.execution_time for call in calls) / len(calls)

    def get_total_llm_calls(self) -> int:
        """Get total number of LLM calls made"""
        return len(llm_call_metrics)

    def get_model_usage_stats(self) -> Dict[str, int]:
        """Get usage statistics for each model"""
        return self.models_used.copy()

    def reset_metrics(self):
        """Reset all LLM metrics"""
        llm_call_metrics.clear()
        self.total_calls = 0
        self.total_tokens_processed = 0
        self.models_used.clear()

    @contextmanager
    def profile_context(self, model_name: str, input_text: str):
        """Context manager to profile code sections that make LLM calls"""
        start_time = time.time()

        try:
            yield
        finally:
            execution_time = time.time() - start_time

            # Estimate tokens (roughly 4 chars per token for English text)
            input_tokens = len(input_text) // 4

            llm_call_metrics.append(
                LLMCallMetrics(
                    model_name=model_name,
                    input_tokens=input_tokens,
                    output_tokens=0,  # We don't know the output in a context manager
                    execution_time=execution_time,
                    start_time=datetime.fromtimestamp(start_time),
                    end_time=datetime.fromtimestamp(time.time()),
                )
            )

            self.total_calls += 1


def profile_ai_service(ai_service_class):
    """Class decorator to profile AI service methods"""
    # Store original methods before modification
    original_simple_chat = ai_service_class.simple_chat
    original_agent_chat = ai_service_class.agent_chat

    def new_simple_chat(
        self,
        message: str,
        model_name: str,
        user_id: Optional[int] = None,
        db: Optional[object] = None,
        session_id: Optional[int] = None,
        search_web: bool = False,
    ) -> str:
        # Profile the simple chat method
        with ai_profiler.profile_context(model_name, message):
            return original_simple_chat(
                self, message, model_name, user_id, db, session_id, search_web
            )

    async def new_agent_chat(
        self,
        message: str,
        model_name: str,
        user_id: Optional[int] = None,
        db: Optional[object] = None,
        session_id: Optional[int] = None,
    ) -> str:
        # Profile the agent chat method
        with ai_profiler.profile_context(model_name, message):
            return await original_agent_chat(
                self, message, model_name, user_id, db, session_id
            )

    ai_service_class.simple_chat = new_simple_chat
    ai_service_class.agent_chat = new_agent_chat

    return ai_service_class


# Global AI service profiler instance
ai_profiler = AIServiceProfiler()
