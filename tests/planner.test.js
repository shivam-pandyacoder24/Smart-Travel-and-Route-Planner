// Tests for the planner: the campus data loaded into every structure, and the features built on them.
import test from 'node:test';
import assert from 'node:assert/strict';

import { RoutePlanner, ROUTE_MODES, wordsIn, gridReference, bearingBetween, compassName, minutesFor } from '../src/planner.js';
import { LOCATIONS, PATHS, CATEGORIES, MAP_SIZE } from '../src/data/campus.js';

const ids = (places) => places.map((place) => place.id);

// ---------- the campus data ----------

test('data: every place has a unique short ID, a name and a spot on the map', () => {
  const seen = new Set();
  for (const place of LOCATIONS) {
    assert.match(place.id, /^[A-Z0-9]{2,4}$/);
    assert.ok(!seen.has(place.id), `${place.id} is used twice`);
    seen.add(place.id);
    assert.ok(place.name.length > 0 && place.about.length > 0);
    assert.ok(place.x > 0 && place.x < MAP_SIZE.width && place.y > 0 && place.y < MAP_SIZE.height);
  }
});

test('data: every path joins two real places and its length agrees with the map', () => {
  const byId = Object.fromEntries(LOCATIONS.map((place) => [place.id, place]));
  const seen = new Set();
  for (const path of PATHS) {
    const a = byId[path.from];
    const b = byId[path.to];
    assert.ok(a && b, `${path.from}-${path.to} names an unknown place`);
    assert.notEqual(path.from, path.to);
    const key = [path.from, path.to].sort().join('-');
    assert.ok(!seen.has(key), `${key} is listed twice`);
    seen.add(key);
    const straight = Math.hypot(a.x - b.x, a.y - b.y);
    // A path cannot be shorter than the straight line between its ends, and should not be wildly longer.
    assert.ok(path.distance >= straight - 1 && path.distance <= straight * 1.5 + 5, `${key} distance does not match the map`);
    assert.ok(['walk', 'covered', 'road', 'steps'].includes(path.kind));
    if (path.kind !== 'walk') assert.ok(path.name, `${key} needs a name`);
  }
});

test('data: every place belongs to a category that exists in the tree', () => {
  const planner = new RoutePlanner();
  for (const place of LOCATIONS) {
    assert.ok(planner.categories.find(place.category), `${place.id} has unknown category ${place.category}`);
  }
  assert.equal(planner.placesIn(CATEGORIES.id).length, LOCATIONS.length);
});

// ---------- arrays and hashing ----------

test('hashing: every ID is found through the hash table, in at most a few probes', () => {
  const planner = new RoutePlanner();
  for (const place of LOCATIONS) {
    const lookup = planner.explainLookup(place.id);
    assert.equal(lookup.found, true);
    assert.equal(lookup.place, place);
    assert.ok(lookup.probes <= 3);
  }
  assert.equal(planner.locate('lib').name, 'Central Library');   // IDs are not case-sensitive
  assert.equal(planner.locate('XXX'), null);
  assert.equal(planner.explainLookup('XXX').found, false);
});

test('hashing: two places with the same ID are rejected', () => {
  const clash = [LOCATIONS[0], { ...LOCATIONS[1], id: LOCATIONS[0].id }];
  assert.throws(() => new RoutePlanner({ locations: clash, paths: [], categories: CATEGORIES }));
});

// ---------- graph and routes ----------

test('graph: the whole campus is connected', () => {
  const planner = new RoutePlanner();
  assert.equal(planner.graph.vertexCount, LOCATIONS.length);
  assert.equal(planner.graph.edgeCount, PATHS.length);
  assert.equal(planner.reachableFrom('GAT').length, LOCATIONS.length);
});

