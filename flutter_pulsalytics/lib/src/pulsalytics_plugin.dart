import 'dart:html';

class HeatmapPlugin {
  static String? _serverUrl;
  static double? _imageQuality;
  static String? _userId;

  /// Inicializa o plugin do heatmap tracker
  ///
  /// [serverUrl] - URL do servidor onde os dados serão enviados
  /// [imageQuality] - Qualidade da imagem (0.0 a 1.0, padrão: 0.8)
  /// [userId] - ID do usuário (opcional)
  static void initialize({
    String? serverUrl,
    double imageQuality = 0.8,
    String? userId,
  }) {
    _serverUrl = serverUrl;
    _imageQuality = imageQuality;
    _userId = userId;

    _injectScript(
      'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js',
      onLoad: () {
        _injectHeatmapConfig();
        _injectScript('packages/flutter_pulsalytics_tracker/web/heatmap.js');
      },
    );
  }

  /// Injeta as configurações do heatmap antes de carregar o script
  static void _injectHeatmapConfig() {
    final configScript = ScriptElement()
      ..type = 'application/javascript'
      ..text = '''
        // Configurações do Heatmap Tracker Plugin
        window.HEATMAP_CONFIG = {
          serverUrl: "${_serverUrl ?? 'http://localhost:3001'}",
          imageQuality: ${_imageQuality ?? 0.8},
          userId: ${_userId != null ? '"$_userId"' : 'null'}
        };
        console.log('Heatmap Config injected:', window.HEATMAP_CONFIG);
      ''';

    document.head!.append(configScript);
  }

  /// Injeta um script no documento HTML
  static void _injectScript(String src, {void Function()? onLoad}) {
    final script = ScriptElement()
      ..src = src
      ..type = 'application/javascript';

    if (onLoad != null) {
      script.onLoad.listen((_) => onLoad());
    }

    document.body!.append(script);
  }

  /// Retorna a URL do servidor configurada
  static String? get serverUrl => _serverUrl;

  /// Retorna a qualidade da imagem configurada
  static double? get imageQuality => _imageQuality;

  /// Retorna o ID do usuário configurado
  static String? get userId => _userId;

  /// Verifica se o plugin foi inicializado
  static bool get isInitialized => _serverUrl != null;
}
