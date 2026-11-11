from typing import TypedDict

from langgraph.graph import END, START, StateGraph


class AgentState(TypedDict):
    message: str
    normalized_message: str
    intent: str
    risk: str


def normalize(state: AgentState) -> dict:
    return {"normalized_message": state["message"].strip()}


def classify(state: AgentState) -> dict:
    return {"intent": "conversation", "risk": "informational"}


def build_chat_graph():
    graph = StateGraph(AgentState)
    graph.add_node("normalize", normalize)
    graph.add_node("classify", classify)
    graph.add_edge(START, "normalize")
    graph.add_edge("normalize", "classify")
    graph.add_edge("classify", END)
    return graph.compile()
