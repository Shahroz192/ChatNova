#!/bin/bash
# Test coverage script for ChatNova AI Chat Application

echo "Running tests with coverage for ChatNova AI Chat Application..."

# Run tests with coverage
PYTHONPATH=backend uv run pytest backend/tests --cov=app --cov-report=html --cov-report=term-missing --cov-report=xml -v

echo "Test coverage report generated:"
echo "- Terminal output above"
echo "- HTML report: htmlcov/index.html"
echo "- XML report: coverage.xml"

# Show a summary
echo ""
echo "To view the HTML coverage report, open htmlcov/index.html in your browser."
