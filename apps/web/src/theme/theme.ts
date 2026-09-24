export const THEME_CHOICES = ["system", "light", "dark"] as const;
export type ThemeChoice = (typeof THEME_CHOICES)[number];

const STORAGE_KEY = "miolos-theme";
const DATASET_VALUES = THEME_CHOICES.filter((choice) => choice !== "system");

// Raw JS, run in <head> before hydration (ADR-0079) — never through the bundler.
export const themeScript = `(function(){try{var v=localStorage.getItem(${JSON.stringify(
  STORAGE_KEY,
)});if(${JSON.stringify(DATASET_VALUES)}.indexOf(v)!==-1){document.documentElement.dataset.theme=v;}}catch(e){}})();`;

function safely<T>(read: () => T, fallback: T): T {
  try {
    return read();
  } catch {
    return fallback;
  }
}

export function readThemeChoice(): ThemeChoice {
  const stored = safely(() => localStorage.getItem(STORAGE_KEY), null);
  return (THEME_CHOICES as readonly string[]).includes(stored ?? "")
    ? (stored as ThemeChoice)
    : "system";
}

export function applyThemeChoice(choice: ThemeChoice): void {
  if (choice === "system") {
    safely(() => localStorage.removeItem(STORAGE_KEY), undefined);
    delete document.documentElement.dataset.theme;
  } else {
    safely(() => localStorage.setItem(STORAGE_KEY, choice), undefined);
    document.documentElement.dataset.theme = choice;
  }
}
