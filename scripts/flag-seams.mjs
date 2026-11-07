// Closes the hairline seams that open between flag shapes which only touch.
//
// Most flags are built from shapes that meet edge to edge: Germany is three rectangles that
// abut at y=160 and y=320. A browser anti-aliases each shape on its own, so where an edge falls
// partway through a device pixel, both shapes cover that pixel only partially and a little of
// whatever sits behind the flag shows through as a thin line. Where the line lands depends on
// the flag's rendered size and position, so it comes and goes as flags scale, shake and spin.
//
// The fix draws an underlay beneath the untouched flag: a copy of its large straight-edged
// shapes (stripes, crosses, bands, borders), each outlined in its own colour so that
// neighbours overlap instead of meeting. Wherever the flag itself covers a pixel fully, the
// underlay is hidden and the flag looks exactly as drawn. Only at a seam, where the flag
// would have let the background through, does the underlay show, and there it shows the
// neighbouring stripe colours. Outlining the visible shapes instead would shift every edge
// where a later shape overlaps an earlier one, which shows on large flags.

// In the flag's own units, on a 640×480 canvas. Each underlay shape grows by half this on every
// side. It has to span at least a device pixel at the smallest size a flag is drawn, or the
// underlay itself has seams; being hidden, it can afford to be generous. Measured across every
// flag at the app's sizes, 8 leaves fewer seams than 4 and changes nothing else visible.
export const SEAM_OVERLAP = 8;

// How far off horizontal or vertical a segment may run and still count as straight. Some
// upstream drawings are a hair out, like Mali's red stripe, whose left edge runs from x=425.7
// to x=425.8.
const STRAIGHT_TOLERANCE = 0.5;

function isAxisAligned(fromX, fromY, toX, toY) {
  return Math.abs(toX - fromX) <= STRAIGHT_TOLERANCE || Math.abs(toY - fromY) <= STRAIGHT_TOLERANCE;
}

// Straight-edged shapes thinner than this (in canvas units) are emblem detail, not stripes, and
// are too small for a seam beside them to be seen. Copying them into the underlay would let
// them bleed past their edges where they sit on transparency.
export const MIN_FEATURE = 16;

// Marks a flag that already has an underlay, so sealing twice changes nothing.
const UNDERLAY_MARK = 'data-seams="underlay"';

// Shapes in here are references or masks rather than paint, so outlining them does nothing
// useful at best and changes a clip region at worst.
const INERT_CONTAINERS = new Set([
  "defs",
  "clipPath",
  "mask",
  "pattern",
  "symbol",
  "marker",
  "linearGradient",
  "radialGradient",
]);

const ATTRIBUTE = /([\w:-]+)\s*=\s*"([^"]*)"/g;

function parseAttributes(tag) {
  const attributes = new Map();
  for (const [, name, value] of tag.matchAll(ATTRIBUTE)) attributes.set(name, value);
  return attributes;
}

// Accepts only transforms that keep horizontal edges horizontal, and returns how much they
// scale the shape (so the outline can be sized in canvas units). Null for anything that
// rotates or skews.
function axisAlignedScale(transform) {
  if (transform === undefined) return 1;
  let scale = 1;
  for (const [, kind, args] of transform.matchAll(/(\w+)\s*\(([^)]*)\)/g)) {
    const values = args
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    if (kind === "translate") continue;
    if (kind === "scale") {
      const [x = 1, y = x] = values;
      if (x <= 0 || y <= 0) return null;
      scale *= Math.sqrt(x * y);
      continue;
    }
    if (kind === "matrix") {
      const [a, b, c, d] = values;
      if (b !== 0 || c !== 0 || !(a > 0) || !(d > 0)) return null;
      scale *= Math.sqrt(a * d);
      continue;
    }
    return null;
  }
  return scale;
}

const PATH_TOKEN = /[MmLlHhVvZzCcSsQqTtAa]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g;

// The size of the smallest part of a path whose every segment runs exactly horizontally or
// vertically: the narrower side of its thinnest subpath. Null when any segment curves or runs
// diagonally, which rules the path out.
export function rectilinearExtent(d) {
  const tokens = d.match(PATH_TOKEN) ?? [];
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;
  let command = "";
  let i = 0;
  let smallest = Infinity;
  let box = null;

  const number = () => {
    const value = Number(tokens[i++]);
    if (Number.isNaN(value)) throw new Error("expected a number");
    return value;
  };
  const closeBox = () => {
    if (box !== null) {
      smallest = Math.min(smallest, box.maxX - box.minX, box.maxY - box.minY);
    }
    box = null;
  };
  const visit = () => {
    if (box === null) box = { minX: x, maxX: x, minY: y, maxY: y };
    box.minX = Math.min(box.minX, x);
    box.maxX = Math.max(box.maxX, x);
    box.minY = Math.min(box.minY, y);
    box.maxY = Math.max(box.maxY, y);
  };
  const lineTo = (nextX, nextY) => {
    if (!isAxisAligned(x, y, nextX, nextY)) return false;
    x = nextX;
    y = nextY;
    visit();
    return true;
  };

  try {
    while (i < tokens.length) {
      if (/^[a-zA-Z]$/.test(tokens[i])) command = tokens[i++];
      switch (command) {
        case "M":
        case "m": {
          const relative = command === "m";
          closeBox();
          x = (relative ? x : 0) + number();
          y = (relative ? y : 0) + number();
          startX = x;
          startY = y;
          visit();
          // Further coordinate pairs after a moveto are implicit linetos.
          command = relative ? "l" : "L";
          break;
        }
        case "L":
          if (!lineTo(number(), number())) return null;
          break;
        case "l":
          if (!lineTo(x + number(), y + number())) return null;
          break;
        case "H":
          lineTo(number(), y);
          break;
        case "h":
          lineTo(x + number(), y);
          break;
        case "V":
          lineTo(x, number());
          break;
        case "v":
          lineTo(x, y + number());
          break;
        case "Z":
        case "z":
          // Closing a subpath draws a line back to its start, which must be straight too.
          if (!lineTo(startX, startY)) return null;
          break;
        default:
          return null;
      }
    }
  } catch {
    return null;
  }
  closeBox();
  return Number.isFinite(smallest) ? smallest : null;
}

