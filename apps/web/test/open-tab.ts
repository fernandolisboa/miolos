import { fireEvent, screen } from "@testing-library/react";

export function openTab(name: string): void {
  fireEvent.click(screen.getByRole("tab", { name }));
}
