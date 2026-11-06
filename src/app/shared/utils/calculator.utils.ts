// src/app/shared/utils/calculator.utils.ts
/**
 * Utility functions for the various financial calculators used in Phase 6.
 * All functions are pure and return plain objects that can be displayed
 * directly in the UI. No external services are required.
 */

/** SIP (Systematic Investment Plan) calculation */
export interface SipResult {
  investedAmount: number;
  futureValue: number;
  totalInterest: number;
}
export function calculateSip(monthlyInvestment: number, annualReturnRate: number, years: number): SipResult {
  const n = years * 12;
  const r = annualReturnRate / 12 / 100; // monthly rate as decimal
  const futureValue = monthlyInvestment * ((Math.pow(1 + r, n) - 1) / r) * (1 + r);
  const investedAmount = monthlyInvestment * n;
  const totalInterest = futureValue - investedAmount;
  return { investedAmount, futureValue, totalInterest };
}

/** Lumpsum calculation */
export interface LumpsumResult {
  investedAmount: number;
  futureValue: number;
  totalInterest: number;
}
export function calculateLumpsum(principal: number, annualReturnRate: number, years: number): LumpsumResult {
  const r = annualReturnRate / 100;
  const futureValue = principal * Math.pow(1 + r, years);
  const totalInterest = futureValue - principal;
  return { investedAmount: principal, futureValue, totalInterest };
}

/** EMI (Equated Monthly Installment) calculation */
export interface EmiResult {
  emi: number;
  totalInterest: number;
  totalPayment: number;
  schedule: { month: number; principal: number; interest: number; balance: number }[];
}
export function calculateEmi(loanAmount: number, annualInterestRate: number, tenureYears: number): EmiResult {
  const n = tenureYears * 12;
  const r = annualInterestRate / 12 / 100; // monthly interest rate
  const emi = loanAmount * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
  let balance = loanAmount;
  const schedule = [] as any[];
  let totalInterest = 0;
  for (let month = 1; month <= n; month++) {
    const interest = balance * r;
    const principal = emi - interest;
    balance = Math.max(0, balance - principal);
    totalInterest += interest;
    schedule.push({ month, principal, interest, balance });
  }
  const totalPayment = emi * n;
  return { emi, totalInterest, totalPayment, schedule };
}

/** Fixed Deposit (FD) calculation
 *  principal: amount deposited once
 *  rate: annual interest rate in %
 *  years: tenure in years
 *  compoundingFrequency: number of times interest is compounded per year (e.g., 1=annual, 4=quarterly, 12=monthly)
 */
export interface FdResult {
  maturityAmount: number;
  interestEarned: number;
}
export function calculateFd(principal: number, annualRate: number, years: number, compoundingFrequency: number = 1): FdResult {
  const r = annualRate / 100 / compoundingFrequency;
  const n = years * compoundingFrequency;
  const maturityAmount = principal * Math.pow(1 + r, n);
  const interestEarned = maturityAmount - principal;
  return { maturityAmount, interestEarned };
}

/** Recurring Deposit (RD) calculation
 *  monthlyInstallment: amount deposited each month
 *  rate: annual interest rate in %
 *  years: tenure in years
 *  compoundingFrequency: usually monthly (12)
 */
export interface RdResult {
  maturityAmount: number;
  interestEarned: number;
}
export function calculateRd(monthlyInstallment: number, annualRate: number, years: number, compoundingFrequency: number = 12): RdResult {
  const n = years * compoundingFrequency;
  const r = annualRate / 100 / compoundingFrequency;
  const maturityAmount = monthlyInstallment * ((Math.pow(1 + r, n) - 1) / r) * (1 + r);
  const totalInvested = monthlyInstallment * n;
  const interestEarned = maturityAmount - totalInvested;
  return { maturityAmount, interestEarned };
}

/** Retirement corpus calculation
 *  monthlyContribution: expected monthly savings after retirement goal set
 *  yearsToRetire: years left until retirement
 *  annualReturnRate: expected return rate before retirement
 *  postRetirementRate: expected return rate after retirement (for corpus growth)
 *  retirementYears: years of retirement period
 */
export interface RetirementResult {
  requiredCorpus: number;
  projectedCorpus: number;
  shortfall: number;
}
export function calculateRetirement(
  monthlyContribution: number,
  yearsToRetire: number,
  annualReturnRate: number,
  postRetirementRate: number,
  retirementYears: number
): RetirementResult {
  // Phase 1: Build corpus till retirement using SIP logic (monthlyContribution as SIP)
  const sip = calculateSip(monthlyContribution, annualReturnRate, yearsToRetire);
  const projectedCorpus = sip.futureValue;
  // Phase 2: Required corpus to support retirement expenses (assume same monthlyContribution needed after retirement)
  const r = postRetirementRate / 12 / 100;
  const n = retirementYears * 12;
  const requiredCorpus = monthlyContribution * ((Math.pow(1 + r, n) - 1) / r) * (1 + r);
  const shortfall = requiredCorpus - projectedCorpus;
  return { requiredCorpus, projectedCorpus, shortfall };
}

