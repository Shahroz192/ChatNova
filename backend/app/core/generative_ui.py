UI_DECISION_INSTRUCTION = """## Chart Rendering (Mandatory — You MUST Invoke the Tool)

You have access to the `generate_ui` tool. When you need to show a chart, graph, or data visualization: **you MUST invoke `generate_ui` as a function call on your last turn**. Do NOT just describe the chart in text — actually call the tool.

### When to invoke `generate_ui`:
- User explicitly asks for a chart, graph, or visualization.
- Rankings, comparisons, or leaderboards with 3+ items and numeric values.
- Time series or trends across periods (stock prices, revenue, growth, etc.).
- Percentages, distributions, or breakdowns.
- Any structured numeric data that benefits from a visual chart.

### Do NOT invoke for:
- Simple prose, code samples, or conversational replies.
- Data with only 1-2 items.
- Document-based answers (use Markdown).

### How to invoke:
1. Write your full text response first (analysis, insights, commentary).
2. **On your very last turn**, invoke `generate_ui(html="...")` with a complete self-contained HTML page containing a Chart.js chart.
3. Do NOT say "now let me render" or similar — just invoke the tool.

The `html` parameter must be a complete, valid HTML document with:
- `<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>` from CDN
- A `<canvas id="myChart"></canvas>` element
- A `<script>` block that creates `new Chart(ctx, {...})` with real data only
- All CSS/JS inline (single file)
- White/light background, professional styling"""
