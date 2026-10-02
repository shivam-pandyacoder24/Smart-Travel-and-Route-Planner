/**
 * RoutePlanner: the brain of the site. It has no knowledge of the page, so the
 * same code runs in the browser and in the tests.
 *
 * It loads the campus data into every data structure once, then answers
 * questions by using the structure that suits each job:
 *
 *   locations (array)        the records themselves
 *   idTable (hash table)     location ID -> position in the array
 *   graph                    places joined by paths; BFS and Dijkstra run on it
 *   categories (tree 1)      Campus > Academics > Departments > ...
 *   index (tree 2, a BST)    word -> places whose name contains that word
 *   trip (linked list)       the stops saved for a multi-stop trip
 *   backStack, forwardStack  route history for the Back and Forward buttons
 */
import { LOCATIONS, PATHS, CATEGORIES, MAP_SIZE, WALK_METRES_PER_MINUTE } from './data/campus.js';
import { HashTable } from './dsa/hash-table.js';
import { Graph, breadthFirstSearch, dijkstra, depthFirstOrder } from './dsa/graph.js';
import { CategoryTree } from './dsa/category-tree.js';
import { BinarySearchTree, fillBalanced } from './dsa/bst.js';
import { LinkedList } from './dsa/linked-list.js';
import { Stack } from './dsa/stack.js';
import { linearSearch, upperBound } from './dsa/search.js';
import { SORTERS, mergeSort } from './dsa/sorting.js';

export const ROUTE_MODES = {
  shortest: {
    label: 'Shortest',
    hint: 'Least walking distance',
    algorithm: "Dijkstra's algorithm",
    frontier: 'Min-heap',
  },
  fewest: {
    label: 'Fewest stops',
    hint: 'Passes the fewest places',
    algorithm: 'Breadth-first search',
    frontier: 'Queue',
  },
  stepfree: {
    label: 'Step-free',
    hint: 'Shortest route with no stairs',
    algorithm: "Dijkstra's algorithm",
    frontier: 'Min-heap',
  },
};

const COMPASS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
const IGNORED_WORDS = ['and', 'the', 'of'];
const GRID_COLUMNS = 'ABCDEF';
const GRID_ROWS = 4;

/** Split text into lower-case words: "Boys' Hostel" -> ["boys", "hostel"]. */
export function wordsIn(text) {
  const words = [];
  let current = '';
  const lower = text.toLowerCase();
  for (let i = 0; i < lower.length; i += 1) {
    const ch = lower[i];
    const isLetterOrDigit = (ch >= 'a' && ch <= 'z') || (ch >= '0' && ch <= '9');
    if (isLetterOrDigit) {
      current += ch;
    } else if (ch !== "'" && current !== '') {
      words[words.length] = current;
      current = '';
    }
  }
  if (current !== '') words[words.length] = current;
  return words;
}

export function minutesFor(metres) {
  return Math.max(1, Math.round(metres / WALK_METRES_PER_MINUTE));
}

/** Map square for a place, like "C2" on a printed map. */
export function gridReference(place) {
  const column = Math.min(GRID_COLUMNS.length - 1, Math.floor(place.x / (MAP_SIZE.width / GRID_COLUMNS.length)));
  const row = Math.min(GRID_ROWS - 1, Math.floor(place.y / (MAP_SIZE.height / GRID_ROWS)));
  return `${GRID_COLUMNS[column]}${row + 1}`;
}

/** Direction of travel in degrees clockwise from north (0 = north, 90 = east). */
export function bearingBetween(from, to) {
  const degrees = (Math.atan2(to.x - from.x, from.y - to.y) * 180) / Math.PI;
  return (degrees + 360) % 360;
}

export function compassName(degrees) {
  return COMPASS[Math.round(degrees / 45) % 8];
}

