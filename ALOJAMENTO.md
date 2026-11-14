# Alojamento independente — Excelência AI

O projeto pode funcionar num domínio e numa infraestrutura escolhidos por ti. Nenhum endereço externo específico está fixado na configuração do aplicativo móvel.

## 1. Preparar

Instala Node.js 20 ou superior e executa:

```bash
npm install
npm run build
```

## 2. Configurar a chave privada

No painel do serviço de alojamento escolhido, cria esta variável protegida:

```env
GROQ_API_KEY=a_tua_chave_privada
```

Nunca coloques a chave no repositório, no APK ou em variáveis públicas iniciadas por `VITE_`.

## 3. Publicar

Usa um serviço que execute aplicações TanStack Start, com funções do servidor. Liga o repositório, usa `npm run build` como comando de compilação e configura a variável acima. Depois liga o teu domínio personalizado ao serviço e ativa HTTPS.

Um alojamento apenas de ficheiros estáticos consegue mostrar a interface e o conteúdo offline, mas não consegue proteger a chave nem executar conversa, voz, transcrição e geração de exercícios. Para todas as funções operarem, o alojamento precisa executar o servidor incluído no projeto.

## 3.1 Netlify

O ficheiro `netlify.toml` já está incluído. No Netlify: **Add new site → Import project** (ou arrasta o repositório), e confirma:

- Comando de compilação: `npm run build`
- Pasta de publicação: `dist`
- Variáveis: `NITRO_PRESET=netlify` (já no `netlify.toml`) e `GROQ_API_KEY` em **Site configuration → Environment variables**

Não uses "deploy manual" arrastando a pasta: as funções do servidor só são criadas quando o Netlify compila o projeto.

## 4. Gerar o aplicativo móvel

Quando o teu endereço estiver ativo:

```bash
CAPACITOR_SERVER_URL=https://app.teudominio.ao npx cap sync android
```

Para iPhone, usa `ios`. Segue os restantes passos em `MOBILE.md`.

## 5. Confirmar independência

- O domínio é teu e pode ser trocado sem alterar a interface.
- O identificador móvel é `ao.excelencia.ai`.
- A chave da Groq fica no teu servidor.
- O PWA mantém manifesto, ícones e cache offline próprios.
