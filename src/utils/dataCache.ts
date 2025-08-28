/**
 * Data Cache Utility for Firebase Data
 * Reduces redundant API calls and improves performance
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresIn: number;
}

class DataCache {
  private cache = new Map<string, CacheEntry<any>>();
  
  // Default cache duration (5 minutes)
  private defaultTTL = 5 * 60 * 1000;

  set<T>(key: string, data: T, ttl?: number): void {
    const expiresIn = ttl || this.defaultTTL;
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      expiresIn,
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > entry.expiresIn) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return false;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > entry.expiresIn) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }

  invalidatePattern(pattern: string): void {
    const regex = new RegExp(pattern);
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  // Cleanup expired entries
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.expiresIn) {
        this.cache.delete(key);
      }
    }
  }
}

// Global cache instance
export const dataCache = new DataCache();

// Cache keys for common data
export const CACHE_KEYS = {
  PRODUCTS: 'products',
  CENTERS: 'centers',
  USERS: 'users',
  VISITORS: 'visitors',
  DASHBOARD_STATS: 'dashboard_stats',
  INVENTORY_DATA: 'inventory_data',
  SALES_DATA: 'sales_data',
  MATERIAL_IN: 'material_in',
  MATERIAL_OUT: 'material_out',
  PURCHASES: 'purchases',
  ENQUIRIES: 'enquiries',
} as const;

// Auto cleanup every 10 minutes (client-side only)
if (typeof window !== 'undefined') {
  // Use setTimeout to avoid blocking the main thread
  setTimeout(() => {
    setInterval(() => {
      dataCache.cleanup();
    }, 10 * 60 * 1000);
  }, 1000);
}
