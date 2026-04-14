export type ExpenseScopeType = 'center' | 'global';

export type ExpenseStatus = 'active' | 'archived';

export interface ManagedExpense {
  id: string;
  date: string;
  amount: number;
  category: string;
  subCategory?: string;
  vendor?: string;
  notes?: string;
  scopeType: ExpenseScopeType;
  centerId?: string;
  centerName?: string;
  status: ExpenseStatus;
  createdBy: string;
  updatedBy: string;
  createdAt: number;
  updatedAt: number;
}

export interface ManagedExpenseInput {
  date: string;
  amount: number;
  category: string;
  subCategory?: string;
  vendor?: string;
  notes?: string;
  scopeType: ExpenseScopeType;
  centerId?: string;
  centerName?: string;
  status?: ExpenseStatus;
}
