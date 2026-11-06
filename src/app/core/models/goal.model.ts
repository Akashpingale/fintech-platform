/** Savings goal model */
export interface Goal {
  id: string;
  userId: string;
  name: string;
  targetAmount: number;
  savedAmount: number;
  deadline: string; // ISO date string
  createdAt: string; // ISO date string
}

/** Goal achievement status */
export type GoalStatus = 'on_track' | 'behind' | 'achieved';

export function getGoalStatus(goal: Goal): GoalStatus {
  if (goal.savedAmount >= goal.targetAmount) return 'achieved';
  const daysLeft = Math.ceil(
    (new Date(goal.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
  const monthsLeft = daysLeft / 30;
  const remaining = goal.targetAmount - goal.savedAmount;
  const monthlyNeeded = monthsLeft > 0 ? remaining / monthsLeft : remaining;
  // If monthly needed is feasible (heuristic: < 50% of saved/month so far)
  const daysActive = Math.ceil(
    (Date.now() - new Date(goal.createdAt).getTime()) / (1000 * 60 * 60 * 24)
  );
  const monthsActive = Math.max(1, daysActive / 30);
  const avgMonthlySaving = goal.savedAmount / monthsActive;
  if (monthlyNeeded <= avgMonthlySaving * 1.5) return 'on_track';
  return 'behind';
}
