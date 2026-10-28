import type { ReactNode } from "react";

export interface Choice {
  readonly label: string;
  readonly options: readonly {
    readonly key: string;
    readonly label: string;
    readonly aria: string;
  }[];
  readonly selected: string;
  readonly onSelect: (key: string) => void;
  readonly toggle?: {
    readonly on: string;
    readonly off: string;
    readonly icon: ReactNode;
    readonly focusOnMount: boolean;
  };
}

export function choice<T extends string | number>({
  label,
  options,
  selected,
  optionLabel,
  optionAria,
  onSelect,
}: {
  readonly label: string;
  readonly options: readonly T[];
  readonly selected: T;
  readonly optionLabel: (option: T) => string;
  readonly optionAria: (option: T) => string;
  readonly onSelect: (option: T) => void;
}): Choice {
  return {
    label,
    options: options.map((option) => ({
      key: String(option),
      label: optionLabel(option),
      aria: optionAria(option),
    })),
    selected: String(selected),
    onSelect: (key) => {
      const option = options.find((candidate) => String(candidate) === key);
      if (option !== undefined) onSelect(option);
    },
  };
}

export function choiceLabel({ options, selected }: Choice): string {
  return options.find((option) => option.key === selected)?.label ?? "";
}
