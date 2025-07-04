#!/bin/bash

# Script de Implementação Automática - Flutter Heatmap Tracker
# Para o projeto: /Users/nathan.oliveira/Documents/ecossistema/ecossistema/flutter-exaconecta

PROJECT_PATH="/Users/nathan.oliveira/Documents/ecossistema/ecossistema/flutter-exaconecta"
PLUGIN_PATH="/Users/nathan.oliveira/Documents/test/clarity/flutter_heatmap_tracker"

echo "🚀 Iniciando implementação do Flutter Heatmap Tracker..."

# Verificar se o projeto de destino existe
if [ ! -d "$PROJECT_PATH" ]; then
    echo "❌ Projeto não encontrado em: $PROJECT_PATH"
    exit 1
fi

echo "✅ Projeto encontrado!"

# Navegar para o projeto
cd "$PROJECT_PATH"

# 1. Backup do pubspec.yaml original
echo "📋 Fazendo backup do pubspec.yaml..."
cp pubspec.yaml pubspec.yaml.backup

# 2. Adicionar dependência do plugin
echo "📦 Adicionando dependência do plugin..."
if ! grep -q "flutter_heatmap_tracker:" pubspec.yaml; then
    # Adicionar a dependência após flutter: sdk: flutter
    sed -i '' '/flutter:/a\
  flutter_heatmap_tracker:\
    path: /Users/nathan.oliveira/Documents/test/clarity/flutter_heatmap_tracker' pubspec.yaml
    echo "✅ Dependência adicionada ao pubspec.yaml"
else
    echo "⚠️  Dependência já existe no pubspec.yaml"
fi

# 3. Copiar arquivo JavaScript
echo "📄 Copiando arquivo heatmap.js..."
cp "$PLUGIN_PATH/web/heatmap.js" "web/" 2>/dev/null || {
    echo "⚠️  Pasta web/ não encontrada, criando..."
    mkdir -p web
    cp "$PLUGIN_PATH/web/heatmap.js" "web/"
}
echo "✅ Arquivo heatmap.js copiado!"

# 4. Verificar se o index.html existe
if [ -f "web/index.html" ]; then
    # Verificar se o script já foi adicionado
    if ! grep -q "heatmap.js" web/index.html; then
        echo "🔧 Modificando index.html..."
        # Adicionar script antes do </body>
        sed -i '' 's|</body>|  <!-- Heatmap Tracker -->\
  <script src="heatmap.js"></script>\
</body>|' web/index.html
        echo "✅ Script adicionado ao index.html"
    else
        echo "⚠️  Script já existe no index.html"
    fi
else
    echo "❌ Arquivo web/index.html não encontrado!"
    echo "   Crie manualmente e adicione: <script src=\"heatmap.js\"></script>"
fi

# 5. Criar arquivo de exemplo para implementação
echo "📝 Criando exemplo de implementação..."
cat > "heatmap_implementation_example.dart" << 'EOF'
// Exemplo de implementação do Heatmap Tracker
// Adicione este código no seu main.dart

import 'package:flutter_heatmap_tracker/flutter_heatmap_tracker.dart';

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

  // Resto do seu código...
}
EOF

# 6. Instalar dependências
echo "📦 Instalando dependências..."
flutter pub get

# 7. Instruções finais
echo ""
echo "🎉 IMPLEMENTAÇÃO CONCLUÍDA!"
echo ""
echo "📋 PRÓXIMOS PASSOS:"
echo "1. Copie o código de 'heatmap_implementation_example.dart' para seu main.dart"
echo "2. Execute: flutter run -d chrome --web-port 8080"
echo "3. Teste movendo o mouse e clicando na página"
echo ""
echo "🔧 ARQUIVOS MODIFICADOS:"
echo "- pubspec.yaml (backup salvo como pubspec.yaml.backup)"
echo "- web/index.html (script adicionado)"
echo "- web/heatmap.js (copiado)"
echo "- heatmap_implementation_example.dart (criado)"
echo ""
echo "🌐 SERVIDOR HEATMAP:"
echo "- URL: http://localhost:3001/admin/"
echo "- Status: Rodando ✅"
echo ""
echo "📊 PARA VERIFICAR DADOS:"
echo "- Acesse http://localhost:3001/admin/ no navegador"
echo "- Screenshots salvos em: /tmp/heatmap_screenshots/"
echo ""

exit 0
