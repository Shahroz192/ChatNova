"""
Database Performance Profiler for AI Chat Pro
This module provides database query monitoring and performance analysis
"""

from sqlalchemy import event
from sqlalchemy.engine import Engine
import time
import logging
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from datetime import datetime


@dataclass
class QueryMetrics:
    """Store query performance metrics"""

    sql: str
    execution_time: float
    start_time: datetime
    end_time: datetime
    parameters: Optional[Dict] = None
    error: Optional[str] = None


# Global query metrics storage
query_metrics: List[QueryMetrics] = []
connection_metrics: Dict[str, Any] = {
    "total_connections": 0,
    "idle_connections": 0,
    "active_connections": 0,
    "pool_size": 0,
}

# Set up logging for database performance monitoring
db_logger = logging.getLogger(__name__)
db_logger.setLevel(logging.INFO)


class DatabaseProfiler:
    """Database profiler to monitor query performance and connection pool metrics"""

    def __init__(self, engine=None):
        self.engine = engine
        self.query_count = 0
        self.connection_metrics = {
            "total_connections": 0,
            "idle_connections": 0,
            "active_connections": 0,
            "pool_size": 0,
        }

    def setup_query_monitoring(self, engine: Engine):
        """Setup query monitoring for SQLAlchemy engine"""
        self.engine = engine
        # Monitor query execution time
        event.listen(engine, "before_cursor_execute", self.before_cursor_execute)
        event.listen(engine, "after_cursor_execute", self.after_cursor_execute)

        # Monitor connection pool
        event.listen(engine.pool, "connect", self.pool_connect)
        event.listen(engine.pool, "checkout", self.pool_checkout)
        event.listen(engine.pool, "checkin", self.pool_checkin)

    def before_cursor_execute(
        self, conn, cursor, statement, parameters, context, executemany
    ):
        """Event handler before query execution"""
        context._query_start_time = time.time()

    def after_cursor_execute(
        self, conn, cursor, statement, parameters, context, executemany
    ):
        """Event handler after query execution"""
        total_time = time.time() - context._query_start_time

        # Log slow queries (those taking more than 100ms)
        if total_time > 0.1:
            db_logger.warning(f"SLOW QUERY ({total_time:.3f}s): {statement[:100]}...")

        query_metrics.append(
            QueryMetrics(
                sql=statement,
                execution_time=total_time,
                start_time=datetime.fromtimestamp(time.time() - total_time),
                end_time=datetime.fromtimestamp(time.time()),
                parameters=parameters if parameters else None,
            )
        )

        self.query_count += 1

    def pool_connect(self, dbapi_connection, connection_record):
        """Event handler for new connections"""
        # The connection_record does not have a pool attribute directly
        # Instead, we can access the pool info from the engine if needed
        if self.engine:
            self.connection_metrics["pool_size"] = self.engine.pool.size()

    def pool_checkout(self, dbapi_connection, connection_record, connection_proxy):
        """Event handler for connection checkout"""
        self.connection_metrics["active_connections"] += 1
        if self.connection_metrics["pool_size"] > 0:
            self.connection_metrics["idle_connections"] = max(
                0,
                self.connection_metrics["pool_size"]
                - self.connection_metrics["active_connections"],
            )

    def pool_checkin(self, dbapi_connection, connection_record):
        """Event handler for connection checkin"""
        self.connection_metrics["active_connections"] = max(
            0, self.connection_metrics["active_connections"] - 1
        )
        if self.connection_metrics["pool_size"] > 0:
            self.connection_metrics["idle_connections"] = max(
                0,
                self.connection_metrics["pool_size"]
                - self.connection_metrics["active_connections"],
            )

    def get_slow_queries(self, threshold: float = 0.1) -> List[QueryMetrics]:
        """Get queries that took longer than threshold seconds"""
        return [q for q in query_metrics if q.execution_time > threshold]

    def get_average_query_time(self) -> float:
        """Get average query execution time"""
        if not query_metrics:
            return 0.0
        return sum(q.execution_time for q in query_metrics) / len(query_metrics)

    def get_total_queries(self) -> int:
        """Get total number of queries executed"""
        return len(query_metrics)

    def reset_metrics(self):
        """Reset all query metrics"""
        query_metrics.clear()
        self.query_count = 0


# Global database profiler instance
db_profiler = DatabaseProfiler()


def setup_db_profiling(engine):
    """Helper function to setup database profiling"""
    db_profiler.setup_query_monitoring(engine)
    db_logger.info("Database query monitoring enabled")
