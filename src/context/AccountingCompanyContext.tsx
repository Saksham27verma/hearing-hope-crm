'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { fetchBusinessCompanies, type BusinessCompany } from '@/utils/businessCompanies';

const STORAGE_KEY = 'crm-accounting-company-v1';

export type AccountingCompanyContextValue = {
  companies: BusinessCompany[];
  companiesLoading: boolean;
  selectedCompanyId: string | null;
  selectedCompanyName: string;
  setSelectedCompanyId: (id: string | null) => void;
  reloadCompanies: () => Promise<void>;
};

const AccountingCompanyContext = createContext<AccountingCompanyContextValue | null>(null);

export function AccountingCompanyProvider({ children }: { children: React.ReactNode }) {
  const [companies, setCompanies] = useState<BusinessCompany[]>([]);
  const [companiesLoading, setCompaniesLoading] = useState(true);
  const [selectedCompanyId, setSelectedCompanyIdState] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const v = localStorage.getItem(STORAGE_KEY);
    if (v) setSelectedCompanyIdState(v);
  }, []);

  const setSelectedCompanyId = useCallback((id: string | null) => {
    setSelectedCompanyIdState(id);
    if (typeof window !== 'undefined') {
      if (id) localStorage.setItem(STORAGE_KEY, id);
      else localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const reloadCompanies = useCallback(async () => {
    setCompaniesLoading(true);
    try {
      const list = await fetchBusinessCompanies();
      setCompanies(list);
    } catch (e) {
      console.warn('AccountingCompany: failed to load companies', e);
    } finally {
      setCompaniesLoading(false);
    }
  }, []);

  useEffect(() => {
    void reloadCompanies();
  }, [reloadCompanies]);

  const selectedCompanyName = useMemo(() => {
    if (!selectedCompanyId) return '';
    const c = companies.find((x) => x.id === selectedCompanyId);
    return c?.name || '';
  }, [companies, selectedCompanyId]);

  const value = useMemo<AccountingCompanyContextValue>(
    () => ({
      companies,
      companiesLoading,
      selectedCompanyId,
      selectedCompanyName,
      setSelectedCompanyId,
      reloadCompanies,
    }),
    [companies, companiesLoading, selectedCompanyId, selectedCompanyName, setSelectedCompanyId, reloadCompanies],
  );

  return (
    <AccountingCompanyContext.Provider value={value}>{children}</AccountingCompanyContext.Provider>
  );
}

export function useAccountingCompany(): AccountingCompanyContextValue {
  const ctx = useContext(AccountingCompanyContext);
  if (!ctx) {
    throw new Error('useAccountingCompany must be used within AccountingCompanyProvider');
  }
  return ctx;
}
