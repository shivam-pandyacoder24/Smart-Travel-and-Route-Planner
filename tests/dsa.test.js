// Tests for each data structure on its own. Run with:  npm test   (or: node --test)
import test from 'node:test';
import assert from 'node:assert/strict';

import { Stack } from '../src/dsa/stack.js';
import { Queue } from '../src/dsa/queue.js';
import { MinHeap } from '../src/dsa/min-heap.js';
import { LinkedList } from '../src/dsa/linked-list.js';
import { HashTable } from '../src/dsa/hash-table.js';
import { linearSearch, binarySearch, upperBound } from '../src/dsa/search.js';
import { insertionSort, mergeSort, quickSort, SORTERS } from '../src/dsa/sorting.js';
import { CategoryTree } from '../src/dsa/category-tree.js';
import { BinarySearchTree, fillBalanced } from '../src/dsa/bst.js';
import { Graph, breadthFirstSearch, dijkstra, depthFirstOrder } from '../src/dsa/graph.js';

const ascending = (a, b) => a - b;

// A small pseudo-random generator so the "random" tests give the same numbers every run.
function randomNumbers(count, seed = 7) {
  const numbers = [];
  let state = seed;
  for (let i = 0; i < count; i += 1) {
    state = (state * 1103515245 + 12345) % 2147483648;
    numbers.push(state % 1000);
  }
  return numbers;
}

// ---------- stack ----------

test('stack: last in, first out', () => {
  const stack = new Stack();
  stack.push('A'); stack.push('B'); stack.push('C');
  assert.equal(stack.size, 3);
  assert.equal(stack.peek(), 'C');
  assert.deepEqual([stack.pop(), stack.pop(), stack.pop()], ['C', 'B', 'A']);
  assert.equal(stack.isEmpty(), true);
});

test('stack: popping an empty stack gives undefined instead of crashing', () => {
  const stack = new Stack();
  assert.equal(stack.pop(), undefined);
  assert.equal(stack.peek(), undefined);
  assert.equal(stack.size, 0);
});

test('stack: toArray lists bottom to top, and clear empties it', () => {
  const stack = new Stack();
  stack.push(1); stack.push(2);
  assert.deepEqual(stack.toArray(), [1, 2]);
  stack.clear();
  assert.deepEqual(stack.toArray(), []);
});

// ---------- queue ----------

test('queue: first in, first out', () => {
  const queue = new Queue();
  queue.enqueue('A'); queue.enqueue('B'); queue.enqueue('C');
  assert.equal(queue.peek(), 'A');
  assert.deepEqual([queue.dequeue(), queue.dequeue(), queue.dequeue()], ['A', 'B', 'C']);
  assert.equal(queue.dequeue(), undefined);
});

test('queue: wraps around the end of its array and grows when full', () => {
  const queue = new Queue(4);
  for (let i = 1; i <= 4; i += 1) queue.enqueue(i);
  assert.equal(queue.dequeue(), 1);
  assert.equal(queue.dequeue(), 2);
  queue.enqueue(5); queue.enqueue(6);        // these wrap to the front slots
  assert.deepEqual(queue.toArray(), [3, 4, 5, 6]);
  queue.enqueue(7);                          // full, so the array doubles
  assert.equal(queue.capacity, 8);
  assert.deepEqual(queue.toArray(), [3, 4, 5, 6, 7]);
  assert.equal(queue.size, 5);
});

// ---------- min-heap ----------

test('min-heap: always pops the smallest priority', () => {
  const heap = new MinHeap();
  const numbers = randomNumbers(200);
  for (const n of numbers) heap.push(n, `item-${n}`);
  const popped = [];
  while (!heap.isEmpty()) popped.push(heap.pop().priority);
  assert.deepEqual(popped, [...numbers].sort(ascending));
  assert.equal(heap.pop(), undefined);
});

