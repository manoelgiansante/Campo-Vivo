# Campo Vivo Mobile

Aplicativo móvel do Campo Vivo - Sistema de Gestão Agrícola.

## 🚀 Tecnologias

- **Expo SDK 52** - Framework React Native
- **Expo Router** - Navegação baseada em arquivos
- **React Query** - Gerenciamento de estado do servidor
- **Zustand** - Gerenciamento de estado local
- **TypeScript** - Tipagem estática

## 📱 Plataformas Suportadas

- ✅ iOS
- ✅ Android
- ✅ Web

## 🛠️ Instalação

```bash
# Instalar dependências
npm install

# Iniciar o servidor de desenvolvimento
npm start
```

## 📲 Executar no dispositivo

### iOS (Simulator)
```bash
npm run ios
```

### Android (Emulator)
```bash
npm run android
```

### Web
```bash
npm run web
```

## 📁 Estrutura do Projeto

```
mobile/
├── app/                    # Telas (Expo Router)
│   ├── (tabs)/            # Telas com tab bar
│   │   ├── index.tsx      # Mapa (home)
│   │   ├── fields.tsx     # Lista de campos
│   │   ├── notes.tsx      # Notas de campo
│   │   └── profile.tsx    # Perfil do usuário
│   ├── fields/            # Telas de campos
│   │   ├── new.tsx        # Novo campo
│   │   └── [id].tsx       # Detalhes do campo
│   └── _layout.tsx        # Layout principal
├── components/            # Componentes reutilizáveis
│   └── ui/               # Componentes de UI
├── constants/            # Constantes e tema
├── contexts/             # Contextos React
├── hooks/                # Custom hooks
├── lib/                  # Utilitários
├── store/                # Zustand stores
└── assets/               # Imagens e fontes
```

## 🎨 Tema

O app usa um sistema de tema com suporte a modo claro e escuro.

Cores principais:
- Verde primário: `#16a34a`
- Verde claro: `#22c55e`
- Verde escuro: `#15803d`

## 🔗 Conexão com API

O app se conecta ao servidor backend via tRPC. Configure a URL da API no arquivo de ambiente:

```env
EXPO_PUBLIC_API_URL=http://seu-servidor:5000
```

## 📦 Build

### Desenvolvimento
```bash
npx expo start
```

### Produção (EAS Build)
```bash
# iOS
eas build --platform ios

# Android
eas build --platform android

# Web
npx expo export --platform web
```

## 📄 Licença

MIT
