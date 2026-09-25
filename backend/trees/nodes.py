"""Nós da árvore alimentar.

A ordem é: estado, ambiente, classificar, social, experiência, soma, sigmoid, comparar, consequência.
Cada nó anota o que fez no log. A escolha da comida é o maior score, não uma regra if/else.
"""

import logging

from backend.engine.calculations import clamp_hunger, normalize, sigmoid

logger = logging.getLogger("forest")

# Quem come acumula mais do que quem apenas viu a comida.
EATEN_GAIN = 0.25
SEEN_GAIN = 0.05
# Uma unidade de tempo. Igual para todos; o botão é quem avança.
HUNGER_STEP = 10
# Muito pouco, de propósito. Agressão fica para quando a relação estiver baixa.
RELATION_DROP = 0.02
# Parte da experiência de ter comido comida ruim que passa a pesar contra.
HARM_BACKLASH = 0.15
# Três refeições seguidas que sobem a felicidade adoecem. A fome alta não impede isso.
FEAST_LIMIT = 3
SICK_TICKS = 4
SICK_HUNGER = 20
SICK_HAPPINESS = 10


def food_harm(food: dict) -> float:
    return float(food.get("harm", 0))


def ensure_memory(agent: dict, food_id: str) -> dict:
    experience = agent.setdefault("experience", {})
    entry = experience.setdefault(food_id, {"eaten": 0.0, "seen": 0.0})
    entry.setdefault("eaten", 0.0)
    entry.setdefault("seen", 0.0)
    return entry


def log_node(ctx: dict, node: str, message: str) -> None:
    line = f"[{ctx['agent_id']}][{node}] {message}"
    ctx["trace"].append(line)
    logger.info(line)


class EstadoAgente:
    """Lê a fome e os pesos deste agente. Não escolhe comida."""

    def tick(self, ctx: dict) -> None:
        agent = ctx["agent"]
        weights = agent["weights"]
        ctx["hunger"] = clamp_hunger(agent["hunger"])
        ctx["hunger_norm"] = normalize(ctx["hunger"])
        ctx["weights"] = weights
        log_node(
            ctx,
            "Estado",
            (
                f"fome={ctx['hunger']:.0f} "
                f"hunger={weights['hunger']:.3f} "
                f"satiety={weights['satiety']:.3f} "
                f"environment={weights['environment']:.3f} "
                f"social={weights['social']:.3f} "
                f"eaten={weights['eaten']:.3f} "
                f"seen={weights['seen']:.3f} "
                f"aversion={weights.get('aversion', 0):.3f} "
                f"happiness={weights.get('happiness', 0):.3f} "
                f"felicidade={agent.get('happiness', 50):.0f} "
                f"status={agent.get('status', 'normal')}"
            ),
        )


class Ambiente:
    """Lista as comidas presentes. Sem comida, não existe decisão de comer."""

    def tick(self, ctx: dict) -> None:
        foods = ctx["foods"]
        if not foods:
            log_node(ctx, "Ambiente", "sem comida, sem decisão de comer")
            return
        names = ",".join(food["id"] for food in foods)
        log_node(ctx, "Ambiente", f"comidas={names}")


class ClassificarComida:
    """Classifica a comida pela saciedade e entrega o mesmo peso base a todos."""

    def tick(self, ctx: dict) -> None:
        food = ctx["food"]
        base = normalize(food["satiety"])
        harm = food_harm(food)
        ctx["satiety_norm"] = base
        ctx["environment_weight"] = base
        ctx["harm"] = harm
        ensure_memory(ctx["agent"], food["id"])
        log_node(
            ctx,
            "Classificar",
            f"{food['id']} saciedade={food['satiety']:.0f} peso_base={base:.2f} dano={harm:.2f}",
        )


