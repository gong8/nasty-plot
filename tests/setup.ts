import "@testing-library/jest-dom/vitest"

// jsdom does not implement ResizeObserver; stub it for Radix UI / cmdk components
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof globalThis.ResizeObserver
}

// jsdom does not implement Element.scrollIntoView; stub it for cmdk
if (
  typeof globalThis.Element !== "undefined" &&
  typeof Element.prototype.scrollIntoView === "undefined"
) {
  Element.prototype.scrollIntoView = function () {}
}
