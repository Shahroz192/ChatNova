"""UI Generator Service — uses structured output (constrained decoding) to
produce guaranteed-valid UIContainer JSON from any LLM that supports it.

Architecture
────────────
This service replaces the old approach of embedding a 500-line JSON schema in
the system prompt and hoping the LLM follows it. Instead:

1. After the main text response finishes streaming, we make a *separate*
   structured output call to determine if a UI component would add value.
2. The LLM uses `with_structured_output(UIContainer | None)` which *forces*
   the output to be valid JSON matching our Pydantic schema — no syntax
   errors, no extra text, no missing fields.
3. The validated UI JSON is sent to the frontend as a dedicated SSE event.

Benefits
────────
- ✅ 100% syntax guarantee — the model cannot produce invalid JSON
- ✅ ~470 fewer lines in the system prompt (more room for conversation)
- ✅ Type-safe contract between backend and frontend
- ✅ Graceful fallback (returns None if UI isn't warranted)
"""

from __future__ import annotations

import json
import logging
import re
from html import escape
from typing import Optional

from langchain_core.prompts import ChatPromptTemplate
from pydantic import BaseModel

from app.schemas.generative_ui import UIContainer

logger = logging.getLogger(__name__)


# ── Decision prompt (tiny — just the rules, not the schema) ─────────────────

UI_DECISION_INSTRUCTION = """You can generate a visual UI component (chart, table, search results, image gallery, etc.) if it would help the user understand your response better.

RULES — ONLY generate UI if ALL of these are true:
1. The user EXPLICITLY asked for a chart/graph/table/visualization, OR the data is complex/numerical enough that a text summary is insufficient.
2. You have REAL data (not fabricated) to populate the component.
3. The UI component provides SIGNIFICANTLY better utility than plain text or a Markdown table.

If ANY rule is violated, return null (no UI)."""


# ── Generator service ───────────────────────────────────────────────────────

# Wrapper model for broader provider compatibility.
# Some providers (Cerebras, Groq) don't support Optional[SomeModel] unions in
# JSON mode, so we use a concrete wrapper with an optional container field.
class UIOutput(BaseModel):
    """Wrapper for structured output that can return None."""
    container: Optional[UIContainer] = None


