export function compareUnitNumbers(a: string, b: string): number {
  return a.localeCompare(b, "sk", { numeric: true });
}