function instructionFor(path, compass, destination) {
  if (path.kind === 'steps') return `Take the ${path.name} ${compass} to ${destination.name}`;
  if (path.kind === 'covered') return `Follow the covered ${path.name} ${compass} to ${destination.name}`;
  if (path.kind === 'road') return `Walk ${compass} along ${path.name} to ${destination.name}`;
  if (path.name) return `Walk ${compass} along ${path.name} to ${destination.name}`;
  return `Walk ${compass} to ${destination.name}`;
}

export class RoutePlanner {
  constructor(campus = { locations: LOCATIONS, paths: PATHS, categories: CATEGORIES }) {
    // ARRAY: the location records. A place's position here is its vertex number in the graph.
    this.locations = campus.locations;
    this.paths = campus.paths;
    this.closed = new Array(this.paths.length).fill(false);
    this.log = []; // what each structure did, newest last (shown on the site)

    // HASHING: location ID -> position in the array.
    // 41 buckets: a prime number a little larger than the number of places spreads the keys well.
    this.idTable = new HashTable(41);
    for (let i = 0; i < this.locations.length; i += 1) {
      if (this.idTable.has(this.locations[i].id)) throw new Error(`Two places share the ID ${this.locations[i].id}`);
      this.idTable.set(this.locations[i].id, i);
    }

    // GRAPH: one vertex per place, one edge per path. Edge number = position in PATHS.
    this.graph = new Graph(this.locations.length);
    for (let i = 0; i < this.paths.length; i += 1) {
      const path = this.paths[i];
      const from = this.idTable.get(path.from);
      const to = this.idTable.get(path.to);
      if (from === undefined || to === undefined) throw new Error(`Path ${path.from}-${path.to} names a place that does not exist`);
      this.graph.addEdge(from, to, path.distance);
    }

    // TREE 1: categories, with each place filed under its category.
    this.categories = CategoryTree.fromDefinition(campus.categories);
    for (let i = 0; i < this.locations.length; i += 1) {
      this.categories.addItem(this.locations[i].category, i);
    }

    // TREE 2: the destination index, a BST of the words in place names.
    this.index = new BinarySearchTree();
    this.buildIndex();

    // LINKED LIST: the saved trip. STACKS: route history.
    this.trip = new LinkedList();
    this.backStack = new Stack();
    this.forwardStack = new Stack();
    this.current = null;
  }

  note(structure, text) {
    this.log[this.log.length] = { structure, text };
    if (this.log.length > 40) this.log.shift();
    return { structure, text };
  }

  buildIndex() {
    const pairs = [];
    for (let i = 0; i < this.locations.length; i += 1) {
      const words = wordsIn(this.locations[i].name);
      for (let w = 0; w < words.length; w += 1) {
        let ignored = false;
        for (let k = 0; k < IGNORED_WORDS.length; k += 1) if (IGNORED_WORDS[k] === words[w]) ignored = true;
        if (!ignored) pairs[pairs.length] = { word: words[w], place: i };
      }
    }
    // Sort the words, group repeats, then insert middle-first so the tree is balanced.
    const sorted = mergeSort(pairs, (a, b) => (a.word < b.word ? -1 : a.word > b.word ? 1 : 0)).sorted;
    const entries = [];
    for (let i = 0; i < sorted.length; i += 1) {
      const last = entries[entries.length - 1];
      if (last && last.key === sorted[i].word) last.values[last.values.length] = sorted[i].place;
      else entries[entries.length] = { key: sorted[i].word, values: [sorted[i].place] };
    }
    fillBalanced(this.index, entries);
  }

  // ---------- looking places up ----------

  /** Hash-table lookup of a location ID. Returns the record, or null. */
  locate(id) {
    const result = this.idTable.lookup(String(id).toUpperCase());
    return result.found ? this.locations[result.value] : null;
  }

  /** The same lookup, with the hash, bucket and probe count for the site to show. */
  explainLookup(id) {
    const key = String(id).toUpperCase();
    const result = this.idTable.lookup(key);
    return { key, ...result, place: result.found ? this.locations[result.value] : null };
  }

  positionOf(id) {
    return this.idTable.get(id);
  }

  /** Top-level category of a place, e.g. "academics" for the CSE Block. */
  mainCategoryOf(place) {
    const path = this.categories.pathTo(place.category);
    return path.length > 1 ? path[1] : path[0];
  }

