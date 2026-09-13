"""Wires the Planner -> Coder -> Reviewer agents into a `GraphEngine`."""

from pathlib import Path

from swe_agent.agents.coder import make_coder_node
from swe_agent.agents.planner import make_planner_node
from swe_agent.agents.reviewer import make_reviewer_node
from swe_agent.llm import LLMClient
from swe_agent.orchestrator.engine import END, GraphEngine


def build_agent_graph(llm: LLMClient, repo_root: Path) -> GraphEngine:
    """Planner runs once; Coder and Reviewer loop until Reviewer accepts.

    Retries are bounded by whatever `Budget` the caller passes to
    `engine.run(state, budget=...)` — this graph has no built-in give-up
    condition of its own.
    """
    engine = GraphEngine()
    engine.add_node("planner", make_planner_node(llm))
    engine.add_node("coder", make_coder_node(llm, repo_root))
    engine.add_node("reviewer", make_reviewer_node(llm, repo_root))

    engine.set_entry_point("planner")
    engine.add_edge("planner", "coder")
    engine.add_edge("coder", "reviewer")
    engine.add_conditional_edges(
        "reviewer",
        lambda state: "accept" if state.status == "succeeded" else "retry",
        {"accept": END, "retry": "coder"},
    )
    return engine
