# Fight Friends

Jogo de luta cartoon 2.5D que roda no navegador, com **Hotmonster**, **Flash**, **Genildo**, **Anderson Silva**, **HGL** e **Davidson**, e o primeiro BOSS, **Trump**. Dá para jogar online com um amigo, em 2 jogadores no mesmo PC ou contra o computador, em três cenários: a **rua** ao pôr do sol, a **praia**, o **Pet Shop Canaã**, o **Marco Zero**, **Brasília** e a **Casa Branca** (o cenário do BOSS: no "Sorteio", sai sempre que o Trump está na luta, e nunca sem ele).

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
  - **Anderson Silva:** **ARMADA**, chute giratório de capoeira que avança e derruba.
  - **HGL** (mecânico): **CARRINHO**, desliza por baixo dos golpes altos e dos tiros e derruba. Só é defendido agachado.
  - **Trump** (BOSS, mais vida, mais lento e pesado): **TARIFAÇO**, um direto longo que avança e derruba.
- **Super:** precisa da barra cheia, que enche quando você bate e quando apanha.
  - **Hotmonster:** chuva de sacos de ração do céu.
  - **Flash:** bebe **GARRA Energy** e ganha +50% de dano e +20% de velocidade por 8 segundos.
  - **Genildo:** **TOLERÂNCIA ZERO**, uma rajada de 5 tiros.
  - **Anderson Silva:** **LIGANDO PRA CASADA**, faz uma ligação e recupera vida. No começo ninguém acerta ele; depois, se apanhar, a ligação cai.
  - **HGL:** **CHAVE DE FENDA**, arremessa a chave de fenda girando no inimigo e derruba.
  - **Trump:** **VOCÊ ESTÁ DEMITIDO!**, aponta o dedo rindo e arremessa o adversário para o outro lado, mesmo de média distância.
- **VOADORA:** corre e chuta voando. Acerta no alto, então só é defendida em pé.
- **ESTRELA:** estrela com chute que derruba.
- **AGARRÃO:** colado no adversário, para frente (ou para trás) + soco forte. Joga o adversário por cima do ombro e ele cai do outro lado. Não dá para defender: para escapar, aperte soco forte logo que for agarrado.
- **ESQUIVA:** toque duas vezes para trás (no celular, puxe o direcional duas vezes). O lutador abaixa e escapa para trás, sem poder ser acertado no começo.
- **Sequência de socos:** apertando soco fraco seguido saem até 4 socos.
- **Defesa:** segure para trás. Agachado, você também defende os golpes baixos (rasteira e chute baixo). Golpes no ar só são defendidos em pé.
- **Combos:** um golpe que acerta pode ser cancelado num mais forte. Exemplo: soco fraco → soco forte → especial → super.
  - Golpes fracos emendam entre si (até 4 seguidos).
  - No meio de um combo, o lutador dá um passinho à frente sozinho para o próximo golpe alcançar, então um combo que começou acertando continua acertando.
  - O especial (`↓ ↘ →` + soco ou o atalho) tem prioridade sobre a sequência do lutador: soco forte → atalho do especial sai especial mesmo no Flash.
- **Lançar:** `↓` + soco forte joga o adversário para cima. Segure `↑` para pular atrás dele e bater no ar (até 3 golpes antes de ele cair).
  - **Combo aéreo:** no ar, um golpe fraco que acerta pode ser cancelado em outro golpe. Exemplo: `↓` + soco forte, segure `↑`, depois soco → chute → chute forte (4 acertos).
- **Segunda sequência (chute que derruba):** Hotmonster soco forte → chute forte (giratório); Flash chute → chute forte (de costas); Genildo soco forte → chute forte; Anderson soco, soco → chute forte; HGL soco forte → chute forte (machado, quica no chão); Davidson soco forte → chute forte (giratório voador).
- **Sequência de cada lutador:**
  - **Hotmonster, FÚRIA DO MONSTRO:** soco, soco, soco forte. O adversário quica no chão e dá para emendar o especial.
  - **Flash, UPPER RELÂMPAGO:** soco forte, soco forte (cotovelada e uppercut que lança). Depois, pule e chute no ar, ou use o especial.
  - **Genildo, ENQUADRO:** chute, chute, soco forte (joelhada, joelhada, uppercut que lança). Depois, o tiro do especial acerta no ar.
  - **Anderson Silva, ARMADA DO ANDERSON:** soco forte, chute forte (cotovelada e armada de capoeira que lança). Depois, pule e chute no ar.
  - **HGL, CABEÇADA ILEGAL:** chute, soco forte (cabeçada que lança). Depois, pule e acerte a bicicleta no ar.
