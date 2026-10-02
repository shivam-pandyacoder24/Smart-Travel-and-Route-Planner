/**
 * Weighted, undirected graph stored as an adjacency list.
 *
 * Vertices are numbered 0 .. vertexCount - 1 (the same numbers as the positions
 * in the locations array). `adjacency[v]` lists the edges leaving vertex v.
 *
 * Used in this project for the campus itself: places are vertices, paths are
 * edges, and the weight of an edge is its length in metres.
 *
 * Three algorithms run on it:
 *   breadthFirstSearch  fewest stops       uses a Queue
 *   dijkstra            shortest distance  uses a MinHeap
 *   depthFirstOrder     what is reachable  uses a Stack
 * The first two rebuild the route by backtracking with a Stack.
 */
import { Queue } from './queue.js';
import { Stack } from './stack.js';
import { MinHeap } from './min-heap.js';
import { insertionSort } from './sorting.js';

export class Graph {
  constructor(vertexCount) {
    this.vertexCount = vertexCount;
    this.adjacency = [];
    for (let v = 0; v < vertexCount; v += 1) this.adjacency[v] = [];
    this.edges = []; // edges[e] = { a, b, weight }
  }

  /** Join two vertices. Returns the new edge's number. */
  addEdge(a, b, weight) {
    const edge = this.edges.length;
    this.edges[edge] = { a, b, weight };
    this.adjacency[a][this.adjacency[a].length] = { to: b, weight, edge };
    this.adjacency[b][this.adjacency[b].length] = { to: a, weight, edge };
    return edge;
  }

  neighbours(vertex) {
    return this.adjacency[vertex];
  }

  get edgeCount() {
    return this.edges.length;
  }
}

const allowEveryEdge = () => true;

/**
 * Backtracking. A search records, for each vertex, the vertex it was reached
 * from. Starting at the target and following those links gives the route in
 * reverse, so each step is pushed on a stack and popped off in the right order.
 */
function rebuildRoute(previousVertex, previousEdge, source, target) {
  const stack = new Stack();
  let vertex = target;
  while (vertex !== source) {
    stack.push({ vertex, edge: previousEdge[vertex] });
    vertex = previousVertex[vertex];
  }
  const vertices = [source];
  const edges = [];
  const pushed = stack.size;
  while (!stack.isEmpty()) {
    const step = stack.pop();
    vertices[vertices.length] = step.vertex;
    edges[edges.length] = step.edge;
  }
  return { vertices, edges, stackDepth: pushed };
}

function notFound(steps, counters) {
  return { found: false, vertices: [], edges: [], distance: Infinity, steps, ...counters };
}

/**
 * Breadth-first search: fewest edges from source to target.
 * `canUse(edge)` lets the caller switch edges off (closed paths, stairs).
 */
export function breadthFirstSearch(graph, source, target, canUse = allowEveryEdge) {
  const visited = new Array(graph.vertexCount).fill(false);
  const previousVertex = new Array(graph.vertexCount).fill(-1);
  const previousEdge = new Array(graph.vertexCount).fill(-1);
  const level = new Array(graph.vertexCount).fill(-1);
  const queue = new Queue();
  const steps = []; // one entry per vertex taken from the queue, for the animation
  let edgesChecked = 0;
  let enqueued = 0;

  visited[source] = true;
  level[source] = 0;
  queue.enqueue(source);
  enqueued += 1;

  while (!queue.isEmpty()) {
    const vertex = queue.dequeue();
    const discovered = [];
    if (vertex !== target) {
      const edges = graph.neighbours(vertex);
      for (let i = 0; i < edges.length; i += 1) {
        const { to, edge } = edges[i];
        if (!canUse(edge)) continue;
        edgesChecked += 1;
        if (visited[to]) continue;
        visited[to] = true;
        previousVertex[to] = vertex;
        previousEdge[to] = edge;
        level[to] = level[vertex] + 1;
        queue.enqueue(to);
        enqueued += 1;
        discovered[discovered.length] = { vertex: to, edge };
      }
    }
    steps[steps.length] = { vertex, cost: level[vertex], discovered, frontier: queue.toArray() };
    if (vertex === target) {
      const route = rebuildRoute(previousVertex, previousEdge, source, target);
      let distance = 0;
      for (let i = 0; i < route.edges.length; i += 1) distance += graph.edges[route.edges[i]].weight;
      return {
        found: true, ...route, distance, steps,
        settled: steps.length, edgesChecked, frontierAdds: enqueued,
      };
    }
  }
  return notFound(steps, { settled: steps.length, edgesChecked, frontierAdds: enqueued, stackDepth: 0 });
}

