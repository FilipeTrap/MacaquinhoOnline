# Adaptive Behavior Forest — V1

## Objetivo

Construir uma primeira versão simples de um agente comportamental para um único `Macaca fascicularis`.

V1:
- 1 agente
- fome
- alimentos
- pesos comportamentais
- decisão alimentar
- frontend simples mostrando a decisão

Não teremos ainda (na V1):
- múltiplos agentes
- movimento/grid
- sede, medo, dor ou energia
- memória complexa
- sons/sprites
- LLM
- treinamento de rede neural

> Atualização: múltiplos agentes, movimento/grid (mapa com posição e uma árvore de
> decisão de movimento separada) e sprites já existem no código atual — evoluções
> pós-V1 registradas aqui só para não perder o histórico da spec original.

## Arquitetura

O sistema será um **Adaptive Behavior Forest**.

```text
                AGENTE
                  │
          ┌───────┴────────┐
          │                │
        FOME          CARACTERÍSTICAS
          │                │
          └───────┬────────┘
                  ↓
          FOOD BEHAVIOR TREE
                  │
        ┌─────────┼─────────┐
        ↓         ↓         ↓
      BANANA    PEPINO     CASCA
        │         │          │
      SCORE     SCORE      SCORE
        │         │          │
        └─────────┼──────────┘
                  ↓
               SIGMOID
                  ↓
        intensidade/tendência
                  ↓
             COMPARAÇÃO
                  ↓
             DECISÃO
```

Não usar regras simples como `if hunger > 70: eat()`. Os fatores serão transformados em valores, multiplicados por pesos e combinados.

## Estado inicial

```json
{
  "id": "A1",
  "hunger": 70,
  "weights": {
    "hunger": 0.223
  },
  "food_preferences": {
    "banana": 1.0,
    "pepino": 0.5,
    "casca": 0.1
  }
}
```

`hunger` varia de `0` a `100`.

Normalização:

```text
hunger_normalized = hunger / 100
```

## Alimentos

Os alimentos continuam separados em `food_rules.json`.

Valores iniciais:

```text
banana: quality 1.0, preference 1.0
pepino: quality 0.5, preference 0.5
casca: quality 0.1, preference 0.1
```

São parâmetros configuráveis.

## Cálculo

Para cada alternativa alimentar:

```text
hunger_influence =
    hunger_normalized × hunger_weight

food_influence =
    food_preference × food_quality

raw_score =
    hunger_influence + food_influence
```

A arquitetura deve permitir adicionar posteriormente:

```text
experience
satiety
energy
fear
pain
social_context
```

sem reconstrução do sistema.

## Sigmoid

```text
sigmoid(x) = 1 / (1 + e^(-x))
```

A sigmoid transforma o `raw_score` em um valor entre `0` e `1`.

Exemplo:

```text
raw_score = 1.0
sigmoid(1.0) = 0.731
```

Não converter imediatamente para 0/1. O valor representa a intensidade/tendência do comportamento.

```text
0.0 → tendência muito baixa
0.5 → tendência intermediária
1.0 → tendência muito alta
```

Quando houver várias alternativas, a V1 pode simplesmente escolher o maior score. Softmax poderá ser adicionado depois para transformar os scores em probabilidades relativas.

## Competição entre alimentos

Exemplo:

```text
BANANA
raw_score → sigmoid → 0.87

PEPINO
raw_score → sigmoid → 0.61

CASCA
raw_score → sigmoid → 0.12
```

Resultado:

```text
banana = 0.87
pepino = 0.61
casca = 0.12

→ BANANA
```

## Regras fundamentais

1. Sem alimento, não existe decisão de comer.
2. `hunger` permanece entre 0 e 100.
3. O agente consome no máximo um alimento por decisão.
4. O alimento escolhido precisa existir no ambiente.
5. A decisão deve ser explicável pelos cálculos.
6. O backend aplica as consequências.
7. Não usar LLM.
8. Não há treinamento de rede neural na V1.

## Aprendizado futuro

Os pesos poderão mudar conforme a experiência.

Exemplo:

```text
agente passa muito tempo com fome
        ↓
hunger_weight aumenta
        ↓
fome exerce maior influência
        ↓
alimentos de baixa qualidade podem se tornar mais aceitáveis
```

