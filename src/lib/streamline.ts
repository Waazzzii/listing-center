interface StreamlineResponse {
  data: unknown;
  status?: string;
  error_code?: string;
  error_message?: string;
}

export function buildStreamlineRequest(methodName: string, params: Record<string, unknown> = {}) {
  const tokenKey = process.env.STREAMLINE_TOKEN_KEY;
  const tokenSecret = process.env.STREAMLINE_TOKEN_SECRET;

  if (!tokenKey || !tokenSecret) {
    throw new Error('Missing STREAMLINE_TOKEN_KEY or STREAMLINE_TOKEN_SECRET environment variables');
  }

  return {
    methodName,
    params: {
      token_key: tokenKey,
      token_secret: tokenSecret,
      ...params,
    },
  };
}

export async function callStreamline(methodName: string, params: Record<string, unknown> = {}): Promise<unknown> {
  const apiUrl = process.env.STREAMLINE_API_URL;
  if (!apiUrl) throw new Error('Missing STREAMLINE_API_URL environment variable');

  const body = buildStreamlineRequest(methodName, params);

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Streamline API HTTP error: ${response.status}`);
  }

  const result: StreamlineResponse = await response.json();

  if (result.error_code) {
    throw new Error(`Streamline API error ${result.error_code}: ${result.error_message}`);
  }

  return result.data;
}

export async function callStreamlineBatch<T>(
  calls: Array<{ method: string; params: Record<string, unknown> }>,
  concurrency: number = 10,
  delayMs: number = 200,
): Promise<T[]> {
  const results: T[] = [];

  for (let i = 0; i < calls.length; i += concurrency) {
    const batch = calls.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(
      batch.map(c => callStreamline(c.method, c.params))
    );

    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        results.push(result.value as T);
      } else {
        console.error('Streamline batch call failed:', result.reason);
      }
    }

    if (i + concurrency < calls.length) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  return results;
}
