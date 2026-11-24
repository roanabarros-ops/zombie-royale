# ZOMBIE ROYALE

Jogo de ação e sobrevivência em 3D, com campanha de quatro níveis, zonas urbanas tomadas, armas e resgates. Rafa ajuda a atirar e Luna cura. Cada resgate entrega a armadura necessária para entrar no nível seguinte; a armadura absorve parte do dano.

## Jogar

Abra `index.html` ou visite o site publicado no GitHub Pages. A versão 3D carrega Three.js pela internet. Para testar localmente, rode `python3 -m http.server 8000` e abra `http://localhost:8000/`.

Controles: `WASD` ou setas movem, mouse mira e atira, `1–4` troca de arma, `R` recarrega, `E` interage e salva amigos, `Space` esquiva, `Q` ativa um pulso elétrico, `F` levanta um escudo e `C` usa um kit médico. A voz do protagonista usa a síntese de fala do navegador; o botão VOZ liga e desliga as falas.

`2d.html` preserva a versão 2D. Na campanha 3D, elimine a horda, encontre a pessoa presa e use `E` para resgatá-la. O último nível tem um chefe.

## Testes da lógica

Execute `npm test` para verificar movimento, munição, recarga, dano, baús e progressão das ondas.
