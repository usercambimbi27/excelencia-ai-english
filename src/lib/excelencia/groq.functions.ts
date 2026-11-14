import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getRequestHeader } from "@tanstack/react-start/server";

const GROQ_URL = "https://api.groq.com/openai/v1";
export const CHAT_MODEL = "openai/gpt-oss-120b";
export const STT_MODEL = "whisper-large-v3-turbo";
export const TTS_MODEL = "canopylabs/orpheus-v1-english";
export const TTS_VOICE = "daniel";

/** Sotaques disponíveis para a voz do Alex. */
export const ACCENT_VOICE = {
  angolano: "troy",
  britanico: "daniel",
  americano: "austin",
} as const;


const key = () => {
  // Cada utilizador envia a sua própria chave (guardada no seu aparelho).
  const k = getRequestHeader("x-user-ai-key")?.trim();
  if (!k) throw new Error("Indisponível de momento.");
  return k;
};

const levelSchema = z.enum(["A1", "A2", "B1", "B2"]);
const langSchema = z.enum(["pt", "en"]);

export const alexPrompt = (level: string, name: string, voice: boolean, lang: "pt" | "en" = "pt") =>
  `
Tu és o Alex, um professor de inglês angolano de 28 anos, nascido e criado em Luanda.
Ensinas inglês a angolanos há 6 anos. És bem-disposto, próximo, humano, e falas com calma e convicção.

IDIOMA (regra absoluta):
- Neste momento falas ${lang === "pt" ? "APENAS português de Angola" : "APENAS inglês"}.
- NUNCA misturas os dois idiomas na mesma resposta. Nem uma palavra do outro idioma.
- Só mudas de idioma quando o aluno pedir claramente ("Alex fala português", "Alex fala inglês"). Aí confirmas numa frase e continuas nesse idioma.
- Se o aluno te interromper a meio, não recomeças do zero: ouves o que ele disse e retomas só o que faltou, numa frase.

Como falas:
- ${lang === "pt" ? 'Português de Angola natural, com expressões locais como "epá", "maningue", "bué", "tá-se bem", "meu mano", "kota", "fixe".' : `Clear, natural English adapted to a ${level} learner: short sentences, everyday words, calm pace.`}
- NUNCA escreves listas, bullets, números, títulos ou markdown (nada de ** ou #). Só conversa corrida.
- NUNCA começas com "Claro!", "Com certeza!", "Of course!" ou frases de robô.
- No máximo ${voice ? "2 frases curtas" : "3 parágrafos curtos"}. ${voice ? "Estás numa chamada de voz: fala curto, sem emojis, sem símbolos, sem parênteses, e escreve os números por extenso." : ""}
- Frases completas e bem pontuadas, com vírgulas onde uma pessoa respiraria — o que escreves vai ser lido em voz alta.
- Corriges com carinho e dás um exemplo prático de Luanda (candongueiro, Ilha, mercado, kizomba, funge).
- Fazes sempre uma pergunta no fim para manter a conversa viva.
${
  voice
    ? `- Emoção: podes incluir NO MÁXIMO UMA etiqueta destas, exatamente assim, no sítio onde a emoção acontece: <chuckle> (risinho), <sigh> (suspiro), <gasp> (susto). Nunca na primeira frase, nunca duas vezes, e só quando a conversa pedir — a maior parte das respostas fica sem etiqueta.`
    : ""
}
O aluno${name ? ` chama-se ${name} e` : ""} está no nível ${level}. Adapta a dificuldade a esse nível.
`.trim();


