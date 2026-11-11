from __future__ import annotations

import re
from dataclasses import dataclass, field

from app.graph.chat_graph import build_chat_graph
from app.infrastructure.desktop_action_repository import DesktopActionRepository
from app.infrastructure.supabase_chat_repository import SupabaseChatRepository


@dataclass(frozen=True)
class ProposedDesktopAction:
    action_id: str
    target_summary: str
    expires_at: str | None


@dataclass
class AgentExecution:
    intent: str
    plan: list[str]
    tool_results: list[str] = field(default_factory=list)
    context: list[str] = field(default_factory=list)
    approval: ProposedDesktopAction | None = None


class AgentService:
    """Deterministic orchestration around local Qwen; the model never executes OS actions itself."""

    def __init__(self, chat_repository: SupabaseChatRepository, desktop_repository: DesktopActionRepository) -> None:
        self.chat_repository = chat_repository
        self.desktop_repository = desktop_repository
        self.graph = build_chat_graph()

    @staticmethod
    def _application_name(message: str) -> str | None:
        match = re.search(r"(?:open|launch|run)\s+(?:the\s+)?(.+?)(?:\s+(?:and|then)\s+|,|$)", message, re.IGNORECASE)
        return match.group(1).strip(" .") if match else None

    async def execute(self, workspace_id: str, user_id: str, message: str) -> AgentExecution:
        state = await self.graph.ainvoke({"message": message, "normalized_message": "", "intent": "conversation", "risk": "informational", "tools": [], "plan": []})
        execution = AgentExecution(intent=state["intent"], plan=state["plan"])

        if "knowledge.latest_project_notes" in state["tools"]:
            try:
                notes = await self.chat_repository.latest_project_notes(workspace_id)
                if notes:
                    execution.context.extend(notes)
                    execution.tool_results.append(f"Retrieved {len(notes)} latest project note(s).")
                else:
                    execution.tool_results.append("No project notes are available in this workspace.")
            except Exception:
                execution.tool_results.append("Project-note retrieval is temporarily unavailable.")

        if "desktop.open_application" in state["tools"]:
            try:
                requested_name = self._application_name(message)
                device = await self.desktop_repository.active_device_for_user(user_id)
                if not device:
                    execution.tool_results.append("No paired Electron desktop is currently online, so no application can be opened.")
                elif not requested_name:
                    execution.tool_results.append("The application name was not clear enough to create a safe desktop action.")
                else:
                    target = await self.desktop_repository.application_path(user_id, device["id"], requested_name)
                    if not target:
                        execution.tool_results.append(f"'{requested_name}' is not in your approved desktop application map. Add its path in desktop settings before JVerse can launch it.")
                    else:
                        action = await self.desktop_repository.create_action(workspace_id, user_id, device["id"], "open_application", {"path": target}, f"Open {requested_name}", 3)
                        execution.approval = ProposedDesktopAction(action_id=action["id"], target_summary=action["target_summary"], expires_at=action.get("approval_expires_at"))
                        execution.tool_results.append(f"Prepared a protected desktop action to open {requested_name}. User approval is required before execution.")
            except Exception:
                execution.tool_results.append("Desktop orchestration is temporarily unavailable; no desktop action was executed.")

        return execution
