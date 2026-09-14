"""Wires the Planner -> Coder -> Reviewer agents into a `GraphEngine`."""

from pathlib import Path

from swe_agent.agents.coder import make_coder_node
from swe_agent.agents.planner import make_planner_node
from swe_agent.agents.reviewer import make_reviewer_node
from swe_agent.llm import LLMClient
from swe_agent.orchestrator.engine import END, GraphEngine
from swe_agent.trace import Tracer


def build_agent_graph(
    llm: LLMClient, repo_root: Path, *, tracer: Tracer | None = None
) -> GraphEngine:
    """Planner runs once; Coder and Reviewer loop until Reviewer accepts.

    Retries are bounded by whatever `Budget` the caller passes to
    `engine.run(state, budget=...)` — this graph has no built-in give-up
    condition of its own. `tracer`, if given, is threaded into the Coder's
    and Reviewer's own internal tool calls (in addition to the one
    "agent" event per node that `engine.run(tracer=...)` already records),
    so a real run produces per-tool-call trace events too.
    """
    engine = GraphEngine()
    engine.add_node("planner", make_planner_node(llm))
    engine.add_node("coder", make_coder_node(llm, repo_root, tracer=tracer))
    engine.add_node("reviewer", make_reviewer_node(llm, repo_root, tracer=tracer))

    engine.set_entry_point("planner")
    engine.add_edge("planner", "coder")
    engine.add_edge("coder", "reviewer")
    engine.add_conditional_edges(
        "reviewer",
        lambda state: "accept" if state.status == "succeeded" else "retry",
        {"accept": END, "retry": "coder"},
    )
    return engine