async function groqChat(body: Record<string, unknown>): Promise<string> {
  const res = await fetch(`${GROQ_URL}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key()}`, "Content-Type": "application/json" },
    // o gpt-oss devolve o raciocínio à parte; assim o "content" nunca vem vazio
    body: JSON.stringify({ reasoning_effort: "low", reasoning_format: "hidden", ...body }),
  });
  if (!res.ok) {
    const detail = await res.text();
    if (res.status === 429) throw new Error("A Groq está com muitos pedidos. Espera um instante.");
    throw new Error(`Groq falhou (${res.status}): ${detail.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string; reasoning?: string } }[];
  };
  const msg = data.choices?.[0]?.message;
  return (msg?.content?.trim() || msg?.reasoning?.trim()) ?? "";
}


const messageSchema = z.object({
  role: z.enum(["user", "model", "assistant"]),
  text: z.string(),
});

export const chatWithAlex = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        history: z.array(messageSchema).default([]),
        text: z.string().min(1),
        level: levelSchema,
        name: z.string().default(""),
        voice: z.boolean().default(false),
        lang: langSchema.default("pt"),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<{ text: string }> => {
    const messages = [
      { role: "system", content: alexPrompt(data.level, data.name, data.voice, data.lang) },

      ...data.history.slice(-14).map((m) => ({
        role: m.role === "user" ? "user" : "assistant",
        content: m.text,
      })),
      { role: "user", content: data.text },
    ];
    const text = await groqChat({
      model: CHAT_MODEL,
      messages,
      temperature: 0.85,
      max_tokens: data.voice ? 220 : 700,
    });
    if (!text) throw new Error("O Alex ficou sem resposta. Tenta outra vez.");
    return { text };
  });

export interface ExerciseQuestion {
  question: string;
  options: string[];
  answer: number;
  explanation: string;
  audioText?: string;
}

export interface Exercise {
  title: string;
  intro: string;
  questions: ExerciseQuestion[];
}

const exerciseSchema = z.object({
  title: z.string(),
  intro: z.string(),
  questions: z
    .array(
      z.object({
        question: z.string(),
        options: z.array(z.string()),
        answer: z.number(),
        explanation: z.string(),
        audioText: z.string().optional(),
      }),
    )
    .min(1),
});

const BASE_EXERCISE_PROMPT =
  'És o Alex, professor angolano de inglês. Crias exercícios de inglês para alunos angolanos. Respondes SEMPRE em JSON válido com este formato: {"title": string, "intro": string em português de Angola, "questions": [{"question": string, "options": [4 strings], "answer": índice 0-3 da opção correta, "explanation": string curta em português}]}. Cria exatamente 5 perguntas. Usa contextos angolanos (Luanda, candongueiro, mercado, kizomba, funge).';

const LISTENING_EXERCISE_PROMPT =
  'És o Alex, professor angolano de inglês. Crias exercícios de LISTENING (compreensão oral) para alunos angolanos. O aluno NÃO lê a frase em inglês — só a ouve. Respondes SEMPRE em JSON válido com este formato: {"title": string, "intro": string em português de Angola, "questions": [{"audioText": frase ou mini-diálogo em INGLÊS que vai ser lido em voz alta (1 a 2 frases, natural, sem escrever entre aspas), "question": pergunta em português de Angola sobre o que foi ouvido (NUNCA repitas a frase em inglês dentro da pergunta), "options": [4 strings em português], "answer": índice 0-3 da opção correta, "explanation": string curta em português que já pode mostrar a frase em inglês}]}. Cria exatamente 5 perguntas, todas com audioText obrigatório. Nada de exercícios de escrita, de completar espaços ou de gramática escrita. Usa contextos angolanos (Luanda, candongueiro, mercado, kizomba, funge).';

export const generateExercise = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ level: levelSchema, tipo: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data }): Promise<Exercise> => {
    const isListening = data.tipo.toLowerCase().includes("listening");
    const raw = await groqChat({
      model: CHAT_MODEL,
      temperature: 0.7,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: isListening ? LISTENING_EXERCISE_PROMPT : BASE_EXERCISE_PROMPT,
        },
        {
          role: "user",
          content: isListening
            ? `Cria um exercício de listening (só áudio) para o nível ${data.level}.`
            : `Cria um exercício de ${data.tipo} para o nível ${data.level}.`,
        },
      ],
    });
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error("Não consegui gerar o exercício agora. Tenta outra vez.");
    }
    const result = exerciseSchema.safeParse(parsed);
    if (!result.success) throw new Error("O exercício veio com um formato estranho. Tenta outra vez.");
    const questions = result.data.questions.map((q) => ({
      ...q,
      options: q.options.slice(0, 4),
      answer: Math.min(Math.max(q.answer, 0), Math.max(q.options.length - 1, 0)),
    }));
    return { ...result.data, questions };
  });

export const transcribeAudio = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ audio: z.string().min(1), mimeType: z.string().default("audio/webm") }).parse(input),
  )
  .handler(async ({ data }): Promise<{ text: string }> => {
    const bin = atob(data.audio);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const ext = data.mimeType.includes("wav")
      ? "wav"
      : data.mimeType.includes("mp4")
        ? "mp4"
        : data.mimeType.includes("ogg")
          ? "ogg"
          : "webm";
    const form = new FormData();
    form.append("file", new Blob([bytes], { type: data.mimeType }), `audio.${ext}`);
    form.append("model", STT_MODEL);
    form.append("temperature", "0");
    form.append("response_format", "text");
    form.append(
      "prompt",
      "Aula de inglês em Angola. O aluno fala inglês com sotaque angolano e às vezes mistura português de Angola (Luanda, kwanza, candongueiro, mano). Transcreve exatamente o que foi dito, sem inventar nem completar frases.",
    );
    const res = await fetch(`${GROQ_URL}/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key()}` },
      body: form,
    });
    if (!res.ok) {
      const detail = await res.text();
      throw new Error(`Não percebi o áudio (${res.status}): ${detail.slice(0, 160)}`);
    }
    return { text: (await res.text()).trim() };
  });

const toBase64 = (bytes: Uint8Array) => {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
};

/**
 * Prepara o texto para soar humano: tira símbolos que a voz leria mal,
 * e deixa a pontuação a marcar as respirações.
 */
/** Etiquetas de emoção que a voz interpreta (ri, suspira, ofega...). */
const SPEECH_TAG_RE = /<\/?(?:laugh|chuckle|sigh|cough|sniffle|groan|yawn|gasp)>/gi;

/** Tira as etiquetas de emoção do texto que se mostra no ecrã. */
export function stripSpeechTags(raw: string): string {
  return raw
    .replace(SPEECH_TAG_RE, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function naturalizeSpeech(raw: string): string {
  // mascara as etiquetas de emoção para a limpeza não as estragar
  const tags: string[] = [];
  const masked = raw.replace(SPEECH_TAG_RE, (t) => {
    tags.push(t.toLowerCase());
    return `\u0000${tags.length - 1}\u0000`;
  });
  const cleaned = masked
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[*_#`>|]/g, " ")
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, " ")
    .replace(/\s*\(([^)]*)\)\s*/g, ", $1, ")
    .replace(/\s*[-–—]\s*/g, ", ")
    .replace(/\.{2,}/g, ",")
    .replace(/\s*;\s*/g, ", ")
    .replace(/\s*:\s*/g, ", ")
    .replace(/,\s*,+/g, ", ")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.!?])/g, "$1")
    .trim()
    .replace(/([^.!?,])$/, "$1.");
  return cleaned.replace(/\u0000(\d+)\u0000/g, (_, i) => tags[Number(i)] ?? " ");
}