- **Contador de combo:** mostra os golpes e o dano total; combos grandes ganham "BOM!", "BRUTAL!" e "INSANO!".
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
src/net/                  rollback (online, igual jogos de luta profissionais) e salas PeerJS
src/cpu.js                inteligência do computador
assets/models/            os lutadores e anims.glb (todas as animações), comprimidos para o jogo abrir rápido
tools/models_src/         os modelos originais e as animações convertidas, sem compressão
tools/optimize/           gera assets/models/ a partir de tools/models_src/
tools/mixamo/             conversor de animações do Mixamo (.fbx) para os lutadores
assets/can/garra.svg      rótulo da lata GARRA Energy
vendor/                   three.js 0.170.0 e PeerJS 1.5.4 (cópias locais)
```

## Animações

Os golpes, o andar, o pulo, a defesa, o agachar e o levantar vêm de animações do [Mixamo](https://www.mixamo.com/). As reações a golpes, as quedas, as entradas e as comemorações vêm dos próprios modelos.

Os ossos do Mixamo têm os mesmos nomes dos ossos dos modelos, mas ficam virados de outro jeito. Por isso as animações passam por um conversor. Para adicionar uma animação nova:

1. Baixe no Mixamo como **FBX Binary**, **Without Skin**, 30 fps.
2. Coloque o arquivo em `tools/mixamo/in/`.
3. Com o servidor local rodando (`python3 -m http.server 8765`), rode `node tools/mixamo/convert.cjs`. Ele precisa do Playwright.
4. Ligue a animação (o nome do arquivo, sem `.fbx`) ao golpe ou estado em `src/render/poses.js`.
5. Gere os arquivos leves do jogo: `cd tools/optimize && npm install && node build.mjs`. Só entram as animações que o código usa.

Um lutador novo segue o mesmo caminho: o `.glb` vai para `tools/models_src/`, entra na lista `FIGHTERS` de `tools/optimize/build.mjs` e em `src/sim/moves.js`.

## Blender

Os scripts em `tools/blender/` rodam no Blender sem abrir a janela (testado no Blender 5.3):

```bash
blender -b --factory-startup -P tools/blender/props.py              # objetos de mão -> assets/models/props.glb
blender -b --factory-startup -P tools/blender/whitehouse_props.py   # pilastras da Casa Branca -> assets/models/whitehouse_props.glb
blender -b --factory-startup -P tools/blender/mirror_anim.py -- tools/mixamo/in/X.fbx tools/mixamo/in/X_Mirror.fbx  # golpe espelhado
```

- **props.py:** a lata GARRA, o saco de ração, o baseado, a chave de fenda e a pistola. O jogo aplica o material cartoon e o contorno preto; sem o arquivo, volta para as formas simples.
- **whitehouse_props.py:** as pilastras com lanterna em 3D na praça da Casa Branca, que se mexem com a câmera na frente da pintura.
- **mirror_anim.py:** espelha um golpe do Mixamo (a outra perna ou o outro braço). O resultado passa pelo conversor normal.

O conversor (`tools/mixamo/convert.html`) também aceita o esqueleto padrão da Unreal: as animações da *Universal Animation Library* da Quaternius ficam em `tools/mixamo/in_ual/` (fora do git) e as escolhidas em `UAL_CLIPS` (`convert.cjs`) vão para `tools/models_src/ual_anims.glb`.

## Créditos

- **Personagens:** Hotmonster, Flash, Genildo, Anderson Silva, HGL e Davidson, do autor do jogo.
- **Animações:** Mixamo (Adobe), o pacote *Martial Arts* da Motifect (usado no jogo conforme a licença; os arquivos originais não estão no repositório) e a *Universal Animation Library* da Quaternius (CC0, domínio público).
- **GARRA Energy:** marca fictícia criada para o jogo.
- **Bibliotecas:** three.js (MIT), PeerJS (MIT) e o decodificador do meshoptimizer (MIT). As licenças estão em `vendor/`.
