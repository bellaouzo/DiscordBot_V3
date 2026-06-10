export function BuildGridDisplay(values: string[], columns: number): string {
  const rows: string[] = [];
  for (let i = 0; i < values.length; i += columns) {
    rows.push(values.slice(i, i + columns).join("  "));
  }
  return rows.join("\n");
}