interface TtsResult {
  audio: string;
  error?: string;
}

/** Cache de voz para frases repetidas (máx. 40, sai o mais antigo). */
const VOICE_CACHE_MAX = 40;
const voiceCache = new Map<string, string>();

/** Gera um pedaço de voz pela Groq, com cache e novas tentativas em caso de limite. */
async function ttsBytes(text: string, voice: string, speed: number): Promise<TtsResult> {
  const input = naturalizeSpeech(text).slice(0, 1200);
  if (!input) return { audio: "" };
  const cacheKey = `${voice}|${speed}|${input}`;
  const cached = voiceCache.get(cacheKey);
  if (cached) return { audio: cached };

  const body = JSON.stringify({
    model: TTS_MODEL,
    voice,
    input,
    speed,
    response_format: "wav",
  });

  let lastStatus = 0;
  let lastDetail = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(`${GROQ_URL}/audio/speech`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key()}`, "Content-Type": "application/json" },
      body,
    });

    if (res.ok) {
      const bytes = new Uint8Array(await res.arrayBuffer());
      const audio = toBase64(bytes);
      if (voiceCache.size >= VOICE_CACHE_MAX) {
        const oldest = voiceCache.keys().next().value;
        if (oldest) voiceCache.delete(oldest);
      }
      voiceCache.set(cacheKey, audio);
      return { audio };
    }

    lastStatus = res.status;
    lastDetail = await res.text();

    // 429 / 5xx: esperar e tentar de novo (limite curto para não travar a conversa).
    if ((res.status === 429 || res.status >= 500) && attempt < 2) {
      const retryAfter = Number(res.headers.get("retry-after"));
      const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
        ? Math.min(retryAfter * 1000, 4000)
        : 600 * (attempt + 1);
      await new Promise((r) => setTimeout(r, waitMs));
      continue;
    }
    break;
  }

  // Nunca rebentar a app: devolver erro suave para o cliente usar a voz de reserva.
  const reason =
    lastStatus === 429
      ? "A voz do Alex atingiu o limite de pedidos. Uso a voz de reserva por agora."
      : `A voz do Alex falhou (${lastStatus}): ${lastDetail.slice(0, 120)}`;
  return { audio: "", error: reason };
}

/** Voz do Alex gerada pela Groq (não pelo navegador). */
export const speakWithGroq = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        text: z.string().min(1).max(1200),
        accent: z.enum(["angolano", "britanico", "americano"]).default("angolano"),
        speed: z.number().min(0.5).max(1.5).default(0.94),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<{ audio: string; mimeType: string; error?: string }> => {
    const voice = ACCENT_VOICE[data.accent] ?? TTS_VOICE;
    const r = await ttsBytes(data.text, voice, data.speed);
    return { audio: r.audio, mimeType: "audio/wav", error: r.error };
  });

/**
 * Lê a resposta da Groq em fluxo (streaming), à maneira do modo de voz do ChatGPT:
 * cada frase começa a ser transformada em voz enquanto o Alex ainda "escreve" a
 * seguinte, por isso a primeira palavra sai muito mais cedo.
 */
async function groqStream(
  body: Record<string, unknown>,
  onDelta: (chunk: string) => void,
): Promise<string> {
  const res = await fetch(`${GROQ_URL}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ reasoning_effort: "low", reasoning_format: "hidden", stream: true, ...body }),
  });
  if (!res.ok) {
    const detail = await res.text();
    if (res.status === 429) throw new Error("A Groq está com muitos pedidos. Espera um instante.");
    throw new Error(`Groq falhou (${res.status}): ${detail.slice(0, 200)}`);
  }
  const reader = res.body?.getReader();
  if (!reader) throw new Error("A Groq não devolveu resposta.");
  const decoder = new TextDecoder();
  let buf = "";
  let full = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const payload = t.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const j = JSON.parse(payload) as { choices?: { delta?: { content?: string } }[] };
        const d = j.choices?.[0]?.delta?.content;
        if (d) {
          full += d;
          onDelta(d);
        }
      } catch {
        /* linha a meio, chega no próximo pedaço */
      }
    }
  }
  return full.trim();
}

