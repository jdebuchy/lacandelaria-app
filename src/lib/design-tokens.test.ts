import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Contraste de los tokens de color, leido directamente de globals.css.
 *
 * No hay una copia de la paleta aca a proposito: el test parsea el CSS real,
 * asi que si alguien cambia un hex a algo ilegible, CI lo frena. Una tabla
 * duplicada se desincronizaria en la primera semana.
 */

const CSS = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

function parseBlock(selector: string) {
  const start = CSS.indexOf(selector);
  expect(start, `no se encontro el bloque "${selector}" en globals.css`).toBeGreaterThan(-1);

  const open = CSS.indexOf("{", start);
  const close = CSS.indexOf("\n}", open);
  const body = CSS.slice(open, close);
  const tokens: Record<string, string> = {};

  for (const match of body.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6})/gi)) {
    tokens[match[1]] = match[2];
  }

  return tokens;
}

function luminance(hex: string) {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string) {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);

  return (high + 0.05) / (low + 0.05);
}

/**
 * [texto, fondo, minimo, que es]
 *
 * 4.5 es el minimo AA para texto normal.
 * 3.0 es el minimo AA para componentes de interfaz (WCAG 1.4.11): aplica al
 * borde de un control cuando el borde es lo unico que lo identifica.
 */
const PAIRS: Array<[string, string, number, string]> = [
  ["ink", "paper", 4.5, "texto principal sobre card"],
  ["ink", "paper-muted", 4.5, "texto principal sobre pagina"],
  ["ink", "paper-raised", 4.5, "texto principal sobre hover"],
  ["ink-soft", "paper", 4.5, "texto secundario sobre card"],
  ["ink-soft", "paper-muted", 4.5, "texto secundario sobre pagina"],
  ["ink-faint", "paper", 4.5, "meta y placeholder sobre card"],
  ["ink-faint", "paper-muted", 4.5, "meta y placeholder sobre pagina"],
  ["accent", "paper", 4.5, "link y foco sobre card"],
  ["accent", "paper-muted", 4.5, "link y foco sobre pagina"],
  ["accent-fg", "accent", 4.5, "texto del boton primario"],
  ["accent-fg", "accent-strong", 4.5, "texto del primario en hover"],
  ["accent", "accent-soft", 4.5, "texto sobre fondo de seleccion"],
  ["pulp-fg", "pulp", 4.5, "sello de zona"],
  ["tone-neutral-fg", "tone-neutral-bg", 4.5, "badge neutral"],
  ["tone-warn-fg", "tone-warn-bg", 4.5, "badge warn"],
  ["tone-info-fg", "tone-info-bg", 4.5, "badge info"],
  ["tone-success-fg", "tone-success-bg", 4.5, "badge success"],
  ["tone-danger-fg", "tone-danger-bg", 4.5, "badge danger"],
  ["tone-warn-fg", "paper", 4.5, "texto warn sobre card"],
  ["tone-info-fg", "paper", 4.5, "texto info sobre card"],
  ["tone-success-fg", "paper", 4.5, "texto success sobre card"],
  ["tone-danger-fg", "paper", 4.5, "texto danger sobre card"],
  ["line-strong", "paper", 3, "borde de control sobre card"],
  ["line-strong", "paper-muted", 3, "borde de control sobre pagina"]
];

describe.each([
  ["claro", ":root,\n.force-light"],
  ["oscuro", ".dark {"]
])("tema %s", (_label, selector) => {
  const tokens = parseBlock(selector);

  it("define todos los tokens que usan los componentes", () => {
    const required = new Set(PAIRS.flatMap(([fg, bg]) => [fg, bg]));

    for (const token of required) {
      expect(tokens[token], `falta --${token}`).toBeDefined();
    }
  });

  it.each(PAIRS)("%s sobre %s llega a %d:1 (%s)", (fg, bg, min) => {
    const ratio = contrast(tokens[fg], tokens[bg]);

    expect(
      Number(ratio.toFixed(2)),
      `--${fg} (${tokens[fg]}) sobre --${bg} (${tokens[bg]}) da ${ratio.toFixed(2)}:1`
    ).toBeGreaterThanOrEqual(min);
  });
});

describe("coherencia entre temas", () => {
  const light = parseBlock(":root,\n.force-light");
  const dark = parseBlock(".dark {");

  it("los dos temas definen exactamente los mismos tokens", () => {
    expect(Object.keys(dark).sort()).toEqual(Object.keys(light).sort());
  });

  it("el sello de zona no cambia entre temas: es una etiqueta impresa", () => {
    expect(dark.pulp).toBe(light.pulp);
    expect(dark["pulp-fg"]).toBe(light["pulp-fg"]);
  });
});
