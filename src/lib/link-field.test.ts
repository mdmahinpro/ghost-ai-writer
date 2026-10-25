import { strict as assert } from "node:assert";
import test from "node:test";

import {
  FIELD_CAP,
  buildField,
  clampView,
  orbit,
  projectPoint,
  rotate,
  spherePoint,
  zoomBy,
  type FieldArticle,
} from "./link-field.ts";

function article(slug: string, targets: string[] = []): FieldArticle {
  return {
    id: `id-${slug}`,
    title: slug.replace(/-/g, " "),
    slug,
    links: targets.map((targetSlug) => ({ targetSlug, state: "LOCAL" as const })),
  };
}

function length(p: { x: number; y: number; z: number }) {
  return Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z);
}

test("sphere points are evenly spread, unit length, stable and distinct", () => {
  const points = Array.from({ length: 24 }, (_, i) => spherePoint(i, 24, 0.5));
  for (const point of points) {
    assert.ok(Math.abs(length(point) - 1) < 1e-9, "every point sits on the unit sphere");
  }
  // No two nodes may land on top of each other, or the field reads as one blob.
  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      const gap = Math.hypot(
        points[i].x - points[j].x,
        points[i].y - points[j].y,
        points[i].z - points[j].z,
      );
      assert.ok(gap > 0.1, `nodes ${i} and ${j} are too close: ${gap}`);
    }
  }
  const again = spherePoint(5, 24, 0.5);
  assert.deepEqual(again, points[5], "the same index and seed must not move");
  assert.notDeepEqual(spherePoint(5, 24, 0.9), points[5], "a different site seed moves the field");
});

test("rotation turns the sphere without changing its shape", () => {
  const point = { x: 0.3, y: -0.5, z: 0.81 };
  for (const yaw of [0, 0.7, 3.1, 6.2]) {
    for (const pitch of [-1.2, -0.3, 0, 0.9]) {
      const turned = rotate(point, yaw, pitch);
      assert.ok(
        Math.abs(length(turned) - length(point)) < 1e-9,
        "rotation must be rigid, or the depth cues lie",
      );
    }
  }
});

test("the near side of the sphere projects larger than the far side", () => {
  const view = { yaw: 0.4, pitch: -0.25, zoom: 1 };
  const near = projectPoint({ x: 0, y: 0, z: 1 }, 900, 620, view);
  const far = projectPoint({ x: 0, y: 0, z: -1 }, 900, 620, view);
  assert.ok(near.scale > far.scale, "closer nodes must be bigger");
  assert.ok(near.depth > far.depth, "closer nodes must be nearer in depth");
  assert.ok(near.depth <= 1 && far.depth >= 0, "depth stays in 0..1");
});

test("every node stays inside the canvas at every viewing angle", () => {
  const width = 900;
  const height = 620;
  const points = Array.from({ length: FIELD_CAP }, (_, i) => spherePoint(i, FIELD_CAP, 0.4));
  for (let yaw = 0; yaw < Math.PI * 2; yaw += Math.PI / 12) {
    for (let pitch = -1.25; pitch <= 1.25; pitch += 0.25) {
      const view = { yaw, pitch, zoom: 1 };
      for (const point of points) {
        const p = projectPoint(point, width, height, view);
        assert.ok(p.x >= 0 && p.x <= width, `x out of bounds at yaw ${yaw}: ${p.x}`);
        assert.ok(p.y >= 0 && p.y <= height, `y out of bounds at pitch ${pitch}: ${p.y}`);
      }
    }
  }
});

test("the field counts links the way the page does", () => {
  const field = buildField([
    article("alpha", ["beta", "beta", "ghost", "alpha"]),
    article("beta", ["gamma"]),
    article("gamma", []),
  ]);
  assert.equal(field.total, 3);
  assert.equal(field.shown, 3);

  const bySlug = new Map(field.nodes.map((node) => [node.slug, node]));
  assert.equal(bySlug.get("alpha")?.out, 1, "a repeated link is one edge, unknown slugs are dropped");
  assert.equal(bySlug.get("beta")?.inbound, 1, "alpha links to beta once even though it appears twice");
  assert.equal(bySlug.get("gamma")?.inbound, 1);
  assert.equal(bySlug.get("alpha")?.inbound, 0);
  assert.equal(bySlug.get("alpha")?.orphan, true, "nothing links to alpha");
  assert.equal(bySlug.get("beta")?.orphan, false);
  assert.equal(bySlug.get("beta")?.hub, false, "one inbound link is not a hub");
  assert.equal(field.orphans.length, 1);
  assert.equal(field.edges.length, 2, "alpha>beta and beta>gamma");
});

test("self-links never become edges", () => {
  const field = buildField([article("solo", ["solo"]), article("other", ["solo"])]);
  assert.deepEqual(field.edges, [{ from: 1, to: 0 }]);
  assert.equal(field.nodes.find((node) => node.slug === "solo")?.out, 0);
});

test("a single article is never called an orphan", () => {
  const field = buildField([article("only", [])]);
  assert.equal(field.nodes[0].orphan, false, "one page cannot be orphaned from anything");
});

test("the busiest pages survive the cap and the count stays honest", () => {
  const many = Array.from({ length: FIELD_CAP + 12 }, (_, i) => article(`post-${i}`));
  // A late, well-linked page must still make the cut.
  many.push(article("hub", []));
  const linked = many.map((item, i) => (i % 3 === 0 ? article(item.slug, ["hub"]) : item));

  const field = buildField(linked);
  assert.equal(field.shown, FIELD_CAP, "the field is capped");
  assert.equal(field.total, linked.length, "the true total is still reported");
  assert.ok(
    field.nodes.some((node) => node.slug === "hub"),
    "the most inbound-linked page is kept even though it sorts last by name",
  );
  assert.equal(field.nodes[0].slug, "hub", "hubs are ranked first");
  for (const edge of field.edges) {
    assert.ok(edge.from >= 0 && edge.from < field.shown, "edge endpoints index real nodes");
    assert.ok(edge.to >= 0 && edge.to < field.shown);
    assert.notEqual(edge.from, edge.to);
  }
});

test("an empty corpus produces an empty field rather than throwing", () => {
  const field = buildField([]);
  assert.deepEqual(field, { nodes: [], edges: [], orphans: [], total: 0, shown: 0 });
});

test("dragging and zooming stay inside the allowed range", () => {
  const dragged = orbit({ yaw: 0, pitch: 0, zoom: 1 }, 500, 400);
  assert.ok(dragged.pitch <= 1.25 && dragged.pitch >= -1.25, "pitch cannot flip past the poles");
  const spun = orbit({ yaw: 0, pitch: 0, zoom: 1 }, -900, 0);
  assert.ok(spun.yaw < 0, "dragging left turns the sphere the other way");
  assert.equal(zoomBy({ yaw: 0, pitch: 0, zoom: 1 }, 99).zoom, 2.4, "zoom is capped");
  assert.equal(zoomBy({ yaw: 0, pitch: 0, zoom: 1 }, 0.001).zoom, 0.55, "zoom has a floor");
  assert.deepEqual(clampView({ yaw: 1, pitch: 0, zoom: 1 }).pitch, 0);
});