class Felicidade:
    """Lê a felicidade e o efeito desta comida nela.

    Prioridade da árvore: banana puxa para cima, casca para baixo, pepino fica neutro.
    O peso happiness de cada macaco diz o quanto isso importa. O miolo deste nó vai crescer depois.
    """

    def tick(self, ctx: dict) -> None:
        delta = float(ctx["food"].get("happiness", 0))
        weight = ctx["weights"].get("happiness", 1.0)
        ctx["joy"] = (delta / 10) * weight
        log_node(
            ctx,
            "Felicidade",
            (
                f"felicidade={ctx['agent'].get('happiness', 50):.0f} "
                f"{ctx['food']['id']} efeito={delta:+.0f} sinal={ctx['joy']:.3f}"
            ),
        )


class InfluenciaSocial:
    """Mede o quanto os outros agentes já comeram ou viram esta comida."""

    def tick(self, ctx: dict) -> None:
        food_id = ctx["food"]["id"]
        others = [agent for agent in ctx["agents"] if agent["id"] != ctx["agent_id"]]
        total = 0.0
        for other in others:
            exp = other.get("experience", {}).get(food_id, {"eaten": 0.0, "seen": 0.0})
            weights = other["weights"]
            appetite = exp["eaten"] * weights["eaten"] + exp.get("seen", 0) * weights["seen"]
            # Comida com dano não vira recomendação social.
            total += appetite * (1 - food_harm(ctx["food"]))
        signal = total / len(others) if others else 0.0
        ctx["social_signal"] = signal
        log_node(ctx, "Social", f"{food_id} sinal={signal:.3f}")


class Experiencia:
    """Lê o que este agente já comeu ou viu. Comida nova começa em zero."""

    def tick(self, ctx: dict) -> None:
        food_id = ctx["food"]["id"]
        exp = ctx["agent"]["experience"][food_id]
        ctx["eaten"] = exp["eaten"]
        ctx["seen"] = exp["seen"]
        log_node(
            ctx,
            "Experiencia",
            f"{food_id} eaten={exp['eaten']:.2f} seen={exp['seen']:.2f}",
        )


class Soma:
    """Multiplica cada sinal pelo peso do agente e soma."""

    def tick(self, ctx: dict) -> None:
        weights = ctx["weights"]
        harm = ctx["harm"]
        hunger_part = ctx["hunger_norm"] * weights["hunger"]
        satiety_part = ctx["satiety_norm"] * weights["satiety"]
        environment_part = ctx["environment_weight"] * weights["environment"]
        social_part = ctx["social_signal"] * weights["social"]
        appetite = ctx["eaten"] * weights["eaten"] + ctx["seen"] * weights["seen"]
        # Dano zera o gosto adquirido e ainda devolve uma parte contra quem já comeu.
        experience_part = appetite * (1 - harm) - (ctx["eaten"] * weights["eaten"]) * harm * HARM_BACKLASH
        harm_part = harm * weights.get("aversion", 0)
        joy_part = ctx.get("joy", 0)
        raw = (
            hunger_part
            + satiety_part
            + environment_part
            + social_part
            + experience_part
            + joy_part
            - harm_part
        )
        ctx["raw"] = raw
        food_id = ctx["food"]["id"]
        log_node(
            ctx,
            "Soma",
            (
                f"{food_id} fome={hunger_part:.3f} saciedade={satiety_part:.3f} "
                f"ambiente={environment_part:.3f} social={social_part:.3f} "
                f"experiencia={experience_part:.3f} "
                f"felicidade={joy_part:.3f} "
                f"dano={harm_part:.3f} raw={raw:.3f}"
            ),
        )


class SigmoidNode:
    """Converte a soma em tendência entre 0 e 1."""

    def tick(self, ctx: dict) -> None:
        score = sigmoid(ctx["raw"])
        food_id = ctx["food"]["id"]
        ctx["scores"][food_id] = score
        log_node(ctx, "Sigmoid", f"{food_id} score={score:.3f}")


