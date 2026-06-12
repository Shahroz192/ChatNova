"""
Shared pagination utility.

Computes pagination metadata consistently across all endpoints,
eliminating the duplicated calculation pattern.
"""

from typing import Any, Dict


def compute_pagination_meta(
    skip: int,
    limit: int,
    total_count: int,
) -> Dict[str, Any]:
    """Compute standard pagination metadata from skip/limit pagination.

    Args:
        skip: Number of records skipped.
        limit: Number of records per page.
        total_count: Total number of records matching the filter.

    Returns:
        A dict with ``total``, ``page``, ``per_page``, ``total_pages``,
        ``has_more``, ``skip``, and ``limit`` keys.
    """
    current_page = (skip // limit) + 1 if limit else 1
    total_pages = max((total_count + limit - 1) // limit, 1) if limit else 1
    has_more = (skip + limit) < total_count

    return {
        "total": total_count,
        "page": current_page,
        "per_page": limit,
        "total_pages": total_pages,
        "has_more": has_more,
        "skip": skip,
        "limit": limit,
    }