test('route: Central Library to CSE Block, the example from the project brief', () => {
  const planner = new RoutePlanner();
  const route = planner.findRoute('LIB', 'CSE', 'shortest');
  assert.equal(route.found, true);
  assert.deepEqual(ids(route.places), ['LIB', 'SCI', 'CSE']);
  assert.equal(route.distance, 365);
  assert.equal(route.minutes, 5);
  assert.equal(route.stops, 1);
  assert.equal(route.usesSteps, true);
  assert.equal(route.legs.length, 2);
  assert.equal(route.legs[0].instruction, 'Take the Science Steps north-west to Science Block');
  assert.equal(route.legs[0].distance + route.legs[1].distance, route.distance);
});

test('route: step-free avoids every staircase, even when that is longer', () => {
  const planner = new RoutePlanner();
  const route = planner.findRoute('LIB', 'CSE', 'stepfree');
  assert.deepEqual(ids(route.places), ['LIB', 'COF', 'LHC', 'CSE']);
  assert.equal(route.distance, 425);
  assert.equal(route.usesSteps, false);
  for (const a of LOCATIONS) {
    const r = planner.findRoute('QUA', a.id, 'stepfree', true);
    if (a.id !== 'QUA') assert.ok(r.found && r.legs.every((leg) => leg.path.kind !== 'steps'));
  }
});

test('route: fewest stops can be a longer walk than the shortest route', () => {
  const planner = new RoutePlanner();
  const shortest = planner.findRoute('GHO', 'GST', 'shortest');
  const fewest = planner.findRoute('GHO', 'GST', 'fewest');
  assert.ok(fewest.places.length < shortest.places.length);
  assert.ok(fewest.distance > shortest.distance);
});

test('route: the shortest route is never beaten by any other route type, for every pair of places', () => {
  const planner = new RoutePlanner();
  for (const a of LOCATIONS) {
    for (const b of LOCATIONS) {
      if (a.id >= b.id) continue;
      const shortest = planner.findRoute(a.id, b.id, 'shortest', true);
      const fewest = planner.findRoute(a.id, b.id, 'fewest', true);
      const stepfree = planner.findRoute(a.id, b.id, 'stepfree', true);
      assert.ok(shortest.found && fewest.found && stepfree.found);
      assert.ok(shortest.distance <= fewest.distance);
      assert.ok(shortest.distance <= stepfree.distance);
      assert.ok(fewest.places.length <= shortest.places.length);
      // A route is the same length in both directions because paths are two-way.
      assert.equal(planner.findRoute(b.id, a.id, 'shortest', true).distance, shortest.distance);
    }
  }
});

test('route: each step joins the place before it to the place after it', () => {
  const planner = new RoutePlanner();
  const route = planner.findRoute('MEC', 'MED', 'shortest');
  assert.equal(route.places[0].id, 'MEC');
  assert.equal(route.places.at(-1).id, 'MED');
  route.legs.forEach((leg, i) => {
    assert.equal(leg.from, route.places[i]);
    assert.equal(leg.to, route.places[i + 1]);
    const ends = [leg.path.from, leg.path.to].sort();
    assert.deepEqual(ends, [leg.from.id, leg.to.id].sort());
  });
});

test('route: the search trace starts at the source and ends at the destination', () => {
  const planner = new RoutePlanner();
  for (const mode of Object.keys(ROUTE_MODES)) {
    const route = planner.findRoute('GAT', 'SPC', mode);
    assert.equal(route.steps[0].id, 'GAT');
    assert.equal(route.steps.at(-1).id, 'SPC');
    assert.equal(route.steps.length, route.stats.settled);
    assert.ok(route.work.length >= 4);
  }
});

test('route: same place, unknown place and unknown route type are handled', () => {
  const planner = new RoutePlanner();
  assert.equal(planner.findRoute('LIB', 'LIB').reason, 'same-place');
  assert.equal(planner.findRoute('LIB', 'ZZZ').reason, 'unknown-place');
  assert.throws(() => planner.findRoute('LIB', 'CSE', 'teleport'));
});

