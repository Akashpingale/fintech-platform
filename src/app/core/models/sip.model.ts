/** Systematic Investment Plan (SIP) model */
export interface Sip {
  id: string;
  userId: string;
  fundName: string;
  amount: number;
  dayOfMonth: number;
  startDate: string; // ISO date string
  durationMonths: number;
  expectedReturn: number; // annual % return
}