  categoryTrail(categoryId) {
    return this.categories.pathTo(categoryId);
  }

  /** Every place under a category, found by traversing its subtree. */
  placesIn(categoryId) {
    const positions = this.categories.itemsUnder(categoryId);
    const places = [];
    for (let i = 0; i < positions.length; i += 1) places[i] = this.locations[positions[i]];
    return places;
  }

  /**
   * Suggestions for the From and To boxes. Each typed word is looked up in the
   * BST as a prefix, and a place must match every typed word.
   */
  suggest(text) {
    const typed = wordsIn(text);
    if (typed.length === 0) return { places: [], comparisons: 0, visited: [] };
    const hits = new Array(this.locations.length).fill(0);
    let comparisons = 0;
    let visited = [];
    for (let w = 0; w < typed.length; w += 1) {
      const result = this.index.prefixSearch(typed[w]);
      comparisons += result.comparisons;
      visited = result.path;
      const seen = new Array(this.locations.length).fill(false);
      for (let e = 0; e < result.entries.length; e += 1) {
        const values = result.entries[e].values;
        for (let v = 0; v < values.length; v += 1) {
          if (!seen[values[v]]) { seen[values[v]] = true; hits[values[v]] += 1; }
        }
      }
    }
    const matches = [];
    for (let i = 0; i < hits.length; i += 1) {
      if (hits[i] === typed.length) matches[matches.length] = this.locations[i];
    }
    const lower = text.trim().toLowerCase();
    const rank = (place) => (place.name.toLowerCase().startsWith(lower) ? 0 : 1);
    const places = mergeSort(matches, (a, b) => rank(a) - rank(b) || (a.name < b.name ? -1 : 1)).sorted;
    return { places, comparisons, visited };
  }

  /** Turn whatever is in a From/To box into a place: an exact name, an ID, or the best suggestion. */
  resolve(text) {
    const trimmed = String(text || '').trim();
    if (trimmed === '') return null;
    const byId = this.locate(trimmed);
    if (byId) return byId;
    const lower = trimmed.toLowerCase();
    for (let i = 0; i < this.locations.length; i += 1) {
      if (this.locations[i].name.toLowerCase() === lower) return this.locations[i];
    }
    const suggestions = this.suggest(trimmed).places;
    return suggestions.length > 0 ? suggestions[0] : null;
  }

  /**
   * "Search places": a linear search through the whole array, matching the text
   * anywhere in a place's name, ID, category or description.
   */
  search(text, quiet = false) {
    const needle = String(text || '').trim().toLowerCase();
    if (needle === '') return { places: this.locations.slice(), comparisons: 0, indexes: [] };
    const result = linearSearch(this.locations, (place) => {
      const trail = this.categories.pathTo(place.category);
      let haystack = `${place.name} ${place.id} ${place.about}`;
      for (let i = 1; i < trail.length; i += 1) haystack += ` ${trail[i].name}`;
      return haystack.toLowerCase().includes(needle);
    });
    const places = [];
    for (let i = 0; i < result.indexes.length; i += 1) places[i] = this.locations[result.indexes[i]];
    if (!quiet) this.note('Linear search', `"${needle}": checked ${result.comparisons} places, ${places.length} matched`);
    return { places, comparisons: result.comparisons, indexes: result.indexes };
  }

  // ---------- routes ----------

  canUseFor(mode) {
    return (edge) => !this.closed[edge] && (mode !== 'stepfree' || this.paths[edge].kind !== 'steps');
  }

  /** Shortest walking distance from one place to every other place (Dijkstra with no target). */
  distancesFrom(id, mode = 'shortest') {
    return dijkstra(this.graph, this.positionOf(id), -1, this.canUseFor(mode)).distances;
  }