class Comparar:
    """Escolhe a comida de maior score. No máximo uma por decisão."""

    def tick(self, ctx: dict) -> None:
        scores = ctx["scores"]
        if not scores:
            ctx["decision"] = {"action": "NONE", "food": None}
            log_node(ctx, "Comparar", "nenhuma comida")
            return
        chosen = max(scores, key=scores.get)
        # Esperar compete com comer. Score abaixo de 0.5 é raw negativo: a fome não venceu o dano.
        wait_score = sigmoid(0)
        if scores[chosen] <= wait_score:
            ctx["decision"] = {"action": "WAIT", "food": chosen}
            log_node(
                ctx,
                "Comparar",
                f"esperou {chosen} score={scores[chosen]:.3f} abaixo de esperar {wait_score:.3f}",
            )
            return
        ctx["decision"] = {"action": "EAT", "food": chosen}
        log_node(ctx, "Comparar", f"escolhida={chosen} score={scores[chosen]:.3f}")


class Doente:
    """Não come. Por 4 tempos a fome sobe 20 e a felicidade desce 10."""

    def tick(self, ctx: dict) -> None:
        agent = ctx["agent"]
        before_hunger = agent["hunger"]
        before_joy = agent.get("happiness", 50)
        agent["hunger"] = round(clamp_hunger(before_hunger + SICK_HUNGER), 1)
        agent["happiness"] = round(clamp_hunger(before_joy - SICK_HAPPINESS), 1)
        agent["sick_left"] = agent.get("sick_left", 0) - 1
        agent["feast"] = 0
        if agent["sick_left"] <= 0:
            agent["sick_left"] = 0
            agent["status"] = "normal"
        else:
            agent["status"] = "doente"
        agent["last_action"] = {"action": "SICK", "food": None}
        ctx["decision"] = {"action": "SICK", "food": None}
        ctx["took"] = False
        ctx["scores"] = {}
        log_node(
            ctx,
            "Doente",
            (
                f"não come fome={before_hunger:.0f}->{agent['hunger']:.0f} "
                f"felicidade={before_joy:.0f}->{agent['happiness']:.0f} "
                f"restam={agent['sick_left']}"
            ),
        )


class PassarTempo:
    """Uma unidade de tempo. A fome deste macaco sobe 10, sem passar de 100."""

    def tick(self, ctx: dict) -> None:
        agent = ctx["agent"]
        before = agent["hunger"]
        agent["hunger"] = round(clamp_hunger(before + HUNGER_STEP), 1)
        log_node(ctx, "PassarTempo", f"fome={before:.0f}->{agent['hunger']:.0f}")


class Pegar:
    """Pega uma unidade se ainda houver. Quem chega depois e encontra zero não come."""

    def tick(self, ctx: dict, stock: dict) -> None:
        decision = ctx["decision"]
        ctx["took"] = False
        if decision["action"] == "WAIT":
            ctx["agent"]["feast"] = 0
            ctx["agent"]["last_action"] = {"action": "WAIT", "food": decision["food"]}
            log_node(ctx, "Pegar", f"esperou, não pegou {decision['food']}")
            self._see(ctx, except_id=None)
            return
        if decision["action"] != "EAT":
            agent = ctx["agent"]
            agent["feast"] = 0
            agent["last_action"] = {"action": "NONE", "food": None}
            log_node(ctx, "Pegar", "sem comida para pegar")
            return

        food_id = decision["food"]
        if stock.get(food_id, 0) <= 0:
            ctx["decision"] = {"action": "MISS", "food": food_id}
            ctx["agent"]["feast"] = 0
            ctx["agent"]["last_action"] = {"action": "MISS", "food": food_id}
            log_node(ctx, "Pegar", f"{food_id} acabou, outro pegou antes")
            self._see(ctx, except_id=None)
            return

        before_qty = stock[food_id]
        stock[food_id] = before_qty - 1
        ctx["took"] = True
        ctx["agent"]["last_action"] = {"action": "EAT", "food": food_id}
        log_node(ctx, "Pegar", f"{food_id} quantidade={before_qty:.0f}->{stock[food_id]:.0f}")
        Consequencia().tick(ctx)

    def _see(self, ctx: dict, except_id: str | None) -> None:
        for food in ctx["foods"]:
            if food["id"] == except_id:
                continue
            seen = ensure_memory(ctx["agent"], food["id"])
            previous_seen = seen["seen"]
            seen["seen"] = round(previous_seen + SEEN_GAIN, 4)
            log_node(
                ctx,
                "Pegar",
                f"viu {food['id']} seen={previous_seen:.2f}->{seen['seen']:.2f}",
            )


