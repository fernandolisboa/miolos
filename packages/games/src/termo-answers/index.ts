import { normalizeWord } from "../normalize";
import { ANSWER_CANONICALS } from "./answers.generated";

export interface TermoAnswer {
  readonly canonical: string;
  readonly normalized: string;
}

export const TERMO_ANSWERS: readonly TermoAnswer[] =
  /*#__PURE__*/ Object.freeze(
    /*#__PURE__*/ ANSWER_CANONICALS.split("\n").map((canonical) =>
      Object.freeze({ canonical, normalized: normalizeWord(canonical) }),
    ),
  );
