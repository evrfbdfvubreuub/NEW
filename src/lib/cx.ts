export type ClassValue = string | false | null | undefined;

/** Tiny class-name joiner. */
export function cx(...parts: ClassValue[]): string {
  return parts.filter(Boolean).join(" ");
}
