/**
 * The page's controller: it listens to the form, the tabs and the map, asks the
 * RoutePlanner for answers, and draws them. All routing logic lives in
 * ../planner.js and ../dsa/, not here.
 */
import { RoutePlanner, ROUTE_MODES, gridReference, minutesFor } from '../planner.js';
import { MapView } from './map-view.js';
import { PlacePicker } from './place-picker.js';
import { CONCEPTS, renderStage } from './structures.js';
import { el, svg, clear, formatMetres, plural, prefersReducedMotion } from './dom.js';

const planner = new RoutePlanner();
const $ = (id) => document.getElementById(id);
const TRIP_KEY = 'route-planner-trip';
const THEME_KEY = 'route-planner-theme';
const SAMPLE_TRIP = ['GAT', 'ADM', 'LIB', 'CAF', 'SPC'];

const state = {
  from: 'LIB',
  to: 'CSE',
  mode: 'shortest',
  route: null, // the last result of Find route
  trip: null, // the last result of Plan trip
  showing: 'nothing', // what the map is showing: 'nothing', 'route' or 'trip'
  tab: 'route',
  concept: 'graph',
  selected: null,
  closeMode: false,
  places: { text: '', category: 'campus', sortBy: 'name', algorithm: 'merge', within: 0, origin: 'LIB' },
  explore: { steps: [], index: 0, timer: null, playing: false },
};

// ---------- small pieces used in several places ----------

function icon(paths, size = 18) {
  return svg('svg', { viewBox: '0 0 24 24', width: size, height: size, 'aria-hidden': 'true' },
    svg('path', { d: paths, fill: 'none', stroke: 'currentColor', 'stroke-width': 2.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
}
const ICONS = {
  play: 'M8 5.5v13l10-6.5Z',
  pause: 'M8 5v14M16 5v14',
  close: 'M6 6l12 12M18 6 6 18',
  up: 'M6 14l6-6 6 6',
  down: 'M6 10l6 6 6-6',
  plus: 'M12 5v14M5 12h14',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  north: 'M12 19V5M12 5 6.5 10.5M12 5l5.5 5.5',
};

function store(key, value) {
  try { localStorage.setItem(key, value); } catch (error) { /* private browsing: nothing is saved */ }
}

function isNarrow() {
  return window.matchMedia('(max-width: 900px)').matches;
}

function stat(term, value) {
  return el('div', {}, el('dt', { text: term }), el('dd', { text: value }));
}

function signPlate(title, stats) {
  return el('div', { class: 'sign' }, title, el('dl', { class: 'sign-stats' }, stats));
}

// ---------- the map ----------

let map = null; // assigned below; the view-change callback can fire while the map is still being built
map = new MapView({
  element: $('map'),
  frame: $('map-frame'),
  planner,
  onPlace: (id) => openCard(id),
  onPath: (index) => togglePath(index),
  onViewChange: () => {
    if (!map) return;
    updateScaleBar();
    if (state.selected) positionCard();
  },
});

function updateScaleBar() {
  $('scale-bar').style.width = `${(100 / map.unitsPerPixel).toFixed(1)}px`;
}
updateScaleBar();

$('zoom-in').addEventListener('click', () => map.zoomAt(1.4));
$('zoom-out').addEventListener('click', () => map.zoomAt(1 / 1.4));
$('zoom-reset').addEventListener('click', () => map.resetView());
$('map').addEventListener('click', () => { if (!map.draggedRecently) closeCard(); });

function updateBadges() {
  const badges = {};
  if (state.showing === 'trip') {
    planner.tripStops().forEach((place, i) => {
      if (!badges[place.id]) badges[place.id] = { text: String(i + 1), kind: 'stop' };
    });
  } else {
    if (state.to) badges[state.to] = { text: 'B', kind: 'to' };
    if (state.from) badges[state.from] = { text: 'A', kind: 'from' };
  }
  map.setBadges(badges);
}

// ---------- place details card ----------

function openCard(id) {
  const place = planner.locate(id);
  const trail = planner.categoryTrail(place.category).slice(1).map((node) => node.name).join(', ');
  const card = $('place-card');
  state.selected = id;
  map.setSelected(id);
  clear(card);
  card.append(
    el('button', { class: 'icon-button card-close', type: 'button', 'aria-label': 'Close place details', onclick: () => closeCard(true) }, icon(ICONS.close, 16)),
    el('h3', {}, place.name, el('span', { class: 'code', text: place.id })),
    el('p', { class: 'card-meta', text: `${trail}. Map square ${gridReference(place)}.` }),
    el('p', { text: place.about }),
    el('div', { class: 'card-actions' },
      el('button', { class: 'button small', type: 'button', onclick: () => { setEnd('from', id); closeCard(); }, text: 'Start here' }),
      el('button', { class: 'button small primary', type: 'button', onclick: () => { setEnd('to', id); closeCard(); }, text: 'Go here' }),
      el('button', { class: 'button small quiet', type: 'button', onclick: () => { addStop(id); closeCard(); }, text: 'Add to trip' }),
    ),
  );
  card.hidden = false;
  positionCard();
}

function positionCard() {
  const card = $('place-card');
  if (card.hidden || !state.selected) return;
  const frame = $('map-frame').getBoundingClientRect();
  const docked = frame.width < 520;
  card.classList.toggle('is-docked', docked);
  if (docked) { card.style.left = ''; card.style.top = ''; return; }
  const point = map.screenPointOf(state.selected);
  const width = card.offsetWidth;
  const height = card.offsetHeight;
  const left = Math.min(Math.max(point.left - width / 2, 8), frame.width - width - 8);
  const above = point.top - height - 20;
  const top = above >= 8 ? above : Math.min(point.top + 38, frame.height - height - 8); // below the pin and its label
  card.style.left = `${left}px`;
  card.style.top = `${Math.max(8, top)}px`;
}

function closeCard(returnFocus = false) {
  const id = state.selected;
  $('place-card').hidden = true;
  state.selected = null;
  map.setSelected(null);
  if (returnFocus && id) map.placeNodes[id].focus();
}

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && state.selected) closeCard(true);
});

