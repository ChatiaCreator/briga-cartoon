# Briga Cartoon

Jogo de luta cartoon 2.5D que roda no navegador, com **Hotmonster**, **Flash** e **Genildo**. Dá para jogar online com um amigo, em 2 jogadores no mesmo PC ou contra o computador.

**Jogar:** https://chatiacreator.github.io/briga-cartoon/

Feito com [three.js](https://threejs.org/) (personagens 3D) e [PeerJS](https://peerjs.com/) (online direto entre os dois navegadores). Não tem etapa de build: são só arquivos estáticos.

## Como jogar

| Ação | Teclado (jogador 1 / online / CPU) | Jogador 2 (mesmo PC) | Controle |
|---|---|---|---|
| Mover / pular / agachar | `W A S D` (online e CPU: setas também) | Setas | Analógico ou direcional |
| Soco fraco / forte | `J` / `K` | `,` / `.` | X / Y |
| Chute fraco / forte | `U` / `I` | `M` / `N` | A / B |
| SUPER (barra cheia) | `O` | `/` | RB |
| Atalho do especial | `L` | Num 6 | LB |
| VOADORA / ESTRELA | `H` / `Y` | `Ç` / `~` (Num 7 / 8) | LT / RT |
| Pausa / menu | `Esc` | | |

- **Especial:** `↓ ↘ →` + soco, ou o atalho.
  - **Hotmonster:** arremessa um saco de ração em arco.
  - **Flash:** dá uma investida relâmpago.
  - **Genildo** (policial militar): saca a pistola e atira.
- **Super:** precisa da barra cheia, que enche quando você bate e quando apanha.
  - **Hotmonster:** chuva de sacos de ração do céu.
  - **Flash:** bebe **GARRA Energy** e ganha +50% de dano e +20% de velocidade por 8 segundos.
  - **Genildo:** **TOLERÂNCIA ZERO**, uma rajada de 5 tiros.
- **VOADORA:** corre e chuta voando. Acerta no alto, então só é defendida em pé.
- **ESTRELA:** estrela com chute que derruba.
- **Sequência de socos:** apertando soco fraco seguido saem até 4 socos.
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

1. Envie esta pasta para um repositório no GitHub (sem `tools/mixamo/in/`, se quiser economizar espaço).
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
  poses.js                qual animação cada estado/golpe usa, e em que trecho
  scene.js, effects.js    arena, câmera, explosões "POW!", ração, lata, aura
src/net/                  lockstep (online) e salas PeerJS
src/cpu.js                inteligência do computador
assets/models/            hotmonster.glb, flash.glb, genildo.glb, mixamo_anims.glb (animações do Mixamo convertidas)
tools/mixamo/             conversor de animações do Mixamo (.fbx) para os lutadores
assets/can/garra.svg      rótulo da lata GARRA Energy
vendor/                   three.js 0.170.0 e PeerJS 1.5.4 (cópias locais)
```

## Animações

Os golpes, o andar, o pulo, a defesa e o levantar vêm de animações do [Mixamo](https://www.mixamo.com/). As reações a golpes, as quedas, as entradas e as comemorações vêm dos próprios modelos. O que não tem animação (agachar e golpes agachados) é feito no código, com IK.

Os ossos do Mixamo têm os mesmos nomes dos ossos dos modelos, mas ficam virados de outro jeito. Por isso as animações passam por um conversor. Para adicionar uma animação nova:

1. Baixe no Mixamo como **FBX Binary**, **Without Skin**, 30 fps.
2. Coloque o arquivo em `tools/mixamo/in/`.
3. Com o servidor local rodando (`python3 -m http.server 8765`), rode `node tools/mixamo/convert.cjs`. Ele precisa do Playwright.
4. Ligue a animação (o nome do arquivo, sem `.fbx`) ao golpe ou estado em `src/render/poses.js`.

## Créditos

- **Personagens:** Hotmonster, Flash e Genildo, do autor do jogo.
- **GARRA Energy:** marca fictícia criada para o jogo.
- **Bibliotecas:** three.js (MIT) e PeerJS (MIT). As licenças estão em `vendor/`.
