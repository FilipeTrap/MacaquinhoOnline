"""Constantes do mapa: tamanho do grid, alcance de visão e pesos de movimento."""

GRID_WIDTH = 10
GRID_HEIGHT = 7
VISION_RADIUS = 3
CELL_SIZE_PX = 64

# Quanto a distância pesa contra o desejo de ir atrás de uma comida vista.
DISTANCE_WEIGHT = 0.35

# Posições iniciais dos 3 agentes, espalhadas pelo grid.
DEFAULT_POSITIONS = {
    "A1": (1, 1),
    "A2": (8, 1),
    "A3": (4, 5),
}

# Energia: andar custa pouco, correr custa muito e cobre 2 células.
ENERGY_FULL = 100.0
WALK_ENERGY_COST = 1.0
RUN_ENERGY_COST = 5.0
RUN_STEPS = 2

# Abaixo do limiar, dorme; só acorda ao chegar no limiar de cima.
SLEEP_THRESHOLD = 10.0
WAKE_THRESHOLD = 90.0
SLEEP_ENERGY_GAIN = 10.0

# Quão perto um rival precisa estar da fruta alvo para valer a pena correr até ela.
RUN_RIVAL_RADIUS = 5

# Pesos do "vale a pena correr": energia alta + fome moderada + rival por perto.
# O viés negativo garante que, na dúvida, o macaco anda.
RUN_ENERGY_WEIGHT = 2.0
RUN_MODERATE_WEIGHT = 1.0
RUN_COMPETITION_WEIGHT = 1.8
RUN_BASE_BIAS = 3.2

# Aprendizado: pesos que o agente ajusta sozinho com o que vive, sem rede neural.
# Reforça pouco a cada tempo e limita numa faixa; sem reforço, deriva de volta
# pro valor original do agente (cada um tem seu próprio "normal").
LEARNABLE_WEIGHTS = ("hunger", "aversion", "corrida")
LEARNING_RATE = 0.015
WEIGHT_DECAY = 0.004
WEIGHT_MIN = 0.05
WEIGHT_MAX = 2.2
HUNGER_LEARN_THRESHOLD = 70.0