test('min-heap: every parent is no bigger than its children', () => {
  const heap = new MinHeap();
  for (const n of randomNumbers(50, 3)) heap.push(n, n);
  const items = heap.toArray();
  for (let i = 1; i < items.length; i += 1) {
    const parent = Math.floor((i - 1) / 2);
    assert.ok(items[parent].priority <= items[i].priority);
  }
});

// ---------- linked list ----------

test('linked list: append, prepend and read back in order', () => {
  const list = new LinkedList();
  list.append('B'); list.append('C'); list.prepend('A');
  assert.deepEqual(list.toArray(), ['A', 'B', 'C']);
  assert.equal(list.size, 3);
  assert.equal(list.head.value, 'A');
  assert.equal(list.tail.value, 'C');
  assert.equal(list.valueAt(1), 'B');
  assert.equal(list.indexOf('C'), 2);
  assert.equal(list.indexOf('Z'), -1);
});

test('linked list: removing the head, the middle and the tail keeps the links right', () => {
  const list = new LinkedList();
  for (const v of ['A', 'B', 'C', 'D', 'E']) list.append(v);
  assert.equal(list.removeAt(2), 'C');
  assert.equal(list.removeAt(0), 'A');
  assert.equal(list.removeAt(2), 'E');
  assert.deepEqual(list.toArray(), ['B', 'D']);
  assert.equal(list.head.prev, null);
  assert.equal(list.tail.next, null);
  assert.equal(list.head.next, list.tail);
  assert.equal(list.tail.prev, list.head);
  assert.equal(list.removeAt(9), undefined);
});

test('linked list: removing the only node leaves an empty list', () => {
  const list = new LinkedList();
  list.append('A');
  list.removeAt(0);
  assert.equal(list.head, null);
  assert.equal(list.tail, null);
  assert.equal(list.isEmpty(), true);
});

test('linked list: swap neighbours and reverse', () => {
  const list = new LinkedList();
  for (const v of ['A', 'B', 'C', 'D']) list.append(v);
  assert.equal(list.swapWithNext(1), true);
  assert.deepEqual(list.toArray(), ['A', 'C', 'B', 'D']);
  assert.equal(list.swapWithNext(3), false);   // the tail has nothing after it
  list.reverse();
  assert.deepEqual(list.toArray(), ['D', 'B', 'C', 'A']);
  // Walk backwards from the tail to check the prev pointers too.
  const backwards = [];
  for (let node = list.tail; node !== null; node = node.prev) backwards.push(node.value);
  assert.deepEqual(backwards, ['A', 'C', 'B', 'D']);
});

// ---------- hash table ----------

test('hash table: set, get, replace and remove', () => {
  const table = new HashTable(8);
  table.set('LIB', 1); table.set('CSE', 2);
  assert.equal(table.get('LIB'), 1);
  assert.equal(table.has('CSE'), true);
  assert.equal(table.get('XYZ'), undefined);
  table.set('LIB', 99);                        // same key: value is replaced, count unchanged
  assert.equal(table.get('LIB'), 99);
  assert.equal(table.size, 2);
  assert.equal(table.remove('LIB'), true);
  assert.equal(table.remove('LIB'), false);
  assert.equal(table.has('LIB'), false);
  assert.equal(table.size, 1);
});

test('hash table: keys that collide share a bucket and are all still found', () => {
  const table = new HashTable(1);              // one bucket forces every key to collide
  table.resize = () => {};                     // stop it growing, so the chain stays in that bucket
  const keys = ['A', 'B', 'C'];
  keys.forEach((key, i) => table.set(key, i));
  assert.equal(table.snapshot()[0].length, 3);
  keys.forEach((key, i) => assert.equal(table.get(key), i));
  assert.equal(table.lookup('A').probes, 3);   // the first key added is last in the chain
  assert.equal(table.remove('B'), true);       // remove from the middle of a chain
  assert.equal(table.get('A'), 0);
  assert.equal(table.get('C'), 2);
});

