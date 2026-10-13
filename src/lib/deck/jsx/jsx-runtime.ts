/**
 * A tiny JSX-to-HTML renderer used only by the summary deck (selected with `@jsxImportSource` at the top of deck.tsx).
 * Next.js does not allow React's own HTML renderer inside a route, and the deck is plain static HTML anyway:
 * no hooks, no state, no events. Everything written into the page is escaped.
 */
export interface Html {
  readonly __html: string;
}
export type Child = Html | string | number | boolean | null | undefined | Child[];
type Props = Record<string, unknown> & { children?: Child };

const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ESC[c]);
const kebab = (s: string) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
const KEEP_CASE = new Set(["viewBox", "colSpan", "rowSpan", "preserveAspectRatio"]);
const UNITLESS = new Set(["fontWeight", "lineHeight", "opacity", "zIndex", "flex", "order", "flexGrow", "flexShrink"]);

function style(obj: Record<string, string | number | null | undefined>): string {
  return Object.entries(obj)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => `${kebab(k)}:${typeof v === "number" && !UNITLESS.has(k) && v !== 0 ? `${v}px` : v}`)
    .join(";");
}

function attrs(props: Props): string {
  let out = "";
  for (const [k, v] of Object.entries(props)) {
    if (k === "children" || k === "key" || v === null || v === undefined || v === false) continue;
    const name = k === "className" ? "class" : k === "htmlFor" ? "for" : KEEP_CASE.has(k) ? k : kebab(k);
    const value = k === "style" && typeof v === "object" ? style(v as Record<string, string | number>) : String(v);
    out += v === true ? ` ${name}` : ` ${name}="${esc(value)}"`;
  }
  return out;
}

function children(c: Child): string {
  if (c === null || c === undefined || typeof c === "boolean") return "";
  if (Array.isArray(c)) return c.map(children).join("");
  if (typeof c === "object") return c.__html;
  return esc(String(c));
}

export function jsx(type: string | ((p: Props) => Html), props: Props): Html {
  if (typeof type === "function") return type(props);
  return { __html: `<${type}${attrs(props)}>${children(props.children)}</${type}>` };
}
export const jsxs = jsx;
export const jsxDEV = jsx;
export function Fragment(props: Props): Html {
  return { __html: children(props.children) };
}
export const render = (n: Child): string => children(n);

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace JSX {
  export type Element = Html;
  export interface ElementChildrenAttribute {
    children: unknown;
  }
  export interface IntrinsicAttributes {
    key?: string | number;
  }
  export type IntrinsicElements = Record<string, Record<string, unknown>>;
}