class Conviver:
    """Comer junto mantém a relação. Quem pega e deixa outro sem come perde um pouco com ele."""

    def tick(self, contexts: list[dict]) -> None:
        ate = [ctx for ctx in contexts if ctx.get("took")]
        missed = [ctx for ctx in contexts if ctx["decision"]["action"] == "MISS"]
        if not missed:
            message = (
                "comeram juntos, relação mantida"
                if ate
                else "ninguém pegou comida, relação mantida"
            )
            for ctx in contexts:
                log_node(ctx, "Conviver", message)
            return

        for ctx in ate:
            agent = ctx["agent"]
            for other in missed:
                other_id = other["agent_id"]
                relations = agent.setdefault("relations", {})
                before = relations.get(other_id, 1.0)
                after = round(max(0.0, before - RELATION_DROP), 4)
                relations[other_id] = after
                log_node(
                    ctx,
                    "Conviver",
                    f"pegou e {other_id} ficou sem, relação {before:.2f}->{after:.2f}",
                )
            for ctx_other in ate:
                if ctx_other["agent_id"] == ctx["agent_id"]:
                    continue
                log_node(ctx, "Conviver", f"comeu junto com {ctx_other['agent_id']}, relação mantida")


class Consequencia:
    """Quem conseguiu pegar ganha eaten. Quem só viu ganha seen, com ganho menor. A fome desce."""

    def tick(self, ctx: dict) -> None:
        decision = ctx["decision"]
        if decision["action"] != "EAT":
            log_node(ctx, "Consequencia", "nada para aplicar")
            return

        agent = ctx["agent"]
        chosen_id = decision["food"]
        foods_by_id = {food["id"]: food for food in ctx["foods"]}
        chosen = foods_by_id[chosen_id]
        before_hunger = agent["hunger"]
        agent["hunger"] = round(clamp_hunger(before_hunger - chosen["satiety"]), 1)

        delta = float(chosen.get("happiness", 0))
        before_joy = agent.get("happiness", 50)
        agent["happiness"] = round(clamp_hunger(before_joy + delta), 1)
        if delta > 0:
            agent["feast"] = agent.get("feast", 0) + 1
        else:
            agent["feast"] = 0

        eaten = ensure_memory(agent, chosen_id)
        previous_eaten = eaten["eaten"]
        eaten["eaten"] = round(previous_eaten + EATEN_GAIN, 4)
        log_node(
            ctx,
            "Consequencia",
            (
                f"comeu {chosen_id} eaten={previous_eaten:.2f}->{eaten['eaten']:.2f} "
                f"fome={before_hunger:.0f}->{agent['hunger']:.0f} "
                f"felicidade={before_joy:.0f}->{agent['happiness']:.0f}"
            ),
        )
        if agent["feast"] >= FEAST_LIMIT:
            agent["feast"] = 0
            agent["status"] = "doente"
            agent["sick_left"] = SICK_TICKS
            log_node(ctx, "Consequencia", f"comeu demais, doente por {SICK_TICKS} tempos")

        for food in ctx["foods"]:
            if food["id"] == chosen_id:
                continue
            seen = agent["experience"][food["id"]]
            previous_seen = seen["seen"]
            seen["seen"] = round(previous_seen + SEEN_GAIN, 4)
            log_node(
                ctx,
                "Consequencia",
                f"viu {food['id']} seen={previous_seen:.2f}->{seen['seen']:.2f}",
            )