/** Show a place on the map from anywhere on the page. */
function showPlace(id) {
  if (isNarrow() || window.scrollY > 200) $('planner').scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  if (isNarrow()) $('map-frame').scrollIntoView({ block: 'center' });
  openCard(id);
}

// ---------- tabs ----------

const TABS = ['route', 'places', 'trip'];

function selectTab(name, focus = false) {
  state.tab = name;
  for (const tab of TABS) {
    const button = $(`tab-${tab}`);
    const active = tab === name;
    button.setAttribute('aria-selected', String(active));
    button.tabIndex = active ? 0 : -1;
    $(`panel-${tab}`).hidden = !active;
    if (active && focus) button.focus();
  }
  if (name === 'places') renderPlaces();
  else map.setHighlighted(null);
  if (name === 'trip') renderTrip();
}

TABS.forEach((name, i) => {
  const button = $(`tab-${name}`);
  button.addEventListener('click', () => selectTab(name));
  button.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowRight') selectTab(TABS[(i + 1) % TABS.length], true);
    if (event.key === 'ArrowLeft') selectTab(TABS[(i + TABS.length - 1) % TABS.length], true);
  });
});

// ---------- route form ----------

const fromPicker = new PlacePicker({
  mount: $('from-combo'), inputId: 'from-input', planner, placeholder: 'Type a place, like Library',
  onChoose: (place) => setEnd('from', place.id, false),
});
const toPicker = new PlacePicker({
  mount: $('to-combo'), inputId: 'to-input', planner, placeholder: 'Type a place, like CSE Block',
  onChoose: (place) => setEnd('to', place.id, false),
});

function showFormError(message) {
  const box = $('route-error');
  box.textContent = message || '';
  box.hidden = !message;
}

function renderModes() {
  const holder = $('modes');
  clear(holder);
  for (const [key, mode] of Object.entries(ROUTE_MODES)) {
    holder.append(el('label', { class: 'segment' },
      el('input', { type: 'radio', name: 'mode', value: key, checked: key === state.mode, onchange: () => setMode(key) }),
      el('span', { text: mode.label }),
    ));
  }
  $('mode-hint').textContent = `${ROUTE_MODES[state.mode].hint}. Found with ${ROUTE_MODES[state.mode].algorithm}.`;
}

function setMode(mode, run = true) {
  state.mode = mode;
  renderModes();
  if (run && state.showing === 'route') runRoute();
  else if (run && state.showing === 'trip') planTrip();
  else refreshInspector();
}

/** Set the start or the end from the map, the places list or a picker. */
function setEnd(which, id, updatePicker = true) {
  const place = planner.locate(id);
  state[which] = id;
  if (updatePicker) (which === 'from' ? fromPicker : toPicker).set(place);
  showFormError('');
  if (state.showing === 'trip') {
    state.showing = 'nothing';
    map.clearRoute();
    renderTrip();
  }
  updateBadges();
  const ready = state.from && state.to && state.from !== state.to;
  // "Go here" on the map or in a list finds the route straight away. So does changing
  // either end while a route is on screen, so the map never shows a route for old ends.
  if (ready && (state.showing === 'route' || (which === 'to' && updatePicker))) {
    selectTab('route');
    runRoute();
  } else {
    if (state.showing === 'route') { state.showing = 'nothing'; map.clearRoute(); map.clearExploration(); $('explore').hidden = true; }
    refreshInspector();
  }
}

