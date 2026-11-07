// Closes the hairline seams that open between flag shapes which only touch.
//
// Most flags are built from shapes that meet edge to edge: Germany is three rectangles that
// abut at y=160 and y=320. A browser anti-aliases each shape on its own, so where an edge falls
// partway through a device pixel, both shapes cover that pixel only partially and a little of
// whatever sits behind the flag shows through as a thin line. Where the line lands depends on
// the flag's rendered size and position, so it comes and goes as flags scale, shake and spin.
//
// The fix outlines each straight-edged shape in its own fill colour, so neighbours overlap by
// SEAM_OVERLAP instead of meeting exactly. Only large shapes made purely of horizontal and
// vertical edges are touched: stripes, crosses, bands and borders, which is where seams show.
// Emblems, stars, curves and text are left as drawn, so their detail does not thicken.

// In the flag's own units, on a 640×480 canvas. Each shape grows by half this on every side,
// so neighbours overlap by the full amount. The overlap has to span at least one device pixel
// at the smallest size a flag is drawn, or the two edges still share a pixel.
export const SEAM_OVERLAP = 1;

// Straight-edged shapes thinner than this (in canvas units) are emblem detail, not stripes, and
// are too small for a seam beside them to be seen. Outlining them would only fatten them.
export const MIN_FEATURE = 16;

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
    if (nextX !== x && nextY !== y) return false;
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
    if (xs[k] !== xs[next] && ys[k] !== ys[next]) return null;
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

export function sealSeams(svg, overlap = SEAM_OVERLAP) {
  // Inherited state, one entry per open element.
  const stack = [{ fill: "#000", scale: 1, eligible: true }];
  let sealed = 0;

  const output = svg.replace(
    /<(\/?)([a-zA-Z][\w:-]*)([^>]*?)(\/?)>/g,
    (tag, closing, name, rest, selfClosing) => {
      if (closing) {
        stack.pop();
        return tag;
      }

      const parent = stack.at(-1);
      const attributes = parseAttributes(rest);
      const transformScale = axisAlignedScale(attributes.get("transform"));
      const context = {
        fill: attributes.get("fill") ?? parent.fill,
        scale:
          parent.scale === null || transformScale === null ? null : parent.scale * transformScale,
        // Anything already outlined, see-through, or inside a reference container is left as is.
        // Stroke inherits, so a stroke on an ancestor rules out its descendants too.
        eligible:
          parent.eligible &&
          !INERT_CONTAINERS.has(name) &&
          !attributes.has("stroke") &&
          !isTranslucent(attributes),
      };
      if (!selfClosing) stack.push(context);

      if (!context.eligible || context.scale === null || !isSolidPaint(context.fill)) return tag;
      const extent = straightEdgedExtent(name, attributes);
      if (extent === null || extent * context.scale < MIN_FEATURE) return tag;

      sealed += 1;
      const width = Number((overlap / context.scale).toFixed(4));
      return `<${name}${rest} stroke="${context.fill}" stroke-width="${width}"${selfClosing}>`;
    },
  );

  return { svg: output, sealed };
}
