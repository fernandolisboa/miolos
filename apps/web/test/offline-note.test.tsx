import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import FreePlayIndexPage from "../app/modo-livre/page";
import { messages } from "../src/i18n";

function goOffline(offline: boolean) {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(!offline);
  window.dispatchEvent(new Event(offline ? "offline" : "online"));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the free-play index says the daily needs a connection while offline (T-WEB-S1067)", () => {
  it("shows the note only while offline and follows the online and offline events", () => {
    render(<FreePlayIndexPage />);
    expect(screen.queryByRole("status")).toBeNull();

    act(() => {
      goOffline(true);
    });
    expect(screen.getByRole("status")).toHaveTextContent(
      messages.freePlay.offline,
    );

    act(() => {
      goOffline(false);
    });
    expect(screen.queryByRole("status")).toBeNull();
  });
});
