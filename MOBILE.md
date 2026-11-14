# Excelência AI — Android e iPhone

O projeto está preparado com Capacitor e tem a identificação nativa `ao.excelencia.ai`.
A compilação do APK/AAB precisa do Android Studio; a do IPA precisa de um Mac com Xcode.

## Android

1. Transfere os ficheiros do projeto para o computador.
2. Na pasta do projeto, executa:

```bash
npm install
npx cap add android
npm run build:mobile
npx cap sync android
npx cap open android
```

3. No Android Studio, escolhe **Build → Build Bundle(s) / APK(s) → Build APK(s)**.
4. O APK fica normalmente em `android/app/build/outputs/apk/debug/app-debug.apk`.

Para a Play Store, cria um AAB assinado em **Build → Generate Signed Bundle / APK**.

## iPhone

Num Mac com Xcode, executa:

```bash
npm install
npx cap add ios
npm run build:mobile
npx cap sync ios
npx cap open ios
```

Assina o aplicativo com a tua conta Apple Developer e gera o IPA no Xcode.

## Ligar ao teu próprio servidor

As conversas, transcrição, voz e exercícios precisam das funções seguras do servidor. Primeiro publica o projeto no teu próprio endereço. Depois sincroniza o aplicativo indicando esse endereço:

```bash
npm run build:mobile
CAPACITOR_SERVER_URL=https://app.teudominio.ao npx cap sync android
```

No iPhone, troca `android` por `ios`. O endereço deve usar HTTPS. Se não definires esta variável, o Capacitor empacota os ficheiros locais; a interface e os conteúdos em cache abrem, mas os recursos de IA precisam do servidor para proteger a chave privada.

## Permissões do microfone

No Android, adiciona dentro de `<manifest>` em `android/app/src/main/AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
<uses-permission android:name="android.permission.INTERNET" />
```

No iOS, adiciona em `ios/App/App/Info.plist`:

```xml
<key>NSMicrophoneUsageDescription</key>
<string>O Excelência AI usa o microfone para conversas e treinos de fala com o Alex.</string>
```

## Tamanho

Um APK de Capacitor costuma ter 20–30 MB. Para reduzir, gera um AAB com otimização ativada; a loja entrega apenas os ficheiros necessários a cada aparelho.
