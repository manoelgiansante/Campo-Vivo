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


## Versão 4.0 - Implementar TODAS as Funcionalidades do OneSoil

### Funcionalidades Web do OneSoil (Implementar no Mobile)
- [ ] Gráficos de precipitação acumulada
- [ ] Gráficos de soma térmica
- [ ] Gráficos de alterações do NDVI por talhão
- [ ] Upload em massa de talhões (arquivo .shp, .kml, .geojson)
- [ ] Alocação automática de culturas para rotação
- [ ] Comparação de valores NDVI entre datas diferentes
- [ ] Comparação de imagens de satélite de diferentes datas
- [ ] Visualização de dados de computadores de bordo (maquinário)
- [ ] Agrupamento avançado de talhões

### Funcionalidades Mobile do OneSoil
- [ ] Campos pré-detectados (Select mode)
- [ ] Modo offline completo com sincronização
- [ ] Rotas de navegação GPS até anotações
- [ ] Recomendações de momento de pulverização
- [ ] Notificações push sobre mudanças no NDVI

### Funcionalidades Pro do OneSoil
- [ ] Mapas de prescrição (VRA) para semeadura/fertilização/pulverização
- [ ] Ferramenta de amostragem de solo
- [ ] Exportação de limites de talhões (.shp, .pdf, .kml, .gpx)
- [ ] Zonas de produtividade histórica
- [ ] Análise de rendimento
- [ ] Testes de campo A/B

### Modelo de Monetização
- [ ] Definir plano gratuito vs pago
- [ ] Implementar sistema de assinatura
- [ ] Trial de 14 dias para funcionalidades Pro


## Versão 2.2 - Integração NDVI Agromonitoring (Em Progresso)

### Backend
- [x] Criar serviço de integração com API Agromonitoring
- [x] Adicionar campo agroPolygonId ao schema de fields
- [x] Criar endpoint getLatestNdviImage para buscar imagens NDVI
- [x] Criar endpoint history para timeline de NDVI
- [x] Criar proxy /api/ndvi-image/:fieldId para evitar CORS
- [x] Criar proxy /api/ndvi-tiles/:fieldId/{z}/{x}/{y}.png para tiles
- [x] Testes de validação da API key

### Frontend
- [x] Criar hook useNdviOverlay para gerenciar overlays no Mapbox
- [x] Atualizar FieldDetailNew para usar proxy local de NDVI
- [x] Exibir overlay de imagem NDVI no mapa
- [x] Exibir badge de cobertura de nuvens
- [x] Fallback para gradiente sintético quando sem imagem

### Pendente
- [ ] Sincronizar campos com polígonos do Agromonitoring
- [ ] Criar polígono automaticamente ao criar campo
- [ ] Timeline com thumbnails reais de NDVI
- [ ] Seleção de data na timeline para mudar overlay


## Versão 3.0 - Interface Profissional (Estilo OneSoil)

### Visualização NDVI (Prioridade Alta)
- [x] Melhorar overlay NDVI com cores profissionais (vermelho→amarelo→verde)
- [x] Adicionar escala de cores lateral no card NDVI (0.0 a 1.0)
- [x] Implementar navegação entre datas com setas < >
- [x] Adicionar card separado para imagem de satélite
- [x] Mostrar data da imagem no título do card

### Gráficos de Análise (Prioridade Alta)
- [x] Gráfico de evolução NDVI ao longo do tempo (linha temporal)
- [x] Gráfico de precipitação acumulada
- [x] Gráfico de graus-dia de crescimento
- [x] Seletor de período personalizado (calendário)

### Lista de Campos (Prioridade Média)
- [ ] Thumbnails do polígono na lista de campos
- [ ] Melhorar layout da lista com área em hectares
- [ ] Sistema de temporadas (Seasons)
- [ ] Agrupamento de campos

### Informações do Campo (Prioridade Média)
- [x] Widget de clima atual (temperatura, precipitação, vento)
- [x] Adicionar cultivo ao campo (botão)
- [x] Adicionar data de plantio (botão)


## Correções Urgentes - Igualar ao OneSoil

### Overlay NDVI (CRÍTICO)
- [ ] Overlay NDVI com cores vibrantes (verde/amarelo/vermelho) visíveis
- [ ] Escala de cores VERTICAL dentro do card do mapa (0.0 a 1.0)
- [ ] Contorno do campo mais visível (branco no NDVI, preto no satélite)

### Design dos Cards
- [ ] Cards com bordas mais arredondadas e sombra suave
- [ ] Fundo branco nos cards
- [ ] Título do card com data e botões de navegação inline

### Gráficos
- [ ] Linha mais suave nos gráficos
- [ ] Área preenchida com gradiente
- [ ] Layout mais limpo com valores à direita


## Versão 3.1 - Vinculação Automática com Agromonitoring

- [x] Criar endpoint para criar polígono no Agromonitoring quando campo é criado
- [x] Atualizar lógica de criação de campo para vincular automaticamente
- [x] Testar criação de campo com vinculação automática

## Versão 3.2 - Tela Map com Overlay NDVI (Concluído)

- [x] Tela Map com overlay NDVI colorido em todos os campos (igual OneSoil)
- [x] Labels de área em hectares sobre cada campo no mapa
- [x] Escala de cores NDVI na lateral esquerda do mapa
- [x] Botão Vegetation para alternar visualização NDVI
- [x] Overlay NDVI recortado pelo contorno exato do polígono
- [x] Botão "Vincular todos os campos" no perfil para integrar com Agromonitoring
- [x] Endpoint linkAllToAgromonitoring para vincular campos existentes


## Versão 3.3 - Dados Meteorológicos Completos (Concluído)

### Backend - Open-Meteo Integration
- [x] Criar serviço de meteorologia com Open-Meteo (API gratuita)
- [x] Endpoint getByField - Clima atual e previsão 7 dias
- [x] Endpoint getHistorical - Dados históricos com precipitação e temperatura
- [x] Cálculo de soma térmica (graus-dia) com temperatura base configurável
- [x] Cálculo de precipitação acumulada

### Frontend - Componentes de Gráficos Profissionais
- [x] NdviChart - Gráfico de evolução NDVI com Recharts
- [x] PrecipitationChart - Gráfico de precipitação diária e acumulada
- [x] ThermalSumChart - Gráfico de soma térmica com meta de GDD
- [x] WeatherWidget - Widget de clima compacto e expandido
- [x] NdviColorScale - Escala de cores NDVI vertical

### Integração na Página FieldDetailPro
- [x] Widget de clima atual com temperatura, umidade e vento
- [x] Gráfico de NDVI com valor atual e classificação
- [x] Gráfico de precipitação com total acumulado
- [x] Gráfico de soma térmica com progresso para meta
- [x] Previsão de 7 dias com temperaturas e precipitação
- [x] Suporte a metas de GDD por tipo de cultura

### Página Weather Atualizada
- [x] Atualizar para usar nova estrutura de dados do Open-Meteo
- [x] Corrigir tipagem TypeScript
- [x] Recomendações agrícolas baseadas no clima


## Bugs Reportados

- [x] Erro 404 na rota /fields no Vercel (falta configuração SPA routing)
