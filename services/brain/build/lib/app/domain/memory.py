from dataclasses import dataclass
from typing import Literal

MemoryKind = Literal["short_term", "long_term", "project", "conversation"]

@dataclass(frozen=True)
class ContextItem:
    source: Literal["memory", "knowledge", "conversation"]
    content: str
    citation: str | None = None