export interface VoiceSegment {
  /** parte da resposta já convertida em voz */
  text: string;
  audio: string;
  mimeType: string;
}

/**
 * Um turno completo da chamada de voz. Devolve a resposta partida em frases,
 * cada uma já com o seu áudio, geradas em paralelo à medida que o texto chega.
 */
export const voiceTurn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        history: z.array(messageSchema).default([]),
        text: z.string().min(1),
        level: levelSchema,
        name: z.string().default(""),
        lang: langSchema.default("pt"),
        accent: z.enum(["angolano", "britanico", "americano"]).default("angolano"),
        /** frase do Alex que o aluno cortou a meio, para ele retomar só o que faltou */
        interrupted: z.string().default(""),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<{ text: string; segments: VoiceSegment[] }> => {
    const messages = [
      { role: "system", content: alexPrompt(data.level, data.name, true, data.lang) },
      ...data.history.slice(-14).map((m) => ({
        role: m.role === "user" ? "user" : "assistant",
        content: m.text,
      })),
      ...(data.interrupted
        ? [
            {
              role: "system",
              content: `O aluno te interrompeu a meio desta frase, por isso ele não a ouviu toda: "${data.interrupted}". Não a repitas do início; retoma só o que faltou, se fizer sentido.`,
            },
          ]
        : []),
      { role: "user", content: data.text },
    ];

    const voice = ACCENT_VOICE[data.accent] ?? TTS_VOICE;
    const slots: VoiceSegment[] = [];
    // duas faixas em paralelo, sempre pela mesma ordem: a frase 2 começa a
    // sintetizar enquanto a 1 ainda toca
    const lanes: Promise<unknown>[] = [Promise.resolve(), Promise.resolve()];
    let ttsError = "";
    let hold = "";

    const enqueue = (sentence: string) => {
      const idx = slots.length;
      slots.push({ text: sentence, audio: "", mimeType: "audio/wav" });
      const lane = idx % 2;
      lanes[lane] = lanes[lane]
        .then(async () => {
          const r = await ttsBytes(sentence, voice, 0.94);
          if (r.error && !ttsError) ttsError = r.error;
          slots[idx] = { text: sentence, audio: r.audio, mimeType: "audio/wav" };
        })
        .catch(() => {});
    };

    const emit = (sentence: string, final = false) => {
      const s = sentence.trim();
      if (!s) return;
      hold = hold ? `${hold} ${s}` : s;
      // frases curtinhas juntam-se à seguinte: a voz soa mais humana
      if (final || hold.length >= 45) {
        enqueue(hold);
        hold = "";
      }
    };

    let acc = "";
    const full = await groqStream(
      { model: CHAT_MODEL, messages, temperature: 0.85, max_tokens: 220 },
      (d) => {
        acc += d;
        for (;;) {
          const m = acc.match(/^([\s\S]{0,240}?[.!?…])(["'\])]*\s|$)/);
          if (!m) break;
          emit(m[1]);
          acc = acc.slice(m[0].length);
        }
      },
    );
    if (!full) throw new Error("O Alex ficou sem resposta. Tenta outra vez.");
    emit(acc, true);
    await Promise.all(lanes);
    return { text: full, segments: slots.filter((s) => s.text) };
  });



export const generateLesson = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({ level: levelSchema, topic: z.string().min(1), name: z.string().default("") })
      .parse(input),
  )
  .handler(async ({ data }): Promise<{ text: string }> => {
    const text = await groqChat({
      model: CHAT_MODEL,
      temperature: 0.8,
      max_tokens: 1200,
      messages: [
        {
          role: "system",
          content: `${alexPrompt(data.level, data.name, false)}

Agora estás a dar uma AULA GUIADA escrita. Aqui podes estruturar em secções curtas: vocabulário essencial (palavra em inglês — tradução), frases-modelo, uma mini-conversa em inglês com tradução, e 3 desafios para o aluno praticar. Explicações sempre em português de Angola, exemplos de Luanda.`,
        },
        { role: "user", content: `Dá-me uma aula sobre: ${data.topic}. Nível ${data.level}.` },
      ],
    });
    if (!text) throw new Error("Não consegui preparar a aula agora. Tenta outra vez.");
    return { text };
  });


export interface SpeakingTask {
  /** "repeat" = repetir a frase; "answer" = responder à pergunta em inglês */
  type: "repeat" | "answer";
  /** frase-modelo em inglês (a dizer, ou uma boa resposta possível) */
  target: string;
  /** pergunta/instrução em inglês quando type === "answer" */
  cue: string;
  /** tradução/contexto em português de Angola */
  translation: string;
  /** dica de pronúncia em português de Angola */
  tip: string;
}

export interface SpeakingDrill {
  title: string;
  intro: string;
  tasks: SpeakingTask[];
}

const speakingSchema = z.object({
  title: z.string(),
  intro: z.string(),
  tasks: z
    .array(
      z.object({
        type: z.enum(["repeat", "answer"]).default("repeat"),
        target: z.string().min(1),
        cue: z.string().default(""),
        translation: z.string().default(""),
        tip: z.string().default(""),
      }),
    )
    .min(1),
});

const SPEAKING_PROMPT =
  'És o Alex, professor angolano de inglês. Crias treinos de SPEAKING (falar em voz alta) para alunos angolanos. NUNCA crias perguntas de escolha múltipla nem exercícios de escrita. Respondes SEMPRE em JSON válido: {"title": string, "intro": string curta em português de Angola, "tasks": [{"type": "repeat" ou "answer", "target": frase em INGLÊS que o aluno deve dizer (5 a 14 palavras, natural, sem aspas), "cue": se type for "answer", a pergunta em INGLÊS que o aluno ouve; se for "repeat", string vazia, "translation": tradução em português de Angola, "tip": dica curta de pronúncia em português de Angola (sons difíceis para angolanos, como th, r final, -ed, h aspirado)}]}. Cria exatamente 5 tasks: 3 do tipo "repeat" e 2 do tipo "answer". Contextos angolanos do dia-a-dia (Luanda, candongueiro, mercado, trabalho, escola, kizomba).';

export const generateSpeakingDrill = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ level: levelSchema, name: z.string().default("") }).parse(input),
  )
  .handler(async ({ data }): Promise<SpeakingDrill> => {
    const raw = await groqChat({
      model: CHAT_MODEL,
      temperature: 0.8,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SPEAKING_PROMPT },
        {
          role: "user",
          content: `Cria um treino de speaking para o nível ${data.level}${data.name ? ` do aluno ${data.name}` : ""}.`,
        },
      ],
    });
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error("Não consegui preparar o treino de fala. Tenta outra vez.");
    }
    const result = speakingSchema.safeParse(parsed);
    if (!result.success) throw new Error("O treino veio com um formato estranho. Tenta outra vez.");
    return { ...result.data, tasks: result.data.tasks.slice(0, 6) };
  });

