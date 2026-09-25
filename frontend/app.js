const monkeysEl = document.querySelector("#monkeys");
const foodsEl = document.querySelector("#foods");
const timeEl = document.querySelector("#time");
const traceEl = document.querySelector("#trace");

let state = null;

function foodName(foodId) {
  return state.foods.find((food) => food.id === foodId)?.name || foodId;
}

function actionText(agent) {
  const action = agent.last_action;
  if (!action) return "Esperando o tempo";
  if (action.action === "SICK") return "Doente, não come";
  if (action.action === "EAT") return `Comeu ${foodName(action.food)}`;
  if (action.action === "WAIT") return `Esperou, não comeu ${foodName(action.food)}`;
  if (action.action === "MISS") return `Quis ${foodName(action.food)}, outro pegou`;
  return "Sem comida";
}

function bar(value, className) {
  const track = document.createElement("div");
  track.className = "track";
  const fill = document.createElement("div");
  fill.className = `fill ${className || ""}`.trim();
  fill.style.width = `${Math.max(0, Math.min(100, Math.round(value * 100)))}%`;
  track.appendChild(fill);
  return track;
}

function renderMonkeys() {
  monkeysEl.innerHTML = "";
  for (const agent of state.agents) {
    const card = document.createElement("article");
    card.className = "monkey";

    const head = document.createElement("div");
    head.className = "name-row";
    const title = document.createElement("h2");
    title.textContent = `🐒 ${agent.name}`;
    const status = document.createElement("span");
    status.className = "status";
    if (agent.status === "doente") {
      status.classList.add("sick");
      status.textContent = `doente · ${agent.sick_left}`;
    } else {
      status.textContent = "normal";
    }
    head.append(title, status);

    const stats = document.createElement("div");
    stats.className = "stats";
    const joyLabel = document.createElement("div");
    joyLabel.className = "bar-row";
    joyLabel.append(
      document.createTextNode("Felicidade"),
      bar((agent.happiness ?? 50) / 100, "joy"),
      document.createTextNode(String(agent.happiness ?? 50)),
    );
    const hungerLabel = document.createElement("div");
    hungerLabel.className = "bar-row";
    hungerLabel.append(
      document.createTextNode("Fome"),
      bar(agent.hunger / 100, "hunger"),
      document.createTextNode(String(agent.hunger)),
    );
    stats.append(joyLabel, hungerLabel);

    const action = document.createElement("p");
    action.className = "action";
    action.textContent = actionText(agent);

    const relationsTitle = document.createElement("h3");
    relationsTitle.textContent = "Interação";
    const relations = document.createElement("div");
    relations.className = "relations";
    relations.appendChild(relationsTitle);

    for (const other of state.agents) {
      if (other.id === agent.id) continue;
      const value = agent.relations[other.id] ?? 1;
      const row = document.createElement("div");
      row.className = "bar-row";
      row.append(
        document.createTextNode(other.name),
        bar(value),
        document.createTextNode(value.toFixed(2)),
      );
      relations.appendChild(row);
    }

    card.append(head, stats, action, relations);
    monkeysEl.appendChild(card);
  }
}

function renderFoods() {
  foodsEl.innerHTML = "";
  for (const food of state.foods) {
    const row = document.createElement("div");
    row.className = "food-row";

    const name = document.createElement("span");
    const mood = food.happiness ?? 0;
    const sign = mood > 0 ? `+${mood}` : String(mood);
    name.textContent = `${food.name} (${sign})`;

    const qty = document.createElement("span");
    qty.className = "qty";
    qty.textContent = String(food.quantity);

    const amount = document.createElement("input");
    amount.type = "number";
    amount.min = "1";
    amount.value = "1";
    amount.setAttribute("aria-label", `Quantidade de ${food.name}`);

    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Por";
    button.addEventListener("click", () => addFood(food.id, Number(amount.value)));

    row.append(name, qty, amount, button);
    foodsEl.appendChild(row);
  }
}

function render() {
  timeEl.textContent = `Tempo ${state.time}`;
  renderMonkeys();
  renderFoods();
  traceEl.textContent = state.trace.length ? state.trace.join("\n") : "Ainda não passou tempo.";
}

async function post(path, body) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : "{}",
  });
  if (!response.ok) {
    const error = await response.json();
    traceEl.textContent = error.detail || "Não foi possível atualizar.";
    return;
  }
  state = await response.json();
  render();
}

function addFood(id, amount) {
  const qty = Number.isFinite(amount) && amount >= 1 ? Math.floor(amount) : 1;
  post("/stock", { id, amount: qty });
}

document.querySelector("#tick").addEventListener("click", () => post("/tick"));
document.querySelector("#reset").addEventListener("click", () => post("/reset"));

fetch("/state")
  .then((response) => {
    if (!response.ok) throw new Error("state");
    return response.json();
  })
  .then((payload) => {
    state = payload;
    render();
  })
  .catch(() => {
    traceEl.textContent = "Não foi possível carregar o estado.";
  });
