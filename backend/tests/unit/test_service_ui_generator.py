from app.services.ui_generator import ui_generator_service


def test_generates_line_chart_from_markdown_table():
    response = """
Based on the data:

| Year | Closing Price | Annual Change |
|------|---------------|---------------|
| 2016 | $26.65 | - |
| 2017 | $39.56 | +48.5% |
| 2018 | $37.43 | -5.4% |
| 2019 | $70.72 | +89.0% |

Now let me render the interactive line chart:
"""

    ui_data = ui_generator_service.generate_line_chart_from_markdown_table(
        "line chart of apple stock in last 10 years",
        response,
    )

    assert ui_data is not None
    assert ui_data["type"] == "container"
    child = ui_data["children"][0]
    assert child["type"] == "custom"
    html = child["props"]["html"]
    assert "new Chart" in html
    assert "Apple Stock Price - Last 10 Years" in html
    assert "26.65" in html
