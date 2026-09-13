"""The planning agent: turns a task description into a concrete plan."""

from swe_agent.agents.common import to_anthropic_messages
from swe_agent.llm import LLMClient
from swe_agent.orchestrator.engine import NodeFunc
from swe_agent.schemas import AgentMessage, TaskState

PLANNER_SYSTEM_PROMPT = (
    "You are the planning agent in a multi-agent software engineering system. "
    "Given a task description, produce a short, concrete, numbered plan for "
    "how the Coder agent should implement it. Do not write code yourself — "
    "just the plan."
)


def make_planner_node(llm: LLMClient) -> NodeFunc:
    def planner(state: TaskState) -> TaskState:
        state.iteration += 1
        state.status = "running"

        response = llm.complete(
            system=PLANNER_SYSTEM_PROMPT,
            messages=to_anthropic_messages(state.messages),
        )
        state.total_tokens += response.input_tokens + response.output_tokens
        state.total_cost_usd += llm.cost_usd(
            input_tokens=response.input_tokens, output_tokens=response.output_tokens
        )
        state.messages.append(AgentMessage(role="assistant", name="planner", content=response.text))
        return state

    return planner
