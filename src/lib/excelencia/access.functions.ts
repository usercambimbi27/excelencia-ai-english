import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

async function sha(s: string) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
}

export const verifyUnlock = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ password: z.string().max(200) }).parse(i))
  .handler(async ({ data }) => {
    const expected = process.env["APP_UNLOCK_PASSWORD"];
    if (!expected) return { ok: false };
    const a = await sha(data.password);
    const b = await sha(expected);
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
    return { ok: diff === 0 };
  });

export const validateGroqKey = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ key: z.string().min(10).max(300) }).parse(i))
  .handler(async ({ data }) => {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/models", {
        headers: { Authorization: `Bearer ${data.key.trim()}` },
      });
      return { ok: res.ok, status: res.status };
    } catch {
      return { ok: false, status: 0 };
    }
  });