function submitRoute() {
  const from = fromPicker.resolve();
  const to = toPicker.resolve();
  if (!from || !to) {
    const picker = from ? toPicker : fromPicker;
    const typed = picker.text.trim();
    showFormError(typed === ''
      ? `Choose where to ${from ? 'go' : 'start'}.`
      : `No place matches "${typed}". Try a name like Library, or an ID like LIB.`);
    picker.input.focus();
    return;
  }
  if (from === to) {
    showFormError('From and To are the same place. Choose two different places.');
    toPicker.input.focus();
    return;
  }
  showFormError('');
  state.from = from.id;
  state.to = to.id;
  runRoute();
}

$('route-form').addEventListener('submit', (event) => {
  event.preventDefault();
  submitRoute();
});

$('swap').addEventListener('click', () => {
  const from = fromPicker.resolve();
  const to = toPicker.resolve();
  fromPicker.set(to);
  toPicker.set(from);
  state.from = to ? to.id : null;
  state.to = from ? from.id : null;
  updateBadges();
  if (state.showing === 'route' && state.from && state.to) runRoute();
});

/** Find the route for the current From, To and route type, then show it. */
function runRoute({ record = true, animate = true } = {}) {
  const route = planner.findRoute(state.from, state.to, state.mode);
  state.route = route;
  state.showing = 'route';
  if (record) planner.remember(state.from, state.to, state.mode);
  $('history-back').disabled = !planner.canGoBack();
  $('history-forward').disabled = !planner.canGoForward();
  closeCard();
  updateBadges();
  renderRouteResult();
  renderTrip();
  startExploration(route, animate);
  rememberInAddress();
  refreshInspector();
  if (isNarrow()) {
    if (route.found) map.fitTo(route.places, 120);
    $('map-frame').scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'center' });
  }
}

function goInHistory(entry) {
  if (!entry) return;
  state.from = entry.from;
  state.to = entry.to;
  state.mode = entry.mode;
  fromPicker.set(planner.locate(entry.from));
  toPicker.set(planner.locate(entry.to));
  renderModes();
  runRoute({ record: false, animate: false });
}
$('history-back').addEventListener('click', () => goInHistory(planner.goBack()));
$('history-forward').addEventListener('click', () => goInHistory(planner.goForward()));

function renderRouteResult() {
  const box = $('route-result');
  const route = state.route;
  clear(box);
  if (!route) {
    box.append(el('p', { class: 'panel-intro', text: 'Choose two places, or pick them on the map, then find the route. The map shows how the search spreads out before it draws the way.' }));
    return;
  }
  if (!route.found) {
    const closed = planner.closedPaths().length;
    let advice = 'These two places are not connected.';
    if (closed > 0) advice = `${plural(closed, 'path is', 'paths are')} closed, and every way through needs one of them.`;
    else if (route.mode === 'stepfree') advice = 'Every way there uses stairs. Try the Shortest route type.';
    box.append(el('div', { class: 'notice warn' },
      el('h3', { text: `No open route from ${route.from.name} to ${route.to.name}` }),
      el('p', { text: advice }),
      closed > 0 && el('button', { class: 'button small', type: 'button', onclick: reopenAll, text: 'Reopen all paths' }),
    ));
    return;
  }

  box.append(signPlate(
    el('h2', { class: 'sign-route' }, el('span', { text: route.from.name }), icon(ICONS.arrow, 20), el('span', { text: route.to.name })),
    [
      stat('Distance', formatMetres(route.distance)),
      stat('Walk', `${route.minutes} min`),
      stat('On the way', route.stops === 0 ? 'Direct' : plural(route.stops, 'place')),
    ],
  ));

  if (route.usesSteps) {
    const names = route.legs.filter((leg) => leg.path.kind === 'steps').map((leg) => leg.path.name).join(' and ');
    box.append(el('p', { class: 'notice' },
      `This route uses stairs: ${names}. `,
      el('button', { class: 'link-button', type: 'button', onclick: () => setMode('stepfree'), text: 'Find a step-free route' }),
    ));
  }

  const kindLabel = { steps: 'Stairs', covered: 'Covered', road: 'Road' };
  const steps = el('ol', { class: 'steps' }, route.legs.map((leg) => el('li', {},
    el('span', { class: 'bearing', style: `--turn:${leg.bearing.toFixed(0)}deg`, title: `Heading ${leg.compass}` }, icon(ICONS.north, 18)),
    el('span', { class: 'step-text' },
      leg.instruction,
      el('span', { class: 'step-meta' },
        `${formatMetres(leg.distance)}, about ${minutesFor(leg.distance)} min`,
        kindLabel[leg.path.kind] && el('span', { class: `tag tag-${leg.path.kind}`, text: kindLabel[leg.path.kind] }),
      ),
    ),
    el('button', {
      class: 'icon-button step-close', type: 'button', title: 'Close this path and find another way',
      'aria-label': `Close the path from ${leg.from.name} to ${leg.to.name} and find another way`,
      onclick: () => togglePath(leg.pathIndex),
    }, icon(ICONS.close, 15)),
  )));
  steps.append(el('li', { class: 'arrive' },
    el('span', { class: 'end-letter end-b', 'aria-hidden': 'true', text: 'B' }),
    el('span', { class: 'step-text', text: `Arrive at ${route.to.name}` }),
  ));
  box.append(steps);

  box.append(el('details', { class: 'work' },
    el('summary', { text: 'How this route was found' }),
    el('ul', {}, route.work.map((item) => el('li', {}, el('strong', { text: item.structure }), ` ${item.text}.`))),
  ));
}