test('hash table: grows when it gets crowded and keeps every entry', () => {
  const table = new HashTable(4);
  for (let i = 0; i < 100; i += 1) table.set(`key-${i}`, i);
  assert.ok(table.bucketCount > 4);
  assert.ok(table.loadFactor <= 0.75);
  for (let i = 0; i < 100; i += 1) assert.equal(table.get(`key-${i}`), i);
  assert.equal(table.size, 100);
});

test('hash table: the same key always hashes to the same bucket', () => {
  const table = new HashTable(41);
  assert.equal(table.hash('LIB'), table.hash('LIB'));
  assert.notEqual(table.hash('LIB'), table.hash('BIL'));   // letter order matters
  const index = table.indexFor('LIB');
  assert.ok(index >= 0 && index < 41);
});

// ---------- searching ----------

test('linear search: finds every match and checks every item', () => {
  const result = linearSearch([4, 8, 15, 16, 23, 42], (n) => n % 2 === 0);
  assert.deepEqual(result.indexes, [0, 1, 3, 5]);
  assert.equal(result.comparisons, 6);
});

test('binary search: finds items in far fewer steps than a linear scan', () => {
  const sorted = [];
  for (let i = 0; i < 1000; i += 1) sorted.push(i * 2);
  for (const target of [0, 2, 998, 1998]) {
    const result = binarySearch(sorted, (item) => target - item);
    assert.equal(sorted[result.index], target);
    assert.ok(result.comparisons <= 10);        // log2(1000) is about 10
  }
  assert.equal(binarySearch(sorted, (item) => 7 - item).index, -1);
  assert.equal(binarySearch([], () => 0).index, -1);
});

test('upper bound: counts the items at or below a limit', () => {
  const distances = [50, 120, 120, 300, 410];
  const keyOf = (d) => d;
  assert.equal(upperBound(distances, 0, keyOf).index, 0);
  assert.equal(upperBound(distances, 120, keyOf).index, 3);
  assert.equal(upperBound(distances, 299, keyOf).index, 3);
  assert.equal(upperBound(distances, 1000, keyOf).index, 5);
});

// ---------- sorting ----------

for (const [key, sorter] of Object.entries(SORTERS)) {
  test(`${sorter.name}: sorts random, sorted, reversed, repeated and empty lists`, () => {
    const cases = [
      randomNumbers(300),
      [1, 2, 3, 4, 5],
      [5, 4, 3, 2, 1],
      [3, 3, 3, 1, 1, 2],
      [42],
      [],
    ];
    for (const input of cases) {
      const before = [...input];
      const result = sorter.run(input, ascending);
      assert.deepEqual(result.sorted, [...input].sort(ascending), `${key} failed on ${input.slice(0, 6)}`);
      assert.deepEqual(input, before, 'the original array must not be changed');
    }
  });
}

test('merge sort is stable: ties keep their original order', () => {
  const people = [
    { name: 'Asha', floor: 2 }, { name: 'Ravi', floor: 1 },
    { name: 'Meena', floor: 2 }, { name: 'Kiran', floor: 1 },
  ];
  const sorted = mergeSort(people, (a, b) => a.floor - b.floor).sorted;
  assert.deepEqual(sorted.map((p) => p.name), ['Ravi', 'Kiran', 'Asha', 'Meena']);
});

test('sorting: comparison counts match what the theory predicts', () => {
  const alreadySorted = [];
  for (let i = 0; i < 100; i += 1) alreadySorted.push(i);
  const reversed = [...alreadySorted].reverse();
  assert.equal(insertionSort(alreadySorted, ascending).comparisons, 99);       // best case: n - 1
  assert.equal(insertionSort(reversed, ascending).comparisons, 4950);          // worst case: n(n-1)/2
  assert.ok(mergeSort(reversed, ascending).comparisons < 700);                 // about n log2 n
  assert.ok(quickSort(randomNumbers(100), ascending).comparisons < 1500);
});

