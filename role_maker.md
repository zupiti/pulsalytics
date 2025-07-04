Sempre siga role.md para fazer qualquer um ajuste


# 📦 Configuração de Google Tag Manager e Google Search Console – Flutter Web (Exa Escudo)

**URL principal:** [https://exaescudo.com.br](https://exaescudo.com.br)  
**Redirecionamento:** `https://exeescudo.com` → `https://exaescudo.com.br`

---

## ✅ Objetivo

Integrar **Google Tag Manager (GTM)** e verificar propriedade com o **Google Search Console** em uma aplicação **Flutter Web**, sem necessidade de redeploy para atualizações de rastreamento.

---

## 🧱 Estrutura do Projeto

Localize o arquivo:

```
web/index.html
```

---

## 1️⃣ Instalação do Google Tag Manager (ID: GTM-K3S29NWM)

### 📌 Adicione no `<head>`:

```html
<!-- Google Tag Manager -->
<script>
  (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
  new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
  j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
  'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
  })(window,document,'script','dataLayer','GTM-K3S29NWM');
</script>
<!-- End Google Tag Manager -->
```

### 📌 Adicione após `<body>`:

```html
<!-- Google Tag Manager (noscript) -->
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-K3S29NWM"
height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
<!-- End Google Tag Manager (noscript) -->
```

---

## 2️⃣ Função JavaScript para eventos personalizados

Adicione também no `<head>`:

```html
<script>
  function pushEventToDataLayer(eventName, eventData) {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: eventName,
      ...eventData
    });
  }
</script>
```

---

## 3️⃣ Envio de eventos do Flutter para o GTM

No seu código Dart:

```dart
import 'dart:js' as js;

void sendEventToGTM(String name, Map<String, dynamic> data) {
  js.context.callMethod('pushEventToDataLayer', [name, js.JsObject.jsify(data)]);
}
```

### 🧪 Exemplo de botão com evento:

```dart
ElevatedButton(
  onPressed: () {
    sendEventToGTM('button_click', {
      'button_name': 'Assinar Agora',
      'location': 'HomePage',
    });
  },
  child: Text('Assinar'),
),
```

---

## 4️⃣ Google Search Console – Verificação de domínio

### 🧾 Propriedade: `exaescudo.com.br`  
### Método: Registro **TXT** no DNS

Adicione este registro:

```
google-site-verification=KTR-wR3Ot3cg_-1gMI16NuFAt0TXOTIRLnfY7urhSBE
```

No seu provedor DNS (ex: registro.br)

---

## 5️⃣ Redirecionamento de domínio

Configure redirecionamento 301 de:

```
https://exeescudo.com → https://exaescudo.com.br
```

---

## ✅ Checklist

| Tarefa | Status |
|--------|--------|
| Inserir GTM no `index.html` (`<head>` e `<body>`) | ✅ |
| Adicionar função JS `pushEventToDataLayer` | ✅ |
| Chamar `sendEventToGTM` no Flutter | ✅ |
| Verificar domínio via DNS TXT | 🔲 |
| Redirecionar domínio antigo | 🔲 |

---

## 🔍 Dicas Finais

- Teste eventos em tempo real no **Preview Mode do GTM**.
- GTM permite integração com GA4, Facebook Pixel, Hotjar etc.
- Com GTM, você **não precisa redeployar** seu app Flutter para alterações de rastreamento.