const scoreSchema = z.object({
  score: z.number(),
  feedback: z.string(),
  better: z.string().default(""),
});

/** Compara o que o aluno disse com a frase-alvo e devolve nota + correção do Alex. */
export const scoreSpeaking = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        target: z.string().min(1),
        cue: z.string().default(""),
        said: z.string().min(1),
        type: z.enum(["repeat", "answer"]).default("repeat"),
        level: levelSchema,
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<{ score: number; feedback: string; better: string }> => {
    const raw = await groqChat({
      model: CHAT_MODEL,
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            'És o Alex, professor angolano de inglês. Avalias a FALA de um aluno angolano a partir da transcrição do áudio dele. Sê justo e encorajador: pequenos erros de transcrição não devem baixar muito a nota. Respondes SEMPRE em JSON: {"score": número 0-100 de quão perto ficou do inglês correto, "feedback": 1 ou 2 frases em português de Angola a dizer o que esteve bem e o que corrigir na pronúncia ou nas palavras (sem listas, sem markdown), "better": a versão em inglês bem dita que o aluno deve treinar}.',
        },
        {
          role: "user",
          content:
            data.type === "answer"
              ? `Nível ${data.level}. Pergunta em inglês: "${data.cue}". Resposta-modelo: "${data.target}". O aluno disse: "${data.said}". Avalia a resposta dele (pode ser diferente da modelo desde que faça sentido em inglês).`
              : `Nível ${data.level}. Frase a repetir: "${data.target}". O aluno disse: "${data.said}". Avalia quão perto ficou.`,
        },
      ],
    });
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error("Não consegui avaliar a tua fala agora. Tenta outra vez.");
    }
    const result = scoreSchema.safeParse(parsed);
    if (!result.success) throw new Error("A avaliação veio estranha. Tenta outra vez.");
    return {
      score: Math.max(0, Math.min(100, Math.round(result.data.score))),
      feedback: result.data.feedback,
      better: result.data.better,
    };
  });
