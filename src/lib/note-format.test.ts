import { describe, expect, it } from "vitest";
import { continueList, decodeEntities, parseInline, parseNote, plainNote } from "@/lib/note-format";

const SAMPLE = `1. Sélection des images sur Magnific

1. Se connecter sur [Magnific](https://www.magnific.com/app) avec « Continuer avec Google ».
2. Appliquer les filtres avant toute recherche :
   * exclure les images générées par IA ;
   * n&#39;afficher que les images Premium.
3. Trouver les mots-clés : ouvrir [la conversation ChatGPT dédiée](https://chatgpt.com/c/abc).

2. Ajout des images dans Digicom

* L&#39;image s&#39;uploade directement.
* Un curseur permet d&#39;ajuster le cadrage.`;

describe("parseNote", () => {
  it("renders the pasted procedure as sections, lists, nested bullets and links", () => {
    const blocks = parseNote(SAMPLE);
    expect(blocks.map((b) => b.type)).toEqual(["section", "list", "section", "list"]);
    const [s1, l1, s2, l2] = blocks;
    expect(s1).toMatchObject({ type: "section", number: 1 });
    expect(s2).toMatchObject({ type: "section", number: 2 });
    if (l1.type !== "list" || l2.type !== "list") throw new Error();
    expect(l1.ordered).toBe(true);
    expect(l1.items.map((i) => i.number)).toEqual([1, 2, 3]);
    expect(l1.items[0].lines[0]).toContainEqual({
      type: "link",
      text: "Magnific",
      href: "https://www.magnific.com/app",
    });
    const nested = l1.items[1].children[0];
    expect(nested).toMatchObject({ type: "list", ordered: false });
    if (nested.type !== "list") throw new Error();
    expect(nested.items).toHaveLength(2);
    expect(nested.items[1].lines[0][0]).toEqual({
      type: "text",
      text: "n'afficher que les images Premium.",
    });
    expect(l2.ordered).toBe(false);
    expect(l2.items).toHaveLength(2);
  });

  it("keeps a loose numbered list as list items", () => {
    const blocks = parseNote("1. a\n\n2. b\n\nfin");
    expect(blocks.map((b) => b.type)).toEqual(["list", "list", "para"]);
  });

  it("keeps line breaks inside paragraphs", () => {
    expect(parseNote("ligne 1\nligne 2")).toEqual([
      {
        type: "para",
        lines: [[{ type: "text", text: "ligne 1" }], [{ type: "text", text: "ligne 2" }]],
      },
    ]);
  });

  it("parses dashes, headings and rules", () => {
    const blocks = parseNote("# Titre\n- un\n- deux\n---\ntexte");
    expect(blocks.map((b) => b.type)).toEqual(["heading", "list", "hr", "para"]);
  });
});

describe("parseInline", () => {
  it("never turns javascript: links into links", () => {
    expect(parseInline("[x](javascript:alert(1))")).toEqual([
      { type: "text", text: "[x](javascript:alert(1))" },
    ]);
  });
  it("handles bold, italic, code and bare URLs", () => {
    expect(parseInline("**gras** et *ital* `code` https://a.fr/x.")).toEqual([
      { type: "strong", children: [{ type: "text", text: "gras" }] },
      { type: "text", text: " et " },
      { type: "em", children: [{ type: "text", text: "ital" }] },
      { type: "text", text: " " },
      { type: "code", text: "code" },
      { type: "text", text: " " },
      { type: "link", text: "https://a.fr/x", href: "https://a.fr/x" },
      { type: "text", text: "." },
    ]);
  });
  it("leaves underscores in URLs alone", () => {
    expect(parseInline("https://x.fr/a_b_c")).toEqual([
      { type: "link", text: "https://x.fr/a_b_c", href: "https://x.fr/a_b_c" },
    ]);
  });
});

describe("helpers", () => {
  it("decodes entities", () => {
    expect(decodeEntities("n&#39;afficher &amp; &laquo;x&raquo;")).toBe("n'afficher & «x»");
  });
  it("gives plain text for previews", () => {
    expect(plainNote("Voir [le site](https://a.fr) **vite**\n- un")).toBe(
      "Voir le site vite\n• un",
    );
  });
  it("continues lists on Enter", () => {
    expect(continueList("  3. trois")).toEqual({ insert: "\n  4. " });
    expect(continueList("- un")).toEqual({ insert: "\n- " });
    expect(continueList("- ")).toEqual({ exit: true });
    expect(continueList("texte")).toBeNull();
  });
});
