/**
 * Performance Monitoring Utilities
 * For production monitoring and optimization
 */

interface PerformanceMetrics {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  metadata?: Record<string, any>;
}

class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetrics> = new Map();
  private isProduction = process.env.NODE_ENV === 'production';

  // Start timing an operation
  startTimer(name: string, metadata?: Record<string, any>): void {
    const startTime = performance.now();
    this.metrics.set(name, {
      name,
      startTime,
      metadata
    });

    if (!this.isProduction) {
      console.time(name);
    }
  }

  // End timing an operation
  endTimer(name: string): number | null {
    const metric = this.metrics.get(name);
    if (!metric) {
      console.warn(`Timer "${name}" was not started`);
      return null;
    }

    const endTime = performance.now();
    const duration = endTime - metric.startTime;

    metric.endTime = endTime;
    metric.duration = duration;

    if (!this.isProduction) {
      console.timeEnd(name);
      console.log(`⏱️ ${name}: ${duration.toFixed(2)}ms`);
    }

    // Log slow operations in production
    if (this.isProduction && duration > 1000) {
      console.warn(`Slow operation detected: ${name} took ${duration.toFixed(2)}ms`, metric.metadata);
    }

    return duration;
  }

  // Get metrics for analysis
  getMetrics(): PerformanceMetrics[] {
    return Array.from(this.metrics.values()).filter(m => m.duration !== undefined);
  }

  // Clear metrics
  clearMetrics(): void {
    this.metrics.clear();
  }

  // Log performance summary
  logSummary(): void {
    const completedMetrics = this.getMetrics();
    if (completedMetrics.length === 0) return;

    const totalTime = completedMetrics.reduce((sum, m) => sum + (m.duration || 0), 0);
    const averageTime = totalTime / completedMetrics.length;

    console.group('📊 Performance Summary');
    console.log(`Total operations: ${completedMetrics.length}`);
    console.log(`Total time: ${totalTime.toFixed(2)}ms`);
    console.log(`Average time: ${averageTime.toFixed(2)}ms`);
    
    // Show slowest operations
    const sortedMetrics = completedMetrics.sort((a, b) => (b.duration || 0) - (a.duration || 0));
    console.log('Slowest operations:');
    sortedMetrics.slice(0, 5).forEach(m => {
      console.log(`  ${m.name}: ${m.duration?.toFixed(2)}ms`);
    });
    
    console.groupEnd();
  }
}

// Global performance monitor instance
export const performanceMonitor = new PerformanceMonitor();

// HOC for monitoring React component render performance
export function withPerformanceMonitoring<T extends object>(
  Component: React.ComponentType<T>,
  componentName?: string
) {
  const WrappedComponent = (props: T) => {
    const name = componentName || Component.displayName || Component.name || 'Component';
    
    React.useEffect(() => {
      performanceMonitor.startTimer(`${name}_mount`);
      return () => {
        performanceMonitor.endTimer(`${name}_mount`);
      };
    }, [name]);

    return React.createElement(Component, props);
  };

  WrappedComponent.displayName = `withPerformanceMonitoring(${Component.displayName || Component.name})`;
  return WrappedComponent;
}

// Hook for monitoring custom operations
export function usePerformanceTimer(operationName: string) {
  const startTimer = React.useCallback((metadata?: Record<string, any>) => {
    performanceMonitor.startTimer(operationName, metadata);
  }, [operationName]);

  const endTimer = React.useCallback(() => {
    return performanceMonitor.endTimer(operationName);
  }, [operationName]);

  return { startTimer, endTimer };
}

// Firebase query performance wrapper
export async function monitorFirebaseQuery<T>(
  queryName: string,
  queryFn: () => Promise<T>,
  metadata?: Record<string, any>
): Promise<T> {
  performanceMonitor.startTimer(`firebase_${queryName}`, metadata);
  
  try {
    const result = await queryFn();
    performanceMonitor.endTimer(`firebase_${queryName}`);
    return result;
  } catch (error) {
    performanceMonitor.endTimer(`firebase_${queryName}`);
    throw error;
  }
}

// Web Vitals monitoring (for production)
export function initWebVitalsMonitoring() {
  if (typeof window === 'undefined' || !process.env.NODE_ENV === 'production') {
    return;
  }

  // Monitor Core Web Vitals
  import('web-vitals').then(({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {
    getCLS(console.log);
    getFID(console.log);
    getFCP(console.log);
    getLCP(console.log);
    getTTFB(console.log);
  }).catch(() => {
    // web-vitals not available
  });
}

// Bundle size analyzer (development only)
export function logBundleInfo() {
  if (process.env.NODE_ENV !== 'development') return;

  // Log information about the current bundle
  console.group('📦 Bundle Information');
  console.log('Next.js version:', process.env.NEXT_PUBLIC_VERCEL_ENV || 'development');
  console.log('React version:', React.version);
  console.log('Environment:', process.env.NODE_ENV);
  console.groupEnd();
}
