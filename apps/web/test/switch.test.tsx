import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Switch } from "../src/components/switch";
import switchStyles from "../src/components/switch.module.css";
import { bodyOf, decl, stylesheet } from "./css-source";

function renderSwitch(props: { checked: boolean; disabled?: boolean }) {
  const onToggle = vi.fn();
  render(
    <>
      <span id="switch-label">Lembrete</span>
      <span id="switch-hint">Avisa quando a sequência corre risco.</span>
      <Switch
        labelledBy="switch-label"
        describedBy="switch-hint"
        onToggle={onToggle}
        {...props}
      >
        {props.checked ? "Ligado" : "Desligado"}
      </Switch>
    </>,
  );
  return { onToggle, button: screen.getByRole("switch") };
}

describe("the shared Switch (T-WEB-S1080)", () => {
  it("is a named, described button with role switch whose state is aria-checked, and a tap asks for the other state", () => {
    for (const checked of [false, true]) {
      const { onToggle, button } = renderSwitch({ checked });
      expect(button.tagName).toBe("BUTTON");
      expect(button).toHaveAttribute("type", "button");
      expect(button).toHaveAccessibleName("Lembrete");
      expect(button).toHaveAccessibleDescription(
        "Avisa quando a sequência corre risco.",
      );
      expect(button).toHaveAttribute("aria-checked", String(checked));
      expect(button).toHaveTextContent(checked ? "Ligado" : "Desligado");
      expect(button.classList.contains(String(switchStyles.switch))).toBe(true);

      fireEvent.click(button);
      expect(onToggle).toHaveBeenCalledExactlyOnceWith(!checked);
      document.body.innerHTML = "";
    }
  });

  it("disabled, it is announced as such and a tap does nothing", () => {
    const { onToggle, button } = renderSwitch({
      checked: true,
      disabled: true,
    });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onToggle).not.toHaveBeenCalled();
  });

  it("lends its look to /admin's Salvar from the module that defines it", () => {
    expect(
      decl(
        bodyOf(stylesheet("app/admin/admin.module.css"), ".save"),
        "composes",
      ),
    ).toBe('switch from "../../src/components/switch.module.css"');
    expect(
      bodyOf(stylesheet("src/components/switch.module.css"), ".switch"),
    ).toContain("min-height");
  });
});
