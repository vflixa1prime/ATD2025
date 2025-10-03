export type WhatsAppConfig = {
  endpoint: string;
  appkey: string;
  authkey: string;
  templateId?: string;
  imageHost?: string;
};

const STORAGE_KEY = "whatsappConfig";

const DEFAULT_CONFIG: WhatsAppConfig = {
  endpoint: "https://whatsapp.atdsonata.fun/api/create-message",
  appkey: "a0631fb3-0a75-46e0-848d-9f8a58a0caf4",
  authkey: "da794E7rsuSN7lboIdPIR1lMftFTCnFK1LKGt7isiuhEcwxMel",
  templateId: "",
  imageHost: "https://atdsonata.fun/",
};

function sanitizeConfig(raw: Partial<WhatsAppConfig> | null | undefined) {
  const config = raw ?? {};
  return {
    endpoint: config.endpoint || DEFAULT_CONFIG.endpoint,
    appkey: config.appkey || DEFAULT_CONFIG.appkey,
    authkey: config.authkey || DEFAULT_CONFIG.authkey,
    templateId: config.templateId || "",
    imageHost: config.imageHost || "",
  } satisfies WhatsAppConfig;
}

export function readWhatsAppConfig(): WhatsAppConfig {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return { ...DEFAULT_CONFIG };
    const parsed = JSON.parse(stored) as Partial<WhatsAppConfig>;
    return sanitizeConfig(parsed);
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveWhatsAppConfig(config: WhatsAppConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function getWhatsAppCredentials(): WhatsAppConfig | null {
  const cfg = readWhatsAppConfig();
  if (!cfg.endpoint || !cfg.appkey || !cfg.authkey) return null;
  return cfg;
}

export function normalizeWhatsAppRecipient(raw?: string | null) {
  const digits = String(raw || "").replace(/\D+/g, "");
  if (!digits) return "";
  const last10 = digits.slice(-10);
  return `91${last10}`;
}
