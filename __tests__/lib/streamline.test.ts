import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildStreamlineRequest } from '@/lib/streamline';

describe('buildStreamlineRequest', () => {
  beforeEach(() => {
    vi.stubEnv('STREAMLINE_TOKEN_KEY', 'test-key');
    vi.stubEnv('STREAMLINE_TOKEN_SECRET', 'test-secret');
  });

  it('constructs correct JSON-RPC body', () => {
    const body = buildStreamlineRequest('GetPropertyList', { additional_variables: true });
    expect(body).toEqual({
      methodName: 'GetPropertyList',
      params: {
        token_key: 'test-key',
        token_secret: 'test-secret',
        additional_variables: true,
      },
    });
  });

  it('throws on missing env vars', () => {
    vi.stubEnv('STREAMLINE_TOKEN_KEY', '');
    expect(() => buildStreamlineRequest('GetPropertyList')).toThrow('Missing STREAMLINE');
  });
});
