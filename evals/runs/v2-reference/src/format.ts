export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0]!.toUpperCase())
    .join("");
}