/**
 * Simplified Indian income tax estimator, old and new regimes.
 *
 * Illustrative only — it models the slab structure, standard deduction,
 * rebate and 4% cess, but not surcharge, capital-gains rates, or the many
 * special cases in the Act. Figures reflect the slabs commonly in force for
 * salaried individuals under 60; verify against the current Finance Act before
 * relying on them.
 */
export type TaxRegime = 'old' | 'new';

export interface TaxSlabBreakdown {
  from: number;
  to: number | null;
  rate: number;
  taxableInSlab: number;
  tax: number;
}

export interface TaxResult {
  regime: TaxRegime;
  grossIncome: number;
  standardDeduction: number;
  /** Deductions actually applied (the new regime ignores 80C/80D and similar). */
  deductionsApplied: number;
  taxableIncome: number;
  /** Tax before rebate and cess. */
  taxBeforeRebate: number;
  rebate: number;
  taxAfterRebate: number;
  cess: number;
  totalTax: number;
  /** Total tax as a share of gross income. */
  effectiveRate: number;
  slabs: TaxSlabBreakdown[];
}

interface Slab {
  upTo: number | null;
  rate: number;
}

/** Slab tables, as marginal rates applied to the band above the previous limit. */
const SLABS: Record<TaxRegime, Slab[]> = {
  // New regime (default): wider bands, no 80C/80D-style deductions.
  new: [
    { upTo: 400000, rate: 0 },
    { upTo: 800000, rate: 0.05 },
    { upTo: 1200000, rate: 0.1 },
    { upTo: 1600000, rate: 0.15 },
    { upTo: 2000000, rate: 0.2 },
    { upTo: 2400000, rate: 0.25 },
    { upTo: null, rate: 0.3 },
  ],
  // Old regime: narrower bands, deductions allowed.
  old: [
    { upTo: 250000, rate: 0 },
    { upTo: 500000, rate: 0.05 },
    { upTo: 1000000, rate: 0.2 },
    { upTo: null, rate: 0.3 },
  ],
};

const STANDARD_DEDUCTION: Record<TaxRegime, number> = {
  new: 75000,
  old: 50000,
};

/** Section 87A rebate: full relief up to this taxable income. */
const REBATE_LIMIT: Record<TaxRegime, number> = {
  new: 1200000,
  old: 500000,
};

const REBATE_CAP: Record<TaxRegime, number> = {
  new: 60000,
  old: 12500,
};

const CESS_RATE = 0.04;

export function estimateTax(
  grossIncome: number,
  deductions = 0,
  regime: TaxRegime = 'new'
): TaxResult {
  const gross = Math.max(0, grossIncome);
  const standardDeduction = gross > 0 ? STANDARD_DEDUCTION[regime] : 0;
  // Chapter VI-A deductions (80C, 80D, ...) are only available in the old regime.
  const chapterVia = regime === 'old' ? Math.max(0, deductions) : 0;
  const deductionsApplied = standardDeduction + chapterVia;
  const taxableIncome = Math.max(0, gross - deductionsApplied);

  const slabs: TaxSlabBreakdown[] = [];
  let taxBeforeRebate = 0;
  let previousLimit = 0;

  for (const slab of SLABS[regime]) {
    const upper = slab.upTo ?? Number.POSITIVE_INFINITY;
    const taxableInSlab = Math.max(
      0,
      Math.min(taxableIncome, upper) - previousLimit
    );
    if (taxableInSlab > 0) {
      const tax = taxableInSlab * slab.rate;
      taxBeforeRebate += tax;
      slabs.push({
        from: previousLimit,
        to: slab.upTo,
        rate: slab.rate,
        taxableInSlab,
        tax,
      });
    }
    previousLimit = upper;
    if (taxableIncome <= upper) break;
  }

  const rebate =
    taxableIncome <= REBATE_LIMIT[regime]
      ? Math.min(taxBeforeRebate, REBATE_CAP[regime])
      : 0;

  const taxAfterRebate = Math.max(0, taxBeforeRebate - rebate);
  const cess = taxAfterRebate * CESS_RATE;
  const totalTax = taxAfterRebate + cess;

  return {
    regime,
    grossIncome: gross,
    standardDeduction,
    deductionsApplied,
    taxableIncome,
    taxBeforeRebate,
    rebate,
    taxAfterRebate,
    cess,
    totalTax,
    effectiveRate: gross > 0 ? (totalTax / gross) * 100 : 0,
    slabs,
  };
}

/** Runs both regimes so the UI can show which one costs less. */
export function compareRegimes(
  grossIncome: number,
  deductions = 0
): { old: TaxResult; new: TaxResult; better: TaxRegime; saving: number } {
  const oldResult = estimateTax(grossIncome, deductions, 'old');
  const newResult = estimateTax(grossIncome, deductions, 'new');
  const better = newResult.totalTax <= oldResult.totalTax ? 'new' : 'old';
  return {
    old: oldResult,
    new: newResult,
    better,
    saving: Math.abs(oldResult.totalTax - newResult.totalTax),
  };
}
