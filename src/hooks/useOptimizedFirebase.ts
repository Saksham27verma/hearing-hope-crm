'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  collection, 
  getDocs, 
  query, 
  orderBy, 
  limit, 
  where,
  startAfter,
  DocumentSnapshot,
  QueryConstraint 
} from 'firebase/firestore';
import { db } from '@/firebase/config';
import { dataCache, CACHE_KEYS } from '@/utils/dataCache';

interface UseOptimizedCollectionOptions {
  cacheKey?: string;
  cacheTTL?: number;
  enablePagination?: boolean;
  pageSize?: number;
  orderByField?: string;
  orderDirection?: 'asc' | 'desc';
  whereConditions?: Array<{field: string, operator: any, value: any}>;
}

interface PaginationState {
  hasMore: boolean;
  lastDoc: DocumentSnapshot | null;
  currentPage: number;
}

export function useOptimizedCollection<T = any>(
  collectionName: string,
  options: UseOptimizedCollectionOptions = {}
) {
  const {
    cacheKey = collectionName,
    cacheTTL = 5 * 60 * 1000, // 5 minutes
    enablePagination = false,
    pageSize = 25,
    orderByField,
    orderDirection = 'desc',
    whereConditions = []
  } = options;

  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true); // Start with true to prevent hydration mismatch
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationState>({
    hasMore: true,
    lastDoc: null,
    currentPage: 0
  });

  const buildQuery = useCallback((startAfterDoc?: DocumentSnapshot) => {
    const constraints: QueryConstraint[] = [];

    // Add where conditions
    whereConditions.forEach(condition => {
      constraints.push(where(condition.field, condition.operator, condition.value));
    });

    // Add ordering
    if (orderByField) {
      constraints.push(orderBy(orderByField, orderDirection));
    }

    // Add pagination
    if (enablePagination) {
      if (startAfterDoc) {
        constraints.push(startAfter(startAfterDoc));
      }
      constraints.push(limit(pageSize));
    }

    return constraints.length > 0 
      ? query(collection(db, collectionName), ...constraints)
      : collection(db, collectionName);
  }, [collectionName, whereConditions, orderByField, orderDirection, enablePagination, pageSize]);

  const fetchData = useCallback(async (loadMore = false) => {
    if (!db) {
      setError('Database not initialized');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Check cache for initial load
      if (!loadMore && !enablePagination) {
        const cachedData = dataCache.get<T[]>(cacheKey);
        if (cachedData) {
          setData(cachedData);
          setLoading(false);
          return;
        }
      }

      const queryRef = buildQuery(loadMore ? pagination.lastDoc : undefined);
      const snapshot = await getDocs(queryRef);
      
      const newData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as T[];

      if (enablePagination) {
        if (loadMore) {
          setData(prev => [...prev, ...newData]);
        } else {
          setData(newData);
        }

        setPagination(prev => ({
          hasMore: newData.length === pageSize,
          lastDoc: snapshot.docs[snapshot.docs.length - 1] || null,
          currentPage: loadMore ? prev.currentPage + 1 : 0
        }));
      } else {
        setData(newData);
        // Cache the data
        dataCache.set(cacheKey, newData, cacheTTL);
      }

    } catch (err: any) {
      console.error(`Error fetching ${collectionName}:`, err);
      setError(err.message || `Failed to fetch ${collectionName}`);
    } finally {
      setLoading(false);
    }
  }, [collectionName, cacheKey, cacheTTL, buildQuery, enablePagination, pageSize, pagination.lastDoc]);

  const loadMore = useCallback(() => {
    if (enablePagination && pagination.hasMore && !loading) {
      fetchData(true);
    }
  }, [enablePagination, pagination.hasMore, loading, fetchData]);

  const refresh = useCallback(() => {
    dataCache.invalidate(cacheKey);
    setPagination({
      hasMore: true,
      lastDoc: null,
      currentPage: 0
    });
    fetchData(false);
  }, [cacheKey, fetchData]);

  // Initial fetch
  useEffect(() => {
    fetchData(false);
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    pagination,
    loadMore,
    refresh,
    hasMore: pagination.hasMore
  };
}

// Optimized dashboard data hook
export function useOptimizedDashboard() {
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalVisitors: 0,
    totalSales: 0,
    monthlySales: 0,
    monthlyRevenue: 0
  });
  const [loading, setLoading] = useState(true); // Start with true to prevent hydration mismatch
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async () => {
    if (!db) return;

    try {
      setLoading(true);
      setError(null);

      // Check cache first
      const cachedStats = dataCache.get(CACHE_KEYS.DASHBOARD_STATS);
      if (cachedStats) {
        setStats(cachedStats);
        setLoading(false);
        return;
      }

      // Get counts efficiently (just count, don't fetch all data)
      const [productsSnap, visitorsSnap, salesSnap] = await Promise.all([
        getDocs(collection(db, 'products')),
        getDocs(collection(db, 'visitors')),
        getDocs(collection(db, 'sales'))
      ]);

      // Calculate monthly data for current month only
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      
      const monthlySalesQuery = query(
        collection(db, 'sales'),
        where('saleDate', '>=', firstDayOfMonth),
        orderBy('saleDate', 'desc')
      );
      
      const monthlySalesSnap = await getDocs(monthlySalesQuery);
      
      let monthlyRevenue = 0;
      monthlySalesSnap.forEach(doc => {
        const saleData = doc.data();
        monthlyRevenue += saleData.totalAmount || 0;
      });

      const newStats = {
        totalProducts: productsSnap.size,
        totalVisitors: visitorsSnap.size,
        totalSales: salesSnap.size,
        monthlySales: monthlySalesSnap.size,
        monthlyRevenue
      };

      setStats(newStats);
      
      // Cache for 10 minutes
      dataCache.set(CACHE_KEYS.DASHBOARD_STATS, newStats, 10 * 60 * 1000);

    } catch (err: any) {
      console.error('Error fetching dashboard data:', err);
      setError(err.message || 'Failed to fetch dashboard data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  return { stats, loading, error, refresh: fetchDashboardData };
}

// Optimized products hook with caching
export function useOptimizedProducts() {
  return useOptimizedCollection('products', {
    cacheKey: CACHE_KEYS.PRODUCTS,
    cacheTTL: 10 * 60 * 1000, // Products don't change often, cache for 10 minutes
    orderByField: 'name',
    orderDirection: 'asc'
  });
}

// Optimized centers hook
export function useOptimizedCenters() {
  return useOptimizedCollection('centers', {
    cacheKey: CACHE_KEYS.CENTERS,
    cacheTTL: 15 * 60 * 1000, // Centers rarely change, cache for 15 minutes
    orderByField: 'name',
    orderDirection: 'asc'
  });
}
