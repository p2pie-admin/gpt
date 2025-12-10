"""
Convert SheetBrain JSON report to a readable HTML file.

Usage:
    ./venv/bin/python report_to_html.py --input report.json --output report.html

Only stdlib is used; no extra dependencies required.
"""

from __future__ import annotations

import argparse
import json
from html import escape
from pathlib import Path
from typing import Any, Dict, List


def load_report(path: Path) -> Dict[str, Any]:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def render_list(items: List[Any]) -> str:
    if not items:
        return "<p>–</p>"
    lis = "".join(f"<li>{escape(str(item))}</li>" for item in items)
    return f"<ul>{lis}</ul>"


def render_execution_summaries(results: List[Dict[str, Any]]) -> str:
    if not results:
        return "<p>No execution results.</p>"

    rows = []
    for idx, item in enumerate(results, start=1):
        answer = escape(str(item.get("answer", "")))
        success = "✅" if item.get("success") else "❌"
        turns = item.get("total_turns", "–")
        rows.append(
            f"<tr>"
            f"<td>{idx}</td>"
            f"<td>{success}</td>"
            f"<td>{turns}</td>"
            f"<td>{answer}</td>"
            f"</tr>"
        )

    return (
        "<table class='table'>"
        "<thead><tr><th>#</th><th>Success</th><th>Total turns</th><th>Answer</th></tr></thead>"
        f"<tbody>{''.join(rows)}</tbody>"
        "</table>"
    )


def render_validation(validation_results: List[Dict[str, Any]]) -> str:
    if not validation_results:
        return "<p>No validation results.</p>"

    parts = []
    for idx, item in enumerate(validation_results, start=1):
        passed = "✅" if item.get("validation_passed") else "⚠️"
        conf = item.get("confidence_score")
        conf_txt = f"{conf:.2f}" if isinstance(conf, (float, int)) else "–"
        issues = render_list(item.get("issues_found") or [])
        feedback = escape(str(item.get("improvement_feedback", ""))) or "–"
        parts.append(
            f"<div class='subcard'>"
            f"<h4>Validation #{idx} {passed} &nbsp;Confidence: {conf_txt}</h4>"
            f"<div><strong>Issues Found:</strong> {issues}</div>"
            f"<div><strong>Feedback:</strong> <pre>{feedback}</pre></div>"
            f"</div>"
        )
    return "".join(parts)


def render_conversation(history: List[Dict[str, Any]], max_chars: int = 2000) -> str:
    if not history:
        return "<p>No conversation history.</p>"
    rendered = []
    current_len = 0
    for turn in history:
        role = escape(str(turn.get("role", "unknown")))
        content = escape(str(turn.get("content", "")))
        snippet = content
        if len(snippet) + current_len > max_chars:
            snippet = snippet[: max(0, max_chars - current_len)] + "…"
            rendered.append(f"<div class='bubble {role}'><strong>{role}:</strong> {snippet}</div>")
            break
        rendered.append(f"<div class='bubble {role}'><strong>{role}:</strong> {snippet}</div>")
        current_len += len(snippet)
    return "<div class='conversation'>" + "".join(rendered) + "</div>"


