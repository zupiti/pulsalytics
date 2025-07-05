# Flutter Heatmap Tracker

> **Atenção:** Para utilizar todas as funcionalidades desta biblioteca, é necessário:
>
> 1. Rodar o painel de administração (admin-ui):
>    - Entre na pasta `admin-ui` e execute `npm install` e depois `npm start`.
>    - O painel permite visualizar sessões, heatmaps e monitorar usuários em tempo real.
> 2. Rodar o servidor de WebSocket:
>    - Entre na pasta `heatmap-server` e execute `npm install` e depois `npm run websocket`.
>    - Este servidor recebe dados em tempo real do plugin Flutter e os disponibiliza para o admin-ui.
>
> Ambos devem estar ativos para o monitoramento e visualização em tempo real.

## Finalidade

Esta biblioteca tem como objetivo rastrear interações de usuários em aplicações Flutter Web, gerando heatmaps, capturando cliques, movimentos do mouse e screenshots, e enviando esses dados para um servidor backend. O objetivo é fornecer insights detalhados sobre o comportamento do usuário, facilitando a análise de usabilidade e a identificação de pontos de interesse ou problemas na interface.

## Como funciona?

- O plugin coleta dados de interação do usuário (mouse, cliques, screenshots) e envia para o servidor via HTTP e WebSocket.
- O servidor armazena e processa esses dados.
- O admin-ui permite visualizar sessões ativas, heatmaps e estatísticas em tempo real.

## Funcionalidades

- 🎯 **Rastreamento de movimento do mouse** - Captura posições do cursor em tempo real
- 🖱️ **Detecção de cliques** - Registra todos os cliques do usuário na interface
- 📸 **Screenshots automáticas** - Gera capturas de tela com overlay de heatmap
- 🌐 **Suporte a múltiplas URLs** - Rastreia diferentes páginas da aplicação
- 📤 **Upload automático** - Envia dados para servidor configurado
- 👤 **Identificação de usuário** - Suporte opcional a ID de usuário
- ⚡ **Performance otimizada** - Sistema invisível e de alta performance
- 🎨 **Visualização em tempo real** - Overlay visual opcional para debug

## Instalação

Adicione a dependência no seu `pubspec.yaml`:

```yaml
dependencies:
  flutter_pulsalytics: ^1.0.0
```

Execute:

```bash
flutter pub get
```

## Uso Básico

### 1. Inicialização Simples

```dart
import 'package:flutter_pulsalytics/flutter_pulsalytics.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Inicializa o plugin
  HeatmapTrackerPlugin.initialize(
    serverUrl: 'https://seu-servidor.com/api',
  );
  
  runApp(MyApp());
}
```

### 2. Configuração Completa

```dart
HeatmapTrackerPlugin.initialize(
  serverUrl: 'https://seu-servidor.com/api',    // Obrigatório
  imageQuality: 0.8,                            // Opcional (0.0 - 1.0)
  userId: 'user_123',                           // Opcional
);
```

### 3. Verificação de Status

```dart
// Verificar se foi inicializado
bool isReady = HeatmapTrackerPlugin.isInitialized;

// Acessar configurações
String? serverUrl = HeatmapTrackerPlugin.serverUrl;
double? quality = HeatmapTrackerPlugin.imageQuality;
String? userId = HeatmapTrackerPlugin.userId;
```

## Configuração do Servidor

O plugin envia dados para dois endpoints:

### Upload de Imagens
```
POST /upload
Content-Type: multipart/form-data

Campos:
- image: arquivo de imagem (WebP ou JPEG)
- userId: ID do usuário (se configurado)
```

### Eventos de Sessão
```
POST /session-event
Content-Type: application/x-www-form-urlencoded

Campos:
- sessionId: ID da sessão
- eventType: 'session_end'
- timestamp: timestamp do evento
- userId: ID do usuário (se configurado)
```

## Exemplo de Servidor Node.js

```javascript
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.urlencoded({ extended: true }));

const upload = multer({ dest: 'uploads/' });

// Upload de imagens
app.post('/upload', upload.single('image'), (req, res) => {
  console.log('Imagem recebida:', req.file.filename);
  console.log('User ID:', req.body.userId);
  res.json({ success: true });
});

// Eventos de sessão
app.post('/session-event', (req, res) => {
  console.log('Evento:', req.body);
  res.json({ success: true });
});

app.listen(3001, () => {
  console.log('Servidor rodando na porta 3001');
});
```

## Funcionamento

### Captura Automática
- **Fast Capture**: A cada 500ms quando o mouse está em movimento
- **Screenshot Completa**: A cada 10 segundos
- **Detecção de Mudança de URL**: Automática para SPAs

### Dados Capturados
- Posições do mouse (x, y, timestamp)
- Cliques do usuário (x, y, timestamp)
- URL atual da página
- Session ID único por usuário
- Metadados da sessão

### Formato das Imagens
- **Formato**: WebP (com fallback para JPEG)
- **Resolução**: Máximo 1920x1080
- **Qualidade**: Configurável (padrão: 0.2)
- **Overlay**: Heatmap + rastro do mouse + cliques

## Configurações Avançadas

### Qualidade da Imagem
```dart
// Baixa qualidade, menor tamanho (recomendado para produção)
imageQuality: 0.2

// Alta qualidade, maior tamanho (recomendado para debug)
imageQuality: 0.8
```

### Identificação de Usuário
```dart
// Sem identificação
userId: null

// Com ID personalizado
userId: 'user_${DateTime.now().millisecondsSinceEpoch}'

// Com ID do sistema de autenticação
userId: currentUser.id
```

## Debug e Monitoramento

### Console do Navegador
O plugin gera logs detalhados no console:

```javascript
// Verificar dados do heatmap
showHeatmapData()

// Informações da sessão
getSessionInfo()

// Reset da sessão (desenvolvimento)
resetSession()
```

### Funções de Debug Disponíveis
- `window.showHeatmapData()` - Mostra dados coletados
- `window.getSessionInfo()` - Informações da sessão atual
- `window.resetSession()` - Reset da sessão (requer reload)

## Considerações de Performance

### Otimizações Implementadas
- Compressão automática de imagens
- Throttling de capturas por movimento
- Cleanup automático de dados antigos
- Sistema totalmente invisível ao usuário

### Recomendações
- Use qualidade de imagem baixa (0.2-0.4) em produção
- Configure servidor com boa capacidade de armazenamento
- Monitore o tamanho dos uploads
- Implemente rotação de logs no servidor

## Compatibilidade

- ✅ **Flutter Web**: Suporte completo
- ❌ **Flutter Mobile**: Não suportado (específico para web)
- ✅ **Navegadores**: Chrome, Firefox, Safari, Edge

## Requisitos

- Flutter >= 2.0.0
- Dart >= 2.12.0
- Navegador com suporte a html2canvas
- Servidor para receber uploads

## Exemplo Completo

Veja o exemplo completo na pasta `/example` do plugin.

## Contribuição

Contribuições são bem-vindas! Por favor:

1. Fork o projeto
2. Crie uma branch para sua feature
3. Faça commit das mudanças
4. Abra um Pull Request

## Licença

Este projeto está sob a licença MIT. Veja o arquivo LICENSE para detalhes.

## Suporte

Para dúvidas e problemas:
- Abra uma issue no GitHub
- Consulte a documentação do exemplo
- Verifique os logs do console do navegador
