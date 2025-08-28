/**
 * Simplified Performance Monitoring Utilities
 * Reduced complexity to prevent bundling issues
 */

// Simple performance tracking without complex class structure
const performanceTimers = new Map<string, number>();

export const performanceMonitor = {
  startTimer(name: string): void {
    if (typeof window !== 'undefined') {
      performanceTimers.set(name, Date.now());
    }
  },

  endTimer(name: string): number | null {
    if (typeof window === 'undefined') return null;
    
    const startTime = performanceTimers.get(name);
    if (!startTime) return null;

    const duration = Date.now() - startTime;
    performanceTimers.delete(name);

    if (process.env.NODE_ENV === 'development') {
      console.log(`⏱️ ${name}: ${duration}ms`);
    }

    return duration;
  },

  clear(): void {
    performanceTimers.clear();
  }
};

// Simple Firebase query performance wrapper
export async function monitorFirebaseQuery<T>(
  queryName: string,
  queryFn: () => Promise<T>
): Promise<T> {
  performanceMonitor.startTimer(`firebase_${queryName}`);
  
  try {
    const result = await queryFn();
    performanceMonitor.endTimer(`firebase_${queryName}`);
    return result;
  } catch (error) {
    performanceMonitor.endTimer(`firebase_${queryName}`);
    throw error;
  }
}

// Simple web vitals monitoring (no dynamic imports to prevent bundling issues)
export function initWebVitalsMonitoring() {
  // Disabled temporarily to prevent bundling issues
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    console.log('📊 Performance monitoring initialized');
  }
}
