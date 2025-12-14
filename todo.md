# CampoVivo - TODO

## Versão 1.0 (Concluído)
- [x] Sistema de autenticação de usuários
- [x] Perfis de agricultores, agrônomos e consultores
- [x] Página de perfil do usuário
- [x] Cadastro de campos agrícolas
- [x] Edição de campos
- [x] Visualização de propriedades
- [x] Listagem de campos do usuário
- [x] Integração com Google Maps
- [x] Visualização geográfica dos campos
- [x] Desenho de áreas de cultivo no mapa
- [x] Coordenadas GPS para campos
- [x] Previsão de tempo de 5 dias por campo
- [x] Alertas de precipitação
- [x] Criação de notas durante scouting
- [x] Upload de fotos nas notas
- [x] Histórico de plantios por campo
- [x] Sugestões automáticas de cultivos
- [x] Visualização de índices NDVI
- [x] Cache de dados para acesso offline
- [x] Indicador de status de conexão
- [x] Dashboard com visão geral
- [x] Sistema de alertas importantes

## Versão 2.0 - Redesign OneSoil Style (Concluído)

### Navegação
- [x] Implementar bottom tab bar com 4 abas (Map, Fields, Notes, Profile)
- [x] Remover sidebar e usar navegação mobile-first
- [x] Adicionar transições suaves entre telas

### Tela de Mapa
- [x] Mapa em tela cheia com Google Maps satélite
- [x] Header com dropdown "All fields" + "Season"
- [x] Botão de camadas (layers) para alternar visualizações
- [x] Overlay de NDVI nos campos com escala de cores
- [x] Escala de cores NDVI na lateral (vermelho→amarelo→verde)
- [x] Botão flutuante "Vegetation" centralizado
- [x] Botão de localização GPS
- [x] Modo de desenho de campo com pontos
- [x] Toggle Select/Draw no topo
- [x] Cálculo automático de área em hectares
- [x] Botão Undo para desfazer pontos
- [x] Botão "Finish field boundary" com área

### Tela de Fields
- [x] Lista de campos com thumbnails do polígono
- [x] Indicador NDVI colorido (barra gradiente)
- [x] Valor NDVI numérico ao lado
- [x] Total de hectares por grupo
- [x] Modal de seleção de camadas (Satellite, Crop, Vegetation)
- [x] Opções de NDVI (Basic, Contrasted, Average, Heterogenity)

### Tela de Detalhes do Campo
- [x] Card expansível com nome e área
- [x] Mapa com overlay NDVI
- [x] Dropdown para tipo de NDVI
- [x] Seção History com timeline horizontal
- [x] Thumbnails de datas com imagens NDVI
- [x] Toggle "Hide cloudy days"
- [x] Valor NDVI e variação (+/-)
- [x] Seção de cultivo com cor indicadora
- [x] Campos de Planting date e Harvest date

### Tela de Notes
- [x] Estado vazio com ilustração e texto explicativo
- [x] Botão verde "Add note" centralizado
- [x] Lista de notas com localização no mapa

### Tela de Profile
- [x] Informações do usuário
- [x] Configurações do app
- [x] Opção de logout

### Estilo Visual
- [x] Paleta de cores verde OneSoil (#22C55E)
- [x] Cards com cantos arredondados
- [x] Botões flutuantes centralizados
- [x] Tipografia bold para títulos
- [x] Backgrounds cinza claro (#F5F5F5)


## Versão 2.1 - Integração Mapbox (Concluído)

### Mapbox
- [x] Instalar Mapbox GL JS
- [x] Configurar token do Mapbox
- [x] Criar componente MapboxMap
- [x] Substituir Google Maps por Mapbox na tela de Mapa
- [x] Substituir Google Maps por Mapbox na tela de desenho de campo
- [x] Substituir Google Maps por Mapbox nos detalhes do campo
- [x] Configurar estilo de satélite igual ao OneSoil
- [x] Instalar turf.js para cálculos geográficos


## Versão 2.2 - Gradiente NDVI igual OneSoil (Em Progresso)

- [ ] Usar tiles NDVI do Agromonitoring com gradiente de cores
- [ ] Implementar overlay com variação vermelho→amarelo→verde
- [ ] Recortar tiles pelo contorno exato do polígono
- [ ] Atualizar endpoint de proxy para tiles
