"""A dependency-free PDF report writer.

Rather than pull in a PDF library, Atlas ships a tiny, self-contained PDF
generator that lays out lines of text across US-Letter pages using the built-in
Helvetica fonts.  It is intentionally minimal — headings, key metrics, the
hypothesis verdict and a trade log — but it produces a valid PDF openable in any
reader, keeping the whole platform installable with zero third-party packages.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional, Tuple

from atlas.backtest.engine import BacktestResult
from atlas.backtest.metrics import summary_table
from atlas.hypothesis import HypothesisResult

# US-Letter geometry, in PostScript points.
PAGE_WIDTH = 612
PAGE_HEIGHT = 792
MARGIN = 54
LEADING = 14
TOP = PAGE_HEIGHT - MARGIN

# A line is (text, font_name, size).
Line = Tuple[str, str, int]


def _escape(text: str) -> str:
    return (
        text.replace("\\", r"\\")
        .replace("(", r"\(")
        .replace(")", r"\)")
    )


def _ascii(text: str) -> str:
    """Base-14 Helvetica is Latin-1; drop anything outside it for safety."""
    return text.encode("latin-1", "replace").decode("latin-1")


def _paginate(lines: List[Line]) -> List[List[Tuple[float, Line]]]:
    """Split lines into pages, returning ``[(y, line), ...]`` per page."""
    pages: List[List[Tuple[float, Line]]] = []
    current: List[Tuple[float, Line]] = []
    y = TOP
    for line in lines:
        if y < MARGIN + LEADING:
            pages.append(current)
            current = []
            y = TOP
        current.append((y, line))
        y -= LEADING
    if current:
        pages.append(current)
    return pages


def _content_stream(page: List[Tuple[float, Line]]) -> bytes:
    parts = ["BT"]
    for y, (text, font, size) in page:
        parts.append(f"/{font} {size} Tf")
        parts.append(f"1 0 0 1 {MARGIN} {y:.1f} Tm")
        parts.append(f"({_escape(_ascii(text))}) Tj")
    parts.append("ET")
    return ("\n".join(parts)).encode("latin-1")


def _build_pdf(lines: List[Line]) -> bytes:
    pages = _paginate(lines) or [[]]
    objects: List[bytes] = []

    def add(body: bytes) -> int:
        objects.append(body)
        return len(objects)  # 1-based object number

    # Fonts (Helvetica regular + bold).
    font_regular = add(
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"
    )
    font_bold = add(
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>"
    )

    pages_obj_number = len(objects) + 1  # reserve the /Pages object number
    objects.append(b"")  # placeholder, filled in once kids are known

    page_refs: List[int] = []
    for page in pages:
        stream = _content_stream(page)
        content_num = add(
            b"<< /Length "
            + str(len(stream)).encode()
            + b" >>\nstream\n"
            + stream
            + b"\nendstream"
        )
        page_num = add(
            (
                f"<< /Type /Page /Parent {pages_obj_number} 0 R "
                f"/MediaBox [0 0 {PAGE_WIDTH} {PAGE_HEIGHT}] "
                f"/Resources << /Font << /F1 {font_regular} 0 R "
                f"/F2 {font_bold} 0 R >> >> "
                f"/Contents {content_num} 0 R >>"
            ).encode("latin-1")
        )
        page_refs.append(page_num)

    kids = " ".join(f"{ref} 0 R" for ref in page_refs)
    objects[pages_obj_number - 1] = (
        f"<< /Type /Pages /Kids [{kids}] /Count {len(page_refs)} >>"
    ).encode("latin-1")

    catalog_num = add(
        f"<< /Type /Catalog /Pages {pages_obj_number} 0 R >>".encode("latin-1")
    )

    # Assemble the file with a cross-reference table.
    out = bytearray(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
    offsets: List[int] = []
    for number, body in enumerate(objects, start=1):
        offsets.append(len(out))
        out += f"{number} 0 obj\n".encode("latin-1") + body + b"\nendobj\n"

    xref_start = len(out)
    count = len(objects) + 1
    out += f"xref\n0 {count}\n".encode("latin-1")
    out += b"0000000000 65535 f \n"
    for offset in offsets:
        out += f"{offset:010d} 00000 n \n".encode("latin-1")
    out += (
        f"trailer\n<< /Size {count} /Root {catalog_num} 0 R >>\n"
        f"startxref\n{xref_start}\n%%EOF\n"
    ).encode("latin-1")
    return bytes(out)


def write_pdf_report(
    result: BacktestResult,
    path: str | Path,
    title: str = "Project Atlas — Backtest Report",
    hypothesis_result: Optional[HypothesisResult] = None,
    max_trades: int = 40,
) -> Path:
    """Write a PDF report for ``result`` to ``path``."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)

    lines: List[Line] = []
    lines.append((title, "F2", 16))
    generated = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    lines.append((f"{result.symbol}  {result.label}  |  generated {generated}", "F1", 9))
    lines.append(("", "F1", 10))

    lines.append(("Performance", "F2", 12))
    for label, value in summary_table(result.metrics):
        lines.append((f"{label:.<28} {value}", "F1", 10))
    lines.append(("", "F1", 10))

    if hypothesis_result is not None:
        lines.append((f"Hypothesis verdict: {hypothesis_result.verdict.value}", "F2", 12))
        for reason in hypothesis_result.reasons:
            lines.append((f"- {reason}", "F1", 10))
        lines.append(("", "F1", 10))

    lines.append(("Trade log", "F2", 12))
    header = f"{'Entry':<17}{'Dir':<6}{'Exit':<9}{'R':>8}{'P&L':>12}"
    lines.append((header, "F2", 9))
    for trade in result.trades[:max_trades]:
        row = (
            f"{trade.entry_time.strftime('%Y-%m-%d %H:%M'):<17}"
            f"{trade.direction:<6}{trade.exit_reason:<9}"
            f"{trade.r_multiple:>+8.2f}{trade.pnl:>+12.2f}"
        )
        lines.append((row, "F1", 9))
    if len(result.trades) > max_trades:
        lines.append(
            (f"... {len(result.trades) - max_trades} more trades omitted.", "F1", 9)
        )

    path.write_bytes(_build_pdf(lines))
    return path
