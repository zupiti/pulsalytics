import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'dart:html';

void injectScript(String src, {void Function()? onLoad}) {
  final script = ScriptElement()
    ..src = src
    ..type = 'application/javascript';
  if (onLoad != null) {
    script.onLoad.listen((_) => onLoad());
  }
  document.body!.append(script);
}

void main() {
  // Injeta o html2canvas primeiro, depois o heatmap.js
  injectScript(
    'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js',
    onLoad: () {
      injectScript('heatmap.js');
    },
  );
  runApp(const MyApp());
}

final GoRouter _router = GoRouter(
  routes: [
    GoRoute(
      path: '/',
      builder: (context, state) => const HomeScreen(),
      routes: [
        GoRoute(
          path: 'segunda',
          builder: (context, state) => const SegundaTela(),
        ),
      ],
    ),
  ],
);

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  // This widget is the root of your application.
  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'Flutter Demo',
      theme: ThemeData(
        // This is the theme of your application.
        //
        // TRY THIS: Try running your application with "flutter run". You'll see
        // the application has a purple toolbar. Then, without quitting the app,
        // try changing the seedColor in the colorScheme below to Colors.green
        // and then invoke "hot reload" (save your changes or press the "hot
        // reload" button in a Flutter-supported IDE, or press "r" if you used
        // the command line to start the app).
        //
        // Notice that the counter didn't reset back to zero; the application
        // state is not lost during the reload. To reset the state, use hot
        // restart instead.
        //
        // This works for code too, not just values: Most code changes can be
        // tested with just a hot reload.
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.deepPurple),
      ),
      routerConfig: _router,
    );
  }
}

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Home')),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Text('Esta é a tela inicial!'),
            const SizedBox(height: 20),
            ElevatedButton(
              onPressed: () => context.go('/segunda'),
              child: const Text('Ir para Segunda Tela'),
            ),
          ],
        ),
      ),
    );
  }
}

class SegundaTela extends StatelessWidget {
  const SegundaTela({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Segunda Tela')),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            TextField(
              decoration: InputDecoration(
                labelText: 'Digite algo',
                border: OutlineInputBorder(),
              ),
            ),
            const Text('Você está na segunda tela!'),
            const SizedBox(height: 20),
            ElevatedButton(
              onPressed: () => context.go('/'),

              child: const Text('Voltar para Home'),
            ),
          ],
        ),
      ),
    );
  }
}
