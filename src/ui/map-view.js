/**
 * MapView draws the campus as an SVG map and shows what the planner is doing on it.
 *
 * It knows nothing about routing. The app tells it what to show: which places
 * are the start and end, which were explored, which path is the route.
 */
import { svg, clear, formatMetres, prefersReducedMotion } from './dom.js';
import { MAP_SIZE } from '../data/campus.js';

/** Where each label sits around its pin: n, s, e or w. Unlisted places use s (below). */
const LABEL_SIDE = {
  LAB: 'n', MBA: 'n', GHO: 'n', MEC: 'n', SCI: 'n', LIB: 'n',
  COF: 'w', JUI: 'e', BGT: 'w', BKS: 'e', LAK: 'w',
};

/** Building outlines, as rectangles [dx, dy, width, height] measured from the place's point. */
const BUILDINGS = {
  ADM: [[-36, -22, 72, 44]],
  AUD: [[-40, -24, 80, 48, 16]],
  LIB: [[-44, -22, 88, 44], [-17, -34, 34, 14]],
  LHC: [[-46, -20, 92, 40], [-46, 18, 26, 20]],
  LAB: [[-34, -19, 68, 38]],
  CSE: [[-42, -21, 84, 42], [18, 19, 24, 18]],
  ECE: [[-38, -21, 76, 42]],
  MEC: [[-44, -22, 88, 44], [-44, 20, 30, 16]],
  SCI: [[-40, -21, 80, 42]],
  MBA: [[-40, -19, 80, 38]],
  CAF: [[-36, -23, 72, 46, 12]],
  MES: [[-32, -19, 64, 38]],
  COF: [[-14, -12, 28, 24, 6]],
  JUI: [[-14, -12, 28, 24, 6]],
  BHO: [[-48, -18, 44, 36], [4, -18, 44, 36]],
  GHO: [[-44, -18, 40, 36], [4, -18, 40, 36]],
  GST: [[-30, -17, 60, 34]],
  SPC: [[-46, -27, 92, 54]],
  MED: [[-28, -18, 56, 36]],
  ATM: [[-22, -15, 44, 30]],
  BKS: [[-24, -15, 48, 30]],
};

const MIN_ZOOM = 1;
const MAX_ZOOM = 5;
const MAP_MARGIN = 26; // empty land kept around the map when it is fully zoomed out
const LABELS_SHRINK_ABOVE = 1.5; // map units per screen pixel: beyond this, labels use smaller type
const LABELS_HIDE_ABOVE = 2.1; // and beyond this, most labels are hidden until you zoom in

export class MapView {
  constructor({ element, frame, planner, onPlace, onPath, onViewChange }) {
    this.svg = element;
    this.frame = frame;
    this.planner = planner;
    this.onPlace = onPlace;
    this.onPath = onPath;
    this.onViewChange = onViewChange || (() => {});
    this.placeNodes = {};
    this.pathNodes = [];
    this.scaled = []; // things that keep the same size on screen at every zoom level
    this.zoom = 1;
    this.unitsPerPixel = 1;
    this.animation = null;
    this.draggedRecently = false;

    this.build();
    this.resetView();
    this.listenForGestures();
    new ResizeObserver(() => this.refit()).observe(this.frame);
  }

  // ---------- building the map ----------

  build() {
    clear(this.svg);
    this.ground = svg('g', { class: 'map-ground' });
    this.pathLayer = svg('g', { class: 'map-paths' });
    this.footprintLayer = svg('g', { class: 'map-footprints' });
    this.exploredLayer = svg('g', { class: 'map-explored' });
    this.routeLayer = svg('g', { class: 'map-route' });
    this.placeLayer = svg('g', { class: 'map-places' });
    this.svg.append(this.ground, this.pathLayer, this.footprintLayer, this.exploredLayer, this.routeLayer, this.placeLayer);
    this.drawGround();
    this.drawPaths();
    this.drawFootprints();
    this.drawPlaces();
  }