test('closed paths: the route goes around a closure, and reports when there is no way through', () => {
  const planner = new RoutePlanner();
  const steps = PATHS.findIndex((p) => p.name === 'Science Steps');
  planner.setPathClosed(steps, true);
  const detour = planner.findRoute('LIB', 'CSE', 'shortest');
  assert.deepEqual(ids(detour.places), ['LIB', 'COF', 'LHC', 'CSE']);
  assert.deepEqual(planner.closedPaths(), [steps]);

  // Close every path that touches the Lake Garden: it can no longer be reached.
  PATHS.forEach((path, i) => { if (path.from === 'LAK' || path.to === 'LAK') planner.setPathClosed(i, true); });
  const blocked = planner.findRoute('LIB', 'LAK', 'shortest');
  assert.equal(blocked.found, false);
  assert.equal(blocked.reason, 'no-route');
  assert.equal(planner.reachableFrom('LAK').length, 1);

  planner.reopenAllPaths();
  assert.equal(planner.findRoute('LIB', 'LAK', 'shortest').found, true);
  assert.equal(planner.togglePath(steps), true);
  assert.equal(planner.togglePath(steps), false);
});

// ---------- searching ----------

test('search places: linear search matches names, IDs, descriptions and categories', () => {
  const planner = new RoutePlanner();
  assert.deepEqual(ids(planner.search('hostel').places).sort(), ['BHO', 'GHO', 'MES']);
  assert.deepEqual(ids(planner.search('ATM').places), ['ATM']);
  assert.ok(ids(planner.search('coffee').places).includes('COF'));
  assert.ok(ids(planner.search('departments').places).includes('CSE'));
  assert.equal(planner.search('swimming').places[0].id, 'SPC');
  assert.equal(planner.search('zzz').places.length, 0);
  assert.equal(planner.search('hostel').comparisons, LOCATIONS.length);
  assert.equal(planner.search('').places.length, LOCATIONS.length);
});

test('nearby: sorted nearest first and cut off at the limit by binary search', () => {
  const planner = new RoutePlanner();
  const near = planner.nearby('LIB', 200);
  assert.deepEqual(near.places.map((n) => n.place.id), ['COF', 'BKS', 'MBA', 'QUA', 'SCI']);
  assert.ok(near.places.every((n) => n.distance <= 200));
  assert.equal(near.total, LOCATIONS.length - 1);
  assert.ok(near.searchComparisons <= 5);              // log2(28) rounds up to 5
  assert.equal(planner.nearby('LIB', 10).places.length, 0);
  assert.equal(planner.nearby('LIB', 5000).places.length, LOCATIONS.length - 1);
});

// ---------- sorting ----------

test('sort destinations: by name, by category and by walking distance', () => {
  const planner = new RoutePlanner();
  const byName = planner.sortPlaces(LOCATIONS, 'name').sorted;
  assert.equal(byName[0].name, 'Admin Block');
  assert.equal(byName.at(-1).name, 'Sports Complex');

  const byDistance = planner.sortPlaces(LOCATIONS, 'distance', 'merge', 'LIB');
  assert.equal(byDistance.sorted[0].id, 'LIB');
  assert.equal(byDistance.sorted[1].id, 'COF');
  const d = byDistance.sorted.map((place) => byDistance.distances[planner.positionOf(place.id)]);
  assert.deepEqual(d, [...d].sort((a, b) => a - b));

  const byCategory = planner.sortPlaces(LOCATIONS, 'category').sorted;
  assert.equal(planner.mainCategoryOf(byCategory[0]).name, 'Academics');
});

test('sort destinations: all three algorithms agree', () => {
  const planner = new RoutePlanner();
  const merge = planner.sortPlaces(LOCATIONS, 'distance', 'merge', 'GAT');
  const quick = planner.sortPlaces(LOCATIONS, 'distance', 'quick', 'GAT');
  const insertion = planner.sortPlaces(LOCATIONS, 'distance', 'insertion', 'GAT');
  assert.deepEqual(ids(quick.sorted), ids(merge.sorted));
  assert.deepEqual(ids(insertion.sorted), ids(merge.sorted));
  assert.equal(merge.algorithm, 'Merge sort');
  assert.ok(merge.comparisons > 0 && quick.comparisons > 0 && insertion.comparisons > 0);
});

