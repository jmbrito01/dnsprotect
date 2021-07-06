export interface RedisClientInjectionOptions {
  url: string;
  cacheEmptyResults?: boolean;
  cachedEmptyResultsTTL?: number;
}

export const REDIS_CLIENT_KEY_PREFIX = 'dnsprotect.dns.cache.';
export const DEFAULT_EMPTY_TTL_CACHE = 5;