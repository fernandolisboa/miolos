import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  OFFLINE_LANDING_PARAM,
  OfflineNote,
} from "../src/free-play/offline-note";
import { messages } from "../src/i18n";

function goOffline(offline: boolean) {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(!offline);
  window.dispatchEvent(new Event(offline ? "offline" : "online"));
}

afterEach(() => {
  vi.restoreAllMocks();
  window.history.replaceState(null, "", "/");
});

describe("the free-play index says the daily needs a connection while offline (T-WEB-S1067)", () => {
  it("shows the note only while offline and follows the online and offline events", () => {
    render(<OfflineNote />);
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

  it("shows the note on the worker's offline landing even while the browser reports online", () => {
    window.history.replaceState(
      null,
      "",
      `/modo-livre?${OFFLINE_LANDING_PARAM}`,
    );
    render(<OfflineNote />);
    expect(screen.getByRole("status")).toHaveTextContent(
      messages.freePlay.offline,
    );
  });
});