// ---------- tree 1: categories ----------

test('categories: a branch lists every place beneath it', () => {
  const planner = new RoutePlanner();
  assert.deepEqual(ids(planner.placesIn('departments')).sort(), ['CSE', 'ECE', 'MBA', 'MEC', 'SCI']);
  assert.equal(planner.placesIn('academics').length, 8);
  assert.deepEqual(planner.categoryTrail('departments').map((n) => n.name), ['Campus', 'Academics', 'Departments']);
  assert.equal(planner.mainCategoryOf(planner.locate('CSE')).id, 'academics');
  assert.equal(planner.mainCategoryOf(planner.locate('BHO')).id, 'stay');
  assert.equal(planner.categories.height(), 2);
});

// ---------- tree 2: destination index ----------

test('destination index: typing the start of any word in a name finds the place', () => {
  const planner = new RoutePlanner();
  assert.deepEqual(ids(planner.suggest('lib').places), ['LIB']);
  assert.deepEqual(ids(planner.suggest('Library').places), ['LIB']);
  assert.equal(planner.suggest('block').places.length, 6);
  assert.deepEqual(ids(planner.suggest('cse bl').places), ['CSE']);       // every typed word must match
  assert.deepEqual(ids(planner.suggest('ho').places), ['MES', 'BHO', 'GHO', 'GST']);   // names starting with "ho" first
  assert.equal(planner.suggest('xyz').places.length, 0);
  assert.equal(planner.suggest('  ').places.length, 0);
});

test('destination index: the tree is balanced and holds every word once', () => {
  const planner = new RoutePlanner();
  const keys = planner.index.inOrder().map((entry) => entry.key);
  assert.deepEqual(keys, [...keys].sort());
  assert.equal(new Set(keys).size, keys.length);
  assert.ok(!keys.includes('and'));
  assert.equal(planner.index.height(), Math.floor(Math.log2(keys.length)));
  assert.ok(planner.suggest('lib').comparisons <= planner.index.height() + 2);
});

test('resolve: accepts an ID, a full name or the start of a name', () => {
  const planner = new RoutePlanner();
  assert.equal(planner.resolve('cse').id, 'CSE');
  assert.equal(planner.resolve('central library').id, 'LIB');
  assert.equal(planner.resolve('Libr').id, 'LIB');
  assert.equal(planner.resolve('nowhere at all'), null);
  assert.equal(planner.resolve(''), null);
});

// ---------- linked list: the trip ----------

test('trip: add, reorder, remove and reverse stops', () => {
  const planner = new RoutePlanner();
  assert.equal(planner.addStop('GAT'), true);
  assert.equal(planner.addStop('GAT'), false);          // the same stop twice in a row is ignored
  assert.equal(planner.addStop('ZZZ'), false);
  planner.addStop('LIB'); planner.addStop('CAF'); planner.addStop('BHO');
  assert.deepEqual(ids(planner.tripStops()), ['GAT', 'LIB', 'CAF', 'BHO']);

  planner.moveStop(2, -1);                              // Food Court one place earlier
  assert.deepEqual(ids(planner.tripStops()), ['GAT', 'CAF', 'LIB', 'BHO']);
  planner.moveStop(0, +1);
  assert.deepEqual(ids(planner.tripStops()), ['CAF', 'GAT', 'LIB', 'BHO']);
  assert.equal(planner.moveStop(0, -1), false);         // the first stop cannot move earlier
  assert.equal(planner.moveStop(3, +1), false);

  assert.equal(planner.removeStop(1), 'GAT');
  planner.reverseTrip();
  assert.deepEqual(ids(planner.tripStops()), ['BHO', 'LIB', 'CAF']);
  planner.clearTrip();
  assert.deepEqual(planner.tripStops(), []);
});

