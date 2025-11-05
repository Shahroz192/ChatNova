"""
Compression Middleware for API responses
Applies gzip compression to responses based on content type and size
"""

import gzip
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint


class CompressionMiddleware(BaseHTTPMiddleware):
    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        response = await call_next(request)

        # Only compress if content type is JSON and size is significant
        if response.headers.get("content-type", "").startswith("application/json"):
            content_length = response.headers.get("content-length", "")
            if (
                content_length.isdigit() and int(content_length) > 1024
            ):  # Only compress if > 1KB
                content = b""
                async for chunk in response.body_iterator:
                    content += chunk

                # Compress the content
                compressed_content = gzip.compress(content)

                # Update response
                response.headers["Content-Encoding"] = "gzip"
                response.headers["Content-Length"] = str(len(compressed_content))

                # Create new response with compressed content
                response = Response(
                    content=compressed_content,
                    status_code=response.status_code,
                    headers=dict(response.headers),
                    media_type=response.media_type,
                )

        return response
