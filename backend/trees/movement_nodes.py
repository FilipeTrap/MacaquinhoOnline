"""Nós da árvore de movimento.

A ordem é: visão, avaliar alvo, escolher alvo, avaliar corrida, escolher
direção, mover. Mesma filosofia da árvore alimentar: nada de `if` direto na
escolha do alvo ou no andar/correr — vence por score (peso × sinal, sigmoid).
A direção e o vagueio são mecânicos (não há "decisão" real ali, só executar o
que a árvore escolheu). Dormir é fisiológico, não uma escolha: por isso é
tratado à parte, como o `Doente` da árvore alimentar.
"""

import logging
import random

from backend.engine.calculations import (
    chebyshev_distance,
    clamp,
    clamp_hunger,
    normalize,
    relieve_harm,
    relieve_joy,
    sigmoid,
)
from backend.engine.constants import (
    RUN_ENERGY_COST,
    RUN_ENERGY_WEIGHT,
    RUN_MODERATE_WEIGHT,
    RUN_COMPETITION_WEIGHT,
    RUN_BASE_BIAS,
    RUN_RIVAL_RADIUS,
    RUN_STEPS,
    SLEEP_ENERGY_GAIN,
    WAKE_THRESHOLD,
    WALK_ENERGY_COST,
)

logger = logging.getLogger("forest")

# Ordem fixa para o sorteio de vagueio: 4 direções + parado, com leve viés para andar.
DIRECTIONS = {
    "norte": (0, -1),
    "sul": (0, 1),
    "leste": (1, 0),
    "oeste": (-1, 0),
    "parado": (0, 0),
}
WANDER_WEIGHTS = [0.2125, 0.2125, 0.2125, 0.2125, 0.15]


def log_node(ctx: dict, node: str, message: str) -> None:
    line = f"[{ctx['agent_id']}][{node}] {message}"
    ctx["trace"].append(line)
    logger.info(line)


class VisaoAgente:
    """Lista as comidas dentro do raio de visão do agente. Fora disso, ele não sabe que existem."""

    def tick(self, ctx: dict) -> None:
        position = ctx["agent"]["position"]
        radius = ctx["grid"]["vision_radius"]
        visible = []
        for item in ctx["food_items"]:
            distance = chebyshev_distance(position, item)
            if distance <= radius:
                visible.append({"item": item, "distance": distance, "score": 0.0})
        ctx["visible"] = visible
        if not visible:
            log_node(ctx, "Visao", f"raio={radius} nada a vista")
            return
        names = ", ".join(
            f"{v['item']['food_id']}@{v['item']['x']},{v['item']['y']}(d={v['distance']})" for v in visible
        )
        log_node(ctx, "Visao", f"raio={radius} vendo {names}")


class AvaliarAlvo:
    """Pontua cada comida visível: fome, saciedade/felicidade/dano do tipo, menos a distância."""

    def tick(self, ctx: dict) -> None:
        agent = ctx["agent"]
        weights = agent["weights"]
        hunger_norm = normalize(clamp_hunger(agent["hunger"]))
        aversion_relief = 1 - hunger_norm
        feast = agent.get("feast", 0)
        distance_weight = ctx["grid"]["distance_weight"]
        for visible in ctx["visible"]:
            food = ctx["foods_by_id"][visible["item"]["food_id"]]
            satiety_norm = normalize(food["satiety"])
            harm = float(food.get("harm", 0))
            joy_raw = (float(food.get("happiness", 0)) / 10) * weights.get("happiness", 1.0)
            joy = relieve_joy(joy_raw, feast, aversion_relief)
            raw = (
                hunger_norm * weights["hunger"]
                + satiety_norm * weights["satiety"]
                + joy
                - relieve_harm(harm, weights.get("aversion", 0), aversion_relief)
                - visible["distance"] * distance_weight
            )
            score = sigmoid(raw)
            visible["score"] = score
            log_node(
                ctx,
                "AvaliarAlvo",
                (
                    f"{visible['item']['food_id']}@{visible['item']['x']},{visible['item']['y']} "
                    f"dist={visible['distance']} score={score:.3f}"
                ),
            )


class EscolherAlvo:
    """Escolhe a comida visível de maior score. Sem candidato acima do limiar, vira vagueio."""

    def tick(self, ctx: dict) -> None:
        wait_score = sigmoid(0)
        candidates = [v for v in ctx["visible"] if v["score"] > wait_score]
        if not candidates:
            ctx["target"] = None
            log_node(ctx, "EscolherAlvo", "nenhum alvo vale a pena, vagueando")
            return
        best = max(candidates, key=lambda v: v["score"])
        ctx["target"] = best["item"]
        log_node(
            ctx,
            "EscolherAlvo",
            f"alvo={best['item']['food_id']}@{best['item']['x']},{best['item']['y']} score={best['score']:.3f}",
        )


