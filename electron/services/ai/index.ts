import type { AIProviderId } from "../../../shared/types";

export type GenerateOpts = {
  provider: AIProviderId;
  model: string;
  apiKey: string;
  system: string;
  prompt: string;
  maxTokens?: number;
};

class AIError extends Error {}

async function postJson(url: string, headers: Record<string, string>, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: any;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    const msg =
      json?.error?.message || json?.error || json?.message || json?.raw || `HTTP ${res.status}`;
    throw new AIError(typeof msg === "string" ? msg : JSON.stringify(msg));
  }
  return json;
}

async function generateClaude(o: GenerateOpts): Promise<string> {
  const json = await postJson(
    "https://api.anthropic.com/v1/messages",
    { "x-api-key": o.apiKey, "anthropic-version": "2023-06-01" },
    {
      model: o.model,
      max_tokens: o.maxTokens ?? 320,
      system: o.system,
      messages: [{ role: "user", content: o.prompt }],
    },
  );
  const parts = (json.content ?? []) as { type: string; text?: string }[];
  return parts
    .filter((p) => p.type === "text")
    .map((p) => p.text ?? "")
    .join("")
    .trim();
}

async function generateOpenAICompatible(o: GenerateOpts, baseUrl: string): Promise<string> {
  const json = await postJson(
    `${baseUrl}/chat/completions`,
    { authorization: `Bearer ${o.apiKey}` },
    {
      model: o.model,
      messages: [
        { role: "system", content: o.system },
        { role: "user", content: o.prompt },
      ],
      max_completion_tokens: o.maxTokens ?? 320,
    },
  );
  return (json.choices?.[0]?.message?.content ?? "").trim();
}

async function generateGemini(o: GenerateOpts): Promise<string> {
  const json = await postJson(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      o.model,
    )}:generateContent?key=${encodeURIComponent(o.apiKey)}`,
    {},
    {
      systemInstruction: { parts: [{ text: o.system }] },
      contents: [{ role: "user", parts: [{ text: o.prompt }] }],
      generationConfig: { maxOutputTokens: o.maxTokens ?? 320 },
    },
  );
  const parts = (json.candidates?.[0]?.content?.parts ?? []) as { text?: string }[];
  return parts
    .map((p) => p.text ?? "")
    .join("")
    .trim();
}

export async function generate(o: GenerateOpts): Promise<string> {
  if (!o.apiKey) throw new AIError("No API key configured for this provider.");
  let out: string;
  switch (o.provider) {
    case "claude":
      out = await generateClaude(o);
      break;
    case "openai":
      out = await generateOpenAICompatible(o, "https://api.openai.com/v1");
      break;
    case "groq":
      out = await generateOpenAICompatible(o, "https://api.groq.com/openai/v1");
      break;
    case "gemini":
      out = await generateGemini(o);
      break;
    default:
      throw new AIError(`Unknown provider: ${o.provider}`);
  }
  if (!out) throw new AIError("The model returned an empty response.");
  return out;
}

export async function testKey(
  provider: AIProviderId,
  model: string,
  apiKey: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const reply = await generate({
      provider,
      model,
      apiKey,
      system: "You are a connectivity test. Reply with the single word OK.",
      prompt: "OK",
      maxTokens: 16,
    });
    return { ok: reply.length > 0 };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
