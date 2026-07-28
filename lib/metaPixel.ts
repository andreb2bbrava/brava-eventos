export type MarketingConsentStatus = "unknown" | "accepted" | "rejected";

export type CompleteRegistrationPayload = {
  content_name: string;
  content_category: "lista_evento";
  event_source: "brava_eventos";
  num_items: number;
};

export type TrackMetaCompleteRegistrationInput = {
  pixelId?: string | null;
  listaNome: string;
  quantidade: number;
  eventKey: string;
};

export const MARKETING_CONSENT_STORAGE_KEY = "brava_marketing_consent";

const PIXEL_ID_REGEX = /^\d{8,30}$/;

type FbqTrackPayload = Record<string, string | number | boolean | null | undefined>;

type FbqFunction = {
  (command: "init", pixelId: string): void;
  (command: "track", eventName: string, payload?: FbqTrackPayload): void;
  (command: "trackSingle", pixelId: string, eventName: string, payload?: FbqTrackPayload): void;
};

type MetaPixelRuntimeState = {
  initializedPixelIds: Set<string>;
  sentEventKeys: Set<string>;
};

declare global {
  interface Window {
    fbq?: FbqFunction;
    _fbq?: FbqFunction;
    __metaPixelRuntimeState?: MetaPixelRuntimeState;
  }
}

function debugMetaPixelLog(message: string, details?: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "production") {
    if (details) {
      console.log(message, details);
      return;
    }

    console.log(message);
  }
}

function debugMetaPixelWarn(message: string, details?: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "production") {
    if (details) {
      console.warn(message, details);
      return;
    }

    console.warn(message);
  }
}

function getRuntimeState(): MetaPixelRuntimeState {
  if (typeof window === "undefined") {
    return {
      initializedPixelIds: new Set<string>(),
      sentEventKeys: new Set<string>(),
    };
  }

  if (!window.__metaPixelRuntimeState) {
    window.__metaPixelRuntimeState = {
      initializedPixelIds: new Set<string>(),
      sentEventKeys: new Set<string>(),
    };
  }

  return window.__metaPixelRuntimeState;
}

export function sanitizeMetaPixelId(value: string | null | undefined) {
  const sanitized = (value || "").replace(/\s+/g, "").trim();
  return PIXEL_ID_REGEX.test(sanitized) ? sanitized : null;
}

export function isMetaPixelIdValid(value: string | null | undefined) {
  return sanitizeMetaPixelId(value) !== null;
}

export function readMarketingConsentFromStorage(): MarketingConsentStatus {
  if (typeof window === "undefined") {
    return "unknown";
  }

  const stored = window.localStorage.getItem(MARKETING_CONSENT_STORAGE_KEY);
  if (stored === "accepted" || stored === "rejected") {
    return stored;
  }

  return "unknown";
}

export function writeMarketingConsentToStorage(status: Exclude<MarketingConsentStatus, "unknown">) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(MARKETING_CONSENT_STORAGE_KEY, status);
}

export function initMetaPixel(pixelId: string) {
  if (typeof window === "undefined") {
    return false;
  }

  const safePixelId = sanitizeMetaPixelId(pixelId);
  if (!safePixelId) {
    return false;
  }

  if (typeof window.fbq !== "function") {
    return false;
  }

  const state = getRuntimeState();
  if (state.initializedPixelIds.has(safePixelId)) {
    return true;
  }

  window.fbq("init", safePixelId);
  state.initializedPixelIds.add(safePixelId);
  debugMetaPixelLog(`[META PIXEL] Inicializado: ${safePixelId}`);
  return true;
}

export function trackMetaPixelPageViewOnce(pixelId: string, eventKey: string) {
  if (typeof window === "undefined") {
    return false;
  }

  const safePixelId = sanitizeMetaPixelId(pixelId);
  if (!safePixelId) {
    return false;
  }

  if (typeof window.fbq !== "function") {
    debugMetaPixelWarn("[META PIXEL] Bloqueado ou indisponível", { tipo: "PageView", pixelId: safePixelId });
    return false;
  }

  const state = getRuntimeState();
  const fullEventKey = `PageView:${eventKey}`;

  if (state.sentEventKeys.has(fullEventKey)) {
    return false;
  }

  window.fbq("trackSingle", safePixelId, "PageView");
  state.sentEventKeys.add(fullEventKey);
  debugMetaPixelLog("[META PIXEL] PageView disparado", { pixelId: safePixelId, eventKey: fullEventKey });
  return true;
}

export function trackCompleteRegistrationOnce(
  pixelId: string,
  eventKey: string,
  payload: CompleteRegistrationPayload
) {
  if (typeof window === "undefined") {
    return false;
  }

  const safePixelId = sanitizeMetaPixelId(pixelId);
  if (!safePixelId) {
    return false;
  }

  if (typeof window.fbq !== "function") {
    debugMetaPixelWarn("[META PIXEL] Bloqueado ou indisponível", { tipo: "CompleteRegistration", pixelId: safePixelId });
    return false;
  }

  const state = getRuntimeState();
  const fullEventKey = `CompleteRegistration:${eventKey}`;

  if (state.sentEventKeys.has(fullEventKey)) {
    return false;
  }

  window.fbq("trackSingle", safePixelId, "CompleteRegistration", payload);
  state.sentEventKeys.add(fullEventKey);
  debugMetaPixelLog("[META PIXEL] CompleteRegistration disparado", {
    pixelId: safePixelId,
    eventKey: fullEventKey,
    num_items: payload.num_items,
  });
  return true;
}

export function trackMetaCompleteRegistration({ pixelId, listaNome, quantidade, eventKey }: TrackMetaCompleteRegistrationInput) {
  if (typeof window === "undefined") {
    return false;
  }

  const safePixelId = sanitizeMetaPixelId(pixelId);
  if (!safePixelId) {
    return false;
  }

  if (!Number.isFinite(quantidade) || quantidade <= 0) {
    return false;
  }

  if (typeof window.fbq !== "function") {
    debugMetaPixelWarn("[META PIXEL] Bloqueado ou indisponível", { tipo: "CompleteRegistration", pixelId: safePixelId });
    return false;
  }

  return trackCompleteRegistrationOnce(safePixelId, eventKey, {
    content_name: listaNome,
    content_category: "lista_evento",
    event_source: "brava_eventos",
    num_items: quantidade,
  });
}