// ---------- the search animation ----------

function setPlayIcon() {
  const button = $('explore-play');
  const { explore } = state;
  clear(button);
  button.append(icon(explore.playing ? ICONS.pause : ICONS.play));
  const finished = explore.index >= explore.steps.length;
  button.setAttribute('aria-label', explore.playing ? 'Pause the search animation' : finished ? 'Replay the search animation' : 'Play the search animation');
}

function pauseExploration() {
  clearTimeout(state.explore.timer);
  state.explore.playing = false;
  setPlayIcon();
}

function playExploration() {
  const { explore } = state;
  if (explore.index >= explore.steps.length) setExploreIndex(0);
  explore.playing = true;
  setPlayIcon();
  const tick = () => {
    explore.timer = setTimeout(() => {
      setExploreIndex(explore.index + 1);
      if (explore.index < explore.steps.length && explore.playing) tick();
    }, Number($('explore-speed').value));
  };
  tick();
}

function startExploration(route, animate) {
  pauseExploration();
  state.explore.steps = route.steps;
  $('explore').hidden = route.steps.length === 0;
  $('explore-scrub').max = String(route.steps.length);
  map.clearRoute();
  if (!animate || prefersReducedMotion() || route.steps.length === 0) {
    setExploreIndex(route.steps.length, false);
    return;
  }
  setExploreIndex(0);
  playExploration();
}

/** Show the search as it stood after `index` steps. The last index also draws the route. */
function setExploreIndex(index, animateRoute = true) {
  const { explore, route } = state;
  const total = explore.steps.length;
  explore.index = Math.min(Math.max(index, 0), total);
  $('explore-scrub').value = String(explore.index);
  map.showExploration(explore.steps, explore.index);

  const settings = ROUTE_MODES[route.mode];
  const fewest = route.mode === 'fewest';
  let status;
  if (explore.index === 0) {
    status = `Ready to search from ${route.from.name} with ${settings.algorithm}.`;
  } else if (explore.index === total) {
    status = route.found
      ? `Reached ${route.to.name} after visiting ${total} of ${planner.locations.length} places.`
      : `Visited ${plural(total, 'place')} and ran out of open paths before reaching ${route.to.name}.`;
  } else {
    const step = explore.steps[explore.index - 1];
    const name = planner.locate(step.id).name;
    status = fewest
      ? `Step ${explore.index} of ${total}: visiting ${name}, ${plural(step.cost, 'path')} from the start.`
      : `Step ${explore.index} of ${total}: settled ${name}, ${formatMetres(step.cost)} from the start.`;
  }
  $('explore-status').textContent = status;

  const frontier = explore.index > 0 ? explore.steps[explore.index - 1].frontier : [];
  $('frontier-label').textContent = fewest ? 'Queue, front first' : 'Min-heap, nearest first';
  const chips = $('frontier-chips');
  clear(chips);
  if (frontier.length === 0) chips.append(el('span', { class: 'muted', text: explore.index === 0 ? 'not started' : 'empty' }));
  for (const id of frontier) chips.append(el('span', { class: 'cell', title: planner.locate(id).name }, el('span', { class: 'cell-main', text: id })));

  if (explore.index === total) {
    pauseExploration();
    if (route.found) map.showRoute([route], { animate: animateRoute });
  } else {
    map.clearRoute();
    setPlayIcon();
  }
}