/**
 * Dijkstra's algorithm: smallest total weight from source to target.
 * Pass target = -1 to settle every reachable vertex (used for "nearest places").
 */
export function dijkstra(graph, source, target, canUse = allowEveryEdge) {
  const distance = new Array(graph.vertexCount).fill(Infinity);
  const settled = new Array(graph.vertexCount).fill(false);
  const previousVertex = new Array(graph.vertexCount).fill(-1);
  const previousEdge = new Array(graph.vertexCount).fill(-1);
  const heap = new MinHeap();
  const steps = [];
  let edgesChecked = 0;

  distance[source] = 0;
  heap.push(0, source);

  while (!heap.isEmpty()) {
    const { priority, value: vertex } = heap.pop();
    // A vertex can be in the heap more than once. Only its best entry counts.
    if (settled[vertex] || priority > distance[vertex]) continue;
    settled[vertex] = true;

    const discovered = [];
    if (vertex !== target) {
      const edges = graph.neighbours(vertex);
      for (let i = 0; i < edges.length; i += 1) {
        const { to, weight, edge } = edges[i];
        if (!canUse(edge)) continue;
        edgesChecked += 1;
        if (settled[to]) continue;
        const candidate = distance[vertex] + weight;
        if (candidate < distance[to]) {
          // Relaxation: a shorter way to reach `to` has been found.
          distance[to] = candidate;
          previousVertex[to] = vertex;
          previousEdge[to] = edge;
          heap.push(candidate, to);
          discovered[discovered.length] = { vertex: to, edge };
        }
      }
    }

    // Snapshot of the vertices still waiting, nearest first, without stale entries.
    const waiting = [];
    const heapItems = heap.toArray();
    for (let i = 0; i < heapItems.length; i += 1) {
      const item = heapItems[i];
      if (!settled[item.value] && item.priority === distance[item.value]) waiting[waiting.length] = item;
    }
    const nearestFirst = insertionSort(waiting, (a, b) => a.priority - b.priority).sorted;
    const frontier = [];
    for (let i = 0; i < nearestFirst.length; i += 1) frontier[i] = nearestFirst[i].value;

    steps[steps.length] = { vertex, cost: distance[vertex], discovered, frontier };

    if (vertex === target) {
      const route = rebuildRoute(previousVertex, previousEdge, source, target);
      return {
        found: true, ...route, distance: distance[target], steps, distances: distance,
        settled: steps.length, edgesChecked, frontierAdds: heap.pushes,
      };
    }
  }

  return {
    ...notFound(steps, { settled: steps.length, edgesChecked, frontierAdds: heap.pushes, stackDepth: 0 }),
    distances: distance,
  };
}

/**
 * Depth-first traversal with an explicit stack. Returns every vertex that can be
 * reached from `source`, in the order it was first visited.
 */
export function depthFirstOrder(graph, source, canUse = allowEveryEdge) {
  const visited = new Array(graph.vertexCount).fill(false);
  const order = [];
  const stack = new Stack();
  stack.push(source);
  while (!stack.isEmpty()) {
    const vertex = stack.pop();
    if (visited[vertex]) continue;
    visited[vertex] = true;
    order[order.length] = vertex;
    const edges = graph.neighbours(vertex);
    // Push in reverse so the first neighbour listed is the first one explored.
    for (let i = edges.length - 1; i >= 0; i -= 1) {
      if (canUse(edges[i].edge) && !visited[edges[i].to]) stack.push(edges[i].to);
    }
  }
  return order;
}