// ---------- category tree ----------

function sampleTree() {
  const tree = CategoryTree.fromDefinition({
    id: 'campus', name: 'Campus',
    children: [
      { id: 'academics', name: 'Academics', children: [{ id: 'departments', name: 'Departments' }, { id: 'study', name: 'Study spaces' }] },
      { id: 'food', name: 'Food' },
    ],
  });
  tree.addItem('departments', 'CSE');
  tree.addItem('departments', 'ECE');
  tree.addItem('study', 'LIB');
  tree.addItem('food', 'CAF');
  return tree;
}

test('category tree: find, path from the root and height', () => {
  const tree = sampleTree();
  assert.equal(tree.find('study').name, 'Study spaces');
  assert.equal(tree.find('nowhere'), null);
  assert.deepEqual(tree.pathTo('departments').map((n) => n.name), ['Campus', 'Academics', 'Departments']);
  assert.equal(tree.height(), 2);
  assert.equal(tree.nodeCount, 5);
});

test('category tree: a category includes everything in its sub-categories', () => {
  const tree = sampleTree();
  assert.deepEqual(tree.itemsUnder('departments'), ['CSE', 'ECE']);
  assert.deepEqual(tree.itemsUnder('academics'), ['CSE', 'ECE', 'LIB']);
  assert.deepEqual(tree.itemsUnder('campus'), ['CSE', 'ECE', 'LIB', 'CAF']);
  assert.deepEqual(tree.itemsUnder('nowhere'), []);
});

test('category tree: pre-order and level-order visit nodes in different orders', () => {
  const tree = sampleTree();
  assert.deepEqual(tree.preorder().map((v) => v.node.id), ['campus', 'academics', 'departments', 'study', 'food']);
  assert.deepEqual(tree.levelOrder().map((v) => v.node.id), ['campus', 'academics', 'food', 'departments', 'study']);
  assert.throws(() => tree.add('nowhere', 'x', 'X'));
});

// ---------- binary search tree ----------

test('BST: in-order traversal returns the keys in alphabetical order', () => {
  const tree = new BinarySearchTree();
  for (const word of ['library', 'block', 'hostel', 'gate', 'quad', 'admin']) tree.insert(word, word.length);
  assert.deepEqual(tree.inOrder().map((e) => e.key), ['admin', 'block', 'gate', 'hostel', 'library', 'quad']);
  assert.equal(tree.size, 6);
});

test('BST: search reports the path it took', () => {
  const tree = new BinarySearchTree();
  for (const word of ['m', 'f', 't', 'b', 'h']) tree.insert(word, word);
  assert.deepEqual(tree.search('h').path, ['m', 'f', 'h']);
  assert.equal(tree.search('h').found, true);
  assert.equal(tree.search('z').found, false);
  assert.deepEqual(tree.search('z').path, ['m', 't']);
});

test('BST: one key can hold several values, without duplicates', () => {
  const tree = new BinarySearchTree();
  tree.insert('block', 'CSE'); tree.insert('block', 'ECE'); tree.insert('block', 'CSE');
  assert.deepEqual(tree.search('block').values, ['CSE', 'ECE']);
  assert.equal(tree.size, 1);
});

test('BST: prefix search finds every key with that start and nothing else', () => {
  const tree = new BinarySearchTree();
  const words = ['hall', 'hostel', 'house', 'gate', 'garden', 'kiosk', 'lab', 'lake', 'library', 'ho'];
  for (const word of words) tree.insert(word, word);
  assert.deepEqual(tree.prefixSearch('ho').entries.map((e) => e.key), ['ho', 'hostel', 'house']);
  assert.deepEqual(tree.prefixSearch('la').entries.map((e) => e.key), ['lab', 'lake']);
  assert.deepEqual(tree.prefixSearch('z').entries, []);
  assert.equal(tree.prefixSearch('').entries.length, words.length);
});

