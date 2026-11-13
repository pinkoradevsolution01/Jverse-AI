from typing import Literal, TypedDict

from langgraph.graph import END, START, StateGraph


class AgentState(TypedDict):
    message: str
    normalized_message: str
    intent: Literal["conversation", "knowledge_summary", "desktop_and_knowledge", "desktop_action"]
    risk: Literal["informational", "approval_required"]
    tools: list[str]
    plan: list[str]


def normalize(state: AgentState) -> dict:
    return {"normalized_message": " ".join(state["message"].strip().split())}


def classify(state: AgentState) -> dict:
    message = state["normalized_message"].lower()
    asks_to_open = any(word in message for word in ("open ", "launch ", "start application", "run application"))
    asks_for_knowledge = any(word in message for word in ("note", "project", "summarize", "summary", "knowledge", "document"))
    if asks_to_open and asks_for_knowledge:
        return {"intent": "desktop_and_knowledge", "risk": "approval_required", "tools": ["desktop.open_application", "knowledge.latest_project_notes"]}
    if asks_to_open:
        return {"intent": "desktop_action", "risk": "approval_required", "tools": ["desktop.open_application"]}
    if asks_for_knowledge:
        return {"intent": "knowledge_summary", "risk": "informational", "tools": ["knowledge.latest_project_notes"]}
    return {"intent": "conversation", "risk": "informational", "tools": []}


def plan(state: AgentState) -> dict:
    steps = ["Understand the request and validate workspace access."]
    if "desktop.open_application" in state["tools"]:
        steps.append("Resolve the requested application against the user-approved desktop application map.")
        steps.append("Create a time-limited approval request; never launch an application directly from model output.")
    if "knowledge.latest_project_notes" in state["tools"]:
        steps.append("Retrieve the latest workspace project notes as untrusted reference context.")
    steps.append("Use local Qwen to synthesize an answer grounded in retrieved results.")
    return {"plan": steps}


def build_chat_graph():
    graph = StateGraph(AgentState)
    graph.add_node("normalize", normalize)
    graph.add_node("classify", classify)
    graph.add_node("plan", plan)
    graph.add_edge(START, "normalize")
    graph.add_edge("normalize", "classify")
    graph.add_edge("classify", "plan")
    graph.add_edge("plan", END)
    return graph.compile()