def build_html(report: Dict[str, Any]) -> str:
    success = report.get("success")
    answer = escape(str(report.get("answer", "")))
    confidence = report.get("confidence_score")
    validation = report.get("validation_passed")
    iterations = report.get("total_iterations")
    duration = report.get("total_duration")
    issues = report.get("issues_found") or []
    exec_results = report.get("all_execution_results") or []
    validation_results = report.get("all_validation_results") or []
    # Pull first conversation history if present
    conversation_history = []
    if exec_results and isinstance(exec_results[0], dict):
        conversation_history = exec_results[0].get("conversation_history") or []

    success_badge = "<span class='badge success'>Success</span>" if success else "<span class='badge failure'>Failed</span>"
    validation_badge = "<span class='badge success'>Passed</span>" if validation else "<span class='badge failure'>Failed</span>"
    confidence_text = f"{confidence:.2f}" if isinstance(confidence, (float, int)) else "–"
    iterations_text = iterations if iterations is not None else "–"
    duration_text = f"{duration:.2f}s" if isinstance(duration, (float, int)) else "–"

    exec_answers = [
        escape(str(item.get("answer", ""))) for item in exec_results if isinstance(item, dict)
    ]
    exec_answers_block = "".join(f"<li>{ans}</li>" for ans in exec_answers) or "<li>–</li>"

    return f"""
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>SheetBrain Report</title>
  <style>
    body {{
      font-family: Arial, sans-serif;
      margin: 32px;
      background: #f7f8fb;
      color: #1c1f2a;
    }}
    h1, h2, h3 {{
      color: #0f172a;
    }}
    .card {{
      background: white;
      border-radius: 12px;
      padding: 20px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.06);
      margin-bottom: 20px;
    }}
    .badge {{
      display: inline-block;
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 700;
      color: white;
    }}
    .badge.success {{ background: #16a34a; }}
    .badge.failure {{ background: #dc2626; }}
    .pill {{
      display: inline-block;
      background: #e2e8f0;
      color: #0f172a;
      padding: 6px 10px;
      border-radius: 8px;
      margin-right: 8px;
      font-size: 13px;
    }}
    pre {{
      background: #0f172a;
      color: #e2e8f0;
      padding: 12px;
      border-radius: 8px;
      overflow-x: auto;
      white-space: pre-wrap;
    }}
    .table {{
      width: 100%;
      border-collapse: collapse;
    }}
    .table th, .table td {{
      border: 1px solid #e2e8f0;
      padding: 8px;
      text-align: left;
      vertical-align: top;
    }}
    .table th {{
      background: #f1f5f9;
    }}
    .subcard {{
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 10px;
      background: #f8fafc;
    }}
    .bubble {{
      padding: 8px 10px;
      margin-bottom: 6px;
      border-radius: 8px;
      background: #f1f5f9;
    }}
    .bubble.assistant {{
      background: #e0f2fe;
    }}
    .bubble.user {{
      background: #fef9c3;
    }}
    .conversation {{
      max-height: 400px;
      overflow-y: auto;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px;
      background: #fff;
    }}
  </style>
</head>
<body>
  <h1>SheetBrain Report</h1>

  <div class="card">
    <h2>Status</h2>
    <p>{success_badge} &nbsp; Validation: {validation_badge}</p>
    <p>
      <span class="pill">Confidence: {confidence_text}</span>
      <span class="pill">Iterations: {iterations_text}</span>
      <span class="pill">Duration: {duration_text}</span>
    </p>
  </div>

  <div class="card">
    <h2>Answer</h2>
    <pre>{answer}</pre>
    <h3>Execution Answers</h3>
    <ul>{exec_answers_block}</ul>
  </div>

  <div class="card">
    <h2>Issues Found</h2>
    {render_list(issues)}
  </div>

  <div class="card">
    <h2>Execution Results</h2>
    {render_execution_summaries(exec_results)}
  </div>

  <div class="card">
    <h2>Validation Results</h2>
    {render_validation(validation_results)}
  </div>

  <div class="card">
    <h2>Conversation (truncated)</h2>
    {render_conversation(conversation_history)}
  </div>
</body>
</html>
"""


def main() -> None:
    parser = argparse.ArgumentParser(description="Convert SheetBrain JSON report to HTML.")
    parser.add_argument("--input", "-i", type=Path, default=Path("report.json"), help="Path to JSON report (default: report.json)")
    parser.add_argument("--output", "-o", type=Path, default=Path("report.html"), help="Path to output HTML (default: report.html)")
    args = parser.parse_args()

    report = load_report(args.input)
    html = build_html(report)
    args.output.write_text(html, encoding="utf-8")
    print(f"HTML report saved to {args.output}")


if __name__ == "__main__":
    main()
