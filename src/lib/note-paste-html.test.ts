import { describe, expect, it } from "vitest";

import { htmlWouldCreateUnlanguagedCodeBlock } from "./note-paste-html";

describe("htmlWouldCreateUnlanguagedCodeBlock", () => {
  it("ist false ohne HTML oder ohne pre", () => {
    expect(htmlWouldCreateUnlanguagedCodeBlock("")).toBe(false);
    expect(htmlWouldCreateUnlanguagedCodeBlock("<p>Hallo</p>")).toBe(false);
  });

  it("erkennt Chrome/VS-Code-Paste mit nacktem pre", () => {
    expect(
      htmlWouldCreateUnlanguagedCodeBlock(
        `<html><body><!--StartFragment--><pre>const x = 1</pre><!--EndFragment--></body></html>`,
      ),
    ).toBe(true);
    expect(
      htmlWouldCreateUnlanguagedCodeBlock(
        `<meta charset='utf-8'><div style="color:#ccc"><pre>fn main() {}</pre></div>`,
      ),
    ).toBe(true);
  });

  it("lässt pre mit Sprache durch", () => {
    expect(htmlWouldCreateUnlanguagedCodeBlock(`<pre class="language-js">x</pre>`)).toBe(false);
    expect(htmlWouldCreateUnlanguagedCodeBlock(`<pre data-language="txt">x</pre>`)).toBe(false);
  });

  it("erkennt gemischtes HTML, sobald ein pre ohne Sprache vorkommt", () => {
    expect(
      htmlWouldCreateUnlanguagedCodeBlock(
        `<p>Text</p><pre class="language-ts">ok</pre><pre>nackt</pre>`,
      ),
    ).toBe(true);
  });
});
