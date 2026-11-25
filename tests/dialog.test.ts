import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import { createElement, useState } from "react";

test("dialog has an accessible name, traps focus, dismisses with Escape, restores focus and unlocks scroll", async () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://localhost",
    pretendToBeVisual: true,
  });
  const win = dom.window;
  const globals = [
    "window",
    "document",
    "HTMLElement",
    "HTMLInputElement",
    "HTMLButtonElement",
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
  ];
  for (const key of globals)
    Object.defineProperty(globalThis, key, {
      configurable: true,
      value:
        key === "window"
          ? win
          : key === "document"
            ? win.document
            : typeof win[key as keyof Window] === "function" &&
                [
                  "getComputedStyle",
                  "requestAnimationFrame",
                  "cancelAnimationFrame",
                ].includes(key)
              ? (win[key as keyof Window] as CallableFunction).bind(win)
              : win[key as keyof Window],
    });
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: win.navigator,
  });
  const { ProductDialog } = await import("../src/components/product/dialog");
  const { render, fireEvent, waitFor, cleanup } =
    await import("@testing-library/react");
  const { default: userEvent } = await import("@testing-library/user-event");
  const user = userEvent.setup({ document: win.document });
  function Harness() {
    const [open, setOpen] = useState(false);
    return createElement(
      "div",
      null,
      createElement("button", { onClick: () => setOpen(true) }, "Open details"),
      createElement(
        ProductDialog,
        {
          open,
          onOpenChange: setOpen,
          title: "Isolated title details",
          description: "Private actions stay private.",
        },
        createElement(
          "div",
          null,
          createElement("input", { "aria-label": "Personal note" }),
          createElement("button", null, "Save note"),
        ),
      ),
    );
  }
  const view = render(createElement(Harness));
  const trigger = view.getByRole("button", { name: "Open details" });
  await user.click(trigger);
  const dialog = await view.findByRole("dialog", {
    name: "Isolated title details",
  });
  assert.equal(dialog.getAttribute("aria-describedby") !== null, true);
  await waitFor(() =>
    assert.equal(win.document.body.style.pointerEvents, "none"),
  );
  for (let n = 0; n < 8; n++) {
    await user.tab();
    assert.ok(dialog.contains(win.document.activeElement));
  }
  fireEvent.keyDown(win.document.activeElement!, {
    key: "Escape",
    code: "Escape",
  });
  await waitFor(() => assert.equal(view.queryByRole("dialog"), null));
  await waitFor(() => assert.equal(win.document.activeElement, trigger));
  await waitFor(() =>
    assert.notEqual(win.document.body.style.pointerEvents, "none"),
  );
  cleanup();
  dom.window.close();
});
