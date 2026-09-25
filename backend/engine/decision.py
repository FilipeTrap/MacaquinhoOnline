"""Uma unidade de tempo: a fome sobe, cada macaco se move e, quem estiver na
comida, escolhe. Quem estava mais perto (ou chegou primeiro) come antes."""

from backend.engine.calculations import chebyshev_distance, clamp
from backend.engine.constants import (
    DEFAULT_POSITIONS,
    ENERGY_FULL,
    HUNGER_LEARN_THRESHOLD,
    LEARNABLE_WEIGHTS,
    LEARNING_RATE,
    SLEEP_THRESHOLD,
    WEIGHT_DECAY,
    WEIGHT_MAX,
    WEIGHT_MIN,
)
from backend.trees.movement_nodes import (
    AvaliarAlvo,
    AvaliarCorrida,
    Dormir,
    EscolherAlvo,
    EscolherDirecao,
    Mover,
    VisaoAgente,
)
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
    log_node,
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
    agent.setdefault("energy", ENERGY_FULL)
    agent["weights"].setdefault("happiness", 1.0)
    agent["weights"].setdefault("energy", 1.0)
    agent["weights"].setdefault("corrida", 1.0)
    baseline = agent.setdefault("weight_baseline", {})
    for key in LEARNABLE_WEIGHTS:
        baseline.setdefault(key, agent["weights"].get(key, 1.0))


def ensure_relations(agents: list[dict]) -> None:
    ids = [agent["id"] for agent in agents]
    for agent in agents:
        relations = agent.setdefault("relations", {})
        for other_id in ids:
            if other_id == agent["id"]:
                continue
            relations.setdefault(other_id, 1.0)


def ensure_position(agent: dict, grid: dict) -> None:
    position = agent.get("position")
    if not isinstance(position, dict) or "x" not in position or "y" not in position:
        default_x, default_y = DEFAULT_POSITIONS.get(agent["id"], (0, 0))
        agent["position"] = {"x": default_x, "y": default_y}
        position = agent["position"]
    position["x"] = max(0, min(grid["width"] - 1, int(position["x"])))
    position["y"] = max(0, min(grid["height"] - 1, int(position["y"])))


def move_agent(agent: dict, agents: list[dict], food_items: list[dict], foods_by_id: dict, grid: dict) -> dict:
    ctx = {
        "agent": agent,
        "agent_id": agent["id"],
        "agents": agents,
        "food_items": food_items,
        "foods_by_id": foods_by_id,
        "grid": grid,
        "trace": [],
    }
    VisaoAgente().tick(ctx)
    AvaliarAlvo().tick(ctx)
    EscolherAlvo().tick(ctx)
    AvaliarCorrida().tick(ctx)
    EscolherDirecao().tick(ctx)
    Mover().tick(ctx)
    if agent["energy"] < SLEEP_THRESHOLD:
        agent["status"] = "dormindo"
        log_node(ctx, "Mover", "energia baixa, vai dormir")
    return ctx


def _adjust_weight(agent: dict, key: str, delta: float) -> None:
    weights = agent["weights"]
    current = weights.get(key, agent["weight_baseline"].get(key, 1.0))
    weights[key] = round(clamp(current + delta, WEIGHT_MIN, WEIGHT_MAX), 4)


def _decay_weight(agent: dict, key: str) -> None:
    weights = agent["weights"]
    baseline = agent["weight_baseline"].get(key, weights.get(key, 1.0))
    current = weights.get(key, baseline)
    if current > baseline:
        weights[key] = round(max(baseline, current - WEIGHT_DECAY), 4)
    elif current < baseline:
        weights[key] = round(min(baseline, current + WEIGHT_DECAY), 4)


