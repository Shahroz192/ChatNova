import gzip
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint


class CompressionMiddleware(BaseHTTPMiddleware):
    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        response = await call_next(request)

        if response.headers.get("content-type", "").startswith("application/json"):
            content_length = response.headers.get("content-length", "")
            if (
                content_length.isdigit() and int(content_length) > 1024
            ):
                content = b""
                async for chunk in response.body_iterator:
                    content += chunk

                compressed_content = gzip.compress(content)
                response.headers["Content-Encoding"] = "gzip"
                response.headers["Content-Length"] = str(len(compressed_content))

                response = Response(
                    content=compressed_content,
                    status_code=response.status_code,
                    headers=dict(response.headers),
                    media_type=response.media_type,
                )

        return response
