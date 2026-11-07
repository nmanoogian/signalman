import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isRectilinearPath, MIN_FEATURE, rectilinearExtent, sealSeams } from "./flag-seams.mjs";

describe("isRectilinearPath", () => {
  it("accepts rectangles and crosses", () => {
    assert.ok(isRectilinearPath("M0 160h640v160H0z"));
    assert.ok(isRectilinearPath("M426.7 0H640v480H426.7z"));
    assert.ok(isRectilinearPath("M0 0h640v480H0zm176 0v480h80V0z"));
    assert.ok(isRectilinearPath("M0 0L640 0L640 480L0 480Z"));
    // Implicit linetos after a moveto.
    assert.ok(isRectilinearPath("M0 0 640 0 640 480 0 480z"));
  });

  it("rejects diagonals and curves", () => {
    assert.ok(!isRectilinearPath("M0 0l640 480H0z"));
    assert.ok(!isRectilinearPath("M0 0h640L0 480z"));
    assert.ok(!isRectilinearPath("M0 0c10 10 20 20 30 30z"));
    assert.ok(!isRectilinearPath("M10 10a5 5 0 1 0 10 0"));
    assert.ok(!isRectilinearPath(""));
  });

  it("checks the closing line back to the subpath start", () => {
    // Two straight segments, but closing from (640,480) to (0,0) is a diagonal.
    assert.ok(!isRectilinearPath("M0 0h640v480z"));
  });
});

describe("rectilinearExtent", () => {
  it("measures the narrow side of the thinnest subpath", () => {
    assert.equal(rectilinearExtent("M0 160h640v160H0z"), 160);
    // Andorra's coat of arms: three bars 7.8 wide.
    const bars = rectilinearExtent(
      "M329.7 175.5h7.8V228h-7.8zm15 0h7.8V228h-7.8zm15 0h7.9V228h-7.9z",
    );
    assert.ok(Math.abs(bars - 7.8) < 1e-9);
    assert.equal(rectilinearExtent("M0 0l640 480H0z"), null);
  });
});

describe("sealSeams", () => {
  it("outlines each stripe in its own colour", () => {
    const { svg, sealed } = sealSeams(
      `<svg viewBox="0 0 640 480"><path fill="#fc0" d="M0 320h640v160H0z"/><path fill="red" d="M0 160h640v160H0z"/></svg>`,
    );
    assert.equal(sealed, 2);
    assert.match(svg, /<path fill="#fc0" d="M0 320h640v160H0z" stroke="#fc0" stroke-width="1"\/>/);
    assert.match(svg, /<path fill="red" d="M0 160h640v160H0z" stroke="red" stroke-width="1"\/>/);
  });

  it("uses an inherited fill, and black when there is none", () => {
    const { svg } = sealSeams(
      `<svg><g fill="#0057b8"><path d="M0 0h640v240H0z"/></g><path d="M0 240h640v240H0z"/></svg>`,
    );
    assert.match(svg, /d="M0 0h640v240H0z" stroke="#0057b8"/);
    assert.match(svg, /d="M0 240h640v240H0z" stroke="#000"/);
  });

  it("leaves emblems, gradients, translucency, references and existing strokes alone", () => {
    const input = [
      `<svg>`,
      `<path fill="red" d="M0 0l10 10H0z"/>`,
      `<circle fill="red" r="5"/>`,
      `<path fill="url(#a)" d="M0 0h100v100H0z"/>`,
      `<path fill="red" fill-opacity=".5" d="M0 0h100v100H0z"/>`,
      `<g opacity=".8"><path fill="red" d="M0 0h100v100H0z"/></g>`,
      `<defs><path id="b" fill="red" d="M0 0h100v100H0z"/></defs>`,
      `<clipPath id="c"><path d="M0 0h100v100H0z"/></clipPath>`,
      `<path fill="red" stroke="#000" d="M0 0h100v100H0z"/>`,
      `<g stroke="#000"><path fill="red" d="M0 0h100v100H0z"/></g>`,
      `<path fill="none" d="M0 0h100v100H0z"/>`,
      `<path fill="red" transform="rotate(45)" d="M0 0h100v100H0z"/>`,
      `<rect fill="red" rx="2" width="100" height="100"/>`,
      `</svg>`,
    ].join("");
    const { svg, sealed } = sealSeams(input);
    assert.equal(sealed, 0);
    assert.equal(svg, input);
  });

  it("leaves thin emblem detail alone", () => {
    const thin = MIN_FEATURE - 1;
    const input = `<svg><path fill="red" d="M0 0h640v${thin}H0z"/><rect fill="red" width="${thin}" height="300"/></svg>`;
    assert.equal(sealSeams(input).sealed, 0);
    // Measured in canvas units, so a scaled-down stripe can fall under the threshold too.
    const scaled = `<svg><g transform="scale(.1)"><path fill="red" d="M0 0h640v100H0z"/></g></svg>`;
    assert.equal(sealSeams(scaled).sealed, 0);
  });

  it("sizes the outline in canvas units under a scale", () => {
    const { svg } = sealSeams(
      `<svg><g transform="scale(.5)"><path fill="red" d="M0 0h100v100H0z"/></g></svg>`,
    );
    assert.match(svg, /stroke-width="2"/);
  });

  it("handles rects and rectilinear polygons", () => {
    const { sealed } = sealSeams(
      `<svg><rect fill="red" width="640" height="160"/><polygon fill="red" points="0,0 100,0 100,100 0,100"/><polygon fill="red" points="0,0 100,0 0,100"/></svg>`,
    );
    assert.equal(sealed, 2);
  });

  it("is idempotent", () => {
    const once = sealSeams(`<svg><path fill="red" d="M0 0h100v100H0z"/></svg>`).svg;
    assert.equal(sealSeams(once).svg, once);
  });
});
