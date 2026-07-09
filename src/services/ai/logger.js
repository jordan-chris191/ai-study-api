const isDev = process.env.NODE_ENV !== "production";

// One structured line per attempt (success or failure) instead of a bare
// console.error(err). Never logs the actual source content or API key —
// only shapes/lengths/previews, so this is safe to ship to a log aggregator.
export function logGeneration({
  task,
  model,
  provider,
  durationMs,
  retryCount = 0,
  responseLength,
  truncatedInput,
  error,
  responsePreview,
}) {
  const base = {
    task,
    provider,
    model,
    durationMs,
    retryCount,
    ...(responseLength !== undefined && { responseLength }),
    ...(truncatedInput && { truncatedInput }),
  };

  if (error) {
    console.error("[gemini] generation attempt failed", {
      ...base,
      errorType: error.type,
      errorMessage: error.message,
      retryable: error.retryable,
      ...((responsePreview || error.preview) && {
        responsePreview: (responsePreview || error.preview)?.slice(0, 200),
      }),
      ...(isDev && error.raw?.stack && { stack: error.raw.stack }),
    });
    return;
  }

  console.log("[gemini] generation succeeded", base);
}