import {
  DEFAULT_TIMEOUT_MS,
  MAX_RETRIES,
  BASE_RETRY_DELAY_MS,
  MAX_RETRY_DELAY_MS,
} from "./config.js";
import { assertHasContent, truncateInput } from "./textUtils.js";
import { classifyError, toAppError, GenerationValidationError } from "./errors.js";
import { logGeneration } from "./logger.js";
import { geminiProvider } from "./providers/gemini.js";
import { openRouterProvider, isOpenRouterConfigured } from "./providers/openrouter.js";

// Gemini is always primary. OpenRouter is only added if OPENROUTER_API_KEY is
// set - apps that don't configure it behave exactly as before.
const PROVIDERS = [geminiProvider, ...(isOpenRouterConfigured ? [openRouterProvider] : [])];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backoffDelay(attempt) {
  const exponential = BASE_RETRY_DELAY_MS * 2 ** attempt;
  const jitter = Math.random() * BASE_RETRY_DELAY_MS;
  return Math.min(exponential + jitter, MAX_RETRY_DELAY_MS);
}

// Runs one provider through its own retry+timeout loop. Only throws after
// every retry against THIS provider is exhausted - generate() decides
// whether to try the next provider afterward.
async function runProviderWithRetries(
  provider,
  safeInput,
  { task, systemInstruction, generationConfig, responseSchema, timeoutMs, maxRetries, validateResponse, truncated }
) {
  let lastClassified;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const startedAt = Date.now();

    try {
      const raw = await provider.call(safeInput, {
        systemInstruction,
        generationConfig,
        responseSchema,
        abortSignal: controller.signal,
      });

      const text = (raw ?? "").trim();
      if (!text) {
        throw new GenerationValidationError(`${provider.name} returned an empty response.`, {
          reason: "empty",
        });
      }

      if (validateResponse) {
        validateResponse(text);
      }

      logGeneration({
        task,
        provider: provider.name,
        model: provider.model,
        durationMs: Date.now() - startedAt,
        retryCount: attempt,
        responseLength: text.length,
        truncatedInput: truncated,
      });

      return text;
    } catch (err) {
      const classified = classifyError(err);
      lastClassified = classified;

      logGeneration({
        task,
        provider: provider.name,
        model: provider.model,
        durationMs: Date.now() - startedAt,
        retryCount: attempt,
        error: classified,
      });

      const isLastAttempt = attempt === maxRetries;
      if (!classified.retryable || isLastAttempt) {
        throw toAppError(classified);
      }

      await sleep(backoffDelay(attempt));
    } finally {
      clearTimeout(timer);
    }
  }

  throw toAppError(lastClassified);
}

export async function generate(
  input,
  {
    task = "generate",
    systemInstruction,
    generationConfig = {},
    responseSchema,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxRetries = MAX_RETRIES,
    validateResponse,
  } = {}
) {
  assertHasContent(input, "input");
  const { text: safeInput, truncated } = truncateInput(input);

  let lastError;

  for (const provider of PROVIDERS) {
    try {
      return await runProviderWithRetries(provider, safeInput, {
        task,
        systemInstruction,
        generationConfig,
        responseSchema,
        timeoutMs,
        maxRetries,
        validateResponse,
        truncated,
      });
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError;
}