  drawGround() {
    const { width, height } = MAP_SIZE;
    this.ground.append(
      svg('rect', { class: 'land', x: -3000, y: -3000, width: 7200, height: 6760 }),
      // Lawns
      svg('ellipse', { class: 'lawn', cx: 205, cy: 648, rx: 172, ry: 96 }),
      svg('rect', { class: 'lawn', x: 968, y: 300, width: 190, height: 142, rx: 46 }),
      svg('ellipse', { class: 'lawn', cx: 498, cy: 262, rx: 74, ry: 50 }),
      svg('ellipse', { class: 'lawn', cx: 236, cy: 215, rx: 62, ry: 44 }),
      svg('ellipse', { class: 'lawn', cx: 690, cy: 232, rx: 84, ry: 44 }),
      svg('ellipse', { class: 'lawn', cx: 668, cy: 512, rx: 60, ry: 34 }),
      svg('ellipse', { class: 'lawn', cx: 1010, cy: 152, rx: 70, ry: 40 }),
      // The lake
      svg('path', {
        class: 'water',
        d: 'M52 660c-8-34 22-58 58-56 30 2 44-14 72-4 30 10 34 40 20 62-14 24-44 28-70 40-32 14-70-8-80-42Z',
      }),
    );

    // Trees: scattered with a fixed seed so the map looks the same on every visit.
    const trees = svg('g', { class: 'trees' });
    const placed = [];
    let seed = 20261002;
    const random = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    for (let attempt = 0; attempt < 900 && placed.length < 52; attempt += 1) {
      const x = 30 + random() * (width - 60);
      const y = 34 + random() * (height - 64);
      const r = 4.5 + random() * 3.5;
      if (this.isClearSpot(x, y, placed)) {
        placed.push({ x, y });
        trees.append(svg('circle', { cx: x.toFixed(1), cy: y.toFixed(1), r: r.toFixed(1) }));
      }
    }
    this.ground.append(trees);

    // Map grid, like the squares on a printed map: columns A to F, rows 1 to 4.
    const grid = svg('g', { class: 'grid', 'aria-hidden': 'true' });
    for (let column = 1; column < 6; column += 1) {
      grid.append(svg('line', { x1: column * 200, y1: 0, x2: column * 200, y2: height }));
    }
    for (let row = 1; row < 4; row += 1) {
      grid.append(svg('line', { x1: 0, y1: row * 190, x2: width, y2: row * 190 }));
    }
    for (let column = 0; column < 6; column += 1) {
      grid.append(svg('text', { x: column * 200 + 100, y: 17, 'text-anchor': 'middle', text: 'ABCDEF'[column] }));
    }
    for (let row = 0; row < 4; row += 1) {
      grid.append(svg('text', { x: 11, y: row * 190 + 100, 'text-anchor': 'middle', text: String(row + 1) }));
    }
    grid.append(svg('rect', { class: 'neatline', x: 0, y: 0, width, height }));
    // North arrow
    grid.append(svg('g', { class: 'north', transform: 'translate(1166 716)' },
      svg('path', { d: 'M0-22 8 4 0-2-8 4Z' }),
      svg('text', { x: 0, y: 20, 'text-anchor': 'middle', text: 'N' }),
    ));
    this.ground.append(grid);
  }

  /** True when a tree at (x, y) would not sit on a path, a building or another tree. */
  isClearSpot(x, y, placed) {
    const { locations, paths } = this.planner;
    for (const place of locations) {
      if (Math.hypot(place.x - x, place.y - y) < 66) return false;
    }
    for (const other of placed) {
      if (Math.hypot(other.x - x, other.y - y) < 30) return false;
    }
    for (const path of paths) {
      const a = this.planner.locate(path.from);
      const b = this.planner.locate(path.to);
      const lengthSquared = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
      let t = ((x - a.x) * (b.x - a.x) + (y - a.y) * (b.y - a.y)) / lengthSquared;
      t = Math.max(0, Math.min(1, t));
      if (Math.hypot(a.x + t * (b.x - a.x) - x, a.y + t * (b.y - a.y) - y) < 24) return false;
    }
    // Keep the lake clear.
    if (x < 215 && y > 596 && y < 715) return false;
    return true;
  }

