# Briga Cartoon

Jogo de luta cartoon 2.5D que roda no navegador: **Hotmonster × Flash**. Dá para jogar online com um amigo, em 2 jogadores no mesmo PC ou contra o computador.

Feito com [three.js](https://threejs.org/) (personagens 3D) e [PeerJS](https://peerjs.com/) (online direto entre os dois navegadores). Não tem etapa de build: são só arquivos estáticos.

## Como jogar

| Ação | Teclado (jogador 1 / online / CPU) | Jogador 2 (mesmo PC) | Controle |
|---|---|---|---|
| Mover / pular / agachar | `W A S D` (online e CPU: setas também) | Setas | Analógico ou direcional |
| Soco fraco / forte | `J` / `K` | `,` / `.` | X / Y |
| Chute fraco / forte | `U` / `I` | `M` / `N` | A / B |
| SUPER (barra cheia) | `O` | `/` | RB / RT |
| Atalho do especial | `L` | Num 6 | LB / LT |
| Pausa / menu | `Esc` | | |

- **Especial:** `↓ ↘ →` + soco, ou o atalho.
  - **Hotmonster:** arremessa um saco de ração em arco.
  - **Flash:** dá uma investida relâmpago.
- **Super:** precisa da barra cheia, que enche quando você bate e quando apanha.
  - **Hotmonster:** chuva de sacos de ração do céu.
  - **Flash:** bebe **GARRA Energy** e ganha +50% de dano e +20% de velocidade por 8 segundos.
- **Defesa:** segure para trás. Agachado, você também defende os golpes baixos (rasteira e chute baixo). Golpes no ar só são defendidos em pé.
- **Combos:** um golpe que acerta pode ser cancelado num mais forte. Exemplo: soco fraco → soco forte → especial → super.
- **Partida:** melhor de 3 rounds, com 99 segundos por round.

## Online

1. Quem cria clica em **Jogar online → Criar sala** e manda o código de 6 letras (ou o link pelo botão "Copiar link").
2. O amigo abre o jogo, clica em **Jogar online**, digita o código e clica em **Entrar**.

A conexão é direta entre os dois navegadores. O servidor público gratuito do PeerJS só serve para os dois se encontrarem.

- **Atraso de entrada:** é calculado automaticamente pelo ping, entre 2 e 8 quadros.
- **Redes corporativas e alguns 4G:** podem bloquear conexões diretas. Se isso acontecer, tentem outra rede.
- **Versão do jogo:** os dois precisam estar com a mesma versão. Se aparecer aviso de versão, recarreguem a página.

## Rodar no seu computador

O navegador não abre módulos JavaScript direto do disco (`file://`), então é preciso um servidor local. Na pasta do projeto, rode:

```bash
python3 -m http.server 8000
```

Depois abra `http://localhost:8000`.

Os testes da simulação (regras, golpes, determinismo e netcode) precisam de Node 18 ou mais novo:

```bash
npm test
```

## Publicar no GitHub Pages

1. Envie esta pasta para um repositório no GitHub.
2. No repositório, vá em **Settings → Pages → Build and deployment**.
3. Em Source, escolha **Deploy from a branch**, depois a branch `main` e a pasta `/ (root)`.
4. O jogo fica em `https://SEU-USUARIO.github.io/NOME-DO-REPO/`.

## Organização do código

```
index.html, style.css     menus e HUD
src/main.js               telas, partida e loop principal (simulação fixa a 60 Hz)
src/sim/                  simulação determinística (só números inteiros, sem three.js)
  moves.js                atributos dos personagens e frame data dos golpes  ← balanceamento aqui
  fighter.js              máquina de estados do lutador
  game.js                 rounds, timer, acertos, defesa, empurrões
src/render/
  character.js            carrega o GLB, contorno cartoon, IK de braços e pernas
  poses.js                pose de cada estado/golpe (clipes box_* + poses procedurais)
  scene.js, effects.js    arena, câmera, explosões "POW!", ração, lata, aura
src/net/                  lockstep (online) e salas PeerJS
src/cpu.js                inteligência do computador
assets/models/            hotmonster.glb, flash.glb
assets/can/garra.svg      rótulo da lata GARRA Energy
vendor/                   three.js 0.170.0 e PeerJS 1.5.4 (cópias locais)
```

## Animações

Os modelos vieram com animações de boxe (`box_01` a `box_03`). Elas são usadas para:

- a guarda parada;
- o soco fraco;
- o soco forte.

Os outros movimentos são poses feitas no código, com IK: andar, agachar, chutes, pulo com cambalhota, levar golpe, queda, beber a lata e comemorar.

Os dois personagens usam o esqueleto do Mixamo. Por isso, qualquer animação baixada do [Mixamo](https://www.mixamo.com/) serve nos dois. Para trocar uma animação procedural por uma do Mixamo:

1. Baixe como FBX "Without Skin".
2. Converta para GLB, por exemplo no Blender.
3. Ligue a animação ao estado correspondente em `src/render/poses.js`.

## Créditos

- **Personagens:** Hotmonster e Flash, do autor do jogo.
- **GARRA Energy:** marca fictícia criada para o jogo.
- **Bibliotecas:** three.js (MIT) e PeerJS (MIT). As licenças estão em `vendor/`.