Outro:

```text
agente come casca
        ↓
efeito negativo
        ↓
casca_preference diminui
        ↓
futuras decisões evitam mais a casca
```

A atualização adaptativa dos pesos será implementada depois que o núcleo V1 estiver funcionando.

## Backend

Usar:
- Python
- FastAPI

Endpoints:

```text
GET /health
POST /decision
POST /reset
```

### `/health`

```json
{
  "status": "ok"
}
```

### `/decision`

Entrada:

```json
{
  "agent": {
    "id": "A1",
    "hunger": 70,
    "weights": {
      "hunger": 0.223
    },
    "food_preferences": {
      "banana": 1.0,
      "pepino": 0.5,
      "casca": 0.1
    }
  },
  "environment": {
    "food": [
      "banana",
      "pepino",
      "casca"
    ]
  }
}
```

Resposta:

```json
{
  "decision": {
    "action": "EAT",
    "food": "banana"
  },
  "scores": {
    "banana": 0.87,
    "pepino": 0.61,
    "casca": 0.12
  }
}
```

Os valores são ilustrativos; o backend deve calcular os valores reais.

## Frontend

Criar com HTML/CSS/JavaScript puro.

Deve permitir:
- alterar a fome;
- escolher alimentos disponíveis;
- executar uma decisão;
- mostrar a decisão;
- mostrar score de cada alimento.

Visual simples:

```text
┌────────────────────────────────────┐
│       🐒 ADAPTIVE MONKEY           │
│                                    │
│ Fome: [========----] 70            │
│                                    │
│ Alimentos:                         │
│ ☑ 🍌 Banana                        │
│ ☑ 🥒 Pepino                        │
│ ☑ 🟤 Casca                         │
│                                    │
│        [ DECIDIR ]                 │
│                                    │
│ DECISÃO                            │
│                                    │
│ 🐒 → COMER BANANA                  │
│                                    │
│ Banana   ████████████████  0.87    │
│ Pepino   ███████████       0.61    │
│ Casca    ██                0.12     │
└────────────────────────────────────┘
```

O frontend é uma ferramenta de experimentação, não precisa ser sofisticado.

## Estrutura

```text
monkey-agent/
│
├── backend/
│   ├── main.py
│   ├── decision.py
│   ├── calculations.py
│   └── api.py
│
├── rules/
│   ├── behavior_rules.json
│   └── food_rules.json
│
├── model/
│   ├── for_trainer/
│   └── trained/
│
└── frontend/
    ├── index.html
    ├── style.css
    └── app.js
```

Os arquivos do antigo treinamento de LLM não são necessários para a V1.

## Primeiro objetivo técnico

Fazer funcionar:

```text
Frontend
   ↓
FastAPI
   ↓
Agent State
   ↓
Food Behavior Tree
   ↓
Weighted Calculation
   ↓
Sigmoid
   ↓
Score
   ↓
Decision
   ↓
JSON
   ↓
Frontend
```

Teste inicial:

```text
hunger = 70
food = [banana, pepino, casca]
```

O sistema deve calcular os três scores e apresentar qual alimento foi escolhido.

Depois testar:

```text
hunger = 0
hunger = 20
hunger = 50
hunger = 80
hunger = 100
```

e observar como os scores mudam.

## Filosofia

O objetivo não é criar um chatbot. É criar um **agente comportamental adaptativo**.

```text
ESTADO
   +
AMBIENTE
   +
PESOS INDIVIDUAIS
   +
REGRAS COMPORTAMENTAIS
        ↓
CÁLCULOS
        ↓
SCORES
        ↓
DECISÃO
        ↓
CONSEQUÊNCIA
        ↓
ATUALIZAÇÃO FUTURA DOS PESOS
```

Toda decisão deve ser inspecionável.

Queremos conseguir visualizar algo como:

```text
Fome: 80
Peso da fome: 0.223
Preferência banana: 1.0
Qualidade banana: 1.0

→ cálculo
→ sigmoid
→ score = X

Pepino:
→ score = Y

Casca:
→ score = Z

→ maior score = banana
→ ação = EAT
```

A arquitetura deve permitir adicionar novos comportamentos gradualmente sem depender de treinamento de uma IA.