$('explore-play').addEventListener('click', () => (state.explore.playing ? pauseExploration() : playExploration()));
$('explore-prev').addEventListener('click', () => { pauseExploration(); setExploreIndex(state.explore.index - 1, false); });
$('explore-next').addEventListener('click', () => { pauseExploration(); setExploreIndex(state.explore.index + 1); });
$('explore-scrub').addEventListener('input', (event) => { pauseExploration(); setExploreIndex(Number(event.target.value), false); });

// ---------- closing paths ----------

$('close-mode').addEventListener('click', () => {
  state.closeMode = !state.closeMode;
  $('close-mode').setAttribute('aria-pressed', String(state.closeMode));
  $('close-mode').textContent = state.closeMode ? 'Done closing paths' : 'Close a path';
  map.setCloseMode(state.closeMode);
  renderClosures();
});

function togglePath(index) {
  planner.togglePath(index);
  afterClosureChange();
}

function reopenAll() {
  planner.reopenAllPaths();
  afterClosureChange();
}

function afterClosureChange() {
  map.setClosed(planner.closed);
  renderClosures();
  if (state.showing === 'route') runRoute({ record: false, animate: false });
  else if (state.showing === 'trip') planTrip();
  else refreshInspector();
}

function renderClosures() {
  const box = $('closures');
  const closed = planner.closedPaths();
  clear(box);
  box.hidden = closed.length === 0 && !state.closeMode;
  if (box.hidden) return;
  const names = closed.map((i) => {
    const path = planner.paths[i];
    return path.name || `${planner.locate(path.from).name} to ${planner.locate(path.to).name}`;
  });
  box.append(el('p', {
    text: closed.length === 0
      ? 'Choose any path on the map to close it. Routes will go around it.'
      : `${plural(closed.length, 'path')} closed: ${names.join(', ')}.${state.closeMode ? ' Choose a closed path to reopen it.' : ''}`,
  }));
  if (closed.length > 0) box.append(el('button', { class: 'button small quiet', type: 'button', onclick: reopenAll, text: 'Reopen all' }));
}

// ---------- places tab ----------

function renderCategoryTree() {
  const holder = $('category-tree');
  clear(holder);
  const selected = state.places.category;
  const trail = planner.categoryTrail(selected); // the path from the root of the tree to the chosen category
  const branch = trail.length > 1 ? trail[1] : null;
  const chip = (node, label, isTop) => el('button', {
    class: `chip ${branch === node && selected !== node.id ? 'is-open' : ''}`, type: 'button',
    'aria-pressed': String(selected === node.id),
    onclick: () => { state.places.category = node.id; renderCategoryTree(); renderPlaces(); },
  },
    isTop && node !== planner.categories.root && el('span', { class: `dot cat-${node.id}`, 'aria-hidden': 'true' }),
    label,
    el('span', { class: 'chip-count', text: String(planner.placesIn(node.id).length) }),
  );
  const root = planner.categories.root;
  holder.append(el('div', { class: 'chips' }, chip(root, 'All places', true), root.children.map((node) => chip(node, node.name, true))));
  if (branch && branch.children.length > 0) {
    holder.append(el('div', { class: 'chips sub' }, branch.children.map((node) => chip(node, node.name, false))));
  }
  holder.append(el('p', { class: 'trail', text: trail.map((node) => node.name).join(' › ') }));
}

