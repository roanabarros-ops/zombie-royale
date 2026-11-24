# Continuação — ZOMBIE ROYALE

## Pedido do jogador

- Fazer o personagem andar no computador com `A`, `W`, `S`, `D`.
- Fazer a munição durar mais.
- Mudar de cidade a cada nível/onda.
- Manter os ajudantes Rafa e Luna e os poderes já adicionados.

## Publicado

O site público é <https://roanabarros-ops.github.io/zombie-royale/>. O último commit publicado é `b150fa2` (`Add squad helpers and survivor powers`). Ele inclui Rafa atirando, Luna curando, esquiva (`Space`), pulso (`Q`), escudo (`F`) e controles de toque.

## Alterações locais concluídas nesta retomada

- Movimento aceita `event.code` e `event.key`; o canvas recebe foco ao iniciar e as teclas são limpas ao perder foco.
- Câmera segue o personagem suavemente, e a mira do mouse acompanha a câmera.
- Colisões, desenho dos prédios e árvores, cores e nome da região usam o tema selecionado para cada onda.
- Munição ampliada e arquivos `zombie-royale-simples.html` e `zombie-royale-download.zip` sincronizados com `index.html`.
- Documentação atualizada. Sintaxe JavaScript conferida e `npm test` passou (6 testes).
- A versão 3D virou a página principal (`index.html`); a versão 2D foi preservada em `2d.html`.
- O protótipo 3D recebeu Rafa (atirador), Luna (médica), esquiva, pulso, escudo e mudança de região por onda.
- Campanha de quatro níveis com armaduras por nível, dano absorvido pela armadura, amigos em celas para resgate e falas narradas em português com legendas.
- Adicionei superfícies com textura procedural, um chefe no último nível e uma tela de conclusão da campanha.

## Próximos passos

1. Revisar a versão 3D no navegador, inclusive os poderes, a voz e a campanha de resgate.
2. Publicar no GitHub Pages quando solicitado.

## Estado do repositório

As alterações estão locais e não commitadas. A página publicada ainda corresponde ao commit `b150fa2`.
