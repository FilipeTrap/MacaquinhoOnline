const CELL_SIZE = 64;

const FOOD_ICONS = {
  banana: "assets/food/food-banana.png",
  pepino: "assets/food/food-pepino.png",
  casca: "assets/food/food-casca.png",
};
const MONKEY_SPRITE = "assets/sprites/stading01.png";
const SLEEP_SPRITE = "assets/sprites/sleep.png";

const monkeysEl = document.querySelector("#monkeys");
const timeEl = document.querySelector("#time");
const traceEl = document.querySelector("#trace");
const traceDrawer = document.querySelector("#trace-drawer");
const mapCanvas = document.querySelector("#map");
const mapHint = document.querySelector("#map-hint");
const foodPickerEl = document.querySelector("#food-picker");
const ctx2d = mapCanvas.getContext("2d");

const images = new Map();
function loadImage(src) {
  if (!images.has(src)) {
    const img = new Image();
    img.src = src;
    images.set(src, img);
  }
  return images.get(src);
}
Object.values(FOOD_ICONS).forEach(loadImage);
loadImage(MONKEY_SPRITE);
loadImage(SLEEP_SPRITE);

function hasRealImage(img) {
  return img.complete && img.naturalWidth > 0;
}

let state = null;
let armedFood = null;
let playing = false;
let speed = 1;
let playTimer = null;

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
  return "Sem comida por perto";
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
    } else if (agent.status === "dormindo") {
      status.classList.add("sleeping");
      status.textContent = "dormindo";
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
    const energyLabel = document.createElement("div");
    energyLabel.className = "bar-row";
    energyLabel.append(
      document.createTextNode("Energia"),
      bar((agent.energy ?? 100) / 100, "energy"),
      document.createTextNode(String(agent.energy ?? 100)),
    );
    stats.append(joyLabel, hungerLabel, energyLabel);

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

function renderFoodPicker() {
  foodPickerEl.innerHTML = "";
  for (const food of state.foods) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = armedFood === food.id ? "armed" : "";
    const icon = document.createElement("img");
    icon.src = FOOD_ICONS[food.id] || "";
    icon.alt = "";
    button.append(icon, document.createTextNode(food.name));
    button.addEventListener("click", () => {
      armedFood = armedFood === food.id ? null : food.id;
      renderFoodPicker();
      mapHint.textContent = armedFood
        ? `Clique no mapa para jogar ${food.name} lá.`
        : "Escolha uma comida e clique no mapa para jogá-la lá.";
    });
    foodPickerEl.appendChild(button);
  }
}