function renderPlaces() {
  const options = state.places;
  const origin = planner.locate(options.origin);
  const work = [];

  // 1. Category: traverse that branch of the category tree.
  let list = planner.placesIn(options.category);
  // 2. Search text: linear search through the array.
  if (options.text.trim() !== '') {
    const found = planner.search(options.text);
    list = list.filter((place) => found.places.includes(place));
    work.push(`Linear search checked ${found.comparisons} places.`);
  }
  // 3. Within a walk: binary search on the sorted distances.
  let distances = null;
  if (options.within > 0) {
    const near = planner.nearby(origin.id, options.within);
    const inside = near.places.map((entry) => entry.place);
    list = list.filter((place) => inside.includes(place));
    work.push(`Binary search found the ${options.within} m cut-off in ${plural(near.searchComparisons, 'comparison')}.`);
  }
  // 4. Sort with the chosen algorithm.
  const sorted = planner.sortPlaces(list, options.sortBy, options.algorithm, origin.id);
  if (options.sortBy === 'distance' || options.within > 0) distances = planner.distancesFrom(origin.id);
  if (list.length > 1) work.push(`${sorted.algorithm} ordered ${list.length} places in ${plural(sorted.comparisons, 'comparison')}.`);

  $('origin').disabled = !(options.sortBy === 'distance' || options.within > 0);
  $('places-work').textContent = `${plural(list.length, 'place')}. ${work.join(' ')}`;

  const holder = $('place-list');
  clear(holder);
  if (list.length === 0) {
    holder.append(el('li', { class: 'empty' },
      el('p', { text: 'No places match. Clear the search, pick a wider category or a longer walk.' }),
      el('button', { class: 'button small', type: 'button', onclick: resetPlaceFilters, text: 'Show all places' }),
    ));
  }
  for (const place of sorted.sorted) {
    const category = planner.mainCategoryOf(place);
    const metres = distances ? distances[planner.positionOf(place.id)] : null;
    let meta = planner.categoryTrail(place.category).slice(1).map((node) => node.name).join(', ');
    if (metres !== null && place.id !== origin.id) meta = `${formatMetres(metres)}, ${minutesFor(metres)} min from ${origin.name}`;
    holder.append(el('li', {},
      el('button', { class: 'place-row', type: 'button', onclick: () => showPlace(place.id) },
        el('span', { class: `dot cat-${category.id}`, 'aria-hidden': 'true' }),
        el('span', { class: 'place-row-text' },
          el('span', { class: 'place-row-name' }, place.name, el('span', { class: 'code', text: place.id })),
          el('span', { class: 'place-row-meta', text: meta }),
        ),
      ),
      el('span', { class: 'row-actions' },
        el('button', { class: 'letter-button', type: 'button', title: 'Start here', 'aria-label': `Start from ${place.name}`, onclick: () => setEnd('from', place.id), text: 'A' }),
        el('button', { class: 'letter-button', type: 'button', title: 'Go here', 'aria-label': `Go to ${place.name}`, onclick: () => setEnd('to', place.id), text: 'B' }),
        el('button', { class: 'letter-button', type: 'button', title: 'Add to trip', 'aria-label': `Add ${place.name} to the trip`, onclick: () => addStop(place.id) }, icon(ICONS.plus, 15)),
      ),
    ));
  }

  const filtered = options.category !== 'campus' || options.text.trim() !== '' || options.within > 0;
  map.setHighlighted(filtered ? list.map((place) => place.id) : null);
  refreshInspector();
}

function resetPlaceFilters() {
  Object.assign(state.places, { text: '', category: 'campus', within: 0 });
  $('place-search').value = '';
  $('within').value = '0';
  renderCategoryTree();
  renderPlaces();
}

function fillPlaceSelect(select, chosen) {
  clear(select);
  const places = planner.sortPlaces(planner.locations, 'name', 'merge', null, true).sorted;
  for (const place of places) select.append(el('option', { value: place.id, selected: place.id === chosen, text: place.name }));
}

$('place-search').addEventListener('input', (event) => { state.places.text = event.target.value; renderPlaces(); });
$('sort-by').addEventListener('change', (event) => { state.places.sortBy = event.target.value; renderPlaces(); });
$('sort-algorithm').addEventListener('change', (event) => { state.places.algorithm = event.target.value; renderPlaces(); });
$('within').addEventListener('change', (event) => { state.places.within = Number(event.target.value); renderPlaces(); });
$('origin').addEventListener('change', (event) => { state.places.origin = event.target.value; renderPlaces(); });

function filterCategory(categoryId) {
  state.places.category = categoryId;
  selectTab('places');
  renderCategoryTree();
  $('planner').scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
}

// ---------- trip tab ----------

function saveTrip() {
  store(TRIP_KEY, JSON.stringify(planner.trip.toArray()));
}

function addStop(id) {
  const added = planner.addStop(id);
  saveTrip();
  tripChanged();
  if (!added) return;
  const count = $('trip-count');
  count.classList.remove('is-bumped');
  void count.offsetWidth; // restart the little bump animation
  count.classList.add('is-bumped');
}

function tripChanged() {
  saveTrip();
  if (state.showing === 'trip') {
    if (planner.trip.size >= 2) { planTrip(); return; }
    state.showing = 'nothing';
    state.trip = null;
    map.clearRoute();
    updateBadges();
  }
  renderTrip();
  refreshInspector();
}

