"""Rotas da floresta. Comidas são lidas do arquivo a cada pedido."""

import copy
import json
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from backend.engine.decision import ensure_mood, ensure_relations, pass_time

ROOT = Path(__file__).resolve().parent.parent
FOODS_PATH = ROOT / "data" / "foods.json"
AGENTS_PATH = ROOT / "data" / "agents.json"

router = APIRouter()


def read_json(path: Path):
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def write_agents(agents: list[dict]) -> None:
    with AGENTS_PATH.open("w", encoding="utf-8") as handle:
        json.dump(agents, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


AGENTS: list[dict] = read_json(AGENTS_PATH)
INITIAL_AGENTS: list[dict] = copy.deepcopy(AGENTS)
ensure_relations(AGENTS)
ensure_relations(INITIAL_AGENTS)
for _agent in AGENTS:
    ensure_mood(_agent)
for _agent in INITIAL_AGENTS:
    ensure_mood(_agent)


def load_foods() -> list[dict]:
    return read_json(FOODS_PATH)


def initial_stock() -> dict[str, int]:
    return {food["id"]: int(food.get("quantity", 0)) for food in load_foods()}


STOCK: dict[str, int] = initial_stock()
TIME = 0
LAST_TRACE: list[str] = []


class StockRequest(BaseModel):
    id: str
    amount: int = Field(default=1, ge=1)


def public_agent(agent: dict) -> dict:
    return {
        "id": agent["id"],
        "name": agent["name"],
        "hunger": agent["hunger"],
        "happiness": agent.get("happiness", 50),
        "status": agent.get("status", "normal"),
        "sick_left": agent.get("sick_left", 0),
        "weights": agent["weights"],
        "experience": agent["experience"],
        "relations": agent.get("relations", {}),
        "last_action": agent.get("last_action"),
    }


def sync_stock(foods: list[dict]) -> None:
    for food in foods:
        STOCK.setdefault(food["id"], int(food.get("quantity", 0)))


def world_state() -> dict:
    foods = load_foods()
    sync_stock(foods)
    return {
        "time": TIME,
        "foods": [
            {
                "id": food["id"],
                "name": food["name"],
                "satiety": food["satiety"],
                "happiness": food.get("happiness", 0),
                "quantity": STOCK.get(food["id"], 0),
            }
            for food in foods
        ],
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
    sync_stock(foods)
    _, trace = pass_time(AGENTS, foods, STOCK)
    LAST_TRACE = [f"[tempo] unidade={TIME}"] + trace
    write_agents(AGENTS)
    return world_state()


@router.post("/stock")
def add_stock(body: StockRequest):
    foods = {food["id"]: food for food in load_foods()}
    if body.id not in foods:
        raise HTTPException(status_code=400, detail=f"Comida desconhecida: {body.id}")
    sync_stock(list(foods.values()))
    STOCK[body.id] = STOCK.get(body.id, 0) + body.amount
    return world_state()


@router.post("/reset")
def reset():
    global AGENTS, TIME, LAST_TRACE, STOCK
    AGENTS = copy.deepcopy(INITIAL_AGENTS)
    ensure_relations(AGENTS)
    STOCK = initial_stock()
    TIME = 0
    LAST_TRACE = []
    write_agents(AGENTS)
    return world_state()
