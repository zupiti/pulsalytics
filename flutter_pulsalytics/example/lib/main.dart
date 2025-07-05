import 'package:flutter/material.dart';
import 'package:flutter_pulsalytics/flutter_pulsalytics.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Inicializa o plugin do heatmap tracker
  PulsalyticsPlugin.initialize(
    serverUrl: 'http://localhost:3002',
    imageQuality: 0.3,
    userId: 'user_demo_123',
  );

  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Flutter Heatmap Tracker Demo',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.deepPurple),
        useMaterial3: true,
      ),
      home: const MyHomePage(),
    );
  }
}

class MyHomePage extends StatefulWidget {
  const MyHomePage({super.key});

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
        title: const Text('Flutter Heatmap Tracker Demo'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Informações do Plugin
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Informações do Plugin',
                      style: Theme.of(context).textTheme.headlineSmall,
                    ),
                    const SizedBox(height: 8),
                    Text(
                        'Plugin Inicializado: ${PulsalyticsPlugin.isInitialized ? 'Sim' : 'Não'}'),
                    Text('Server URL: ${PulsalyticsPlugin.serverUrl ?? 'N/A'}'),
                    Text(
                        'Qualidade da Imagem: ${PulsalyticsPlugin.imageQuality ?? 'N/A'}'),
                    Text(
                        'User ID: ${PulsalyticsPlugin.userId ?? 'Não definido'}'),
                  ],
                ),
              ),
            ),

            const SizedBox(height: 16),

            // Área de teste
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Área de Teste',
                      style: Theme.of(context).textTheme.headlineSmall,
                    ),
                    const SizedBox(height: 16),
                    Center(
                      child: Column(
                        children: [
                          const Text('Contador de cliques:'),
                          Text(
                            '$_counter',
                            style: Theme.of(context).textTheme.headlineMedium,
                          ),
                          const SizedBox(height: 16),
                          Container(
                            width: 300,
                            height: 150,
                            decoration: BoxDecoration(
                              color: Colors.blue.withOpacity(0.2),
                              border: Border.all(color: Colors.blue),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: const Center(
                              child: Text(
                                'Área para mover o mouse\n\nMova o mouse aqui para\ngerar dados de heatmap',
                                textAlign: TextAlign.center,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),

            const SizedBox(height: 16),

            // Botões de teste
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Botões de Teste',
                      style: Theme.of(context).textTheme.headlineSmall,
                    ),
                    const SizedBox(height: 16),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        ElevatedButton(
                          onPressed: _incrementCounter,
                          child: const Text('Incrementar'),
                        ),
                        ElevatedButton(
                          onPressed: () {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                  content: Text('Botão Verde clicado!')),
                            );
                          },
                          style: ElevatedButton.styleFrom(
                              backgroundColor: Colors.green),
                          child: const Text('Verde'),
                        ),
                        ElevatedButton(
                          onPressed: () {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                  content: Text('Botão Laranja clicado!')),
                            );
                          },
                          style: ElevatedButton.styleFrom(
                              backgroundColor: Colors.orange),
                          child: const Text('Laranja'),
                        ),
                        ElevatedButton(
                          onPressed: () {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                  content: Text('Botão Vermelho clicado!')),
                            );
                          },
                          style: ElevatedButton.styleFrom(
                              backgroundColor: Colors.red),
                          child: const Text('Vermelho'),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),

            const SizedBox(height: 16),

            // Instruções
            Card(
              color: Colors.green.withOpacity(0.1),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Como Usar',
                      style: Theme.of(context).textTheme.headlineSmall,
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      '• Mova o mouse pela tela para gerar dados de tracking\n'
                      '• Clique em diferentes botões para registrar cliques\n'
                      '• O sistema captura automaticamente a cada 500ms\n'
                      '• Screenshots são tiradas a cada 10 segundos\n'
                      '• Verifique o console do navegador para logs\n'
                      '• Sistema totalmente invisível ao usuário',
                    ),
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
