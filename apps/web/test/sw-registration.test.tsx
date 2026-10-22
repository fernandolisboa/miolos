import type { ReactElement, ReactNode } from "react";
import { createContext, runInContext } from "node:vm";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/font/google", () => ({
  Fraunces: () => ({ variable: "--font-fraunces" }),
  Instrument_Sans: () => ({ variable: "--font-instrument-sans" }),
}));

import RootLayout from "../app/layout";
import { registerServiceWorkerScript } from "../src/offline/register-script";

type Props = {
  children?: ReactNode;
  dangerouslySetInnerHTML?: { __html: string };
};

function inlineScripts(node: ReactNode): string[] {
  if (Array.isArray(node)) return node.flatMap(inlineScripts);
  if (node === null || typeof node !== "object" || !("props" in node)) {
    return [];
  }
  const { props } = node as ReactElement<Props>;
  return [
    ...(props.dangerouslySetInnerHTML
      ? [props.dangerouslySetInnerHTML.__html]
      : []),
    ...inlineScripts(props.children),
  ];
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("the layout registers the worker in production only, on load (T-WEB-S1066)", () => {
  it("renders the registration script only in a production build", () => {
    expect(inlineScripts(RootLayout({ children: null }))).not.toContain(
      registerServiceWorkerScript,
    );
    vi.stubEnv("NODE_ENV", "production");
    expect(inlineScripts(RootLayout({ children: null }))).toContain(
      registerServiceWorkerScript,
    );
  });

  it("registers /sw.js after load, and does nothing without service workers", () => {
    const register = vi.fn(() => Promise.resolve());
    const onLoad: (() => void)[] = [];
    const run = (navigator: object) => {
      runInContext(
        registerServiceWorkerScript,
        createContext({
          navigator,
          addEventListener: (type: string, listener: () => void) => {
            if (type === "load") onLoad.push(listener);
          },
        }),
      );
    };

    run({});
    expect(onLoad).toEqual([]);

    run({ serviceWorker: { register } });
    expect(register).not.toHaveBeenCalled();
    onLoad.forEach((listener) => {
      listener();
    });
    expect(register).toHaveBeenCalledWith("/sw.js");
  });
});