class UIGeneratorService:
    """Generates and validates UIContainer JSON using structured output."""

    def generate_line_chart_from_markdown_table(
        self,
        user_message: str,
        assistant_response: str,
    ) -> Optional[dict]:
        """Build a Chart.js line chart from a real Markdown table in the response.

        This deterministic fallback covers the common failure mode where the LLM
        writes "now let me render" after producing a valid data table, but does
        not actually call the UI tool. It only runs for explicit chart requests.
        """
        if not user_message or not assistant_response:
            return None

        if not re.search(r"\b(line\s+chart|chart|graph|plot|visuali[sz]e)\b", user_message, re.I):
            return None

        lines = [line.strip() for line in assistant_response.splitlines()]
        table_blocks: list[list[str]] = []
        current: list[str] = []
        for line in lines:
            if line.startswith("|") and line.endswith("|"):
                current.append(line)
            elif current:
                table_blocks.append(current)
                current = []
        if current:
            table_blocks.append(current)

        for block in table_blocks:
            if len(block) < 3:
                continue

            headers = [cell.strip().lower() for cell in block[0].strip("|").split("|")]
            separator = block[1]
            if not re.match(r"^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$", separator):
                continue

            label_idx = next(
                (
                    idx
                    for idx, header in enumerate(headers)
                    if any(token in header for token in ("year", "date", "period", "month"))
                ),
                0,
            )
            value_idx = next(
                (
                    idx
                    for idx, header in enumerate(headers)
                    if idx != label_idx
                    and any(token in header for token in ("price", "close", "value", "amount", "revenue", "sales"))
                ),
                None,
            )
            if value_idx is None:
                value_idx = next((idx for idx in range(len(headers)) if idx != label_idx), None)
            if value_idx is None:
                continue

            labels: list[str] = []
            values: list[float] = []
            for row in block[2:]:
                cells = [cell.strip() for cell in row.strip("|").split("|")]
                if len(cells) <= max(label_idx, value_idx):
                    continue

                value_match = re.search(r"-?\d+(?:,\d{3})*(?:\.\d+)?", cells[value_idx])
                if not value_match:
                    continue

                labels.append(cells[label_idx])
                values.append(float(value_match.group(0).replace(",", "")))

            if len(labels) < 3:
                continue

            title = "Line Chart"
            if re.search(r"\bapple|aapl\b", user_message, re.I):
                title = "Apple Stock Price - Last 10 Years"

            html = self._build_chart_html(title, labels, values, headers[value_idx])
            container = {
                "type": "container",
                "children": [{"type": "custom", "props": {"html": html}}],
            }
            try:
                validated = UIContainer.model_validate(container)
                return validated.model_dump(mode="json")
            except Exception as e:
                logger.warning(f"Deterministic chart validation failed: {e}")
                return None

        return None

    def _build_chart_html(
        self,
        title: str,
        labels: list[str],
        values: list[float],
        value_label: str,
    ) -> str:
        """Return a complete sandbox-friendly Chart.js HTML document."""
        safe_title = escape(title)
        labels_json = json.dumps(labels).replace("</", "<\\/")
        values_json = json.dumps(values)
        value_label_json = json.dumps(value_label.title()).replace("</", "<\\/")
        return f"""<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    html, body {{ margin: 0; padding: 0; background: #ffffff; font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #111827; }}
    .wrap {{ box-sizing: border-box; width: 100%; height: 500px; padding: 24px; }}
    h1 {{ margin: 0 0 18px; font-size: 18px; line-height: 1.3; font-weight: 650; }}
    .canvas-wrap {{ position: relative; width: 100%; height: 410px; }}
  </style>
</head>
<body>
  <div class="wrap">
    <h1>{safe_title}</h1>
    <div class="canvas-wrap"><canvas id="myChart"></canvas></div>
  </div>
  <script>
    const labels = {labels_json};
    const values = {values_json};
    const ctx = document.getElementById('myChart').getContext('2d');
    new Chart(ctx, {{
      type: 'line',
      data: {{
        labels,
        datasets: [{{
          label: {value_label_json},
          data: values,
          borderColor: '#2563eb',
          backgroundColor: 'rgba(37, 99, 235, 0.12)',
          borderWidth: 3,
          pointRadius: 4,
          pointHoverRadius: 6,
          tension: 0.3,
          fill: true
        }}]
      }},
      options: {{
        responsive: true,
        maintainAspectRatio: false,
        interaction: {{ mode: 'index', intersect: false }},
        plugins: {{
          legend: {{ display: true, labels: {{ color: '#374151' }} }},
          tooltip: {{ callbacks: {{ label: ctx => `${{ctx.dataset.label}}: $${{ctx.parsed.y.toLocaleString()}}` }} }}
        }},
        scales: {{
          x: {{ ticks: {{ color: '#4b5563' }}, grid: {{ color: 'rgba(148, 163, 184, 0.25)' }} }},
          y: {{ ticks: {{ color: '#4b5563', callback: value => '$' + value.toLocaleString() }}, grid: {{ color: 'rgba(148, 163, 184, 0.25)' }} }}
        }}
      }}
    }});
  </script>
</body>
</html>"""

    async def generate_ui(
        self,
        llm: object,
        user_message: str,
        assistant_response: str,
        search_results: Optional[str] = None,
        document_context: Optional[str] = None,
    ) -> Optional[dict]:
        """Use structured output to generate a UIContainer, or None if UI is not warranted.

        This makes a separate LLM call with `with_structured_output` which
        guarantees valid JSON matching the UIContainer schema.

        Args:
            llm: A LangChain LLM instance that supports with_structured_output().
            user_message: The original user query.
            assistant_response: The text response the assistant already generated.
            search_results: Optional web search results context.
            document_context: Optional RAG document context.

        Returns:
            A validated UIContainer dict, or None if the model decided UI isn't needed.
        """
        deterministic_chart = self.generate_line_chart_from_markdown_table(
            user_message,
            assistant_response,
        )
        if deterministic_chart is not None:
            return deterministic_chart

        if not hasattr(llm, "with_structured_output"):
            logger.warning("LLM does not support with_structured_output; skipping UI gen")
            return None

        try:
            # Use concrete wrapper model for broader provider compatibility.
            # UIOutput.container will be None if no UI is warranted.
            structured_llm = llm.with_structured_output(
                schema=UIOutput,
                method="json_mode",
            )
        except Exception as e:
            logger.warning(f"Failed to bind structured output: {e}")
            return None

        prompt = ChatPromptTemplate.from_messages([
            ("system", UI_DECISION_INSTRUCTION),
            ("human", (
                "USER QUERY:\n{user_message}\n\n"
                "ASSISTANT RESPONSE (already sent to user):\n{assistant_response}\n\n"
                "{extra_context}"
                "Based on the user query and your response above, is there data that "
                "would benefit from a UI visualization? "
                "If YES: return a UIContainer object with the appropriate components.\n"
                "If NO: return null.\n"
                "IMPORTANT: Never fabricate data. Only use real data from the response."
            )),
        ])

        chain = prompt | structured_llm

        extra_context = ""
        if search_results:
            extra_context += f"SEARCH RESULTS:\n{search_results}\n\n"
        if document_context:
            extra_context += f"DOCUMENT CONTEXT:\n{document_context}\n\n"

        try:
            result = await chain.ainvoke({
                "user_message": user_message,
                "assistant_response": assistant_response,
                "extra_context": extra_context,
            })

            # result is UIOutput (wrapper model)
            if result is None or result.container is None:
                return None

            # result.container is a validated UIContainer Pydantic model
            ui_dict = result.container.model_dump(mode="json")
            logger.info(f"Generated UI: {json.dumps(ui_dict)[:200]}...")
            return ui_dict

        except Exception as e:
            logger.error(f"UI generation failed: {e}")
            return None

    async def extract_ui_from_text(self, text: str) -> Optional[dict]:
        """Extract and validate inline UI JSON from plain text response.

        This is a fallback for models/endpoints where with_structured_output
        isn't available. It tries to parse inline JSON and validate against
        the Pydantic schema.
        """
        if not text:
            return None

        # Try to find JSON in the response (matches old format with ```json or raw JSON)
        json_str = text.strip()
        
        # Try ```json ... ``` block first
        import re
        json_block = re.search(r"```json\s*\n([\s\S]*?)\n\s*```", json_str)
        if json_block:
            json_str = json_block.group(1)

        # Find the outermost { ... }
        first_brace = json_str.find("{")
        last_brace = json_str.rfind("}")
        if first_brace == -1 or last_brace == -1 or last_brace <= first_brace:
            return None

        json_str = json_str[first_brace : last_brace + 1]

        try:
            parsed = json.loads(json_str)
            if not isinstance(parsed, dict) or parsed.get("type") != "container":
                return None
            # Validate against Pydantic schema
            validated = UIContainer.model_validate(parsed)
            return validated.model_dump(mode="json")
        except (json.JSONDecodeError, Exception) as e:
            logger.debug(f"Failed to extract inline UI JSON: {e}")
            return None


# Singleton
ui_generator_service = UIGeneratorService()
