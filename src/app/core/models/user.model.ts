/** User account model */
export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  currency: 'INR' | 'USD' | 'EUR';
  monthlyIncome: number;
  riskProfile: 'low' | 'moderate' | 'high';
  avatar?: string;
}
