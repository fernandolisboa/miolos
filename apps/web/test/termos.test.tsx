import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import TermsPage from "../app/termos/page";
import { messages, routes } from "../src/i18n";

describe("the terms-of-use page (T-WEB-S293)", () => {
  it("renders statically with its marker, every section's copy from the messages module, the mailto contact, and the link into the policy", () => {
    const markup = renderToStaticMarkup(<TermsPage />);

    expect(markup).toContain('data-page="termos"');
    expect(markup).toContain(messages.terms.title);
    expect(markup).toContain(messages.terms.intro);

    expect(markup).toContain(messages.terms.free.body);
    expect(markup).toContain(messages.terms.account.body);
    expect(markup).toContain(messages.terms.acceptableUse.body);
    expect(markup).toContain(messages.terms.content.body);
    expect(markup).toContain(messages.terms.warranty.asIs);
    expect(markup).toContain(messages.terms.warranty.liability);
    expect(markup).toContain(messages.terms.changes.body);

    expect(markup).toContain(messages.terms.contact.email);
    expect(markup).toContain(`mailto:${messages.terms.contact.email}`);

    expect(markup).toContain(`href="${routes.privacy}"`);
    expect(markup).toContain(messages.terms.account.privacyLinkLabel);
  });
});
