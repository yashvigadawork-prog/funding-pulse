import { describe, expect, it } from "vitest";
import { statedStageWords } from "./stage-words";

describe("statedStageWords", () => {
  it("quotes the words the article uses near the company name", () => {
    expect(statedStageWords("B2B edtech startup ByteXL raised $9 million in a series B funding round led by Elevar Equity", "byteXL")).toBe("Series B");
    expect(statedStageWords("Sunfox Technologies raised $7 million in a Series A round", "Sunfox Technologies")).toBe("Series A");
  });
  it("returns null when the article names no stage near the company", () => {
    expect(statedStageWords("byteXL has raised $9 million in its latest funding round led by Elevar Equity", "byteXL")).toBeNull();
    expect(statedStageWords("Other company raised money in a Series C round", "byteXL")).toBeNull();
  });
});