test('BST: filling it middle-first keeps it balanced', () => {
  const entries = [];
  for (let i = 0; i < 63; i += 1) entries.push({ key: String(i).padStart(2, '0'), values: [i] });
  const balanced = new BinarySearchTree();
  fillBalanced(balanced, entries);
  assert.equal(balanced.height(), 5);          // 63 keys fit exactly in 6 levels

  const chain = new BinarySearchTree();        // the same keys inserted in sorted order
  for (const entry of entries) chain.insert(entry.key, entry.values[0]);
  assert.equal(chain.height(), 62);
  assert.equal(new BinarySearchTree().height(), -1);
});

// ---------- graph ----------

/*
 *      2        3
 *  A ----- B ------- D        E (not connected to anything)
 *  |       |         |
 *  | 10    | 1       | 1
 *  |       |         |
 *  +------ C --------+
 *              7
 */
function sampleGraph() {
  const graph = new Graph(5);
  const [A, B, C, D] = [0, 1, 2, 3];
  graph.addEdge(A, B, 2);   // edge 0
  graph.addEdge(A, C, 10);  // edge 1
  graph.addEdge(B, C, 1);   // edge 2
  graph.addEdge(B, D, 3);   // edge 3
  graph.addEdge(C, D, 7);   // edge 4
  return graph;
}

test('graph: edges are stored in both directions', () => {
  const graph = sampleGraph();
  assert.equal(graph.edgeCount, 5);
  assert.deepEqual(graph.neighbours(0).map((e) => e.to), [1, 2]);
  assert.deepEqual(graph.neighbours(2).map((e) => e.to), [0, 1, 3]);
  assert.deepEqual(graph.neighbours(4), []);
});

test('graph: Dijkstra takes the lightest route, not the most direct one', () => {
  const result = dijkstra(sampleGraph(), 0, 2);
  assert.equal(result.found, true);
  assert.deepEqual(result.vertices, [0, 1, 2]);   // A-B-C costs 3, the direct A-C edge costs 10
  assert.equal(result.distance, 3);
  assert.deepEqual(result.edges, [0, 2]);
});

test('graph: breadth-first search takes the fewest edges, whatever they weigh', () => {
  const result = breadthFirstSearch(sampleGraph(), 0, 2);
  assert.deepEqual(result.vertices, [0, 2]);
  assert.equal(result.distance, 10);
  assert.equal(result.steps[0].vertex, 0);
  assert.deepEqual(result.steps[0].frontier, [1, 2]);   // A's neighbours wait in the queue
});

test('graph: a switched-off edge is never used', () => {
  const withoutBC = (edge) => edge !== 2;
  const result = dijkstra(sampleGraph(), 0, 2, withoutBC);
  assert.deepEqual(result.vertices, [0, 2]);
  assert.equal(result.distance, 10);
});

test('graph: an unreachable target is reported, not guessed', () => {
  assert.equal(dijkstra(sampleGraph(), 0, 4).found, false);
  assert.equal(breadthFirstSearch(sampleGraph(), 0, 4).found, false);
  assert.equal(dijkstra(sampleGraph(), 0, 4).distance, Infinity);
});

test('graph: Dijkstra with no target gives the distance to every vertex', () => {
  const result = dijkstra(sampleGraph(), 0, -1);
  assert.deepEqual(result.distances, [0, 2, 3, 5, Infinity]);
});

test('graph: Dijkstra settles vertices in order of distance', () => {
  const costs = dijkstra(sampleGraph(), 0, -1).steps.map((s) => s.cost);
  assert.deepEqual(costs, [...costs].sort(ascending));
});

test('graph: depth-first traversal reaches everything that is connected', () => {
  const order = depthFirstOrder(sampleGraph(), 0);
  assert.deepEqual(order, [0, 1, 2, 3]);
  assert.deepEqual(depthFirstOrder(sampleGraph(), 4), [4]);
});
