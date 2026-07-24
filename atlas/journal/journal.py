"""A durable, append-only trade & research journal.

The journal is where the discipline of the process lives: every backtest run,
every hypothesis verdict, and (eventually) every live trade is appended with a
timestamp and never edited in place.  It is stored as newline-delimited JSON so
it is both human-readable and trivially machine-parseable.
"""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional


@dataclass
class JournalEntry:
    """A single timestamped journal record."""

    timestamp: str
    kind: str                       # e.g. "backtest", "verdict", "note", "trade"
    hypothesis: str = ""
    summary: str = ""
    data: Dict[str, Any] = field(default_factory=dict)

    @classmethod
    def create(
        cls,
        kind: str,
        hypothesis: str = "",
        summary: str = "",
        data: Optional[Dict[str, Any]] = None,
    ) -> "JournalEntry":
        return cls(
            timestamp=datetime.now(timezone.utc).isoformat(),
            kind=kind,
            hypothesis=hypothesis,
            summary=summary,
            data=data or {},
        )


class Journal:
    """Append-only journal backed by a newline-delimited JSON file."""

    def __init__(self, path: str | Path) -> None:
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)

    def append(self, entry: JournalEntry) -> JournalEntry:
        """Append ``entry`` to the journal and return it."""
        with self.path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(asdict(entry), sort_keys=True) + "\n")
        return entry

    def log(
        self,
        kind: str,
        hypothesis: str = "",
        summary: str = "",
        data: Optional[Dict[str, Any]] = None,
    ) -> JournalEntry:
        """Convenience wrapper: build and append an entry in one call."""
        return self.append(JournalEntry.create(kind, hypothesis, summary, data))

    def entries(self) -> List[JournalEntry]:
        """Read all entries back from disk (chronological order)."""
        if not self.path.exists():
            return []
        out: List[JournalEntry] = []
        with self.path.open("r", encoding="utf-8") as handle:
            for line in handle:
                line = line.strip()
                if not line:
                    continue
                payload = json.loads(line)
                out.append(JournalEntry(**payload))
        return out
