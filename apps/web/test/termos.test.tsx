import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import TermsPage from "../app/termos/page";
import { messages, routes } from "../src/i18n";

// The /termos page (#158) — /privacidade's test shape (T-WEB-S141): every
// assertion goes through the messages module — never string literals — so
// the copy stays externalized by construction (ADR-0018).

describe("the terms-of-use page (T-WEB-S293)", () => {
  it("renders statically with its marker, every section's copy from the messages module, the mailto contact, and the link into the policy", () => {
    const markup = renderToStaticMarkup(<TermsPage />);

    expect(markup).toContain('data-page="termos"');
    expect(markup).toContain(messages.terms.title);
    expect(markup).toContain(messages.terms.intro);
    // The substance the ticket names, section by section: free service,
    // the no-signup anonymous account, acceptable use, content/IP, the
    // plain-words no-warranty and liability pair, and how terms change.
    expect(markup).toContain(messages.terms.free.body);
    expect(markup).toContain(messages.terms.account.body);
    expect(markup).toContain(messages.terms.acceptableUse.body);
    expect(markup).toContain(messages.terms.content.body);
    expect(markup).toContain(messages.terms.warranty.asIs);
    expect(markup).toContain(messages.terms.warranty.liability);
    expect(markup).toContain(messages.terms.changes.body);
    // The human channel: the address is published and is a real mailto.
    expect(markup).toContain(messages.terms.contact.email);
    expect(markup).toContain(`mailto:${messages.terms.contact.email}`);
    // The one internal link: the data story lives on /privacidade, and the
    // terms point there rather than restating it (single home).
    expect(markup).toContain(`href="${routes.privacy}"`);
    expect(markup).toContain(messages.terms.account.privacyLinkLabel);
  });
});