export function isRectilinearPath(d) {
  return rectilinearExtent(d) !== null;
}

function rectilinearPolygonExtent(points) {
  const values = (points.match(PATH_TOKEN) ?? []).map(Number);
  if (values.length < 6 || values.length % 2 !== 0) return null;
  const xs = values.filter((_, k) => k % 2 === 0);
  const ys = values.filter((_, k) => k % 2 === 1);
  for (let k = 0; k < xs.length; k++) {
    const next = (k + 1) % xs.length;
    if (!isAxisAligned(xs[k], ys[k], xs[next], ys[next])) return null;
  }
  return Math.min(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
}

// How small the shape's thinnest part is, in its own units, when it is straight-edged at all.
function straightEdgedExtent(name, attributes) {
  if (name === "path") return rectilinearExtent(attributes.get("d") ?? "");
  if (name === "polygon") return rectilinearPolygonExtent(attributes.get("points") ?? "");
  if (name === "rect") {
    if (attributes.has("rx") || attributes.has("ry")) return null;
    const width = Number(attributes.get("width"));
    const height = Number(attributes.get("height"));
    // Percentages and other units cannot be sized here; a full-canvas rect is never thin.
    if (Number.isNaN(width) || Number.isNaN(height)) return Infinity;
    return Math.min(width, height);
  }
  return null;
}

function isTranslucent(attributes) {
  for (const name of ["opacity", "fill-opacity"]) {
    const value = attributes.get(name);
    if (value !== undefined && Number(value) < 1) return true;
  }
  return false;
}

// A solid colour the outline can repeat. Gradients and patterns are left alone.
function isSolidPaint(fill) {
  return fill !== "none" && !fill.startsWith("url(");
}

// Removes an id so the underlay's copies never shadow the originals that references point at.
function withoutId(attributeText) {
  return attributeText.replace(/\s+id="[^"]*"/, "");
}

export function sealSeams(svg, overlap = SEAM_OVERLAP) {
  if (svg.includes(UNDERLAY_MARK)) return { svg, sealed: 0 };

  // Inherited state, one entry per open element. `copied` records whether the element's
  // opening tag went into the underlay, so its closing tag can follow.
  const stack = [{ fill: "#000", scale: 1, eligible: true, copied: true, root: true }];
  const underlay = [];
  let rootEnd = -1;
  let sealed = 0;

  for (const match of svg.matchAll(/<(\/?)([a-zA-Z][\w:-]*)([^>]*?)(\/?)>/g)) {
    const [tag, closing, name, rest, selfClosing] = match;
    if (closing) {
      const closed = stack.pop();
      if (closed.copied && !closed.root) underlay.push(`</${name}>`);
      continue;
    }

    const parent = stack.at(-1);
    const attributes = parseAttributes(rest);
    const transformScale = axisAlignedScale(attributes.get("transform"));
    const isRoot = rootEnd === -1 && name === "svg";
    const context = {
      fill: attributes.get("fill") ?? parent.fill,
      scale:
        parent.scale === null || transformScale === null ? null : parent.scale * transformScale,
      // Anything already outlined, see-through, or inside a reference container stays out of
      // the underlay. Stroke inherits, so a stroke on an ancestor rules out its descendants.
      eligible:
        parent.eligible &&
        !INERT_CONTAINERS.has(name) &&
        !attributes.has("stroke") &&
        !isTranslucent(attributes),
      copied: false,
      root: isRoot,
    };

    if (isRoot) {
      rootEnd = match.index + tag.length;
      context.copied = true;
    } else if (parent.copied && context.eligible && name === "g") {
      // Groups carry the transforms, clips and inherited fills the copied shapes rely on.
      context.copied = true;
      underlay.push(`<g${withoutId(rest)}${selfClosing}>`);
    } else if (parent.copied && context.eligible && context.scale !== null) {
      const extent = isSolidPaint(context.fill) ? straightEdgedExtent(name, attributes) : null;
      if (extent !== null && extent * context.scale >= MIN_FEATURE) {
        sealed += 1;
        const width = Number((overlap / context.scale).toFixed(4));
        underlay.push(
          `<${name}${withoutId(rest)} stroke="${context.fill}" stroke-width="${width}"${selfClosing}>`,
        );
      }
    }

    if (!selfClosing) stack.push(context);
  }

  if (sealed === 0 || rootEnd === -1) return { svg, sealed: 0 };

  // Groups that ended up holding nothing are dropped.
  let layer = underlay.join("");
  for (let previous = ""; previous !== layer;) {
    previous = layer;
    layer = layer.replace(/<g\b[^>]*?(?:\/>|>\s*<\/g>)/g, "");
  }

  const output = `${svg.slice(0, rootEnd)}\n  <g ${UNDERLAY_MARK}>${layer}</g>${svg.slice(rootEnd)}`;
  return { svg: output, sealed };
}
