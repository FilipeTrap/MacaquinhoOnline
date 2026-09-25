"""Uma unidade de tempo: a fome sobe, cada macaco escolhe, e quem tem o maior score pega primeiro."""

from backend.trees.nodes import (
    Ambiente,
    ClassificarComida,
    Comparar,
    Conviver,
    Doente,
    EstadoAgente,
    Experiencia,
    Felicidade,
    InfluenciaSocial,
    PassarTempo,
    Pegar,
    SigmoidNode,
    Soma,
)


def score_agent(agent: dict, agents: list[dict], foods: list[dict]) -> dict:
    ctx = {
        "agent": agent,
        "agent_id": agent["id"],
        "agents": agents,
        "foods": foods,
        "trace": [],
        "scores": {},
    }
    EstadoAgente().tick(ctx)
    Ambiente().tick(ctx)
    for food in foods:
        ctx["food"] = food
        ClassificarComida().tick(ctx)
        Felicidade().tick(ctx)
        InfluenciaSocial().tick(ctx)
        Experiencia().tick(ctx)
        Soma().tick(ctx)
        SigmoidNode().tick(ctx)
    Comparar().tick(ctx)
    return ctx


def ensure_mood(agent: dict) -> None:
    agent.setdefault("happiness", 50)
    agent.setdefault("status", "normal")
    agent.setdefault("sick_left", 0)
    agent.setdefault("feast", 0)
    agent["weights"].setdefault("happiness", 1.0)


def ensure_relations(agents: list[dict]) -> None:
    ids = [agent["id"] for agent in agents]
    for agent in agents:
        relations = agent.setdefault("relations", {})
        for other_id in ids:
            if other_id == agent["id"]:
                continue
            relations.setdefault(other_id, 1.0)


def pass_time(agents: list[dict], foods: list[dict], stock: dict) -> tuple[list[dict], list[str]]:
    ensure_relations(agents)
    trace: list[str] = []
    healthy: list[dict] = []
    sick_contexts: list[dict] = []
    for agent in agents:
        ensure_mood(agent)
        ctx = {"agent": agent, "agent_id": agent["id"], "trace": [], "scores": {}}
        if agent.get("sick_left", 0) > 0:
            Doente().tick(ctx)
            sick_contexts.append(ctx)
        else:
            PassarTempo().tick(ctx)
            healthy.append(agent)
        trace.extend(ctx["trace"])

    available = [food for food in foods if stock.get(food["id"], 0) > 0]
    contexts = [score_agent(agent, agents, available) for agent in healthy]

    # Maior score pega primeiro. Empate segue a ordem dos agentes.
    claimants = sorted(
        [ctx for ctx in contexts if ctx["decision"]["action"] == "EAT"],
        key=lambda ctx: ctx["scores"][ctx["decision"]["food"]],
        reverse=True,
    )
    waiting = [ctx for ctx in contexts if ctx["decision"]["action"] != "EAT"]
    for ctx in claimants + waiting:
        Pegar().tick(ctx, stock)

    Conviver().tick(contexts)
    for ctx in contexts:
        trace.extend(ctx["trace"])
    return contexts, trace