def learn(agents: list[dict], contexts: list[dict]) -> list[str]:
    """Reforço simples: fome alta demais puxa o peso da fome pra cima, comer algo
    que faz mal puxa a aversão, perder a comida pra outro puxa a vontade de correr.
    Sem reforço, cada peso deriva de volta pro valor original daquele agente."""
    trace: list[str] = []
    context_by_agent = {ctx["agent_id"]: ctx for ctx in contexts}
    for agent in agents:
        for key in LEARNABLE_WEIGHTS:
            _decay_weight(agent, key)

        if agent["hunger"] >= HUNGER_LEARN_THRESHOLD:
            _adjust_weight(agent, "hunger", LEARNING_RATE)

        ctx = context_by_agent.get(agent["id"])
        if ctx:
            decision = ctx.get("decision", {})
            if ctx.get("took") and decision.get("food"):
                eaten = next((f for f in ctx.get("foods", []) if f["id"] == decision["food"]), None)
                if eaten and eaten.get("harm", 0) > 0:
                    _adjust_weight(agent, "aversion", LEARNING_RATE * 2)
            if decision.get("action") == "MISS":
                _adjust_weight(agent, "corrida", LEARNING_RATE * 2)

        weights = agent["weights"]
        trace.append(
            f"[{agent['id']}][Aprender] hunger={weights.get('hunger', 0):.3f} "
            f"aversion={weights.get('aversion', 0):.3f} corrida={weights.get('corrida', 1):.3f}"
        )
    return trace


def _none_context(agent: dict) -> dict:
    ctx = {
        "agent": agent,
        "agent_id": agent["id"],
        "foods": [],
        "trace": [],
        "scores": {},
        "decision": {"action": "NONE", "food": None},
        "took": False,
    }
    agent["feast"] = 0
    agent["last_action"] = {"action": "NONE", "food": None}
    log_node(ctx, "Pegar", "sem comida na própria célula")
    return ctx


def pass_time(
    agents: list[dict],
    foods_catalog: list[dict],
    food_items: list[dict],
    grid: dict,
) -> tuple[list[dict], list[str]]:
    ensure_relations(agents)
    trace: list[str] = []
    healthy: list[dict] = []
    for agent in agents:
        ensure_mood(agent)
        ensure_position(agent, grid)
        ctx = {"agent": agent, "agent_id": agent["id"], "trace": [], "scores": {}}
        if agent.get("sick_left", 0) > 0:
            Doente().tick(ctx)
        elif agent.get("status") == "dormindo":
            Dormir().tick(ctx)
        else:
            PassarTempo().tick(ctx)
            healthy.append(agent)
        trace.extend(ctx["trace"])

    foods_by_id = {food["id"]: food for food in foods_catalog}

    # Distância antes de mover: quem já estava mais perto tem prioridade na disputa.
    pre_move_distance: dict[str, dict[str, int]] = {}
    for agent in healthy:
        pre_move_distance[agent["id"]] = {
            item["instance_id"]: chebyshev_distance(agent["position"], item) for item in food_items
        }

    for agent in healthy:
        move_ctx = move_agent(agent, agents, food_items, foods_by_id, grid)
        trace.extend(move_ctx["trace"])

    cell_agents: dict[tuple[int, int], list[dict]] = {}
    for agent in healthy:
        cell = (agent["position"]["x"], agent["position"]["y"])
        cell_agents.setdefault(cell, []).append(agent)

    contexts: list[dict] = []
    handled_agent_ids: set[str] = set()
    for item in list(food_items):
        cell = (item["x"], item["y"])
        occupants = cell_agents.get(cell)
        if not occupants:
            continue
        food = foods_by_id[item["food_id"]]
        cell_contexts = [score_agent(agent, agents, [food]) for agent in occupants]

        def claim_order(ctx: dict) -> tuple[int, float]:
            distance = pre_move_distance[ctx["agent_id"]].get(item["instance_id"], 0)
            wants_it = ctx["decision"]["action"] == "EAT"
            score = ctx["scores"].get(item["food_id"], 0.0) if wants_it else -1.0
            return (distance, -score)

        cell_contexts.sort(key=claim_order)
        cell_stock = {item["food_id"]: item["quantity"]}
        for ctx in cell_contexts:
            Pegar().tick(ctx, cell_stock)
        item["quantity"] = cell_stock[item["food_id"]]

        contexts.extend(cell_contexts)
        handled_agent_ids.update(ctx["agent_id"] for ctx in cell_contexts)

    for agent in healthy:
        if agent["id"] in handled_agent_ids:
            continue
        contexts.append(_none_context(agent))

    food_items[:] = [item for item in food_items if item["quantity"] > 0]

    Conviver().tick(contexts)
    for ctx in contexts:
        trace.extend(ctx["trace"])

    trace.extend(learn(agents, contexts))
    return contexts, trace