  /**
   * Find a route.
   *   mode 'shortest'  Dijkstra on distance
   *   mode 'fewest'    breadth-first search
   *   mode 'stepfree'  Dijkstra with stairs switched off
   * `quiet` skips the activity log (used when a trip plans many legs at once).
   * Other methods take the same flag for the same reason.
   */
  findRoute(fromId, toId, mode = 'shortest', quiet = false) {
    const settings = ROUTE_MODES[mode];
    if (!settings) throw new Error(`Unknown route type "${mode}"`);
    const fromLookup = this.explainLookup(fromId);
    const toLookup = this.explainLookup(toId);
    const from = fromLookup.place;
    const to = toLookup.place;
    const base = { found: false, mode, from, to, places: [], legs: [], distance: 0, minutes: 0, steps: [], work: [] };
    if (!from || !to) return { ...base, reason: 'unknown-place' };
    if (from === to) return { ...base, reason: 'same-place' };

    const search = mode === 'fewest' ? breadthFirstSearch : dijkstra;
    const result = search(this.graph, fromLookup.value, toLookup.value, this.canUseFor(mode));

    // The animation works with IDs, not vertex numbers.
    const steps = [];
    for (let i = 0; i < result.steps.length; i += 1) {
      const step = result.steps[i];
      const discovered = [];
      for (let d = 0; d < step.discovered.length; d += 1) {
        discovered[d] = { id: this.locations[step.discovered[d].vertex].id, path: step.discovered[d].edge };
      }
      const frontier = [];
      for (let f = 0; f < step.frontier.length; f += 1) frontier[f] = this.locations[step.frontier[f]].id;
      steps[i] = { id: this.locations[step.vertex].id, cost: step.cost, discovered, frontier };
    }

    const work = [
      { structure: 'Hash table', text: `Looked up ${fromLookup.key} in bucket ${fromLookup.index} and ${toLookup.key} in bucket ${toLookup.index}` },
      {
        structure: `Graph: ${settings.algorithm}`,
        text: `Visited ${result.settled} of ${this.locations.length} places and looked at ${result.edgesChecked} neighbours`,
      },
      { structure: settings.frontier, text: `${result.frontierAdds} places were added while exploring` },
    ];

    if (!result.found) {
      work[work.length] = { structure: 'Result', text: 'The search ran out of places to explore before reaching the destination' };
      if (!quiet) for (let i = 0; i < work.length; i += 1) this.note(work[i].structure, work[i].text);
      return { ...base, steps, work, reason: 'no-route', stats: result };
    }

    const places = [];
    for (let i = 0; i < result.vertices.length; i += 1) places[i] = this.locations[result.vertices[i]];
    const legs = [];
    for (let i = 0; i < result.edges.length; i += 1) {
      const path = this.paths[result.edges[i]];
      const bearing = bearingBetween(places[i], places[i + 1]);
      const compass = compassName(bearing);
      legs[i] = {
        from: places[i],
        to: places[i + 1],
        path,
        pathIndex: result.edges[i],
        distance: path.distance,
        bearing,
        compass,
        instruction: instructionFor(path, compass, places[i + 1]),
      };
    }
    work[work.length] = { structure: 'Stack', text: `Backtracked from ${to.name}: pushed ${result.stackDepth} steps, then popped them in order` };
    if (!quiet) for (let i = 0; i < work.length; i += 1) this.note(work[i].structure, work[i].text);

    return {
      found: true, mode, from, to, places, legs, steps, work,
      distance: result.distance,
      minutes: minutesFor(result.distance),
      stops: places.length - 2, // places passed on the way, not counting the two ends
      usesSteps: legs.some((leg) => leg.path.kind === 'steps'),
      stats: result,
    };
  }

  /** Places that can be reached from a place, in depth-first order. */
  reachableFrom(id) {
    const order = depthFirstOrder(this.graph, this.positionOf(id), this.canUseFor('shortest'));
    const places = [];
    for (let i = 0; i < order.length; i += 1) places[i] = this.locations[order[i]];
    return places;
  }

  // ---------- sorting and "nearby" ----------

