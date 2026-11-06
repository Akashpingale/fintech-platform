/** Transaction model (income or expense) */
export interface Transaction {
  id: string;
  userId: string;
  type: 'income' | 'expense';
  amount: number;
  category: string;
  date: string; // ISO date string
  paymentMethod: 'cash' | 'upi' | 'card' | 'bank';
  notes?: string;
  tags?: string[];
  recurring?: {
    frequency: 'weekly' | 'monthly' | 'yearly';
    endDate?: string;
  };
}

/** Expense categories */
export const EXPENSE_CATEGORIES = [
  'Food',
  'Rent',
  'Transport',
  'Shopping',
  'Bills',
  'Health',
  'Education',
  'Entertainment',
  'Other',
] as const;

/** Income categories */
export const INCOME_CATEGORIES = [
  'Salary',
  'Freelance',
  'Business',
  'Investment',
  'Gift',
  'Other',
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
export type IncomeCategory = (typeof INCOME_CATEGORIES)[number];
