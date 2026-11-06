import {
  calculateEmi,
  calculateFd,
  calculateLumpsum,
  calculateRd,
  calculateSip,
  compareRegimes,
  estimateTax,
} from './calculator.utils';

describe('calculateSip', () => {
  it('matches the standard SIP formula', () => {
    // 10,000/month at 12% for 10 years is about 23.2 lakh.
    const result = calculateSip(10000, 12, 10);
    expect(result.investedAmount).toBe(1200000);
    expect(result.futureValue).toBeGreaterThan(2300000);
    expect(result.futureValue).toBeLessThan(2350000);
  });

  it('keeps future value equal to invested plus interest', () => {
    const result = calculateSip(5000, 10, 5);
    expect(result.futureValue).toBeCloseTo(
      result.investedAmount + result.totalInterest,
      6
    );
  });

  it('grows with a longer horizon', () => {
    const ten = calculateSip(5000, 12, 10).futureValue;
    const twenty = calculateSip(5000, 12, 20).futureValue;
    expect(twenty).toBeGreaterThan(ten * 2);
  });
});

describe('calculateLumpsum', () => {
  it('compounds annually', () => {
    const result = calculateLumpsum(100000, 10, 3);
    expect(result.futureValue).toBeCloseTo(133100, 4);
    expect(result.totalInterest).toBeCloseTo(33100, 4);
  });

  it('returns the principal when the rate is zero', () => {
    expect(calculateLumpsum(50000, 0, 10).futureValue).toBe(50000);
  });
});

describe('calculateEmi', () => {
  const loan = calculateEmi(5000000, 8.5, 20);

  it('computes a plausible EMI for a 50 lakh, 8.5%, 20-year loan', () => {
    // Around ₹43,391 a month.
    expect(loan.emi).toBeGreaterThan(43000);
    expect(loan.emi).toBeLessThan(44000);
  });

  it('produces one schedule row per month', () => {
    expect(loan.schedule).toHaveLength(240);
  });

  it('amortises the balance to zero by the final instalment', () => {
    expect(loan.schedule[239].balance).toBeCloseTo(0, 2);
  });

  it('shifts from interest-heavy to principal-heavy instalments', () => {
    const first = loan.schedule[0];
    const last = loan.schedule[239];
    expect(first.interest).toBeGreaterThan(first.principal);
    expect(last.principal).toBeGreaterThan(last.interest);
  });

  it('keeps total payment equal to principal plus interest', () => {
    expect(loan.totalPayment).toBeCloseTo(5000000 + loan.totalInterest, 0);
  });
});

describe('calculateFd and calculateRd', () => {
  it('compounds an FD at the requested frequency', () => {
    const annual = calculateFd(100000, 8, 5, 1).maturityAmount;
    const quarterly = calculateFd(100000, 8, 5, 4).maturityAmount;
    expect(quarterly).toBeGreaterThan(annual);
  });

  it('keeps FD interest as maturity minus principal', () => {
    const fd = calculateFd(200000, 7, 3, 4);
    expect(fd.interestEarned).toBeCloseTo(fd.maturityAmount - 200000, 6);
  });

  it('computes RD interest on top of all the instalments', () => {
    const rd = calculateRd(5000, 7, 2, 12);
    const invested = 5000 * 24;
    expect(rd.maturityAmount).toBeGreaterThan(invested);
    expect(rd.interestEarned).toBeCloseTo(rd.maturityAmount - invested, 6);
  });
});

describe('estimateTax', () => {
  it('charges no tax inside the new regime rebate band', () => {
    const result = estimateTax(1200000, 0, 'new');
    expect(result.totalTax).toBe(0);
    expect(result.rebate).toBeGreaterThan(0);
  });

  it('applies the standard deduction', () => {
    expect(estimateTax(1000000, 0, 'new').standardDeduction).toBe(75000);
    expect(estimateTax(1000000, 0, 'old').standardDeduction).toBe(50000);
  });

  it('ignores chapter VI-A deductions in the new regime', () => {
    const withDeductions = estimateTax(2000000, 150000, 'new');
    const without = estimateTax(2000000, 0, 'new');
    expect(withDeductions.taxableIncome).toBe(without.taxableIncome);
  });

  it('allows chapter VI-A deductions in the old regime', () => {
    const withDeductions = estimateTax(2000000, 150000, 'old');
    const without = estimateTax(2000000, 0, 'old');
    expect(withDeductions.taxableIncome).toBe(without.taxableIncome - 150000);
  });

  it('adds 4% cess on the tax after rebate', () => {
    const result = estimateTax(3000000, 0, 'new');
    expect(result.cess).toBeCloseTo(result.taxAfterRebate * 0.04, 6);
    expect(result.totalTax).toBeCloseTo(
      result.taxAfterRebate + result.cess,
      6
    );
  });

  it('charges no tax on zero income', () => {
    const result = estimateTax(0, 0, 'new');
    expect(result.totalTax).toBe(0);
    expect(result.effectiveRate).toBe(0);
  });

  it('keeps the effective rate below the top marginal rate', () => {
    const result = estimateTax(5000000, 0, 'new');
    expect(result.effectiveRate).toBeGreaterThan(20);
    expect(result.effectiveRate).toBeLessThan(31.2);
  });

  it('builds a slab breakdown that sums to the pre-rebate tax', () => {
    const result = estimateTax(2500000, 0, 'new');
    const summed = result.slabs.reduce((total, slab) => total + slab.tax, 0);
    expect(summed).toBeCloseTo(result.taxBeforeRebate, 6);
  });
});

describe('compareRegimes', () => {
  it('prefers the new regime for someone with no deductions', () => {
    const comparison = compareRegimes(1500000, 0);
    expect(comparison.better).toBe('new');
    expect(comparison.saving).toBeGreaterThan(0);
  });

  it('reports the saving as the absolute gap between regimes', () => {
    const comparison = compareRegimes(1800000, 200000);
    expect(comparison.saving).toBeCloseTo(
      Math.abs(comparison.old.totalTax - comparison.new.totalTax),
      6
    );
  });
});
