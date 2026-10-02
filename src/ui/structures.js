/**
 * "Inside the planner": one live view for each data structure in the project.
 *
 * Every view reads the planner's real structures at the moment it is drawn, so
 * what you see here is what the route finder is actually using.
 */
import { el, svg, clear, formatMetres, plural } from './dom.js';
import { ROUTE_MODES, gridReference, wordsIn } from '../planner.js';
import { SORTERS } from '../dsa/sorting.js';

const REPOSITORY = 'https://github.com/shivam-pandyacoder24/Smart-Travel-and-Route-Planner';

export const CONCEPTS = [
  { id: 'arrays', name: 'Arrays', use: 'Location information', file: 'src/data/campus.js' },
  { id: 'search', name: 'Searching', use: 'Find locations', file: 'src/dsa/search.js' },
  { id: 'sorting', name: 'Sorting', use: 'Sort destinations', file: 'src/dsa/sorting.js' },
  { id: 'list', name: 'Linked list', use: 'Saved trip stops', file: 'src/dsa/linked-list.js' },
  { id: 'stack', name: 'Stack', use: 'Route history and backtracking', file: 'src/dsa/stack.js' },
  { id: 'queue', name: 'Queue', use: 'Route exploration', file: 'src/dsa/queue.js' },
  { id: 'tree1', name: 'Tree 1', use: 'Location categories', file: 'src/dsa/category-tree.js' },
  { id: 'tree2', name: 'Tree 2', use: 'Destination index', file: 'src/dsa/bst.js' },
  { id: 'graph', name: 'Graph', use: 'Paths, places and routes', file: 'src/dsa/graph.js' },
  { id: 'hashing', name: 'Hashing', use: 'Location-ID lookup', file: 'src/dsa/hash-table.js' },
];

/** What the person typed or picked inside a view, kept while they look at other views. */
const local = {
  searchText: 'hostel',
  limit: 400,
  sortBy: 'distance',
  prefix: 'ho',
  lookup: 'LIB',
};

function facts(pairs) {
  return el('dl', { class: 'facts' }, pairs.map(([term, value]) => el('div', {}, el('dt', { text: term }), el('dd', { text: value }))));
}

function cell(text, extra = '', sub = '') {
  return el('span', { class: `cell ${extra}` }, el('span', { class: 'cell-main', text }), sub !== '' && el('span', { class: 'cell-sub', text: sub }));
}

function routeName(planner, entry) {
  return `${planner.locate(entry.from).name} to ${planner.locate(entry.to).name}`;
}

// ---------- sideways tree drawing, shared by both trees ----------

/**
 * Draw a tree growing left to right.
 *   nodes: [{ key, label, depth, row, parent (index or -1), kind }]
 * `row` is the node's vertical slot, `depth` its column.
 */
function drawTree(nodes, { columnWidth, nodeWidth, rowHeight = 24, onPick = null, title }) {
  const rows = Math.max(...nodes.map((n) => n.row)) + 1;
  const columns = Math.max(...nodes.map((n) => n.depth)) + 1;
  const widthOf = (node) => (typeof nodeWidth === 'function' ? nodeWidth(node) : nodeWidth);
  const lastColumnWidth = Math.max(...nodes.filter((n) => n.depth === columns - 1).map(widthOf));
  const width = (columns - 1) * columnWidth + lastColumnWidth + 4;
  const height = rows * rowHeight + 6;
  const at = (node) => ({ x: node.depth * columnWidth + 2, y: node.row * rowHeight + rowHeight / 2 + 3 });

  const links = svg('g', { class: 'tree-links' });
  const boxes = svg('g', {});
  for (const node of nodes) {
    const here = at(node);
    if (node.parent >= 0) {
      const parent = nodes[node.parent];
      const from = at(parent);
      const startX = from.x + widthOf(parent);
      const bend = startX + (here.x - startX) / 2;
      links.append(svg('path', {
        class: node.state ? `is-${node.state}` : '',
        d: `M${startX} ${from.y}C${bend} ${from.y} ${bend} ${here.y} ${here.x} ${here.y}`,
      }));
    }
    const w = widthOf(node);
    const group = svg('g', {
      class: `tree-node kind-${node.kind || 'node'} ${node.state ? `is-${node.state}` : ''}`,
      transform: `translate(${here.x} ${here.y - 9.5})`,
    },
      svg('rect', { width: w, height: 19, rx: 4 }),
      svg('text', { x: 7, y: 13.5, text: node.label }),
    );
    if (onPick && node.pick) {
      group.setAttribute('role', 'button');
      group.setAttribute('tabindex', '0');
      group.classList.add('is-clickable');
      group.addEventListener('click', () => onPick(node));
      group.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onPick(node); }
      });
    }
    boxes.append(group);
  }
  const drawing = svg('svg', {
    class: 'tree-drawing', viewBox: `0 0 ${width} ${height}`, width, height, role: 'img', 'aria-label': title,
  }, links, boxes);
  return el('div', { class: 'scroll-x' }, drawing);
}

