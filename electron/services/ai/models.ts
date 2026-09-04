import type { AIProviderId } from "../../../shared/types";

export type ProviderMeta = {
  label: string;
  models: string[]; // curated; the UI also accepts a free-text model id
  keyUrl: string;
};

// Curated defaults as of early 2026. Model ids drift, so the Settings UI always
// offers a "Custom…" free-text field that overrides this list.
export const PROVIDERS: Record<AIProviderId, ProviderMeta> = {
  claude: {
    label: "Claude (Anthropic)",
    models: ["claude-sonnet-5", "claude-opus-5", "claude-haiku-4-5-20251001"],
    keyUrl: "https://console.anthropic.com/settings/keys",
  },
  openai: {
    label: "OpenAI",
    models: ["gpt-5", "gpt-5-mini", "gpt-4.1", "gpt-4o-mini"],
    keyUrl: "https://platform.openai.com/api-keys",
  },
  gemini: {
    label: "Google Gemini",
    models: ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash"],
    keyUrl: "https://aistudio.google.com/app/apikey",
  },
  groq: {
    label: "Groq",
    models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"],
    keyUrl: "https://console.groq.com/keys",
  },
};

export const PROVIDER_IDS = Object.keys(PROVIDERS) as AIProviderId[];

export function defaultModel(provider: AIProviderId): string {
  return PROVIDERS[provider].models[0]!;
}
