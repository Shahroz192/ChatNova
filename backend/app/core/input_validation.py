import re
import bleach


class InputSanitizer:
    ALLOWED_TAGS = [
        "b", "i", "u", "strong", "em", "p", "br",
        "ul", "ol", "li", "code", "pre", "blockquote", "a",
    ]

    ALLOWED_ATTRIBUTES = {
        "a": ["href", "title"],
        "p": ["title"],
        "code": ["class"],
        "pre": ["class"],
        "blockquote": ["title"],
        "*": ["class"],
    }

    MAX_MESSAGE_LENGTH = 10000
    MAX_TITLE_LENGTH = 255
    MAX_DESCRIPTION_LENGTH = 1000

    PII_PATTERNS = {
        "EMAIL": r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}",
        "PHONE": r"(\+\d{1,2}\s?)?1?\-?\.?\s?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}",
        "SSN": r"\b\d{3}-\d{2}-\d{4}\b",
        "CREDIT_CARD": r"\b(?:\d[ -]*?){13,16}\b",
        "IPV4": r"\b(?:\d{1,3}\.){3}\d{1,3}\b",
        "PASSWORD": r"(?i)(password|passwd|pwd)\s*[:=]\s*[^\s]+",
        "SECRET_KEY": r"(?i)(secret|api_key|token)\s*[:=]\s*[^\s]{10,}",
    }

    PROMPT_INJECTION_PATTERNS = [
        r"(?i)ignore\s+(all\s+)?(previous\s+)?instructions",
        r"(?i)system\s+override",
        r"(?i)you\s+are\s+now\s+(a|an)\b",
        r"(?i)disregard\s+(all\s+)?(previous\s+)?prompts",
        r"(?i)output\s+the\s+entire\s+system\s+prompt",
        r"(?i)leak\s+(the\s+)?(internal\s+)?instructions",
        r"(?i)new\s+role:\b",
    ]

    @classmethod
    def mask_pii(cls, text: str) -> str:
        if not text:
            return ""
        masked_text = text
        for pii_type, pattern in cls.PII_PATTERNS.items():
            masked_text = re.sub(pattern, f"[REDACTED_{pii_type}]", masked_text)
        return masked_text

    @classmethod
    def sanitize_html(cls, text: str, allow_basic_html: bool = False) -> str:
        if not text:
            return ""

        if allow_basic_html:
            sanitized = bleach.clean(
                text, tags=cls.ALLOWED_TAGS, attributes=cls.ALLOWED_ATTRIBUTES, strip=True
            )
        else:
            sanitized = bleach.clean(text, tags=[], attributes={}, strip=True)

        return sanitized.strip()

    @classmethod
    def detect_prompt_injection(cls, text: str) -> bool:
        if not text:
            return False
        for pattern in cls.PROMPT_INJECTION_PATTERNS:
            if re.search(pattern, text, re.IGNORECASE):
                return True
        return False

    @classmethod
    def validate_message_content(
        cls, content: str, redact_pii: bool = False
    ) -> tuple[bool, str, str]:
        if not content or not isinstance(content, str):
            return False, "", "Message content cannot be empty"

        if len(content) > cls.MAX_MESSAGE_LENGTH:
            return False, "", f"Message content exceeds maximum length of {cls.MAX_MESSAGE_LENGTH} characters"

        sanitized = cls.sanitize_html(content, allow_basic_html=False)

        if redact_pii:
            sanitized = cls.mask_pii(sanitized)

        if len(sanitized) < len(content) * 0.1:
            return False, "", "Message contains excessive formatting or special characters"

        return True, sanitized, ""

    @classmethod
    def validate_title(cls, title: str) -> tuple[bool, str, str]:
        if not title or not isinstance(title, str):
            return False, "", "Title cannot be empty"
        if len(title) > cls.MAX_TITLE_LENGTH:
            return False, "", f"Title exceeds maximum length of {cls.MAX_TITLE_LENGTH} characters"
        if not title.strip():
            return False, "", "Title cannot be empty or whitespace only"
        sanitized = cls.sanitize_html(title.strip(), allow_basic_html=False)
        return True, sanitized, ""

    @classmethod
    def validate_description(cls, description: str) -> tuple[bool, str, str]:
        if not description:
            return True, "", ""
        if not isinstance(description, str):
            return False, "", "Description must be a string"
        if len(description) > cls.MAX_DESCRIPTION_LENGTH:
            return False, "", f"Description exceeds maximum length of {cls.MAX_DESCRIPTION_LENGTH} characters"
        sanitized = cls.sanitize_html(description, allow_basic_html=False)
        return True, sanitized, ""

    @classmethod
    def validate_email(cls, email: str) -> tuple[bool, str, str]:
        if not email or not isinstance(email, str):
            return False, "", "Email cannot be empty"
        email_pattern = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
        if not re.match(email_pattern, email.strip()):
            return False, "", "Invalid email format"
        sanitized = email.strip().lower()
        return True, sanitized, ""

    @classmethod
    def sanitize_filename(cls, filename: str) -> str:
        if not filename:
            return "unnamed"
        sanitized = re.sub(r"[^\w\-_.]", "_", filename)
        sanitized = re.sub(r"\.\./+", "", sanitized)
        if len(sanitized) > 255:
            name, ext = sanitized.rsplit(".", 1) if "." in sanitized else (sanitized, "")
            sanitized = name[:250] + ("." + ext if ext else "")
        return sanitized or "unnamed"
