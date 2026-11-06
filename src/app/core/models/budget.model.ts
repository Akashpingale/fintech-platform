/** Monthly budget per category */
export interface Budget {
  id: string;
  userId: string;
  category: string;
  month: string; // format: YYYY-MM
  limit: number;
}

/** Budget status based on usage percentage */
export type BudgetStatus = 'green' | 'amber' | 'red';

export function getBudgetStatus(spent: number, limit: number): BudgetStatus {
  const pct = limit > 0 ? (spent / limit) * 100 : 0;
  if (pct >= 100) return 'red';
  if (pct >= 80) return 'amber';
  return 'green';
}
