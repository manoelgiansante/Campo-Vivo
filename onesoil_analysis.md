# Análise do OneSoil - Referência para CampoVivo

## Navegação Principal (Bottom Tab Bar)
- **Map** - Mapa principal com visualização de campos
- **Fields** - Lista de campos cadastrados
- **Notes** - Notas de campo/scouting
- **Profile** - Perfil do usuário

## Tela de Mapa (IMG_7816, IMG_7820, IMG_7821)

### Elementos de Interface:
- Header com dropdown "All fields" + "Season 2024"
- Botão de camadas (layers)
- Botão de busca
- Botão de adicionar (+)
- Mapa Mapbox com imagem de satélite
- Campos destacados com overlay de vegetação (NDVI)
- Escala de cores NDVI na lateral esquerda (vermelho → amarelo → verde)
- Botão de localização GPS
- Botão "Vegetation" flutuante no centro inferior
- Data da imagem de satélite exibida no campo ("22 de nov.")

### Modo de Desenho de Campo (IMG_7820, IMG_7821):
- Toggle "Select" / "Draw" no topo
- Pontos brancos para delimitar área
- Cálculo automático de área em hectares
- Botão "Undo" para desfazer
- Botão verde "Finish field boundary" com área calculada
- Campos existentes mostram área em labels (ex: "+ 8.2 ha")
- Campos já cadastrados em verde, novos em cinza

## Tela de Fields/Campos (IMG_7815, IMG_7819)

### Lista de Campos:
- Header "Fields" com dropdown "All fields"
- Botões: busca, adicionar (+), menu (...)
- Seção "No groups" com total de hectares
- Card de campo com:
  - Thumbnail do campo (miniatura do mapa)
  - Nome do campo ("pasto 1")
  - Área em hectares ("17.7 ha")
  - Indicador NDVI colorido (barra gradiente vermelho→verde)
  - Valor NDVI numérico ("0,74")
- Botão flutuante "Vegetation" no centro inferior

### Modal de Camadas (IMG_7819):
- Título "Map layer"
- 3 opções de visualização:
  - Satellite image (ícone de satélite)
  - Crop (ícone de trigo/planta)
  - Vegetation (ícone de folha) - selecionado
- Tipos de NDVI:
  - Basic NDVI (selecionado)
  - Contrasted NDVI
  - Average NDVI
  - Heterogenity NDVI

## Tela de Detalhes do Campo (IMG_7813, IMG_7814)

### Layout:
- Header com "Fields" e dropdown
- Card expansível com:
  - Nome do campo ("pasto 1")
  - Área ("17.7 ha")
  - Menu de opções (...)
- Mapa com NDVI overlay
  - Dropdown "Basic NDVI" no canto superior esquerdo
  - Botão de expandir mapa
  - Escala de cores NDVI na lateral
  - Logo Mapbox
  - Botão de informações

### Seção History:
- Título "History"
- Toggle "Hide cloudy days"
- Timeline horizontal com thumbnails de datas
  - Datas: "07 de nov.", "12 de nov.", "17 de nov.", "22 de nov."
  - Imagens em cinza quando nublado
  - Valor NDVI e variação ("+0,74")

### Seção de Cultivo:
- Indicador de cor (vermelho = Pasture/Pasto)
- Nome do cultivo ("Pasture")
- Botão de editar (lápis)
- Campos:
  - Planting date: "Not set"
  - Harvest date: "Not set"

## Tela de Notes (IMG_7818)

### Layout:
- Header "Notes" com dropdown "All fields"
- Card grande centralizado
- Estado vazio com:
  - Ícone de nota
  - Texto: "Add noted when you conduct field scouting or when you want to mark an important place on the map."
  - Botão verde "Add note" com ícone

## Paleta de Cores

### Cores Principais:
- Verde primário: #22C55E (botões, elementos ativos)
- Verde escuro: #166534 (textos, ícones)
- Cinza claro: #F5F5F5 (backgrounds)
- Branco: #FFFFFF (cards)
- Preto: #000000 (textos principais)

### Escala NDVI:
- Vermelho: baixo NDVI (estresse)
- Amarelo: médio NDVI
- Verde: alto NDVI (saudável)

## Tipografia
- Títulos: Bold, tamanho grande
- Subtítulos: Regular, cinza
- Números NDVI: Bold, alinhado à direita

## Elementos de UI Característicos
1. Bottom tab bar com 4 itens
2. Botões flutuantes centralizados (ex: "Vegetation")
3. Cards com cantos arredondados
4. Dropdowns para filtros
5. Thumbnails de campos com formato do polígono
6. Barras de progresso coloridas para NDVI
7. Timeline horizontal para histórico
8. Modais de seleção com ícones grandes