function renderTrip() {
  const stops = planner.tripStops();
  const count = $('trip-count');
  count.hidden = stops.length === 0;
  count.textContent = String(stops.length);

  const holder = $('stop-list');
  clear(holder);
  if (stops.length === 0) {
    holder.append(el('li', { class: 'empty' },
      el('p', { text: 'No stops yet. Add places below, from the Places tab, or by choosing a place on the map.' }),
      el('button', { class: 'button small', type: 'button', onclick: loadSampleTrip, text: 'Load a sample trip' }),
    ));
  }
  stops.forEach((place, i) => {
    holder.append(el('li', {},
      el('span', { class: 'stop-number', text: String(i + 1) }),
      el('span', { class: 'stop-name' }, place.name, el('span', { class: 'code', text: place.id })),
      el('span', { class: 'row-actions' },
        el('button', { class: 'letter-button', type: 'button', disabled: i === 0, 'aria-label': `Move ${place.name} earlier`, title: 'Move earlier', onclick: () => { planner.moveStop(i, -1); tripChanged(); } }, icon(ICONS.up, 15)),
        el('button', { class: 'letter-button', type: 'button', disabled: i === stops.length - 1, 'aria-label': `Move ${place.name} later`, title: 'Move later', onclick: () => { planner.moveStop(i, 1); tripChanged(); } }, icon(ICONS.down, 15)),
        el('button', { class: 'letter-button', type: 'button', 'aria-label': `Remove ${place.name} from the trip`, title: 'Remove', onclick: () => { planner.removeStop(i); tripChanged(); } }, icon(ICONS.close, 15)),
      ),
    ));
  });

  $('plan-trip').disabled = stops.length < 2;
  $('shorten-trip').disabled = stops.length < 3;
  $('reverse-trip').disabled = stops.length < 2;
  $('clear-trip').disabled = stops.length === 0;
  renderTripResult();
}

function renderTripResult() {
  const box = $('trip-result');
  clear(box);
  const plan = state.trip;
  if (state.showing !== 'trip' || !plan) return;
  if (!plan.found) {
    const blocked = plan.blocked;
    box.append(el('div', { class: 'notice warn' },
      el('h3', { text: `No open route from ${blocked.from.name} to ${blocked.to.name}` }),
      el('p', { text: 'Reopen the closed paths, change the route type, or remove one of those stops.' }),
    ));
    return;
  }
  const stops = planner.tripStops();
  box.append(signPlate(
    el('h2', { class: 'sign-route' }, el('span', { text: stops[0].name }), icon(ICONS.arrow, 20), el('span', { text: stops[stops.length - 1].name })),
    [stat('Distance', formatMetres(plan.distance)), stat('Walk', `${plan.minutes} min`), stat('Stops', String(stops.length))],
  ));
  if (plan.note) box.append(el('div', { class: 'notice' }, el('p', { text: plan.note })));
  box.append(el('ol', { class: 'steps legs' }, plan.routes.map((route, i) => el('li', {},
    el('span', { class: 'stop-number', text: String(i + 1) }),
    el('span', { class: 'step-text' },
      `${route.from.name} to ${route.to.name}`,
      el('span', { class: 'step-meta', text: `${formatMetres(route.distance)}, about ${route.minutes} min${route.stops > 0 ? `, past ${route.places.slice(1, -1).map((p) => p.name).join(', ')}` : ''}` }),
    ),
  ))));
  box.append(el('p', { class: 'hint', text: `Each leg uses the ${ROUTE_MODES[state.mode === 'stepfree' ? 'stepfree' : 'shortest'].label} route type.${state.mode === 'stepfree' ? '' : ' Pick Step-free in the Route tab to avoid stairs.'}` }));
}

function planTrip(note = '') {
  const plan = planner.planTrip(state.mode === 'stepfree' ? 'stepfree' : 'shortest');
  plan.note = note;
  state.trip = plan;
  state.showing = 'trip';
  state.route = null; // the map now shows the trip, so the single route's details no longer apply
  renderRouteResult();
  pauseExploration();
  $('explore').hidden = true;
  map.clearExploration();
  closeCard();
  updateBadges();
  if (plan.found) map.showRoute(plan.routes, { animate: true });
  else map.clearRoute();
  renderTrip();
  refreshInspector();
  if (isNarrow() && plan.found) {
    map.fitTo(planner.tripStops(), 110);
    $('map-frame').scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'center' });
  }
}

function reverseTrip() {
  planner.reverseTrip();
  tripChanged();
}

function loadSampleTrip() {
  planner.clearTrip();
  for (const id of SAMPLE_TRIP) planner.addStop(id);
  tripChanged();
}

$('add-stop').addEventListener('click', () => addStop($('stop-select').value));
$('plan-trip').addEventListener('click', () => planTrip());
$('reverse-trip').addEventListener('click', reverseTrip);
$('clear-trip').addEventListener('click', () => { planner.clearTrip(); tripChanged(); });
$('shorten-trip').addEventListener('click', () => {
  const result = planner.optimiseTrip();
  saveTrip();
  planTrip(result.changed
    ? `Reordered the stops: ${formatMetres(result.before)} became ${formatMetres(result.after)}. The first stop stayed where it was.`
    : 'This order is already as short as the nearest-next rule can make it.');
});

// ---------- "Inside the planner" ----------

const actions = {
  showPlace,
  filterCategory,
  reverseTrip,
  loadSampleTrip,
  runMode: (mode) => {
    setMode(mode, false);
    selectTab('route');
    $('planner').scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    runRoute();
  },
};

