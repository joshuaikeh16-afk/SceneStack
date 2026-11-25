import { JSDOM } from "jsdom";
export function installDom() {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://localhost",
    pretendToBeVisual: true,
  });
  const win = dom.window;
  for (const key of [
    "self",
    "window",
    "FormData",
    "File",
    "document",
    "HTMLElement",
    "HTMLInputElement",
    "HTMLButtonElement",
    "HTMLSelectElement",
    "Element",
    "Node",
    "NodeFilter",
    "MutationObserver",
    "CustomEvent",
    "Event",
    "MouseEvent",
    "KeyboardEvent",
    "FocusEvent",
    "getComputedStyle",
    "requestAnimationFrame",
    "cancelAnimationFrame",
  ]) {
    const value =
      key === "window" || key === "self"
        ? win
        : key === "document"
          ? win.document
          : win[key as keyof Window];
    Object.defineProperty(globalThis, key, {
      configurable: true,
      value:
        typeof value === "function" &&
        [
          "getComputedStyle",
          "requestAnimationFrame",
          "cancelAnimationFrame",
        ].includes(key)
          ? (value as CallableFunction).bind(win)
          : value,
    });
  }
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: win.navigator,
  });
  Object.defineProperty(globalThis, "PointerEvent", {
    configurable: true,
    value: win.MouseEvent,
  });
  win.HTMLElement.prototype.scrollIntoView = () => {};
  win.HTMLElement.prototype.scrollTo = function (
    options: ScrollToOptions | number = {},
    y?: number,
  ) {
    if (typeof options === "number") {
      this.scrollLeft = options;
      this.scrollTop = y ?? 0;
    } else {
      this.scrollLeft = options.left ?? this.scrollLeft;
      this.scrollTop = options.top ?? this.scrollTop;
    }
  };
  win.HTMLElement.prototype.hasPointerCapture = () => false;
  win.HTMLElement.prototype.setPointerCapture = () => {};
  win.HTMLElement.prototype.releasePointerCapture = () => {};
  return dom;
}
