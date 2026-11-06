/**
 * Material icon per transaction category, so a category looks the same
 * everywhere it appears (tables, charts legends, budget cards).
 */
export const CATEGORY_ICONS: Record<string, string> = {
  // Expenses
  Food: 'restaurant',
  Rent: 'home_work',
  Transport: 'directions_bus',
  Shopping: 'shopping_bag',
  Bills: 'receipt',
  Health: 'favorite',
  Education: 'school',
  Entertainment: 'movie',
  // Income
  Salary: 'payments',
  Freelance: 'work_outline',
  Business: 'storefront',
  Investment: 'trending_up',
  Gift: 'card_giftcard',
  // Fallback
  Other: 'category',
};

/** Icon for a category, with a sensible default for custom categories. */
export function categoryIcon(category: string): string {
  return CATEGORY_ICONS[category] ?? 'receipt_long';
}

/** Icon per payment method. */
export const PAYMENT_METHOD_ICONS: Record<string, string> = {
  cash: 'payments',
  upi: 'qr_code_2',
  card: 'credit_card',
  bank: 'account_balance',
};
