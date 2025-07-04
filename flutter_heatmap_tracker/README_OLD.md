# Flutter Heatmap Tracker

Uma biblioteca completa para tracking de heatmap em Flutter Web que captura interações do usuário, movimentos do mouse e gera análises de sessão com visualização em tempo real.

## ✨ Funcionalidades

- 📍 **Tracking de Mouse**: Captura movimentos do mouse em tempo real
- 🖱️ **Detecção de Cliques**: Registra cliques e suas posições
- 📸 **Capturas Automáticas**: Screenshots periódicas com mapas de calor
- 🎯 **Captura Rápida**: Screenshots frequentes quando o mouse está ativo
- 🔄 **Gerenciamento de Sessões**: Controle completo de sessões de usuário
- 📊 **Analytics**: Estatísticas detalhadas de uso
- 🌐 **Mudanças de URL**: Detecção automática de navegação
- 💾 **Storage Local**: Persistência de dados no navegador
- 🎛️ **Configuração Flexível**: Altamente configurável
- 🔍 **Debug Logs**: Sistema de logs detalhado

## 🚀 Instalação

### 1. Adicione a dependência

```yaml
dependencies:
  flutter_heatmap_tracker:
    git:
      url: https://github.com/seu-usuario/flutter_heatmap_tracker.git
      ref: main
```

### 2. Configure o servidor (requerido)

A biblioteca requer um servidor backend para receber as imagens. Use o servidor de exemplo:

```bash
git clone https://github.com/seu-usuario/heatmap-server.git
cd heatmap-server
npm install
npm start
```

O servidor estará disponível em `http://localhost:3001`.

## 📖 Uso Básico

### Configuração Simples

```dart
import 'package:flutter/material.dart';
import 'package:flutter_heatmap_tracker/flutter_heatmap_tracker.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Configuração básica
  final config = HeatmapConfig(
    serverUrl: 'http://localhost:3001',
  );
  
  // Inicializa o tracker
  final tracker = HeatmapTracker.getInstance(config);
  await tracker.initialize();
  
  runApp(MyApp());
}
```

### Configuração Avançada

```dart
final config = HeatmapConfig(
  serverUrl: 'http://localhost:3001',
  fastCaptureInterval: 500,        // Captura rápida a cada 500ms
  automaticCaptureInterval: 10000, // Captura automática a cada 10s
  imageQuality: 0.3,               // Qualidade de compressão (0.0-1.0)
  captureScale: 0.5,               // Escala da captura (para performance)
  maxWidth: 1920,                  // Largura máxima das imagens
  maxHeight: 1080,                 // Altura máxima das imagens
  groupingThreshold: 10.0,         // Agrupar posições próximas (pixels)
  maxPositionsPerUrl: 1000,        // Máximo de posições por URL
  maxDataAgeHours: 24,             // Idade máxima dos dados (horas)
  trailDuration: 2000,             // Duração do rastro (ms)
  clickDuration: 5000,             // Duração dos cliques (ms)
  enableDebugLogs: true,           // Logs de debug
  useLocalStorage: true,           // Usar localStorage
);
```

## 🎯 Exemplo de Uso Completo

Veja o exemplo completo em `example/lib/main.dart`:

```dart
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_heatmap_tracker/flutter_heatmap_tracker.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  final config = HeatmapConfig(
    serverUrl: 'http://localhost:3001',
    enableDebugLogs: true,
  );
  
  final tracker = HeatmapTracker.getInstance(config);
  await tracker.initialize();
  
  runApp(MyApp(tracker: tracker));
}
```

## 📊 API Principal

### HeatmapConfig
```dart
final config = HeatmapConfig(
  serverUrl: 'http://localhost:3001',    // Obrigatório
  fastCaptureInterval: 500,              // Opcional
  automaticCaptureInterval: 10000,       // Opcional
  imageQuality: 0.3,                     // Opcional
  enableDebugLogs: true,                 // Opcional
);
```

### HeatmapTracker
```dart
// Obter instância
final tracker = HeatmapTracker.getInstance(config);

// Inicializar
await tracker.initialize();

// Captura manual
await tracker.captureManual();

// Obter estatísticas
final stats = tracker.getStats();

// Escutar eventos
tracker.events.listen((event) => print(event));

// Finalizar
await tracker.dispose();
```

## 🔧 Requisitos

- Flutter Web
- Dart SDK >=3.0.0
- Servidor backend para receber uploads
- Navegador com suporte a JavaScript moderno

## 🚀 Como Executar o Exemplo

1. Clone o repositório
2. Execute o servidor backend:
   ```bash
   cd heatmap-server
   npm install && npm start
   ```
3. Execute o exemplo Flutter:
   ```bash
   cd flutter_heatmap_tracker/example
   flutter pub get
   flutter run -d chrome
   ```
4. Abra `http://localhost:3005` para o dashboard admin

## 📄 Licença

MIT License