  drawPaths() {
    this.planner.paths.forEach((path, index) => {
      const a = this.planner.locate(path.from);
      const b = this.planner.locate(path.to);
      const ends = { x1: a.x, y1: a.y, x2: b.x, y2: b.y };
      const middle = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const closedMark = svg('g', { class: 'closed-mark' },
        svg('circle', { r: 9 }),
        svg('path', { d: 'M-3.6-3.6 3.6 3.6M3.6-3.6-3.6 3.6' }),
      );
      this.keepSize(closedMark, middle.x, middle.y);
      const label = path.name ? `${path.name}, ` : '';
      const hit = svg('line', {
        class: 'path-hit', ...ends, tabindex: -1, role: 'button',
        'aria-label': `${label}path between ${a.name} and ${b.name}`,
      });
      hit.addEventListener('click', () => { if (!this.draggedRecently) this.onPath(index); });
      hit.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); this.onPath(index); }
      });
      const group = svg('g', { class: `path path-${path.kind}` },
        svg('line', { class: 'path-casing', ...ends }),
        svg('line', { class: 'path-line', ...ends }),
        hit,
        closedMark,
      );
      this.pathLayer.append(group);
      this.pathNodes[index] = { group, hit };
    });
  }

  drawFootprints() {
    for (const place of this.planner.locations) {
      const group = svg('g', { class: 'footprint', transform: `translate(${place.x} ${place.y})` });
      const rects = BUILDINGS[place.id];
      if (rects) {
        for (const [dx, dy, w, h, r = 3] of rects) {
          group.append(svg('rect', { class: 'building', x: dx, y: dy, width: w, height: h, rx: r }));
        }
        if (place.id === 'SPC') group.append(svg('rect', { class: 'pool', x: 54, y: -15, width: 24, height: 34, rx: 4 }));
        if (place.id === 'MED') group.append(svg('path', { class: 'cross', d: 'M16-9v10M11-4h10' }));
      } else if (place.id === 'QUA') {
        group.append(svg('circle', { class: 'lawn-strong', r: 44 }), svg('circle', { class: 'lawn-ring', r: 27 }));
      } else if (place.id === 'GRD') {
        group.append(
          svg('ellipse', { class: 'track', rx: 66, ry: 45 }),
          svg('ellipse', { class: 'lawn-strong', rx: 54, ry: 34 }),
        );
      } else if (place.id === 'LAK') {
        group.append(svg('circle', { class: 'lawn-strong', r: 24 }));
      } else if (place.id === 'OAT') {
        group.append(
          svg('path', { class: 'paved', d: 'M-12-36A36 36 0 0 1-12 36Z' }),
          svg('path', { class: 'seating', d: 'M-12-26A26 26 0 0 1-12 26M-12-16A16 16 0 0 1-12 16' }),
          svg('rect', { class: 'building', x: -24, y: -14, width: 12, height: 28, rx: 2 }),
        );
      } else if (place.id === 'PRK') {
        group.append(
          svg('rect', { class: 'paved', x: -42, y: -18, width: 84, height: 36, rx: 4 }),
          svg('path', { class: 'bays', d: 'M-28-18v12M-14-18v12M0-18v12M14-18v12M28-18v12M-28 18V6M-14 18V6M0 18V6M14 18V6M28 18V6' }),
        );
      } else if (place.id === 'BUS') {
        group.append(
          svg('rect', { class: 'paved', x: -40, y: -15, width: 80, height: 30, rx: 4 }),
          svg('path', { class: 'bays', d: 'M-32-5h20M-6-5h20M20-5h12M-32 5h20M-6 5h20M20 5h12' }),
        );
      } else if (place.id === 'GAT') {
        group.append(svg('path', { class: 'gate', d: 'M-30 0h18M12 0h18' }), svg('path', { class: 'gate-post', d: 'M-12-8v16M12-8v16' }));
      } else if (place.id === 'BGT') {
        group.append(svg('path', { class: 'gate', d: 'M0-30v18M0 12v18' }), svg('path', { class: 'gate-post', d: 'M-8-12h16M-8 12h16' }));
      }
      this.footprintLayer.append(group);
    }
  }

  drawPlaces() {
    for (const place of this.planner.locations) {
      const category = this.planner.mainCategoryOf(place);
      const side = LABEL_SIDE[place.id] || 's';
      const labelAt = {
        n: { x: 0, y: -13, anchor: 'middle' },
        s: { x: 0, y: 23, anchor: 'middle' },
        e: { x: 13, y: 4.5, anchor: 'start' },
        w: { x: -13, y: 4.5, anchor: 'end' },
      }[side];
      const group = svg('g', {
        class: `place cat-${category.id}`,
        tabindex: 0,
        role: 'button',
        'aria-label': `${place.name}, ${category.name}`,
      },
        svg('circle', { class: 'place-hit', r: 18 }),
        svg('circle', { class: 'place-halo', r: 13 }),
        svg('circle', { class: 'place-pin', r: 6.5 }),
        svg('circle', { class: 'place-badge', r: 11.5 }),
        svg('text', { class: 'place-badge-text', y: 4.6, 'text-anchor': 'middle' }),
        svg('text', { class: 'place-label', x: labelAt.x, y: labelAt.y, 'text-anchor': labelAt.anchor, text: place.name }),
      );
      group.addEventListener('click', (event) => {
        if (this.draggedRecently) return;
        event.stopPropagation();
        this.onPlace(place.id);
      });
      group.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          this.onPlace(place.id);
        }
      });
      this.keepSize(group, place.x, place.y);
      this.placeLayer.append(group);
      this.placeNodes[place.id] = group;
    }
  }

  /** Register an element that should stay the same size on screen while the map zooms. */
  keepSize(node, x, y) {
    this.scaled.push({ node, x, y });
    node.setAttribute('transform', `translate(${x} ${y}) scale(${this.unitsPerPixel})`);
  }

  dropSized(layer) {
    this.scaled = this.scaled.filter((item) => !layer.contains(item.node));
  }

  // ---------- zoom and pan ----------

  /** The view that shows the whole map with a little land around it, matching the frame's shape. */
  baseView() {
    const box = this.frame.getBoundingClientRect();
    const frameWidth = Math.max(box.width, 1);
    const frameHeight = Math.max(box.height, 1);
    let w = MAP_SIZE.width + MAP_MARGIN * 2;
    let h = MAP_SIZE.height + MAP_MARGIN * 2;
    if (frameWidth / frameHeight > w / h) w = h * (frameWidth / frameHeight);
    else h = w / (frameWidth / frameHeight);
    return { x: (MAP_SIZE.width - w) / 2, y: (MAP_SIZE.height - h) / 2, w, h, frameWidth };
  }

  resetView() {
    this.zoom = 1;
    this.view = this.baseView();
    this.applyView();
  }

  /** Called when the frame changes size: keep the zoom level and the centre. */
  refit() {
    const base = this.baseView();
    const centre = { x: this.view.x + this.view.w / 2, y: this.view.y + this.view.h / 2 };
    this.view = { w: base.w / this.zoom, h: base.h / this.zoom, x: 0, y: 0 };
    this.view.x = centre.x - this.view.w / 2;
    this.view.y = centre.y - this.view.h / 2;
    this.applyView();
  }

  applyView() {
    const base = this.baseView();
    // Keep the view inside the fully zoomed-out view, so the map cannot be dragged off screen.
    this.view.x = Math.min(Math.max(this.view.x, base.x), base.x + base.w - this.view.w);
    this.view.y = Math.min(Math.max(this.view.y, base.y), base.y + base.h - this.view.h);
    const { x, y, w, h } = this.view;
    this.svg.setAttribute('viewBox', `${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)}`);
    this.unitsPerPixel = w / base.frameWidth;
    this.svg.style.setProperty('--k', this.unitsPerPixel.toFixed(4));
    for (const item of this.scaled) {
      item.node.setAttribute('transform', `translate(${item.x} ${item.y}) scale(${this.unitsPerPixel.toFixed(4)})`);
    }
    this.svg.classList.toggle('labels-tight', this.unitsPerPixel > LABELS_SHRINK_ABOVE);
    this.svg.classList.toggle('labels-few', this.unitsPerPixel > LABELS_HIDE_ABOVE);
    this.svg.classList.toggle('is-zoomed', this.zoom > 1.01);
    this.onViewChange();
  }

  /** Zoom by a factor, keeping the map point (cx, cy) under the same spot on screen. */
  zoomAt(factor, cx, cy) {
    const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, this.zoom * factor));
    if (next === this.zoom) return;
    const base = this.baseView();
    const ratio = this.zoom / next;
    const centreX = cx === undefined ? this.view.x + this.view.w / 2 : cx;
    const centreY = cy === undefined ? this.view.y + this.view.h / 2 : cy;
    this.view = {
      x: centreX - (centreX - this.view.x) * ratio,
      y: centreY - (centreY - this.view.y) * ratio,
      w: base.w / next,
      h: base.h / next,
    };
    this.zoom = next;
    this.applyView();
  }

  /** Zoom in on a set of places, if they take up only part of the map. */
  fitTo(places, padding = 90) {
    if (places.length === 0) return;
    const base = this.baseView();
    let left = Infinity; let right = -Infinity; let top = Infinity; let bottom = -Infinity;
    for (const place of places) {
      left = Math.min(left, place.x); right = Math.max(right, place.x);
      top = Math.min(top, place.y); bottom = Math.max(bottom, place.y);
    }
    const wanted = Math.max((right - left + padding * 2) / base.w, (bottom - top + padding * 2) / base.h);
    this.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, 1 / wanted));
    const w = base.w / this.zoom;
    const h = base.h / this.zoom;
    this.view = { x: (left + right) / 2 - w / 2, y: (top + bottom) / 2 - h / 2, w, h };
    this.applyView();
  }

  /** Convert a mouse or touch position to map coordinates. */
  toMapPoint(clientX, clientY) {
    const box = this.frame.getBoundingClientRect();
    return {
      x: this.view.x + ((clientX - box.left) / box.width) * this.view.w,
      y: this.view.y + ((clientY - box.top) / box.height) * this.view.h,
    };
  }

  /** Where a place is inside the frame, in screen pixels (used to position the details card). */
  screenPointOf(id) {
    const place = this.planner.locate(id);
    return {
      left: (place.x - this.view.x) / this.unitsPerPixel,
      top: (place.y - this.view.y) / this.unitsPerPixel,
    };
  }

  listenForGestures() {
    const pointers = new Map();
    let drag = null;
    let pinch = null;

    this.svg.addEventListener('pointerdown', (event) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.size === 1) {
        drag = { x: event.clientX, y: event.clientY, view: { ...this.view }, moved: false };
      } else if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinch = { distance: Math.hypot(a.x - b.x, a.y - b.y), zoom: this.zoom };
        drag = null;
      }
    });

    this.svg.addEventListener('pointermove', (event) => {
      if (!pointers.has(event.pointerId)) return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pinch && pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const distance = Math.hypot(a.x - b.x, a.y - b.y);
        const target = pinch.zoom * (distance / pinch.distance);
        const centre = this.toMapPoint((a.x + b.x) / 2, (a.y + b.y) / 2);
        this.zoomAt(target / this.zoom, centre.x, centre.y);
        this.draggedRecently = true;
        return;
      }
      if (!drag) return;
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) < 5) return;
      if (this.zoom <= 1.01) return; // nothing to pan when the whole map is showing
      if (!drag.moved) {
        drag.moved = true;
        this.svg.setPointerCapture(event.pointerId);
        this.svg.classList.add('is-dragging');
      }
      this.view.x = drag.view.x - dx * this.unitsPerPixel;
      this.view.y = drag.view.y - dy * this.unitsPerPixel;
      this.applyView();
    });

    const release = (event) => {
      pointers.delete(event.pointerId);
      if (pointers.size < 2) pinch = null;
      if (drag && drag.moved) {
        // A drag ends with a click on whatever is under the pointer. Ignore that click.
        this.draggedRecently = true;
        this.svg.classList.remove('is-dragging');
      }
      if (this.draggedRecently) setTimeout(() => { this.draggedRecently = false; }, 60);
      if (pointers.size === 0) drag = null;
    };
    this.svg.addEventListener('pointerup', release);
    this.svg.addEventListener('pointercancel', release);

    // Pinch on a trackpad arrives as a wheel event with ctrlKey set. Plain scrolling still scrolls the page.
    this.svg.addEventListener('wheel', (event) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const point = this.toMapPoint(event.clientX, event.clientY);
      this.zoomAt(event.deltaY < 0 ? 1.15 : 1 / 1.15, point.x, point.y);
    }, { passive: false });
  }

  // ---------- state shown on the map ----------

  /**
   * Badges on places: { LIB: { text: 'A', kind: 'from' }, CSE: { text: 'B', kind: 'to' } }
   * kind is 'from', 'to' or 'stop'.
   */
  setBadges(badges) {
    for (const [id, node] of Object.entries(this.placeNodes)) {
      const badge = badges[id];
      node.classList.toggle('has-badge', Boolean(badge));
      node.classList.toggle('is-from', Boolean(badge && badge.kind === 'from'));
      node.classList.toggle('is-to', Boolean(badge && badge.kind === 'to'));
      node.classList.toggle('is-stop', Boolean(badge && badge.kind === 'stop'));
      node.querySelector('.place-badge-text').textContent = badge ? badge.text : '';
    }
  }

  /** Dim every place that is not in the list. Pass null to show them all normally. */
  setHighlighted(ids) {
    for (const [id, node] of Object.entries(this.placeNodes)) {
      node.classList.toggle('is-dim', ids !== null && !ids.includes(id));
      node.classList.toggle('is-match', ids !== null && ids.includes(id) && ids.length <= 12);
    }
  }

  setSelected(id) {
    for (const [placeId, node] of Object.entries(this.placeNodes)) {
      node.classList.toggle('is-selected', placeId === id);
    }
  }

  setCloseMode(on) {
    this.svg.classList.toggle('close-mode', on);
    for (const { hit } of this.pathNodes) hit.setAttribute('tabindex', on ? 0 : -1);
  }

  setClosed(closed) {
    this.pathNodes.forEach(({ group, hit }, index) => {
      group.classList.toggle('is-closed', closed[index]);
      hit.setAttribute('aria-pressed', closed[index] ? 'true' : 'false');
    });
  }

  /** Show the search after `count` steps: visited places, the place being visited, and the frontier. */
  showExploration(steps, count) {
    clear(this.exploredLayer);
    for (const node of Object.values(this.placeNodes)) {
      node.classList.remove('is-visited', 'is-frontier', 'is-current');
    }
    for (let i = 0; i < count; i += 1) {
      this.placeNodes[steps[i].id].classList.add('is-visited');
      for (const found of steps[i].discovered) {
        const path = this.planner.paths[found.path];
        const a = this.planner.locate(path.from);
        const b = this.planner.locate(path.to);
        this.exploredLayer.append(svg('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y }));
      }
    }
    if (count > 0) {
      const latest = steps[count - 1];
      this.placeNodes[latest.id].classList.add('is-current');
      for (const id of latest.frontier) this.placeNodes[id].classList.add('is-frontier');
    }
  }

  clearExploration() {
    this.showExploration([], 0);
  }

  /** Draw one or more routes end to end. Each route is a planner result with places and legs. */
  showRoute(routes, { animate = true } = {}) {
    this.clearRoute();
    const points = [];
    for (const route of routes) {
      route.places.forEach((place, i) => {
        if (i === 0 && points.length > 0) return; // the next route starts where the last one ended
        points.push(place);
      });
    }
    if (points.length < 2) return;
    const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join('');
    const casing = svg('path', { class: 'route-casing', d });
    const line = svg('path', { class: 'route-line', d });
    this.routeLayer.append(casing, line);

    const labels = svg('g', { class: 'leg-labels' });
    for (const route of routes) {
      for (const leg of route.legs) {
        const text = formatMetres(leg.distance);
        const width = text.length * 6.4 + 12;
        const label = svg('g', { class: 'leg-label' },
          svg('rect', { x: -width / 2, y: -9.5, width, height: 19, rx: 9.5 }),
          svg('text', { y: 4.2, 'text-anchor': 'middle', text }),
        );
        this.keepSize(label, (leg.from.x + leg.to.x) / 2, (leg.from.y + leg.to.y) / 2);
        labels.append(label);
      }
    }
    this.routeLayer.append(labels);
    this.svg.classList.add('has-route'); // fades the search marks so the route stands out
    for (const place of points) this.placeNodes[place.id].classList.add('is-on-route');

    if (!animate || prefersReducedMotion()) return;

    // Draw the line from start to finish, with a dot walking along its tip.
    const total = line.getTotalLength();
    const walker = svg('g', { class: 'walker' }, svg('circle', { r: 7 }));
    this.keepSize(walker, points[0].x, points[0].y);
    this.routeLayer.append(walker);
    const walkerEntry = this.scaled[this.scaled.length - 1];
    labels.classList.add('is-waiting');
    for (const node of [casing, line]) node.style.strokeDasharray = `${total} ${total}`;
    const duration = Math.min(1700, Math.max(650, total * 1.5));
    const started = performance.now();
    const frame = (now) => {
      const t = Math.min(1, (now - started) / duration);
      const eased = t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2;
      for (const node of [casing, line]) node.style.strokeDashoffset = String(total * (1 - eased));
      const tip = line.getPointAtLength(total * eased);
      walkerEntry.x = tip.x;
      walkerEntry.y = tip.y;
      walker.setAttribute('transform', `translate(${tip.x} ${tip.y}) scale(${this.unitsPerPixel.toFixed(4)})`);
      if (t < 1) {
        this.animation = requestAnimationFrame(frame);
      } else {
        this.animation = null;
        for (const node of [casing, line]) { node.style.strokeDasharray = ''; node.style.strokeDashoffset = ''; }
        labels.classList.remove('is-waiting');
        this.scaled = this.scaled.filter((item) => item !== walkerEntry);
        walker.remove();
      }
    };
    this.animation = requestAnimationFrame(frame);
  }

  clearRoute() {
    if (this.animation !== null) cancelAnimationFrame(this.animation);
    this.animation = null;
    this.dropSized(this.routeLayer);
    clear(this.routeLayer);
    this.svg.classList.remove('has-route');
    for (const node of Object.values(this.placeNodes)) node.classList.remove('is-on-route');
  }
}
