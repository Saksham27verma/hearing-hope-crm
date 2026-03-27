'use client';

import { useEffect, useState } from 'react';
import { db } from '@/firebase/config';
import type { FieldOptionResolved } from '@/lib/field-options/types';
import { subscribeFieldOptions } from '@/services/fieldOptionsService';

export function useFieldOptions(moduleKey: string, fieldKey: string) {
  const [options, setOptions] = useState<FieldOptionResolved[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!db) {
      setLoading(false);
      setError('Firestore not configured');
      return;
    }
    setLoading(true);
    setError(null);
    const unsub = subscribeFieldOptions(
      db,
      moduleKey,
      fieldKey,
      (opts) => {
        setOptions(opts);
        setLoading(false);
      },
      (e) => {
        setError(e.message);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [moduleKey, fieldKey]);

  return { options, loading, error };
}