// ---------- one view per concept ----------

const VIEWS = {
  arrays({ planner, actions }) {
    const rows = planner.locations.map((place, index) => el('tr', {
      tabindex: 0,
      onclick: () => actions.showPlace(place.id),
      onkeydown: (event) => { if (event.key === 'Enter') actions.showPlace(place.id); },
    },
      el('td', { class: 'code', text: String(index) }),
      el('td', { class: 'code', text: place.id }),
      el('td', { text: place.name }),
      el('td', { text: planner.mainCategoryOf(place).name }),
      el('td', { class: 'num', text: `${place.x}, ${place.y}` }),
      el('td', { class: 'code', text: gridReference(place) }),
    ));
    return [
      el('p', { text: `All ${planner.locations.length} places are stored in one array of records. A place's position in the array is also its vertex number in the graph, so every other structure can point to a place with one small number.` }),
      facts([['Read by position', 'O(1)'], ['Find by scanning', 'O(n)'], ['Records', String(planner.locations.length)]]),
      el('div', { class: 'scroll-x' }, el('table', { class: 'data-table wide' },
        el('caption', { text: 'The LOCATIONS array. Choose a row to see that place on the map.' }),
        el('thead', {}, el('tr', {}, ['Index', 'ID', 'Name', 'Category', 'x, y (m)', 'Map square'].map((h) => el('th', { scope: 'col', text: h })))),
        el('tbody', {}, rows),
      )),
    ];
  },

  search({ planner, state, redraw }) {
    // Linear search
    const result = planner.search(local.searchText, true);
    const matched = new Set(result.indexes);
    const hasText = local.searchText.trim() !== '';
    const linearCells = planner.locations.map((place, index) => cell(place.id, hasText ? (matched.has(index) ? 'is-hit' : 'is-checked') : ''));
    const input = el('input', {
      id: 'lab-search', type: 'search', value: local.searchText,
      oninput: (event) => { local.searchText = event.target.value; redraw(); },
    });

    // Binary search on sorted distances
    const origin = planner.locate(state.from) || planner.locations[0];
    const near = planner.nearby(origin.id, local.limit, true);
    const order = new Map(near.probes.map((position, i) => [position, i + 1]));
    const binaryCells = near.all.map((entry, index) => {
      const classes = [index < near.places.length ? 'is-in' : 'is-out', order.has(index) ? 'is-probed' : ''].join(' ');
      const node = cell(entry.place.id, classes, String(entry.distance));
      if (order.has(index)) node.append(el('span', { class: 'probe', text: String(order.get(index)) }));
      return node;
    });
    const limit = el('select', {
      id: 'lab-limit',
      onchange: (event) => { local.limit = Number(event.target.value); redraw(); },
    }, [[160, '2 minute walk (160 m)'], [400, '5 minute walk (400 m)'], [800, '10 minute walk (800 m)']].map(([value, label]) => el('option', { value, selected: value === local.limit, text: label })));

    return [
      el('p', { text: 'Search places uses linear search. The text you type could be anywhere in a name, ID or description, so every record has to be checked. The "within a walk" filter uses binary search: the distances are already sorted, so each comparison throws away half of what is left.' }),
      facts([['Linear search', 'O(n)'], ['Binary search', 'O(log n)']]),
      el('div', { class: 'demo' },
        el('h4', { text: 'Linear search through the array' }),
        el('div', { class: 'field inline' }, el('label', { for: 'lab-search', text: 'Search for' }), input),
        el('div', { class: 'cells' }, linearCells),
        el('p', { class: 'result-line', text: hasText
          ? `Checked all ${result.comparisons} places. ${plural(result.places.length, 'place')} matched.`
          : 'Type something to search for.' }),
      ),
      el('div', { class: 'demo' },
        el('h4', { text: `Binary search on distances from ${origin.name}` }),
        el('div', { class: 'field inline' }, el('label', { for: 'lab-limit', text: 'Find places within a' }), limit),
        el('div', { class: 'cells' }, binaryCells),
        el('p', { class: 'result-line', text: `${plural(near.places.length, 'place')} within ${local.limit} m. Binary search looked at ${plural(near.searchComparisons, 'position')} (numbered in order) instead of all ${near.total}.` }),
      ),
    ];
  },

  sorting({ planner, state, redraw }) {
    const origin = planner.locate(state.from) || planner.locations[0];
    const runs = Object.keys(SORTERS).map((key) => ({ key, ...planner.sortPlaces(planner.locations, local.sortBy, key, origin.id, true) }));
    const most = Math.max(...runs.map((run) => run.comparisons));
    const select = el('select', {
      id: 'lab-sort',
      onchange: (event) => { local.sortBy = event.target.value; redraw(); },
    }, [['distance', `Walking distance from ${origin.name}`], ['name', 'Name, A to Z'], ['category', 'Category']].map(([value, label]) => el('option', { value, selected: value === local.sortBy, text: label })));
    const bars = runs.map((run) => el('div', { class: 'bar-row' },
      el('span', { class: 'bar-name', text: run.algorithm }),
      el('span', { class: 'bar-track' }, el('span', { class: 'bar-fill', style: `width:${Math.max(2, (run.comparisons / most) * 100)}%` })),
      el('span', { class: 'bar-value', text: `${run.comparisons} comparisons` }),
    ));
    const sorted = runs[0];
    const cells = sorted.sorted.map((place) => cell(place.id, '', sorted.distances ? String(sorted.distances[planner.positionOf(place.id)]) : ''));
    return [
      el('p', { text: 'The Places list can be sorted by name, category or walking distance. All three algorithms below produce exactly the same order. What differs is how much work each one does to get there.' }),
      facts([['Insertion sort', 'O(n²)'], ['Merge sort', 'O(n log n)'], ['Quick sort', 'O(n log n) on average']]),
      el('div', { class: 'demo' },
        el('div', { class: 'field inline' }, el('label', { for: 'lab-sort', text: `Sort ${planner.locations.length} places by` }), select),
        el('div', { class: 'bars' }, bars),
        el('h4', { text: 'Sorted result' }),
        el('div', { class: 'cells' }, cells),
        sorted.distances && el('p', { class: 'result-line', text: 'The small number under each ID is its walking distance in metres.' }),
      ),
    ];
  },

  list({ planner, actions }) {
    const stops = planner.tripStops();
    let chain;
    if (stops.length === 0) {
      chain = el('div', { class: 'empty' },
        el('p', { text: 'The list is empty: head and tail both point to nothing. Add stops in the Trip tab, or load a sample.' }),
        el('button', { class: 'button', type: 'button', onclick: () => actions.loadSampleTrip(), text: 'Load a sample trip' }),
      );
    } else {
      const nodes = [el('span', { class: 'list-end', text: 'head' })];
      stops.forEach((place, i) => {
        nodes.push(el('span', { class: 'list-arrow', 'aria-hidden': 'true', text: i === 0 ? '→' : '⇄' }));
        nodes.push(el('span', { class: 'list-node' },
          el('span', { class: 'pointer', title: 'prev pointer' }),
          el('span', { class: 'list-value' }, el('span', { class: 'code', text: place.id }), ` ${place.name}`),
          el('span', { class: 'pointer', title: 'next pointer' }),
        ));
      });
      nodes.push(el('span', { class: 'list-arrow', 'aria-hidden': 'true', text: '←' }), el('span', { class: 'list-end', text: 'tail' }));
      chain = el('div', { class: 'chain', role: 'img', 'aria-label': `Linked list: ${stops.map((p) => p.name).join(', then ')}` }, nodes);
    }
    return [
      el('p', { text: 'Your trip is a doubly linked list. Each stop is a node holding a pointer to the stop before it and the stop after it. Adding, removing or reversing stops only changes a few pointers; nothing is shifted along the way it would be in an array.' }),
      facts([['Add at the end', 'O(1)'], ['Remove a node', 'O(1) once found'], ['Reach stop n', 'O(n)'], ['Stops now', String(stops.length)]]),
      el('div', { class: 'demo' },
        chain,
        stops.length > 1 && el('div', { class: 'demo-actions' },
          el('button', { class: 'button quiet small', type: 'button', onclick: () => actions.reverseTrip(), text: 'Reverse the list' }),
        ),
      ),
    ];
  },

  stack({ planner, state }) {
    const pile = (title, entries, emptyText) => el('div', { class: 'pile' },
      el('h4', { text: title }),
      entries.length === 0
        ? el('p', { class: 'pile-empty', text: emptyText })
        : el('ol', { class: 'pile-items' }, entries.map((entry, i) => el('li', { class: i === 0 ? 'is-top' : '' },
          routeName(planner, entry), el('span', { class: 'pile-mode', text: ROUTE_MODES[entry.mode].label }),
          i === 0 && el('span', { class: 'pile-tag', text: 'top' }),
        ))),
    );
    const back = planner.backStack.toArray().reverse(); // show the top first
    const forward = planner.forwardStack.toArray().reverse();
    const route = state.route && state.route.found ? state.route : null;
    let backtrack;
    if (route) {
      const pushed = route.places.slice(1).reverse();
      backtrack = el('div', { class: 'demo' },
        el('h4', { text: `Backtracking the route from ${route.from.name} to ${route.to.name}` }),
        el('p', { class: 'result-line', text: 'The search only remembers where each place was reached from. Following those links starts at the destination, so each place is pushed as it is passed:' }),
        el('div', { class: 'cells' }, pushed.map((place, i) => cell(place.id, '', `push ${i + 1}`))),
        el('p', { class: 'result-line', text: 'Popping the stack then hands them back in walking order:' }),
        el('div', { class: 'cells' }, [cell(route.from.id, 'is-in', 'start'), ...route.places.slice(1).map((place, i) => cell(place.id, 'is-in', `pop ${i + 1}`))]),
      );
    } else {
      backtrack = el('div', { class: 'empty' }, el('p', { text: 'Find a route to see how a stack turns the search result into walking order.' }));
    }
    return [
      el('p', { text: 'Two stacks drive the Back and Forward buttons, the same way a browser does it. Finding a new route pushes the old one onto the Back stack. Back pops it and pushes the route you were on onto the Forward stack.' }),
      facts([['Push', 'O(1)'], ['Pop', 'O(1)'], ['Back stack', String(back.length)], ['Forward stack', String(forward.length)]]),
      el('div', { class: 'piles' },
        pile('Back stack', back, 'Empty. Find two routes, then use Back.'),
        el('div', { class: 'pile' },
          el('h4', { text: 'Current route' }),
          planner.current
            ? el('ol', { class: 'pile-items' }, el('li', { class: 'is-current' }, routeName(planner, planner.current), el('span', { class: 'pile-mode', text: ROUTE_MODES[planner.current.mode].label })))
            : el('p', { class: 'pile-empty', text: 'No route yet.' }),
        ),
        pile('Forward stack', forward, 'Empty. It fills when you go Back.'),
      ),
      backtrack,
    ];
  },

  queue({ planner, state, actions }) {
    const route = planner.findRoute(state.from, state.to, 'fewest', true);
    if (route.steps.length === 0) {
      return [el('div', { class: 'empty' }, el('p', { text: 'Choose two different places in From and To to see the queue at work.' }))];
    }
    const rows = route.steps.map((step, i) => el('tr', {},
      el('td', { class: 'num', text: String(i + 1) }),
      el('td', {}, cell(step.id, 'is-hit')),
      el('td', {}, step.discovered.length === 0 ? el('span', { class: 'muted', text: 'nothing new' }) : el('div', { class: 'cells tight' }, step.discovered.map((found) => cell(found.id)))),
      el('td', {}, step.frontier.length === 0 ? el('span', { class: 'muted', text: 'empty' }) : el('div', { class: 'cells tight' }, step.frontier.map((id) => cell(id)))),
    ));
    return [
      el('p', { text: 'Fewest stops uses breadth-first search. Newly discovered places join the back of a queue and the next place to visit is taken from the front. That order means everything one path away is visited before anything two paths away, so the first time the destination comes out, it has been reached in the fewest steps.' }),
      facts([['Enqueue', 'O(1)'], ['Dequeue', 'O(1)'], ['Storage', 'Circular array']]),
      el('div', { class: 'demo' },
        el('h4', { text: `Breadth-first search from ${route.from.name} to ${route.to.name}` }),
        el('div', { class: 'scroll-x' }, el('table', { class: 'data-table trace wide' },
          el('thead', {}, el('tr', {}, ['Step', 'Taken from the front', 'Joined the back', 'Queue afterwards, front first'].map((h) => el('th', { scope: 'col', text: h })))),
          el('tbody', {}, rows),
        )),
        el('div', { class: 'demo-actions' },
          el('button', { class: 'button quiet small', type: 'button', onclick: () => actions.runMode('fewest'), text: 'Play this search on the map' }),
        ),
      ),
    ];
  },

  tree1({ planner, actions }) {
    // Lay the tree out sideways: leaves take one row each, a parent sits between its children.
    const nodes = [];
    let nextRow = 0;
    const place = (categoryNode, depth, parent) => {
      const index = nodes.length;
      const entry = { key: categoryNode.id, label: categoryNode.name, depth, parent, kind: depth === 0 ? 'root' : 'branch', pick: true, row: 0 };
      nodes.push(entry);
      const childRows = [];
      for (const position of categoryNode.items) {
        const location = planner.locations[position];
        nodes.push({ key: location.id, label: location.name, depth: depth + 1, parent: index, kind: 'leaf', row: nextRow, pick: true, placeId: location.id });
        childRows.push(nextRow);
        nextRow += 1;
      }
      for (const child of categoryNode.children) childRows.push(place(child, depth + 1, index));
      entry.row = childRows.length === 0 ? nextRow++ : (Math.min(...childRows) + Math.max(...childRows)) / 2;
      return entry.row;
    };
    place(planner.categories.root, 0, -1);
    const tree = planner.categories;
    return [
      el('p', { text: 'Categories form a general tree, where a node can have any number of children. Choosing a category in the Places tab finds that node, then walks everything beneath it to collect its places.' }),
      facts([['Categories', String(tree.nodeCount)], ['Height', String(tree.height())], ['Places filed', String(planner.locations.length)], ['Collect a branch', 'O(size of branch)']]),
      el('div', { class: 'demo' },
        el('p', { class: 'result-line', text: 'Choose a category to filter the map, or a place to see it.' }),
        drawTree(nodes, {
          columnWidth: 150,
          nodeWidth: (node) => (node.kind === 'leaf' ? 150 : 128),
          rowHeight: 23,
          title: 'Category tree',
          onPick: (node) => (node.placeId ? actions.showPlace(node.placeId) : actions.filterCategory(node.key)),
        }),
      ),
    ];
  },

  tree2({ planner, redraw }) {
    const typed = wordsIn(local.prefix)[0] || '';
    const result = typed ? planner.index.prefixSearch(typed) : { entries: [], path: [], comparisons: 0 };
    const visited = new Set(result.path);
    const matches = new Set(result.entries.map((entry) => entry.key));
    const nodes = [];
    let row = 0;
    const place = (bstNode, depth, parent) => {
      if (bstNode === null) return;
      const index = nodes.length;
      const entry = { key: bstNode.key, label: bstNode.key, depth, parent, row: 0, state: matches.has(bstNode.key) ? 'match' : visited.has(bstNode.key) ? 'visited' : '' };
      nodes.push(entry);
      place(bstNode.left, depth + 1, index);
      entry.row = row; // in-order position: after the whole left subtree
      row += 1;
      place(bstNode.right, depth + 1, index);
    };
    place(planner.index.root, 0, -1);
    const found = [];
    for (const entry of result.entries) for (const position of entry.values) {
      const name = planner.locations[position].name;
      if (!found.includes(name)) found.push(name);
    }
    const input = el('input', {
      id: 'lab-prefix', type: 'text', value: local.prefix, spellcheck: 'false', autocomplete: 'off',
      oninput: (event) => { local.prefix = event.target.value; redraw(); },
    });
    return [
      el('p', { text: 'A binary search tree indexes every word in a place name, like the index at the back of a book. Smaller words go left, bigger words go right. Typing in From or To walks down this tree instead of reading every name.' }),
      facts([['Words', String(planner.index.size)], ['Height', String(planner.index.height())], ['Search', 'O(log n) when balanced'], ['Kept balanced by', 'inserting the middle word first']]),
      el('div', { class: 'demo' },
        el('div', { class: 'field inline' }, el('label', { for: 'lab-prefix', text: 'Words starting with' }), input),
        el('p', { class: 'result-line', text: typed === ''
          ? 'Type the start of a word.'
          : `Visited ${plural(result.comparisons, 'node')} out of ${planner.index.size}. ${found.length === 0 ? 'No place matches.' : `Places: ${found.join(', ')}.`}` }),
        el('ul', { class: 'key' },
          el('li', {}, el('span', { class: 'swatch is-visited' }), 'Visited'),
          el('li', {}, el('span', { class: 'swatch is-match' }), 'Match'),
        ),
        drawTree(nodes, { columnWidth: 118, nodeWidth: 92, rowHeight: 22, title: 'Binary search tree of the words in place names' }),
      ),
    ];
  },

  graph({ planner, state, actions }) {
    const closedCount = planner.closedPaths().length;
    const reachable = planner.reachableFrom('GAT').length;
    const rows = planner.locations.map((place, index) => el('tr', {},
      el('td', { class: 'code', text: String(index) }),
      el('td', {}, el('span', { class: 'code', text: place.id }), ` ${place.name}`),
      el('td', {}, el('div', { class: 'cells tight' }, planner.graph.neighbours(index).map((edge) => cell(planner.locations[edge.to].id, planner.closed[edge.edge] ? 'is-closed' : '', String(edge.weight))))),
    ));
    const route = planner.findRoute(state.from, state.to, state.mode === 'fewest' ? 'shortest' : state.mode, true);
    const trace = route.steps.length > 0 && el('div', { class: 'demo' },
      el('h4', { text: `Dijkstra's algorithm from ${route.from.name} to ${route.to.name}` }),
      el('p', { class: 'result-line', text: 'Each step settles the nearest place not yet settled. The min-heap keeps the waiting places ordered by distance.' }),
      el('div', { class: 'scroll-x' }, el('table', { class: 'data-table trace wide' },
        el('thead', {}, el('tr', {}, ['Step', 'Settled', 'Distance', 'Shorter ways found to', 'Heap afterwards, nearest first'].map((h) => el('th', { scope: 'col', text: h })))),
        el('tbody', {}, route.steps.map((step, i) => el('tr', {},
          el('td', { class: 'num', text: String(i + 1) }),
          el('td', {}, cell(step.id, 'is-hit')),
          el('td', { class: 'num', text: formatMetres(step.cost) }),
          el('td', {}, step.discovered.length === 0 ? el('span', { class: 'muted', text: 'none' }) : el('div', { class: 'cells tight' }, step.discovered.map((found) => cell(found.id)))),
          el('td', {}, step.frontier.length === 0 ? el('span', { class: 'muted', text: 'empty' }) : el('div', { class: 'cells tight' }, step.frontier.map((id) => cell(id)))),
        ))),
      )),
      el('div', { class: 'demo-actions' },
        el('button', { class: 'button quiet small', type: 'button', onclick: () => actions.runMode(state.mode === 'fewest' ? 'shortest' : state.mode), text: 'Play this search on the map' }),
      ),
    );
    return [
      el('p', { text: 'The campus is a graph. Places are vertices, paths are edges, and each edge weighs its length in metres. Shortest and Step-free run Dijkstra\'s algorithm with a min-heap. Fewest stops runs breadth-first search with a queue. Closing a path switches its edge off.' }),
      facts([
        ['Vertices', String(planner.graph.vertexCount)],
        ['Edges', String(planner.graph.edgeCount)],
        ['Closed', String(closedCount)],
        ['Reachable from Main Gate', `${reachable} of ${planner.locations.length}`],
        ['Dijkstra', 'O((V + E) log V)'],
        ['Breadth-first search', 'O(V + E)'],
      ]),
      el('div', { class: 'demo' },
        el('h4', { text: 'Adjacency list' }),
        el('p', { class: 'result-line', text: 'Each row lists the places one path away, with the distance in metres underneath. "Reachable" above is counted with a depth-first traversal.' }),
        el('div', { class: 'scroll-x' }, el('table', { class: 'data-table wide' },
          el('thead', {}, el('tr', {}, ['Vertex', 'Place', 'Neighbours'].map((h) => el('th', { scope: 'col', text: h })))),
          el('tbody', {}, rows),
        )),
      ),
      trace,
    ];
  },

  hashing({ planner, redraw }) {
    const table = planner.idTable;
    const key = local.lookup.trim().toUpperCase();
    const lookup = planner.explainLookup(key);
    const buckets = table.snapshot();
    const longest = Math.max(...buckets.map((chain) => chain.length));
    const used = buckets.filter((chain) => chain.length > 0).length;

    // Spell out the hash calculation so it can be checked by hand.
    let working = '';
    let h = 0;
    for (let i = 0; i < key.length; i += 1) {
      const code = key.charCodeAt(i);
      const next = (h * 31 + code) >>> 0;
      working += `${i === 0 ? '' : '  →  '}${h} × 31 + ${code} (${key[i]}) = ${next}`;
      h = next;
    }
    const input = el('input', {
      id: 'lab-lookup', type: 'text', value: local.lookup, maxlength: 6, spellcheck: 'false', autocomplete: 'off', class: 'code-input',
      oninput: (event) => { local.lookup = event.target.value; redraw(); },
    });
    const bucketNodes = buckets.map((chain, index) => el('li', { class: `bucket ${chain.length === 0 ? 'is-empty' : ''} ${key && index === lookup.index ? 'is-target' : ''}` },
      el('span', { class: 'bucket-number', text: String(index).padStart(2, '0') }),
      el('span', { class: 'bucket-chain' }, chain.length === 0 ? '' : chain.flatMap((entry, i) => [
        i > 0 && el('span', { class: 'chain-link', 'aria-hidden': 'true', text: '→' }),
        el('span', { class: `cell ${entry.key === key ? 'is-hit' : ''}` }, el('span', { class: 'cell-main', text: entry.key })),
      ])),
    ));
    return [
      el('p', { text: 'Every place has a three-letter ID. A hash function turns the ID into a bucket number, so the planner jumps straight to the right record instead of searching the array. IDs that land in the same bucket are linked in a chain.' }),
      facts([
        ['Lookup', 'O(1) on average'],
        ['Buckets', `${table.bucketCount} (${used} in use)`],
        ['Entries', String(table.size)],
        ['Load factor', table.loadFactor.toFixed(2)],
        ['Longest chain', String(longest)],
      ]),
      el('div', { class: 'demo' },
        el('div', { class: 'field inline' }, el('label', { for: 'lab-lookup', text: 'Look up an ID' }), input),
        key === '' ? el('p', { class: 'result-line', text: 'Type an ID such as LIB, CSE or GAT.' }) : el('div', { class: 'working' },
          el('p', { class: 'code', text: working }),
          el('p', { class: 'code', text: `${lookup.hash} mod ${table.bucketCount} = bucket ${lookup.index}` }),
          el('p', { text: lookup.found
            ? `Found after ${plural(lookup.probes, 'probe')}: position ${lookup.value} in the array, ${lookup.place.name}.`
            : `Not found. Bucket ${lookup.index} was checked (${plural(lookup.probes, 'probe')}) and no entry has that ID.` }),
        ),
        el('ol', { class: 'buckets', 'aria-label': 'Hash table buckets' }, bucketNodes),
      ),
    ];
  },
};

/** Draw one concept's view into the stage. */
export function renderStage(stage, conceptId, context) {
  const concept = CONCEPTS.find((item) => item.id === conceptId);
  // Typing in a view redraws it, so remember which box had the cursor and put it back.
  const focused = stage.contains(document.activeElement) ? document.activeElement : null;
  const focusId = focused ? focused.id : '';
  const caret = focused && 'selectionStart' in focused ? focused.selectionStart : null;

  clear(stage);
  stage.append(
    el('header', { class: 'stage-head' },
      el('h3', {}, concept.name, el('span', { class: 'stage-use', text: concept.use })),
      el('a', { class: 'code-link', href: `${REPOSITORY}/blob/main/${concept.file}` }, 'Code: ', el('span', { class: 'code', text: concept.file })),
    ),
    ...VIEWS[conceptId]({ ...context, redraw: () => renderStage(stage, conceptId, context) }).filter(Boolean),
  );

  if (focusId) {
    const again = stage.querySelector(`#${focusId}`);
    if (again) {
      again.focus();
      // Put the cursor back where it was. Some browsers do not allow this on every input type.
      try { if (caret !== null) again.setSelectionRange(caret, caret); } catch (error) { /* keep the default position */ }
    }
  }
}
