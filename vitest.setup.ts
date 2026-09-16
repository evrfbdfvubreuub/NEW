import "@testing-library/jest-dom/vitest";
import "fake-indexeddb/auto";

// jsdom lacks structuredClone in some versions; provide a fallback used by the
// import/export snapshot paths and repository deep copies.
if (typeof globalThis.structuredClone !== "function") {
  globalThis.structuredClone = (value: unknown) =>
    JSON.parse(JSON.stringify(value)) as unknown;
}

// jsdom does not implement matchMedia; theme resolution reads it.
if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}
