"""Graph / state-machine executor for orchestrating agent + tool nodes.

Nodes are plain callables over `TaskState`. Edges connect nodes and may be
unconditional or conditional (routed by a function of the current state),
and the graph is not required to be acyclic — a conditional edge may route
back to an earlier node, which is how retries are expressed.
"""

from collections.abc import Callable, Mapping
from dataclasses import dataclass, field

from swe_agent.schemas import TaskState

END = "__end__"

NodeFunc = Callable[[TaskState], TaskState]
Condition = Callable[[TaskState], str]


class GraphExecutionError(RuntimeError):
    """Raised when the graph is misconfigured or execution cannot proceed."""


@dataclass(frozen=True)
class _ConditionalEdge:
    condition: Condition
    routes: dict[str, str] = field(default_factory=dict)


class GraphEngine:
    """A minimal directed graph executor supporting cycles."""

    def __init__(self) -> None:
        self._nodes: dict[str, NodeFunc] = {}
        self._edges: dict[str, str] = {}
        self._conditional_edges: dict[str, _ConditionalEdge] = {}
        self._entry_point: str | None = None

    def add_node(self, name: str, func: NodeFunc) -> None:
        if name == END:
            raise ValueError(f"{END!r} is reserved and cannot be used as a node name")
        if name in self._nodes:
            raise ValueError(f"node {name!r} is already registered")
        self._nodes[name] = func

    def add_edge(self, from_node: str, to_node: str) -> None:
        self._require_node(from_node)
        self._require_routable(to_node)
        self._require_no_outgoing_edge(from_node)
        self._edges[from_node] = to_node

    def add_conditional_edges(
        self, from_node: str, condition: Condition, routes: Mapping[str, str]
    ) -> None:
        self._require_node(from_node)
        self._require_no_outgoing_edge(from_node)
        for target in routes.values():
            self._require_routable(target)
        self._conditional_edges[from_node] = _ConditionalEdge(condition, dict(routes))

    def set_entry_point(self, name: str) -> None:
        self._require_node(name)
        self._entry_point = name

    def run(self, state: TaskState, *, max_steps: int = 10_000) -> TaskState:
        """Run the graph to completion (until a node routes to `END`).

        `max_steps` is a hard safety valve against a misconfigured graph
        cycling forever — it is independent of any task-level iteration
        budget the caller may enforce inside its own node/edge logic.
        """
        if self._entry_point is None:
            raise GraphExecutionError("no entry point set; call set_entry_point() first")

        current = self._entry_point
        steps = 0
        while current != END:
            if steps >= max_steps:
                raise GraphExecutionError(
                    f"exceeded max_steps={max_steps} without reaching {END!r} "
                    "(likely an unbounded cycle)"
                )
            state = self._nodes[current](state)
            current = self._next_node(current, state)
            steps += 1
        return state

    def _next_node(self, current: str, state: TaskState) -> str:
        if current in self._edges:
            return self._edges[current]
        if current in self._conditional_edges:
            edge = self._conditional_edges[current]
            key = edge.condition(state)
            if key not in edge.routes:
                raise GraphExecutionError(
                    f"condition for node {current!r} returned unrouted key {key!r}; "
                    f"expected one of {sorted(edge.routes)}"
                )
            return edge.routes[key]
        raise GraphExecutionError(f"node {current!r} has no outgoing edge")

    def _require_node(self, name: str) -> None:
        if name not in self._nodes:
            raise ValueError(f"unknown node {name!r}; register it with add_node() first")

    def _require_routable(self, name: str) -> None:
        if name != END:
            self._require_node(name)

    def _require_no_outgoing_edge(self, name: str) -> None:
        if name in self._edges or name in self._conditional_edges:
            raise ValueError(f"node {name!r} already has an outgoing edge")
