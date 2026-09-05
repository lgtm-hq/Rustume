export interface BillingCheckoutSettings {
  client_token: string;
  price_id: string;
  email: string;
  custom_data: Record<string, unknown>;
  environment: "sandbox" | "production";
}

export interface BillingPortalResponse {
  url: string;
}

const PADDLE_SCRIPT_SRC = "https://cdn.paddle.com/paddle/v2/paddle.js";

let paddleScriptPromise: Promise<void> | null = null;
let paddleInitialized = false;
let paddleInitializedToken: string | null = null;
let paddleInitializedEnvironment: BillingCheckoutSettings["environment"] | null = null;

function resetPaddleScriptState(): void {
  paddleScriptPromise = null;
  paddleInitialized = false;
  paddleInitializedToken = null;
  paddleInitializedEnvironment = null;
  delete window.Paddle;
  document.querySelector(`script[src="${PADDLE_SCRIPT_SRC}"]`)?.remove();
}

async function reloadPaddleScript(): Promise<NonNullable<Window["Paddle"]>> {
  resetPaddleScriptState();
  await loadPaddleScript();

  const paddle = window.Paddle;
  if (!paddle) {
    throw new Error("Paddle.js failed to initialize");
  }

  return paddle;
}

async function ensurePaddleInitialized(
  settings: BillingCheckoutSettings,
  paddle: NonNullable<Window["Paddle"]>,
): Promise<NonNullable<Window["Paddle"]>> {
  const configChanged =
    paddleInitialized &&
    (paddleInitializedToken !== settings.client_token ||
      paddleInitializedEnvironment !== settings.environment);

  if (configChanged) {
    paddle = await reloadPaddleScript();
  }

  if (paddle.Environment) {
    paddle.Environment.set(settings.environment);
  }

  if (!paddleInitialized) {
    paddle.Initialize({ token: settings.client_token });
    paddleInitialized = true;
    paddleInitializedToken = settings.client_token;
    paddleInitializedEnvironment = settings.environment;
  }

  return paddle;
}

function loadPaddleScript(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Paddle checkout is only available in the browser"));
  }

  if (window.Paddle) {
    return Promise.resolve();
  }

  paddleScriptPromise ??= new Promise<void>((resolve, reject) => {
    const fail = (script: HTMLScriptElement, error: Error) => {
      script.remove();
      paddleScriptPromise = null;
      reject(error);
    };

    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${PADDLE_SCRIPT_SRC}"]`,
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => fail(existing, new Error("Failed to load Paddle.js")),
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.src = PADDLE_SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => fail(script, new Error("Failed to load Paddle.js"));
    document.head.appendChild(script);
  });

  return paddleScriptPromise;
}

async function parseApiError(response: Response): Promise<string> {
  const text = await response.text();
  try {
    const json = JSON.parse(text) as { error?: string };
    if (typeof json.error === "string") {
      return json.error;
    }
  } catch {
    // Keep raw text when the body is not JSON.
  }
  return text || response.statusText;
}

/** Fetch checkout overlay settings for the signed-in user. */
export async function fetchCheckoutSettings(): Promise<BillingCheckoutSettings> {
  const response = await fetch("/api/billing/checkout", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  return (await response.json()) as BillingCheckoutSettings;
}

/** Fetch an authenticated Paddle customer portal URL. */
export async function fetchPortalUrl(): Promise<string> {
  const response = await fetch("/api/billing/portal", {
    method: "GET",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  const payload = (await response.json()) as BillingPortalResponse;
  return payload.url;
}

/** Load Paddle.js and open the hosted checkout overlay. */
export async function openCheckout(onComplete?: () => void): Promise<void> {
  const settings = await fetchCheckoutSettings();
  await loadPaddleScript();

  let paddle = window.Paddle;
  if (!paddle) {
    throw new Error("Paddle.js failed to initialize");
  }

  paddle = await ensurePaddleInitialized(settings, paddle);

  paddle.Checkout.open({
    items: [{ priceId: settings.price_id, quantity: 1 }],
    customer: { email: settings.email },
    customData: settings.custom_data,
    settings: {
      displayMode: "overlay",
    },
    eventCallback: (event: { name?: string }) => {
      if (event.name === "checkout.completed" && onComplete) {
        onComplete();
      }
    },
  });
}

/** Redirect the browser to the Paddle customer portal. */
export async function redirectToPortal(): Promise<void> {
  const url = await fetchPortalUrl();
  window.location.assign(url);
}

/** Reset cached Paddle.js state (for tests). */
export function resetPaddleClientForTests(): void {
  resetPaddleScriptState();
}

declare global {
  interface Window {
    Paddle?: {
      Environment?: { set: (environment: string) => void };
      Initialize: (options: { token: string }) => void;
      Checkout: {
        open: (options: Record<string, unknown>) => void;
      };
    };
  }
}
