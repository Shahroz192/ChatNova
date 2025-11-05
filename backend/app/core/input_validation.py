import re
import html
import bleach


class InputSanitizer:
    """Comprehensive input sanitization and validation for security."""

    # XSS patterns to detect and remove
    XSS_PATTERNS = [
        r"<script[^>]*>.*?</script>",  # Script tags
        r"<iframe[^>]*>.*?</iframe>",  # Iframe tags
        r"<object[^>]*>.*?</object>",  # Object tags
        r"<embed[^>]*>.*?</embed>",  # Embed tags
        r"<form[^>]*>.*?</form>",  # Form tags
        r'<input[^>]*(?:type\s*=\s*["\']?(?:text|password|hidden|file)[^"\']*)?[^>]*>',  # Input tags
        r"<link[^>]*>",  # Link tags
        r"<style[^>]*>.*?</style>",  # Style tags
        r"<meta[^>]*>",  # Meta tags
        r'javascript:[^"\']*',  # JavaScript URLs
        r'on\w+\s*=\s*["\'][^"\']*["\']',  # Event handlers
        r'on\w+\s*=\s*[^"\s]+',  # Event handlers without quotes
        r'data:[^"\']*',  # Data URLs
        r'vbscript:[^"\']*',  # VBScript URLs
        r"expression\s*\([^)]*\)",  # CSS expressions
    ]

    # Allowed HTML tags for sanitized content
    ALLOWED_TAGS = [
        "b",
        "i",
        "u",
        "strong",
        "em",
        "p",
        "br",
        "ul",
        "ol",
        "li",
        "code",
        "pre",
        "blockquote",
        "a",
    ]

    # Allowed attributes for specific tags
    ALLOWED_ATTRIBUTES = {
        "a": ["href", "title"],
        "p": ["title"],
        "code": ["class"],
        "pre": ["class"],
        "blockquote": ["title"],
        "*": ["class"],  # Allow class on all tags
    }

    # Maximum lengths for different content types
    MAX_MESSAGE_LENGTH = 10000
    MAX_TITLE_LENGTH = 255
    MAX_DESCRIPTION_LENGTH = 1000

    @classmethod
    def sanitize_html(cls, text: str, allow_basic_html: bool = False) -> str:
        """Sanitize HTML content to prevent XSS attacks.

        Args:
            text: Input text to sanitize
            allow_basic_html: If True, allow basic HTML tags (b, i, u, etc.)

        Returns:
            Sanitized text with XSS patterns removed
        """
        if not text:
            return ""

        # First, escape HTML entities to prevent HTML injection
        sanitized = html.escape(text)

        if allow_basic_html:
            # Allow basic formatting tags if requested
            allowed_tags = cls.ALLOWED_TAGS
            allowed_attrs = cls.ALLOWED_ATTRIBUTES
        else:
            # Remove all HTML tags
            allowed_tags = []
            allowed_attrs = {}

        # Use bleach for additional sanitization
        sanitized = bleach.clean(
            sanitized, tags=allowed_tags, attributes=allowed_attrs, strip=True
        )

        return sanitized.strip()

    @classmethod
    def validate_message_content(cls, content: str) -> tuple[bool, str, str]:
        """Validate and sanitize chat message content.

        Args:
            content: Raw message content

        Returns:
            tuple: (is_valid, sanitized_content, error_message)
        """
        if not content or not isinstance(content, str):
            return False, "", "Message content cannot be empty"

        # Check length
        if len(content) > cls.MAX_MESSAGE_LENGTH:
            return (
                False,
                "",
                f"Message content exceeds maximum length of {cls.MAX_MESSAGE_LENGTH} characters",
            )

        # Sanitize the content
        sanitized = cls.sanitize_html(content, allow_basic_html=False)

        # Check for suspicious patterns that might indicate injection attempts
        suspicious_patterns = []

        # Check for SQL injection patterns (less strict for benign words)
        sql_patterns = [
            r"(?i)(union|select|insert|update|drop|create|alter|exec|execute)",
            r'["\']\s*;\s*--',  # SQL comment
            r"\bor\b\s+1\s*=\s*1\b",  # SQL injection 1=1
            r"\band\b\s+1\s*=\s*1\b",  # SQL injection 1=1
        ]

        for pattern in sql_patterns:
            if re.search(pattern, content, re.IGNORECASE):
                suspicious_patterns.append("SQL injection pattern detected")

        # Check for command injection patterns
        cmd_patterns = [
            r"[\|&;`$(){}\[\]<>]",  # Shell metacharacters
            r"&&\s*|\|\|\s*",  # Command chaining
        ]

        for pattern in cmd_patterns:
            if re.search(pattern, content):
                suspicious_patterns.append("Command injection pattern detected")

        # If suspicious patterns found, return error
        if suspicious_patterns:
            return False, "", "Message contains potentially malicious content"

        # Additional validation - check if sanitization removed too much content
        if len(sanitized) < len(content) * 0.1:  # If more than 90% was removed
            return (
                False,
                "",
                "Message contains excessive formatting or special characters",
            )

        return True, sanitized, ""

    @classmethod
    def validate_title(cls, title: str) -> tuple[bool, str, str]:
        """Validate and sanitize session title.

        Args:
            title: Session title

        Returns:
            tuple: (is_valid, sanitized_title, error_message)
        """
        if not title or not isinstance(title, str):
            return False, "", "Title cannot be empty"

        # Check length
        if len(title) > cls.MAX_TITLE_LENGTH:
            return (
                False,
                "",
                f"Title exceeds maximum length of {cls.MAX_TITLE_LENGTH} characters",
            )

        # Basic validation - should not be just whitespace
        if not title.strip():
            return False, "", "Title cannot be empty or whitespace only"

        # Sanitize the title
        sanitized = cls.sanitize_html(title.strip(), allow_basic_html=False)

        return True, sanitized, ""

    @classmethod
    def validate_description(cls, description: str) -> tuple[bool, str, str]:
        """Validate and sanitize session description.

        Args:
            description: Session description

        Returns:
            tuple: (is_valid, sanitized_description, error_message)
        """
        if not description:
            return True, "", ""  # Description is optional

        if not isinstance(description, str):
            return False, "", "Description must be a string"

        # Check length
        if len(description) > cls.MAX_DESCRIPTION_LENGTH:
            return (
                False,
                "",
                f"Description exceeds maximum length of {cls.MAX_DESCRIPTION_LENGTH} characters",
            )

        # Sanitize the description
        sanitized = cls.sanitize_html(description, allow_basic_html=False)

        return True, sanitized, ""

    @classmethod
    def validate_email(cls, email: str) -> tuple[bool, str, str]:
        """Validate email format and content.

        Args:
            email: Email address to validate

        Returns:
            tuple: (is_valid, sanitized_email, error_message)
        """
        if not email or not isinstance(email, str):
            return False, "", "Email cannot be empty"

        # Basic email format check
        email_pattern = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
        if not re.match(email_pattern, email.strip()):
            return False, "", "Invalid email format"

        # Sanitize
        sanitized = email.strip().lower()

        return True, sanitized, ""

    @classmethod
    def sanitize_filename(cls, filename: str) -> str:
        """Sanitize filename to prevent directory traversal and other attacks.

        Args:
            filename: Raw filename

        Returns:
            Sanitized filename safe for filesystem operations
        """
        if not filename:
            return "unnamed"

        # Remove or replace dangerous characters
        sanitized = re.sub(r"[^\w\-_.]", "_", filename)

        # Remove path traversal attempts
        sanitized = re.sub(r"\.\./+", "", sanitized)

        # Limit length
        if len(sanitized) > 255:
            name, ext = (
                sanitized.rsplit(".", 1) if "." in sanitized else (sanitized, "")
            )
            sanitized = name[:250] + ("." + ext if ext else "")

        return sanitized or "unnamed"

    @classmethod
    def detect_suspicious_content(cls, text: str) -> dict:
        """Detect various types of suspicious content in text.

        Args:
            text: Text to analyze

        Returns:
            dict: Analysis results with threat levels and reasons
        """
        if not text:
            return {
                "is_safe": True,
                "threat_level": "none",
                "threats_detected": [],
                "recommendations": [],
            }

        threats = []
        recommendations = []

        # Check for XSS patterns
        for pattern in cls.XSS_PATTERNS:
            if re.search(pattern, text, re.IGNORECASE | re.DOTALL):
                threats.append(
                    {
                        "type": "XSS",
                        "description": "Potential Cross-Site Scripting content detected",
                        "severity": "high",
                    }
                )
                break

        # Check for SQL injection patterns
        sql_indicators = [
            (
                r"(?i)(union|select|insert|update|delete|drop|create|alter)",
                "SQL injection attempt",
            ),
            (r'["\']\s*;\s*--', "SQL comment injection"),
            (r"\b(?:or|and)\b\s+1\s*=\s*1\b", "SQL boolean injection"),
        ]

        for pattern, description in sql_indicators:
            if re.search(pattern, text):
                threats.append(
                    {
                        "type": "SQL_INJECTION",
                        "description": description,
                        "severity": "high",
                    }
                )
                break

        # Check for command injection patterns
        cmd_indicators = [
            (r"[;&|`$(){}[\]<>]", "Command injection characters"),
            (r"&&\s*|\|\|", "Command chaining"),
            (r"curl\s+|wget\s+|nc\s+|netcat\s+", "Network command usage"),
        ]

        for pattern, description in cmd_indicators:
            if re.search(pattern, text):
                threats.append(
                    {
                        "type": "COMMAND_INJECTION",
                        "description": description,
                        "severity": "medium",
                    }
                )
                break

        # Check for sensitive information patterns
        sensitive_patterns = [
            (
                r"(?i)(password|pass|secret|key|token|api.*key)",
                "Potential sensitive information",
            ),
            (r"\b[A-Za-z0-9]{32,}\b", "Long alphanumeric string (potential key)"),
            (r"[0-9a-f]{32,}", "Hexadecimal string (potential hash/key)"),
        ]

        for pattern, description in sensitive_patterns:
            if re.search(pattern, text):
                threats.append(
                    {
                        "type": "SENSITIVE_INFO",
                        "description": description,
                        "severity": "low",
                    }
                )

        # Determine threat level
        if any(t["severity"] == "high" for t in threats):
            threat_level = "high"
        elif any(t["severity"] == "medium" for t in threats):
            threat_level = "medium"
        elif threats:
            threat_level = "low"
        else:
            threat_level = "none"

        # Add recommendations based on threats
        if any(t["type"] == "XSS" for t in threats):
            recommendations.append("Remove HTML/JavaScript content")
        if any(t["type"] in ["SQL_INJECTION", "COMMAND_INJECTION"] for t in threats):
            recommendations.append("Remove database/system commands")
        if any(t["type"] == "SENSITIVE_INFO" for t in threats):
            recommendations.append("Review for sensitive information disclosure")

        return {
            "is_safe": threat_level == "none",
            "threat_level": threat_level,
            "threats_detected": threats,
            "recommendations": recommendations,
        }


# Utility functions for easy use
def sanitize_message_content(content: str) -> str:
    """Quick function to sanitize message content."""
    is_valid, sanitized, error = InputSanitizer.validate_message_content(content)
    if not is_valid:
        raise ValueError(error)
    return sanitized


def sanitize_session_title(title: str) -> str:
    """Quick function to sanitize session title."""
    is_valid, sanitized, error = InputSanitizer.validate_title(title)
    if not is_valid:
        raise ValueError(error)
    return sanitized


def analyze_content_safety(text: str) -> dict:
    """Quick function to analyze content safety."""
    return InputSanitizer.detect_suspicious_content(text)