function renderMap() {
  const { width, height } = state.grid;
  mapCanvas.width = width * CELL_SIZE;
  mapCanvas.height = height * CELL_SIZE;

  ctx2d.clearRect(0, 0, mapCanvas.width, mapCanvas.height);

  ctx2d.strokeStyle = "#cdd9b8";
  ctx2d.lineWidth = 1;
  for (let x = 0; x <= width; x++) {
    ctx2d.beginPath();
    ctx2d.moveTo(x * CELL_SIZE, 0);
    ctx2d.lineTo(x * CELL_SIZE, height * CELL_SIZE);
    ctx2d.stroke();
  }
  for (let y = 0; y <= height; y++) {
    ctx2d.beginPath();
    ctx2d.moveTo(0, y * CELL_SIZE);
    ctx2d.lineTo(width * CELL_SIZE, y * CELL_SIZE);
    ctx2d.stroke();
  }

  const inset = 10;
  for (const item of state.food_items) {
    const icon = loadImage(FOOD_ICONS[item.food_id]);
    const drawIcon = () =>
      ctx2d.drawImage(
        icon,
        item.x * CELL_SIZE + inset,
        item.y * CELL_SIZE + inset,
        CELL_SIZE - inset * 2,
        CELL_SIZE - inset * 2,
      );
    if (icon.complete) drawIcon();
    else icon.addEventListener("load", drawIcon, { once: true });
  }

  const standing = loadImage(MONKEY_SPRITE);
  const sleeping = loadImage(SLEEP_SPRITE);
  for (const agent of state.agents) {
    const px = agent.position.x * CELL_SIZE;
    const py = agent.position.y * CELL_SIZE;
    const asleep = agent.status === "dormindo";
    const sprite = asleep ? sleeping : standing;
    const drawAgent = () => {
      ctx2d.save();
      if (asleep && !hasRealImage(sleeping)) {
        // Sem sleep.png ainda: desenha o sprite normal apagado + "zzz" no lugar.
        ctx2d.globalAlpha = 0.45;
        ctx2d.drawImage(standing, px + 4, py + 4, CELL_SIZE - 8, CELL_SIZE - 8);
        ctx2d.globalAlpha = 1;
        ctx2d.font = "14px 'Segoe UI', sans-serif";
        ctx2d.textAlign = "center";
        ctx2d.fillText("💤", px + CELL_SIZE / 2, py + 16);
      } else {
        ctx2d.drawImage(sprite, px + 4, py + 4, CELL_SIZE - 8, CELL_SIZE - 8);
      }
      ctx2d.restore();
      ctx2d.fillStyle = "#2b241c";
      ctx2d.font = "12px 'Segoe UI', sans-serif";
      ctx2d.textAlign = "center";
      ctx2d.fillText(agent.name, px + CELL_SIZE / 2, py + CELL_SIZE - 2);
    };
    if (standing.complete) drawAgent();
    else standing.addEventListener("load", drawAgent, { once: true });
  }
}

function render() {
  timeEl.textContent = `Tempo ${state.time}`;
  renderMonkeys();
  renderFoodPicker();
  renderMap();
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
    mapHint.textContent = error.detail || "Não foi possível atualizar.";
    return false;
  }
  state = await response.json();
  render();
  return true;
}

function tick() {
  post("/tick");
}

function setPlaying(next) {
  playing = next;
  const pauseButton = document.querySelector("#pause");
  pauseButton.textContent = playing ? "❚❚ Pausar" : "▶ Retomar";
  clearInterval(playTimer);
  if (playing) {
    playTimer = setInterval(tick, 1000 / speed);
  }
}

function setSpeed(next) {
  speed = next;
  document.querySelectorAll(".speed").forEach((button) => {
    button.classList.toggle("active", Number(button.dataset.speed) === speed);
  });
  if (playing) {
    setPlaying(true);
  }
}

document.querySelector("#pause").addEventListener("click", () => setPlaying(!playing));
document.querySelector("#step").addEventListener("click", tick);
document.querySelector("#reset").addEventListener("click", () => {
  setPlaying(false);
  post("/reset");
});
document.querySelectorAll(".speed").forEach((button) => {
  button.addEventListener("click", () => setSpeed(Number(button.dataset.speed)));
});
document.querySelector("#toggle-trace").addEventListener("click", () => {
  traceDrawer.hidden = !traceDrawer.hidden;
});
document.querySelector("#close-trace").addEventListener("click", () => {
  traceDrawer.hidden = true;
});

mapCanvas.addEventListener("click", (event) => {
  if (!armedFood) {
    mapHint.textContent = "Escolha uma comida antes de clicar no mapa.";
    return;
  }
  const rect = mapCanvas.getBoundingClientRect();
  const scaleX = mapCanvas.width / rect.width;
  const scaleY = mapCanvas.height / rect.height;
  const x = Math.floor(((event.clientX - rect.left) * scaleX) / CELL_SIZE);
  const y = Math.floor(((event.clientY - rect.top) * scaleY) / CELL_SIZE);
  post("/food/throw", { food_id: armedFood, x, y });
});

setSpeed(1);
setPlaying(false);

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
    mapHint.textContent = "Não foi possível carregar o estado.";
  });