function renderConceptList() {
  const holder = $('lab-list');
  clear(holder);
  CONCEPTS.forEach((concept, i) => {
    holder.append(el('button', {
      class: 'concept', type: 'button', role: 'tab', id: `concept-${concept.id}`,
      'aria-selected': String(concept.id === state.concept), tabindex: concept.id === state.concept ? 0 : -1,
      onclick: () => selectConcept(concept.id),
      onkeydown: (event) => {
        const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[event.key];
        if (!step) return;
        event.preventDefault();
        selectConcept(CONCEPTS[(i + step + CONCEPTS.length) % CONCEPTS.length].id, true);
      },
    },
      el('span', { class: 'concept-name', text: concept.name }),
      el('span', { class: 'concept-use', text: concept.use }),
    ));
  });
}

function selectConcept(id, focus = false) {
  state.concept = id;
  renderConceptList();
  $('lab-stage').setAttribute('aria-labelledby', `concept-${id}`);
  refreshInspector();
  if (focus) $(`concept-${id}`).focus();
}

function refreshInspector() {
  renderStage($('lab-stage'), state.concept, { planner, state, actions });
  const holder = $('activity-list');
  clear(holder);
  const recent = planner.log.slice(-12).reverse();
  if (recent.length === 0) holder.append(el('li', { class: 'muted', text: 'Nothing yet. Find a route to see the structures at work.' }));
  for (const entry of recent) holder.append(el('li', {}, el('strong', { text: entry.structure }), el('span', { text: entry.text })));
}

// ---------- map key ----------

function renderLegend() {
  const holder = $('legend');
  clear(holder);
  const swatch = (kind) => svg('svg', { class: `path-swatch path-${kind}`, viewBox: '0 0 30 12', width: 30, height: 12, 'aria-hidden': 'true' },
    svg('line', { class: 'path-casing', x1: 2, y1: 6, x2: 28, y2: 6 }),
    svg('line', { class: 'path-line', x1: 2, y1: 6, x2: 28, y2: 6 }));
  for (const [kind, label] of [['walk', 'Walkway'], ['covered', 'Covered walkway'], ['road', 'Road'], ['steps', 'Stairs']]) {
    holder.append(el('li', {}, swatch(kind), label));
  }
  for (const category of planner.categories.root.children) {
    holder.append(el('li', {}, el('span', { class: `dot cat-${category.id}`, 'aria-hidden': 'true' }), category.name));
  }
}

// ---------- theme ----------

function currentTheme() {
  const chosen = document.documentElement.dataset.theme;
  if (chosen) return chosen;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function labelThemeButton() {
  $('theme-toggle').setAttribute('aria-label', currentTheme() === 'dark' ? 'Switch to light map' : 'Switch to dark map');
}

$('theme-toggle').addEventListener('click', () => {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  store(THEME_KEY, next);
  labelThemeButton();
});

// ---------- shareable address: ?from=LIB&to=CSE&mode=shortest ----------

function rememberInAddress() {
  try {
    const query = new URLSearchParams({ from: state.from, to: state.to, mode: state.mode });
    history.replaceState(null, '', `${location.pathname}?${query}${location.hash}`);
  } catch (error) { /* some embedded previews do not allow changing the address */ }
}

function readAddress() {
  const query = new URLSearchParams(location.search);
  const from = planner.locate(query.get('from') || '');
  const to = planner.locate(query.get('to') || '');
  if (!from || !to || from === to) return false;
  state.from = from.id;
  state.to = to.id;
  if (ROUTE_MODES[query.get('mode')]) state.mode = query.get('mode');
  return true;
}

// ---------- start ----------

function start() {
  try {
    const saved = JSON.parse(localStorage.getItem(TRIP_KEY) || '[]');
    if (Array.isArray(saved)) for (const id of saved) planner.addStop(String(id));
  } catch (error) { /* nothing saved, or storage is unavailable */ }
  planner.log.length = 0; // loading the saved trip is not something the visitor did

  const shared = readAddress();
  state.places.origin = state.from;
  fromPicker.set(planner.locate(state.from));
  toPicker.set(planner.locate(state.to));
  renderModes();
  renderLegend();
  renderCategoryTree();
  fillPlaceSelect($('origin'), state.places.origin);
  fillPlaceSelect($('stop-select'), 'GAT');
  renderConceptList();
  $('lab-stage').setAttribute('aria-labelledby', `concept-${state.concept}`);
  labelThemeButton();
  setPlayIcon();
  updateBadges();
  renderRouteResult();
  renderTrip();
  refreshInspector();
  if (shared) runRoute();
}

start();
