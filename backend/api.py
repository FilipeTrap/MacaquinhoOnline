"""Rotas da floresta. Comidas são lidas do arquivo a cada pedido."""

import copy
import json
import uuid
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from backend.engine.constants import CELL_SIZE_PX, DISTANCE_WEIGHT, GRID_HEIGHT, GRID_WIDTH, VISION_RADIUS
from backend.engine.decision import ensure_mood, ensure_position, ensure_relations, pass_time

ROOT = Path(__file__).resolve().parent.parent
FOODS_PATH = ROOT / "data" / "foods.json"
AGENTS_PATH = ROOT / "data" / "agents.json"

router = APIRouter()

GRID = {
    "width": GRID_WIDTH,
    "height": GRID_HEIGHT,
    "vision_radius": VISION_RADIUS,
    "distance_weight": DISTANCE_WEIGHT,
}


def read_json(path: Path):
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def write_agents(agents: list[dict]) -> None:
    with AGENTS_PATH.open("w", encoding="utf-8") as handle:
        json.dump(agents, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


AGENTS: list[dict] = read_json(AGENTS_PATH)
ensure_relations(AGENTS)
for _agent in AGENTS:
    ensure_mood(_agent)
    ensure_position(_agent, GRID)
INITIAL_AGENTS: list[dict] = copy.deepcopy(AGENTS)


def load_foods() -> list[dict]:
    return read_json(FOODS_PATH)


FOOD_ITEMS: list[dict] = []
TIME = 0
LAST_TRACE: list[str] = []


class ThrowRequest(BaseModel):
    food_id: str
    x: int = Field(ge=0)
    y: int = Field(ge=0)
    amount: int = Field(default=1, ge=1)


def public_agent(agent: dict) -> dict:
    return {
        "id": agent["id"],
        "name": agent["name"],
        "hunger": agent["hunger"],
        "happiness": agent.get("happiness", 50),
        "status": agent.get("status", "normal"),
        "sick_left": agent.get("sick_left", 0),
        "position": agent["position"],
        "energy": agent.get("energy", 100),
        "weights": agent["weights"],
        "experience": agent["experience"],
        "relations": agent.get("relations", {}),
        "last_action": agent.get("last_action"),
    }


def public_food_item(item: dict) -> dict:
    return {
        "instance_id": item["instance_id"],
        "food_id": item["food_id"],
        "x": item["x"],
        "y": item["y"],
        "quantity": item["quantity"],
    }


def world_state() -> dict:
    foods = load_foods()
    return {
        "time": TIME,
        "grid": GRID,
        "foods": [
            {
                "id": food["id"],
                "name": food["name"],
                "satiety": food["satiety"],
                "happiness": food.get("happiness", 0),
                "harm": food.get("harm", 0),
                "fruit": food.get("fruit", False),
            }
            for food in foods
        ],
        "food_items": [public_food_item(item) for item in FOOD_ITEMS],
        "agents": [public_agent(agent) for agent in AGENTS],
        "trace": LAST_TRACE,
    }


@router.get("/health")
def health():
    return {"status": "ok"}


@router.get("/foods")
def foods():
    return world_state()["foods"]


@router.get("/agents")
def agents():
    return [public_agent(agent) for agent in AGENTS]


@router.get("/state")
def state():
    return world_state()


@router.post("/tick")
def tick():
    global TIME, LAST_TRACE
    TIME += 1
    foods = load_foods()
    _, trace = pass_time(AGENTS, foods, FOOD_ITEMS, GRID)
    LAST_TRACE = [f"[tempo] unidade={TIME}"] + trace
    write_agents(AGENTS)
    return world_state()


@router.post("/food/throw")
def throw_food(body: ThrowRequest):
    foods_by_id = {food["id"]: food for food in load_foods()}
    if body.food_id not in foods_by_id:
        raise HTTPException(status_code=400, detail=f"Comida desconhecida: {body.food_id}")
    if body.x >= GRID["width"] or body.y >= GRID["height"]:
        raise HTTPException(status_code=400, detail="Fora dos limites do mapa")
    for item in FOOD_ITEMS:
        if item["x"] == body.x and item["y"] == body.y:
            raise HTTPException(status_code=400, detail="Já existe comida nessa célula")
    FOOD_ITEMS.append(
        {
            "instance_id": uuid.uuid4().hex,
            "food_id": body.food_id,
            "x": body.x,
            "y": body.y,
            "quantity": body.amount,
        }
    )
    return world_state()


@router.post("/reset")
def reset():
    global AGENTS, TIME, LAST_TRACE, FOOD_ITEMS
    AGENTS = copy.deepcopy(INITIAL_AGENTS)
    ensure_relations(AGENTS)
    FOOD_ITEMS = []
    TIME = 0
    LAST_TRACE = []
    write_agents(AGENTS)
    return world_state()