test('trip: the plan is one route per pair of neighbouring stops', () => {
  const planner = new RoutePlanner();
  assert.equal(planner.planTrip().found, false);        // nothing to plan with fewer than two stops
  planner.addStop('GAT');
  assert.equal(planner.planTrip().found, false);
  planner.addStop('LIB'); planner.addStop('CAF');
  const plan = planner.planTrip();
  assert.equal(plan.routes.length, 2);
  const expected = planner.findRoute('GAT', 'LIB').distance + planner.findRoute('LIB', 'CAF').distance;
  assert.equal(plan.distance, expected);
  assert.equal(plan.minutes, minutesFor(expected));
});

test('trip: "shorten trip" keeps the first stop and never makes the trip longer', () => {
  const planner = new RoutePlanner();
  for (const id of ['GAT', 'BGT', 'ADM', 'SPC', 'AUD']) planner.addStop(id);
  const before = planner.planTrip().distance;
  const result = planner.optimiseTrip();
  assert.equal(result.changed, true);
  assert.equal(result.before, before);
  assert.ok(result.after < before);
  const stops = ids(planner.tripStops());
  assert.equal(stops[0], 'GAT');
  assert.deepEqual([...stops].sort(), ['ADM', 'AUD', 'BGT', 'GAT', 'SPC']);

  const again = planner.optimiseTrip();                 // already in nearest-next order
  assert.equal(again.changed, false);
  assert.deepEqual(ids(planner.tripStops()), stops);
});

// ---------- stacks: route history ----------

test('history: Back and Forward work like a browser', () => {
  const planner = new RoutePlanner();
  assert.equal(planner.canGoBack(), false);
  assert.equal(planner.goBack(), null);
  planner.remember('LIB', 'CSE', 'shortest');
  planner.remember('LIB', 'CSE', 'shortest');           // repeating the same search adds nothing
  planner.remember('GAT', 'LIB', 'fewest');
  planner.remember('CAF', 'BHO', 'stepfree');
  assert.equal(planner.backStack.size, 2);

  assert.deepEqual(planner.goBack(), { from: 'GAT', to: 'LIB', mode: 'fewest' });
  assert.deepEqual(planner.goBack(), { from: 'LIB', to: 'CSE', mode: 'shortest' });
  assert.equal(planner.canGoBack(), false);
  assert.deepEqual(planner.goForward(), { from: 'GAT', to: 'LIB', mode: 'fewest' });

  planner.remember('ADM', 'AUD', 'shortest');           // a new search clears Forward
  assert.equal(planner.canGoForward(), false);
  assert.equal(planner.goForward(), null);
  assert.deepEqual(planner.goBack(), { from: 'GAT', to: 'LIB', mode: 'fewest' });
});

// ---------- helpers ----------

test('helpers: words, map squares, compass directions and minutes', () => {
  assert.deepEqual(wordsIn("Boys' Hostel"), ['boys', 'hostel']);
  assert.deepEqual(wordsIn('Open-Air Theatre'), ['open', 'air', 'theatre']);
  assert.deepEqual(wordsIn('  '), []);
  assert.equal(gridReference({ x: 10, y: 10 }), 'A1');
  assert.equal(gridReference({ x: 1190, y: 750 }), 'F4');
  assert.equal(gridReference({ x: 590, y: 290 }), 'C2');
  const here = { x: 100, y: 100 };
  assert.equal(compassName(bearingBetween(here, { x: 100, y: 0 })), 'north');
  assert.equal(compassName(bearingBetween(here, { x: 200, y: 100 })), 'east');
  assert.equal(compassName(bearingBetween(here, { x: 0, y: 200 })), 'south-west');
  assert.equal(compassName(359), 'north');
  assert.equal(minutesFor(80), 1);
  assert.equal(minutesFor(10), 1);
  assert.equal(minutesFor(400), 5);
});

test('activity log: operations are recorded and the log stays short', () => {
  const planner = new RoutePlanner();
  planner.findRoute('LIB', 'CSE');
  assert.ok(planner.log.some((entry) => entry.structure === 'Hash table'));
  assert.ok(planner.log.some((entry) => entry.structure === 'Stack'));
  for (let i = 0; i < 30; i += 1) planner.findRoute('LIB', 'CSE');
  assert.ok(planner.log.length <= 40);
});
