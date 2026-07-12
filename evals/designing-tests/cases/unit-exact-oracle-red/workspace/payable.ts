export function payable(totalCents: number, activeMember: boolean): number {
  const discount = activeMember && totalCents > 10_000
    ? Math.min(Math.round(totalCents * 0.10), 3_000)
    : 0;
  return totalCents - discount;
}
