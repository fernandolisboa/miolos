import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { streakReminderBody, streakReminderSubject } from "../src/email/copy";
import { sendReminderEmail } from "../src/email/transport";

type Sent = { url: string; body: string };

function stubResend(...statuses: number[]): Sent[] {
  const sent: Sent[] = [];
  vi.stubGlobal("fetch", (url: string, init: { body: string }) => {
    sent.push({ url, body: init.body });
    const status = statuses[sent.length - 1] ?? statuses.at(-1) ?? 200;
    return Promise.resolve(new Response(null, { status }));
  });
  return sent;
}

beforeEach(() => {
  vi.stubEnv("RESEND_API_KEY", "re_test_key");
  vi.stubEnv("WEB_ORIGIN", "https://miolos.app");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("the streak reminder email (#199, ADR-0079)", () => {
  it("T-API-S193: the copy is pinned in both number forms, links to WEB_ORIGIN and says how to stop; the send is text-only with List-Unsubscribe; a refusal is logged and returns false; no key sends nothing", async () => {
    expect(streakReminderSubject).toBe("Sua sequência no Miolos está em risco");
    expect(streakReminderBody(3, "https://miolos.app")).toBe(
      [
        "Sua sequência de 3 dias termina à meia-noite, no horário de Brasília.",
        "Jogue hoje para mantê-la:",
        "",
        "https://miolos.app",
        "",
        "Você recebe este lembrete porque pediu lembretes por e-mail no Miolos.",
        "No máximo um por dia, e nunca propaganda.",
        "Para não receber mais, escreva para privacidade@miolos.app.",
      ].join("\n"),
    );
    expect(streakReminderBody(1, "https://miolos.app")).toContain(
      "Sua sequência de 1 dia termina",
    );

    const sent = stubResend(200);
    expect(await sendReminderEmail({ to: "ana@example.org", streak: 3 })).toBe(
      true,
    );
    expect(sent).toHaveLength(1);
    expect(sent[0]?.url).toBe("https://api.resend.com/emails");
    const body: unknown = JSON.parse(sent[0]?.body ?? "{}");
    expect(body).toEqual({
      from: "Miolos <conta@miolos.app>",
      to: ["ana@example.org"],
      subject: streakReminderSubject,
      text: streakReminderBody(3, "https://miolos.app"),
      headers: { "List-Unsubscribe": "<mailto:privacidade@miolos.app>" },
    });

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    stubResend(422);
    expect(await sendReminderEmail({ to: "ana@example.org", streak: 3 })).toBe(
      false,
    );
    expect(String(errorSpy.mock.calls[0]?.[0])).toContain(
      "Resend answered 422",
    );

    const unkeyed = stubResend(200);
    vi.stubEnv("RESEND_API_KEY", undefined);
    expect(await sendReminderEmail({ to: "ana@example.org", streak: 3 })).toBe(
      false,
    );
    expect(unkeyed).toHaveLength(0);
  });

  it("T-API-S193a: a 429 waits and retries once — a second 429 counts as not sent", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const retried = stubResend(429, 200);
    expect(await sendReminderEmail({ to: "ana@example.org", streak: 2 })).toBe(
      true,
    );
    expect(retried).toHaveLength(2);

    const limited = stubResend(429, 429);
    expect(await sendReminderEmail({ to: "ana@example.org", streak: 2 })).toBe(
      false,
    );
    expect(limited).toHaveLength(2);
  }, 10_000);
});
