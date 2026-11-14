# Checklist — Excelência AI English

## Funcionalidades
- [x] Apresentação inicial: nome, nível (A1–B2) e sotaque do Alex (angolano, britânico, americano)
- [x] Início: barra de XP, sequência diária, missões e módulos
- [x] Conversa por texto com o Alex (sem misturar idiomas; "Alex fala português/inglês")
- [x] Chamada de voz com o Alex: voz Groq, deteção de fala, interrupção, reserva de voz se houver limite
- [x] Exercícios gerados por IA (listening só com áudio)
- [x] Treino de fala com pontuação 0–100 e dicas de pronúncia
- [x] Tutor AI com lições de contexto angolano
- [x] Progresso: competências e medalhas
- [x] Ranking semanal
- [x] XP, sequência e medalhas guardados no aparelho
- [x] Funciona offline (interface e conteúdos já abertos)
- [x] Instalável como app no Android e iPhone (PWA)
- [x] Base Android/iPhone nativa (Capacitor, `ao.excelencia.ai`)
- [x] Sem marca de terceiros; alojamento próprio (Netlify incluído)

## Pendente
- [ ] Login com Google e progresso na nuvem (falta decisão sobre a chave Groq)
- [ ] Testar voz com microfone real no telemóvel
- [ ] Compilar o APK no Android Studio / IPA no Xcode

## Antes de publicar
- [ ] `GROQ_API_KEY` configurada no alojamento
- [ ] Domínio com HTTPS
- [ ] Para o APK com IA: `CAPACITOR_SERVER_URL=https://teu-dominio` ao sincronizar
