# ZOMBIE ROYALE

Jogo simples de tiro e sobrevivência em 2D. A página principal funciona direto no navegador, sem servidor, instalação ou bibliotecas externas.

## Jogar

Abra `index.html` ou visite o site publicado no GitHub Pages.

Controles: `WASD` ou setas movem, mouse mira e atira, `1–4` troca de arma, `R` recarrega, `E` abre baús, `Space` esquiva, `Q` ativa um pulso elétrico e `F` levanta um escudo. No celular, use o joystick e os botões na tela.

Rafa, o atirador, ajuda a eliminar zumbis. Luna, a médica, cura você e os companheiros. Existem zumbis corredores e tanques, além de um chefe a cada cinco ondas.

## Versão 3D

`3d.html` contém o protótipo de terceira pessoa feito com Three.js. Rode `python3 -m http.server 8000` e abra `http://localhost:8000/3d.html`. Essa versão precisa de internet para carregar Three.js.

## Testes da lógica

Execute `npm test` para verificar movimento, munição, recarga, dano, baús e progressão das ondas.
