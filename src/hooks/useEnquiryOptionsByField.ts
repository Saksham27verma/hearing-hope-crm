'use client';

import { useEffect, useState } from 'react';
import { db } from '@/firebase/config';
import type { FieldOptionResolved } from '@/lib/field-options/types';
import { buildEnquiryFieldDefaultsMap, subscribeEnquiryFieldOptionsMap } from '@/services/fieldOptionsService';

export function useEnquiryOptionsByField() {
  const [optionsByField, setOptionsByField] = useState<Record<string, FieldOptionResolved[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!db) {
      setOptionsByField(buildEnquiryFieldDefaultsMap());
      setLoading(false);
      setError('Firestore not configured');
      return;
    }
    setLoading(true);
    setError(null);
    const unsub = subscribeEnquiryFieldOptionsMap(
      db,
      (byField) => {
        setOptionsByField(byField);
        setLoading(false);
      },
      (e) => {
        setOptionsByField(buildEnquiryFieldDefaultsMap());
        setError(e.message);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  return { optionsByField, loading, error };
}
