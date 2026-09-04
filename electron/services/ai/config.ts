import type { AIProviderId, AIProviderInfo } from "../../../shared/types";
import { PROVIDERS, PROVIDER_IDS, defaultModel } from "./models";
import { getSecret, hasSecret, setSecret } from "../secrets";
import { testKey as pingKey } from "./index";

export function listProviders(): AIProviderInfo[] {
  return PROVIDER_IDS.map((id) => ({
    id,
    label: PROVIDERS[id].label,
    models: PROVIDERS[id].models,
    defaultModel: defaultModel(id),
    keyConfigured: hasSecret(`ai.${id}.key`),
    keyUrl: PROVIDERS[id].keyUrl,
  }));
}

export function saveProviderKey(provider: AIProviderId, key: string): AIProviderInfo[] {
  setSecret(`ai.${provider}.key`, key.trim());
  return listProviders();
}

export async function testProviderKey(input: {
  provider: AIProviderId;
  model?: string;
  key?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const model = input.model?.trim() || defaultModel(input.provider);
  const key = input.key?.trim() || getSecret(`ai.${input.provider}.key`) || "";
  if (!key) return { ok: false, error: "No API key to test." };
  return pingKey(input.provider, model, key);
}
