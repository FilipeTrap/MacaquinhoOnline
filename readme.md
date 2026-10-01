# Recinto — macacos que aprendem sozinhos

Simulação no navegador de um recinto com **três macacos**. Cada um tem um cérebro próprio (rede neural) que começa vazio e aprende só com o que acontece dentro do recinto — inspirado no experimento clássico da “escada e banana” / conformidade social.

**Rodar:** abra `index.html` no navegador (duplo clique ou um servidor estático local). Não precisa de backend.

---

## O experimento

1. Rode em **25×** ou **200×** até quase ninguém mais subir a escada (uns 30 dias).
2. Desligue a água fria.
3. Troque um macaco por vez e veja se os novatos ainda apanham.
4. Depois de trocar os três: ninguém do grupo atual levou água — e mesmo assim batem em quem sobe?

A ideia: a punição pode se manter por **imitação / norma do grupo**, não só por ter levado água pessoalmente.

---

## O recinto

| Elemento | O que é |
|----------|---------|
| **Pepinos** (canto esquerdo) | Comida do chão. O macaco precisa **andar até lá** para comer. |
| **Escada da banana** (direita) | Sobe em etapas. No topo tem a banana. |
| **Escada vazia + piso alto** | Lugar mais calmo; dá para fugir de quem se teme. |
| **Chuveiro** | Se alguém pega a banana e a água está ligada, os **outros** levam água fria **onde estiverem**. |

Movimento é **passo a passo** (sem teleporte): chão ↔ loft só pela escada vazia; topo da banana só pela escada da banana.

---

## Necessidades e emoções

Cada macaco tem:

- **Fome, energia, vida, felicidade**
- **Raiva** e **medo** dirigidos a cada outro macaco (sobe ao apanhar; baixam devagar — medo mais devagar que raiva)

### Fome

| Nível | Comportamento |
|-------|----------------|
| **≥ 70** | Começa a procurar comida |
| **≥ 90** | Procura forte → vai ao pepino |
| **100** | Desespero → tenta a **banana** se houver; senão pepino |

### Energia e vida

- Energia muito baixa → **10 tempos** dormindo parado.
- Vida &lt; 10 → **10 tempos** parado se recuperando.

### Medo

Medo alto de alguém → fica longe (prefere o loft), **exceto** quando a fome manda buscar comida.

---

## Ações

- Descansar, comer pepino, dormir  
- Subir a escada da banana  
- Bater / **sacudir a escada** (do pé dela, derruba quem está subindo)  
- Catar outro macaco (só funciona no outro, não em si mesmo)

Ícones acima da cabeça: 🍽️ comer · 💤 dormir · 🧗 subir · 👊 bater/sacudir · 🤲 catar.

---

## Aprendizado

- Cada macaco tem uma rede Q que vê fome, energia, vida, felicidade, banana, e (por outro) se sobe, raiva/medo nos dois sentidos, se dorme.
- Aprende com recompensa ligada a felicidade/vida, curiosidade e **conformidade** (imitação do grupo).
- Slider **Conformidade**: vontade de agir como o grupo (ex.: sacudir quem sobe).
- Slider **Curiosidade**: prazer em testar ações pouco usadas.
- Você pode **recompensar** ou **punir** a última ação do macaco selecionado.

Quando alguém sobe, os outros podem priorizar sacudir a escada (raiva, memória de quem já levou água, ou norma observada) — desde que não estejam em fome extrema.

---

## Controles

- **Rodar / Pausar**, **Avançar 1 instante**, velocidades **1× · 5× · 25× · 200×**
- Clique num macaco (ou nas abas) para ver barras, histórico e valores Q
- **Trocar macaco** / **Recomeçar do zero**
- Ligar/desligar água fria

---

## Estrutura do código

```
index.html          página
css/style.css       visual
js/config.js        constantes do mapa e da rede
js/network.js       rede neural / aprendizado
js/emotions.js      necessidades, raiva, medo
js/actions.js       comer, bater, caminho, escadas
js/policy.js        escolha de ação
js/sim.js           loop da simulação
js/render.js        desenho no canvas
js/ui.js            painel e controles
js/main.js          boot
```

Só frontend: HTML + CSS + JS puro.

---

## Repo

[github.com/FilipeTrap/MacaquinhoOnline](https://github.com/FilipeTrap/MacaquinhoOnline)
