# Guia de Implementação - Plugin Flutter Heatmap Tracker

## 📋 Pré-requisitos
- Projeto Flutter Web funcionando
- Servidor heatmap rodando na porta 3001 (já configurado)

## 🚀 Passo a Passo para Implementação

### 1. Adicionar Dependência do Plugin

No arquivo `pubspec.yaml` do projeto `/Users/nathan.oliveira/Documents/ecossistema/ecossistema/flutter-exaconecta`, adicione:

```yaml
dependencies:
  flutter:
    sdk: flutter
  flutter_heatmap_tracker:
    path: /Users/nathan.oliveira/Documents/test/clarity/flutter_heatmap_tracker
```

### 2. Copiar o Arquivo JavaScript

Copie o arquivo `heatmap.js` para a pasta `web/` do projeto de destino:

```bash
cp /Users/nathan.oliveira/Documents/test/clarity/flutter_heatmap_tracker/web/heatmap.js /Users/nathan.oliveira/Documents/ecossistema/ecossistema/flutter-exaconecta/web/
```

### 3. Modificar o index.html

No arquivo `web/index.html` do projeto de destino, adicione antes do `</body>`:

```html
<!-- Heatmap Tracker -->
<script src="heatmap.js"></script>
```

### 4. Implementar no main.dart

No arquivo `lib/main.dart` (ou onde você inicializa o app), adicione:

```dart
import 'package:flutter_heatmap_tracker/flutter_heatmap_tracker.dart';

void main() {
  runApp(MyApp());
}

class MyApp extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Flutter Demo',
      home: MyHomePage(),
    );
  }
}

class MyHomePage extends StatefulWidget {
  @override
  _MyHomePageState createState() => _MyHomePageState();
}

class _MyHomePageState extends State<MyHomePage> {
  @override
  void initState() {
    super.initState();
    _initializeHeatmap();
  }

  void _initializeHeatmap() async {
    // Aguarda um pouco para garantir que a página carregou
    await Future.delayed(Duration(milliseconds: 500));
    
    try {
      await HeatmapTrackerPlugin.initialize(
        serverUrl: 'http://localhost:3001',
        imageQuality: 0.3,
        userId: 'exaconecta_user_${DateTime.now().millisecondsSinceEpoch}',
      );
      print('✅ Heatmap tracker inicializado com sucesso!');
    } catch (e) {
      print('❌ Erro ao inicializar heatmap tracker: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    // Seu widget existente aqui
    return Scaffold(
      appBar: AppBar(
        title: Text('ExaConecta - Com Heatmap'),
      ),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text('Heatmap Tracker Ativo!'),
            Text('Mova o mouse e clique para gerar dados'),
            ElevatedButton(
              onPressed: () {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text('Clique registrado!')),
                );
              },
              child: Text('Botão de Teste'),
            ),
          ],
        ),
      ),
    );
  }
}
```

## 🔧 Comandos para Executar

### 1. Instalar dependências
```bash
cd /Users/nathan.oliveira/Documents/ecossistema/ecossistema/flutter-exaconecta
flutter pub get
```

### 2. Executar o projeto
```bash
flutter run -d chrome --web-port 8080
```

## 🧪 Como Testar

1. **Verificar se o servidor está rodando**:
   - Acesse http://localhost:3001 no navegador
   - Deve mostrar "Heatmap Server is running!"

2. **Testar o rastreamento**:
   - Abra o app Flutter em http://localhost:8080
   - Mova o mouse pela tela
   - Clique em diferentes elementos
   - Aguarde 10 segundos (intervalo de envio automático)

3. **Verificar dados no servidor**:
   - Verifique o terminal do servidor heatmap
   - Deve mostrar logs de dados recebidos
   - Screenshots são salvos em `/tmp/heatmap_screenshots/`

## 📊 Dados Capturados

O plugin captura automaticamente:
- **Movimento do mouse**: coordenadas X,Y com timestamp
- **Cliques**: posição e timestamp
- **Screenshots**: imagem da página com overlay do heatmap
- **Metadados**: URL, dimensões da tela, user agent

## ⚙️ Configurações Disponíveis

```dart
HeatmapTrackerPlugin.initialize(
  serverUrl: 'http://localhost:3001',     // Obrigatório
  imageQuality: 0.3,                     // Opcional (0.1 a 1.0)
  userId: 'seu_user_id',                 // Opcional
);
```

## 🐛 Solução de Problemas

### Plugin não inicializa
- Verifique se o `heatmap.js` está na pasta `web/`
- Confirme se foi adicionado no `index.html`
- Veja o console do navegador para erros

### Dados não chegam no servidor
- Confirme se o servidor está rodando na porta 3001
- Verifique se não há bloqueio de CORS
- Aguarde 10 segundos para o envio automático

### Erro de dependência
- Execute `flutter clean && flutter pub get`
- Verifique se o path do plugin está correto no `pubspec.yaml`

## 📝 Logs Úteis

Para debugar, observe:
- **Console do navegador**: erros JavaScript
- **Terminal do Flutter**: logs do plugin
- **Terminal do servidor**: dados recebidos

---

**Status**: Plugin pronto para implementação ✅
**Servidor**: Rodando na porta 3001 🟢
**Documentação**: Completa 📚
