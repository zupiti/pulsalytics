import 'package:universal_html/html.dart';

class PulsalyticsPlugin {
  static String? _serverUrl;
  static double? _imageQuality;
  static String? _userId;

  /// Initializes the heatmap tracker plugin
  ///
  /// [serverUrl] - URL of the server where data will be sent
  /// [imageQuality] - Image quality (0.0 to 1.0, default: 0.8)
  /// [userId] - User ID (optional)
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
        _injectScript('packages/flutter_pulsalytics/web/pulsalytics.js');
      },
    );
  }

  /// Injects the heatmap settings before loading the script
  static void _injectHeatmapConfig() {
    final configScript = ScriptElement()
      ..type = 'application/javascript'
      ..text = '''
        window.HEATMAP_CONFIG = {
          serverUrl: "${_serverUrl ?? 'http://localhost:3001'}",
          imageQuality: ${_imageQuality ?? 0.8},
          userId: ${_userId != null ? '"$_userId"' : 'null'}
        };
      ''';

    document.head!.append(configScript);
  }

  /// Injects a script into the HTML document
  static void _injectScript(String src, {void Function()? onLoad}) {
    final script = ScriptElement()
      ..src = src
      ..type = 'application/javascript';

    if (onLoad != null) {
      script.onLoad.listen((_) => onLoad());
    }

    document.body!.append(script);
  }

  /// Returns the configured server URL
  static String? get serverUrl => _serverUrl;

  /// Returns the configured image quality
  static double? get imageQuality => _imageQuality;

  /// Returns the configured user ID
  static String? get userId => _userId;

  /// Checks if the plugin has been initialized
  static bool get isInitialized => _serverUrl != null;
}
