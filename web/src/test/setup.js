import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
    cleanup();
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

// API-uri de browser pe care jsdom nu le are, folosite de componente
if (!window.matchMedia) {
    window.matchMedia = query => ({
        matches: false, media: query, onchange: null,
        addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
        dispatchEvent() { return false; },
    });
}
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
window.HTMLElement.prototype.scrollIntoView ??= function () {};
Element.prototype.getAnimations ??= function () { return []; };   // base-ui ScrollArea
