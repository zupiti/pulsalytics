import 'package:flutter/material.dart';
import 'package:flutter_heatmap_tracker/flutter_heatmap_tracker.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Inicializa o plugin do heatmap tracker
  HeatmapTrackerPlugin.initialize(
    serverUrl: 'http://localhost:3001',
    imageQuality: 0.3,
    userId: 'test_user_123',
  );

  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Heatmap Tracker Test',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.deepPurple),
        useMaterial3: true,
      ),
      home: const MyHomePage(title: 'Heatmap Tracker Demo'),
    );
  }
}

class MyHomePage extends StatefulWidget {
  const MyHomePage({super.key, required this.title});

  final String title;

  @override
  State<MyHomePage> createState() => _MyHomePageState();
}

class _MyHomePageState extends State<MyHomePage> {
  int _counter = 0;

  void _incrementCounter() {
    setState(() {
      _counter++;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: Theme.of(context).colorScheme.inversePrimary,
        title: Text(widget.title),
      ),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            // Status do Plugin
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Status do Plugin',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Inicializado: ${HeatmapTrackerPlugin.isInitialized ? "✅ Sim" : "❌ Não"}',
                    ),
                    Text(
                      'Server URL: ${HeatmapTrackerPlugin.serverUrl ?? "N/A"}',
                    ),
                    Text(
                      'Qualidade: ${HeatmapTrackerPlugin.imageQuality ?? "N/A"}',
                    ),
                    Text('User ID: ${HeatmapTrackerPlugin.userId ?? "N/A"}'),
                  ],
                ),
              ),
            ),

            const SizedBox(height: 20),

            // Área de teste
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  children: [
                    const Text(
                      'Área de Teste',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 16),
                    Container(
                      width: double.infinity,
                      height: 200,
                      decoration: BoxDecoration(
                        color: Colors.blue.withOpacity(0.1),
                        border: Border.all(color: Colors.blue),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Text('Mova o mouse nesta área'),
                          const SizedBox(height: 16),
                          Text(
                            'Cliques: $_counter',
                            style: Theme.of(context).textTheme.headlineMedium,
                          ),
                          const SizedBox(height: 16),
                          ElevatedButton(
                            onPressed: _incrementCounter,
                            child: const Text('Clique aqui!'),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),

            const SizedBox(height: 20),

            // Instruções
            const Card(
              child: Padding(
                padding: EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Instruções',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    SizedBox(height: 8),
                    Text('1. Mova o mouse pela tela'),
                    Text('2. Clique em diferentes áreas'),
                    Text('3. Abra o Console (F12) para ver os logs'),
                    Text('4. O sistema captura automaticamente'),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: _incrementCounter,
        tooltip: 'Increment',
        child: const Icon(Icons.add),
      ),
    );
  }
}
