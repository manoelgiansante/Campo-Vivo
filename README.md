# Campo Vivo - Monitoramento Agrícola

Plataforma de monitoramento agrícola com suporte a **Web**, **iOS** e **Android**.

## 🚀 Estrutura do Projeto

```
campovivo/
├── client/           # Frontend Web (React + Vite)
├── mobile/           # App Mobile (Expo + React Native)
├── api/              # API Serverless (Vercel Functions)
├── server/           # Servidor local de desenvolvimento
└── shared/           # Código compartilhado
```

## 📱 Plataformas Suportadas

### Web (PWA)
- Acesse pelo navegador
- Instalável como app (PWA)
- Funciona offline com Service Worker

### iOS
- App nativo via Expo
- Disponível na App Store

### Android
- App nativo via Expo
- Disponível na Play Store

## 🛠️ Desenvolvimento

### Pré-requisitos
- Node.js 18+
- pnpm (recomendado) ou npm
- Expo CLI (para mobile)

### Instalação

```bash
# Instalar dependências do projeto web
pnpm install

# Instalar dependências do mobile
cd mobile && npm install
```

### Executar em desenvolvimento

**Web:**
```bash
pnpm dev
```

**Mobile (iOS/Android):**
```bash
cd mobile
npm start
# Pressione 'i' para iOS ou 'a' para Android
```

## 🏗️ Build de Produção

### Web
```bash
pnpm build
```

### Mobile
```bash
cd mobile

# Build para iOS
eas build --platform ios

# Build para Android
eas build --platform android
```

## 🔧 Configuração

### Variáveis de Ambiente

**Web (.env):**
```env
DATABASE_URL=postgresql://...
AGROMONITORING_API_KEY=...
MAPBOX_ACCESS_TOKEN=...
```

**Mobile (.env):**
```env
EXPO_PUBLIC_API_URL=https://campovivo.vercel.app
```

## 📦 Deploy

### Vercel (Web + API)
```bash
vercel
```

### EAS (Mobile)
```bash
cd mobile
eas submit --platform ios
eas submit --platform android
```

## 🗺️ Funcionalidades

- ✅ Mapa interativo com campos
- ✅ Monitoramento NDVI via satélite
- ✅ Previsão do tempo
- ✅ Notas e observações de campo
- ✅ Gestão de cultivos
- ✅ Alertas e notificações
- ✅ Modo offline (PWA)

## 📄 Licença

MIT
