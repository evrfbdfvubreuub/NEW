import { useEffect } from "react";

/** Sets a meaningful document title on route entry (Blueprint §S). */
export function usePageTitle(title: string): void {
  useEffect(() => {
    document.title = title ? `${title} · THE ARCHITECT` : "THE ARCHITECT";
  }, [title]);
}
