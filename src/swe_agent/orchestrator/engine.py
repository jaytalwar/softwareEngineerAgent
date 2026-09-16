"""Graph / state-machine executor for orchestrating agent + tool nodes.

Nodes are plain callables over `TaskState`. Edges connect nodes and may be
unconditional or conditional (routed by a function of the current state),
and the graph is not required to be acyclic — a conditional edge may route
back to an earlier node, which is how retries are expressed.
"""

from collections.abc import Callable, Mapping
from dataclasses import dataclass, field

from swe_agent.schemas import TaskState
from swe_agent.trace import Tracer

END = "__end__"

NodeFunc = Callable[[TaskState], TaskState]
Condition = Callable[[TaskState], str]


class GraphExecutionError(RuntimeError):
    """Raised when the graph is misconfigured or execution cannot proceed."""


class BudgetExceededError(GraphExecutionError):
    """Raised when a task exceeds its configured iteration or cost `Budget`.

    Unlike `max_steps` (a developer safety net against a broken graph), this
    is a caller-supplied policy: it fires on the task's own `iteration`,
    `total_tokens`, and `total_cost_usd` counters, which node functions are
    responsible for updating.
    """

    def __init__(self, message: str, *, state: TaskState) -> None:
        super().__init__(message)
        self.state = state


class TaskCancelledError(GraphExecutionError):
    """Raised when `cancel_requested` reports true between graph steps.

    Cancellation is only checked between nodes (the same point `Budget` is
    checked), not inside one — a node already running (e.g. the Coder
    mid-way through its own internal tool-call loop) always finishes that
    node first. This is a coarser grain than mid-tool-call interruption,
    but requires no changes to node internals and matches how `Budget`
    already works.
    """

    def __init__(self, message: str, *, state: TaskState) -> None:
        super().__init__(message)
        self.state = state


@dataclass(frozen=True)
class Budget:
    """A task-level guardrail: caps iterations and, optionally, tokens/cost."""

    max_iterations: int
    max_tokens: int | None = None
    max_cost_usd: float | None = None

    def violation(self, state: TaskState) -> str | None:
        """Return a description of the first exceeded limit, or None."""
        if state.iteration > self.max_iterations:
            return f"iteration {state.iteration} exceeds max_iterations={self.max_iterations}"
        if self.max_tokens is not None and state.total_tokens > self.max_tokens:
            return f"total_tokens {state.total_tokens} exceeds max_tokens={self.max_tokens}"
        if self.max_cost_usd is not None and state.total_cost_usd > self.max_cost_usd:
            return (
                f"total_cost_usd {state.total_cost_usd} exceeds max_cost_usd={self.max_cost_usd}"
            )
        return None


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

    def run(
        self,
        state: TaskState,
        *,
        max_steps: int = 10_000,
        budget: Budget | None = None,
        tracer: Tracer | None = None,
        cancel_requested: Callable[[], bool] | None = None,
    ) -> TaskState:
        """Run the graph to completion (until a node routes to `END`).

        `max_steps` is a hard safety valve against a misconfigured graph
        cycling forever. `budget`, if given, is checked after every node
        runs and raises `BudgetExceededError` the moment the task's own
        iteration/token/cost counters cross their configured limit — this
        is what actually stops a runaway task, independent of `max_steps`.
        `cancel_requested`, if given, is checked at the same point as
        `budget` and raises `TaskCancelledError` the moment it returns
        true — this is what a caller-initiated "stop this task" wires
        into, checked between nodes rather than inside one.
        `tracer`, if given, records one `"agent"` trace event per node run
        — a compact `{iteration, status}` snapshot before/after, and the
        node's token cost as the `total_tokens` delta it produced. A node
        that raises still gets its trace line written (with the error
        captured) before the exception propagates.
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
            state = self._run_node(current, state, tracer)
            if budget is not None:
                violation = budget.violation(state)
                if violation is not None:
                    message = f"task {state.task_id} stopped: {violation}"
                    raise BudgetExceededError(message, state=state)
            if cancel_requested is not None and cancel_requested():
                raise TaskCancelledError(f"task {state.task_id} cancelled", state=state)
            current = self._next_node(current, state)
            steps += 1
        return state

    def _run_node(self, name: str, state: TaskState, tracer: Tracer | None) -> TaskState:
        if tracer is None:
            return self._nodes[name](state)

        tokens_before = state.total_tokens
        with tracer.span(
            kind="agent",
            name=name,
            input={"iteration": state.iteration, "status": state.status},
        ) as span:
            new_state = self._nodes[name](state)
            span.output = {"iteration": new_state.iteration, "status": new_state.status}
            span.tokens = new_state.total_tokens - tokens_before
        return new_state

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