class AvaliarCorrida:
    """Avalia se vale a pena correr até a fruta alvo: energia alta, fome moderada
    e um rival a até `RUN_RIVAL_RADIUS` células dela — a ameaça é o que normalmente
    faz pender pra corrida. Sem fruta alvo, ou o alvo não sendo fruta, não há corrida.

    Perto (a 1 célula, incluindo diagonal) o pulo não ajuda em nada — só andar já
    resolve — e correr ali faria o macaco pular por cima da comida. Por isso a
    corrida só é sequer avaliada quando a distância até o alvo é de 2 células ou
    mais (o suficiente pra um pulo render de verdade)."""

    def tick(self, ctx: dict) -> None:
        agent = ctx["agent"]
        target = ctx["target"]
        food = ctx["foods_by_id"].get(target["food_id"]) if target else None
        if target is None or not food or not food.get("fruit", False):
            ctx["mode"] = "andar"
            log_node(ctx, "AvaliarCorrida", "sem fruta alvo, anda")
            return

        gap = chebyshev_distance(agent["position"], target)
        if gap < RUN_STEPS:
            ctx["mode"] = "andar"
            log_node(ctx, "AvaliarCorrida", f"a {gap} bloco(s), perto demais pra valer o pulo")
            return

        weights = agent["weights"]
        energy_norm = normalize(clamp_hunger(agent.get("energy", 100)))
        hunger_norm = normalize(clamp_hunger(agent["hunger"]))
        moderacao = max(0.0, 1 - abs(hunger_norm - 0.5) / 0.5)

        rival_distance = min(
            (
                chebyshev_distance(other["position"], target)
                for other in ctx["agents"]
                if other["id"] != ctx["agent_id"]
            ),
            default=None,
        )
        rival = 1.0 if rival_distance is not None and rival_distance <= RUN_RIVAL_RADIUS else 0.0

        raw = (
            energy_norm * RUN_ENERGY_WEIGHT * weights.get("energy", 1.0)
            + moderacao * RUN_MODERATE_WEIGHT
            + rival * RUN_COMPETITION_WEIGHT * weights.get("corrida", 1.0)
            - RUN_BASE_BIAS
        )
        score = sigmoid(raw)
        ctx["mode"] = "correr" if score > 0.5 else "andar"
        log_node(
            ctx,
            "AvaliarCorrida",
            (
                f"gap={gap} energia={energy_norm:.2f} moderacao={moderacao:.2f} rival={rival:.0f} "
                f"score={score:.3f} modo={ctx['mode']}"
            ),
        )


class EscolherDirecao:
    """Com alvo, anda 1 passo no eixo de maior diferença. Sem alvo, sorteia entre as 5 opções."""

    def tick(self, ctx: dict) -> None:
        target = ctx["target"]
        if target is None:
            direction = random.choices(list(DIRECTIONS.keys()), weights=WANDER_WEIGHTS)[0]
            ctx["direction"] = direction
            log_node(ctx, "EscolherDirecao", f"vagueio direcao={direction}")
            return

        position = ctx["agent"]["position"]
        dx = target["x"] - position["x"]
        dy = target["y"] - position["y"]
        if dx == 0 and dy == 0:
            direction = "parado"
        elif abs(dx) >= abs(dy):
            direction = "leste" if dx > 0 else "oeste"
        else:
            direction = "sul" if dy > 0 else "norte"
        ctx["direction"] = direction
        log_node(ctx, "EscolherDirecao", f"rumo ao alvo direcao={direction}")


class Mover:
    """Aplica o deslocamento: 1 célula andando, até 2 correndo — sem sair do grid
    e sem passar do alvo nesse eixo (senão o pulo passaria por cima da comida).
    Só cobra energia se o agente de fato saiu do lugar."""

    def tick(self, ctx: dict) -> None:
        grid = ctx["grid"]
        agent = ctx["agent"]
        dx, dy = DIRECTIONS[ctx["direction"]]
        running = ctx.get("mode") == "correr" and (dx, dy) != (0, 0)

        position = agent["position"]
        before_x, before_y = position["x"], position["y"]

        steps = 1
        if running:
            target = ctx.get("target")
            if target is not None:
                gap = abs(target["x"] - before_x) if dx else abs(target["y"] - before_y)
                steps = max(1, min(RUN_STEPS, gap))
            else:
                steps = RUN_STEPS

        position["x"] = clamp(before_x + dx * steps, 0, grid["width"] - 1)
        position["y"] = clamp(before_y + dy * steps, 0, grid["height"] - 1)

        if (position["x"], position["y"]) != (before_x, before_y):
            cost = RUN_ENERGY_COST if running else WALK_ENERGY_COST
            agent["energy"] = round(clamp_hunger(agent.get("energy", 100) - cost), 1)

        modo = "correndo" if running else "andando"
        log_node(
            ctx,
            "Mover",
            f"{modo} {before_x},{before_y} -> {position['x']},{position['y']} energia={agent.get('energy', 100):.0f}",
        )


class Dormir:
    """Dorme parado: a fome não anda, e a energia sobe até o limiar de acordar."""

    def tick(self, ctx: dict) -> None:
        agent = ctx["agent"]
        before = agent.get("energy", 0)
        agent["energy"] = round(clamp_hunger(before + SLEEP_ENERGY_GAIN), 1)
        if agent["energy"] >= WAKE_THRESHOLD:
            agent["status"] = "normal"
            log_node(ctx, "Dormir", f"energia={before:.0f}->{agent['energy']:.0f} acordou")
        else:
            log_node(ctx, "Dormir", f"energia={before:.0f}->{agent['energy']:.0f} dormindo")
