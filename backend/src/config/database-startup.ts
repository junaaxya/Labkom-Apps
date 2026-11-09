type RetryContext = {
  attempt: number;
  maxAttempts: number;
  delayMs: number;
  error: unknown;
};

type DatabaseRetryOptions = {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  sleep?: (delayMs: number) => Promise<void>;
  onRetry?: (context: RetryContext) => void;
};

const defaultSleep = (delayMs: number) => new Promise<void>((resolve) => {
  setTimeout(resolve, delayMs);
});

export async function connectDatabaseWithRetry(
  connect: () => Promise<void>,
  options: DatabaseRetryOptions = {},
): Promise<void> {
  const maxAttempts = options.maxAttempts ?? 10;
  const initialDelayMs = options.initialDelayMs ?? 1_000;
  const maxDelayMs = options.maxDelayMs ?? 10_000;
  const sleep = options.sleep ?? defaultSleep;

  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new Error("maxAttempts must be a positive integer");
  }
  if (initialDelayMs < 0 || maxDelayMs < initialDelayMs) {
    throw new Error("database retry delays are invalid");
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await connect();
      return;
    } catch (error) {
      if (attempt >= maxAttempts) throw error;

      const delayMs = Math.min(initialDelayMs * (2 ** (attempt - 1)), maxDelayMs);
      options.onRetry?.({ attempt, maxAttempts, delayMs, error });
      await sleep(delayMs);
    }
  }
}