  /**
   * Sort a list of places.
   *   by 'name' | 'category' | 'distance' (walking distance from `fromId`)
   *   algorithm 'merge' | 'quick' | 'insertion'
   */
  sortPlaces(places, by = 'name', algorithm = 'merge', fromId = null, quiet = false) {
    const sorter = SORTERS[algorithm] || SORTERS.merge;
    const byName = (a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
    let compare = byName;
    let distances = null;
    if (by === 'distance' && fromId && this.locate(fromId)) {
      distances = this.distancesFrom(fromId);
      compare = (a, b) => distances[this.positionOf(a.id)] - distances[this.positionOf(b.id)] || byName(a, b);
    } else if (by === 'category') {
      const label = (place) => this.mainCategoryOf(place).name;
      compare = (a, b) => (label(a) < label(b) ? -1 : label(a) > label(b) ? 1 : byName(a, b));
    }
    const result = sorter.run(places, compare);
    if (!quiet) this.note(sorter.name, `Sorted ${places.length} places by ${by} with ${result.comparisons} comparisons`);
    return { sorted: result.sorted, comparisons: result.comparisons, algorithm: sorter.name, distances };
  }

  /**
   * Places within a walking distance of a place: Dijkstra for the distances,
   * merge sort to order them, binary search to find where the limit falls.
   */
  nearby(fromId, maxMetres, quiet = false) {
    const distances = this.distancesFrom(fromId);
    const origin = this.positionOf(fromId);
    const reachable = [];
    for (let i = 0; i < this.locations.length; i += 1) {
      if (i !== origin && distances[i] !== Infinity) {
        reachable[reachable.length] = { place: this.locations[i], distance: distances[i], minutes: minutesFor(distances[i]) };
      }
    }
    const sorted = mergeSort(reachable, (a, b) => a.distance - b.distance);
    const cut = upperBound(sorted.sorted, maxMetres, (entry) => entry.distance);
    const within = [];
    for (let i = 0; i < cut.index; i += 1) within[i] = sorted.sorted[i];
    if (!quiet) this.note('Binary search', `Found the ${maxMetres} m cut-off among ${sorted.sorted.length} sorted distances in ${cut.comparisons} comparisons`);
    return {
      places: within,
      all: sorted.sorted,
      total: sorted.sorted.length,
      sortComparisons: sorted.comparisons,
      searchComparisons: cut.comparisons,
      probes: cut.probes,
    };
  }

  // ---------- closed paths ----------

  setPathClosed(pathIndex, isClosed) {
    if (pathIndex < 0 || pathIndex >= this.paths.length) return;
    this.closed[pathIndex] = isClosed;
    const path = this.paths[pathIndex];
    this.note('Graph', `${isClosed ? 'Closed' : 'Reopened'} the path between ${this.locate(path.from).name} and ${this.locate(path.to).name}`);
  }

  togglePath(pathIndex) {
    this.setPathClosed(pathIndex, !this.closed[pathIndex]);
    return this.closed[pathIndex];
  }

  closedPaths() {
    const list = [];
    for (let i = 0; i < this.closed.length; i += 1) if (this.closed[i]) list[list.length] = i;
    return list;
  }

  reopenAllPaths() {
    for (let i = 0; i < this.closed.length; i += 1) this.closed[i] = false;
  }

  // ---------- route history (two stacks) ----------

  /** Record a route search. Going somewhere new clears the Forward stack, like a browser. */
  remember(fromId, toId, mode) {
    const entry = { from: fromId, to: toId, mode };
    const same = this.current && this.current.from === fromId && this.current.to === toId && this.current.mode === mode;
    if (same) return;
    if (this.current) {
      this.backStack.push(this.current);
      this.note('Stack', `Pushed the previous route onto the Back stack (${this.backStack.size} to go back to)`);
    }
    this.current = entry;
    this.forwardStack.clear();
  }

  canGoBack() {
    return !this.backStack.isEmpty();
  }

  canGoForward() {
    return !this.forwardStack.isEmpty();
  }

  goBack() {
    if (this.backStack.isEmpty()) return null;
    this.forwardStack.push(this.current);
    this.current = this.backStack.pop();
    this.note('Stack', `Popped the last route off the Back stack (${this.backStack.size} left)`);
    return this.current;
  }

  goForward() {
    if (this.forwardStack.isEmpty()) return null;
    this.backStack.push(this.current);
    this.current = this.forwardStack.pop();
    this.note('Stack', `Popped a route off the Forward stack (${this.forwardStack.size} left)`);
    return this.current;
  }

  // ---------- the saved trip (linked list) ----------

  tripStops() {
    const ids = this.trip.toArray();
    const places = [];
    for (let i = 0; i < ids.length; i += 1) places[i] = this.locate(ids[i]);
    return places;
  }

  /** Add a stop at the end. The same place twice in a row is ignored. */
  addStop(id) {
    const place = this.locate(id);
    if (!place) return false;
    if (this.trip.tail !== null && this.trip.tail.value === place.id) return false;
    this.trip.append(place.id);
    this.note('Linked list', `Appended ${place.name} after the tail (${this.trip.size} stops)`);
    return true;
  }

  removeStop(position) {
    const removed = this.trip.removeAt(position);
    if (removed !== undefined) this.note('Linked list', `Unlinked ${this.locate(removed).name} from position ${position + 1}`);
    return removed;
  }

  /** Move a stop one place earlier (direction -1) or later (direction +1). */
  moveStop(position, direction) {
    const moved = direction < 0 ? this.trip.swapWithNext(position - 1) : this.trip.swapWithNext(position);
    if (moved) this.note('Linked list', `Swapped stops ${direction < 0 ? position : position + 1} and ${direction < 0 ? position + 1 : position + 2}`);
    return moved;
  }

  reverseTrip() {
    this.trip.reverse();
    this.note('Linked list', 'Reversed the trip by swapping every node\'s prev and next pointers');
  }

  clearTrip() {
    this.trip.clear();
  }

  /** Route through every saved stop in order: one route per pair of neighbouring nodes. */
  planTrip(mode = 'shortest') {
    const routes = [];
    let distance = 0;
    let node = this.trip.head;
    while (node !== null && node.next !== null) {
      const route = this.findRoute(node.value, node.next.value, mode, true);
      if (!route.found) return { found: false, routes, distance, minutes: 0, blocked: route };
      routes[routes.length] = route;
      distance += route.distance;
      node = node.next;
    }
    if (routes.length > 0) this.note('Linked list', `Walked the list from head to tail and routed ${routes.length} legs`);
    return { found: routes.length > 0, routes, distance, minutes: routes.length > 0 ? minutesFor(distance) : 0 };
  }

  /**
   * Reorder the stops to cut walking: keep the first stop, then always go to the
   * nearest stop not yet visited. This greedy rule is fast and usually good, but
   * it does not guarantee the best possible order.
   */
  optimiseTrip() {
    const ids = this.trip.toArray();
    if (ids.length < 3) return false;
    const before = this.planTrip().distance;
    const ordered = [ids[0]];
    const used = new Array(ids.length).fill(false);
    used[0] = true;
    for (let step = 1; step < ids.length; step += 1) {
      const distances = this.distancesFrom(ordered[ordered.length - 1]);
      let best = -1;
      for (let i = 0; i < ids.length; i += 1) {
        if (used[i]) continue;
        if (best === -1 || distances[this.positionOf(ids[i])] < distances[this.positionOf(ids[best])]) best = i;
      }
      used[best] = true;
      ordered[ordered.length] = ids[best];
    }
    this.trip.clear();
    for (let i = 0; i < ordered.length; i += 1) this.trip.append(ordered[i]);
    const after = this.planTrip().distance;
    if (after >= before) {
      // The greedy order was no better, so put the stops back as they were.
      this.trip.clear();
      for (let i = 0; i < ids.length; i += 1) this.trip.append(ids[i]);
      return { before, after: before, changed: false };
    }
    this.note('Linked list', `Rebuilt the list in nearest-next order: ${before} m became ${after} m`);
    return { before, after, changed: true };
  }
}
