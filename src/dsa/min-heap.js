/**
 * Min-heap (priority queue): always hands back the item with the smallest priority.
 *
 * A binary heap stored in an array. For the item at index i:
 *   parent = (i - 1) / 2, left child = 2i + 1, right child = 2i + 2.
 * Push and pop both take O(log n).
 *
 * Used in this project by Dijkstra's algorithm: the place with the shortest
 * known distance from the start is always the next one to be settled.
 */
export class MinHeap {
  constructor() {
    this.items = []; // each item is { priority, value }
    this.pushes = 0;
    this.pops = 0;
  }

  get size() {
    return this.items.length;
  }

  isEmpty() {
    return this.items.length === 0;
  }

  push(priority, value) {
    this.items[this.items.length] = { priority, value };
    this.siftUp(this.items.length - 1);
    this.pushes += 1;
  }

  pop() {
    const count = this.items.length;
    if (count === 0) return undefined;
    const smallest = this.items[0];
    const last = this.items[count - 1];
    this.items.length = count - 1;
    if (count > 1) {
      this.items[0] = last;
      this.siftDown(0);
    }
    this.pops += 1;
    return smallest;
  }

  peek() {
    return this.items[0];
  }

  /** Move a new item up until its parent is no bigger than it. */
  siftUp(index) {
    let child = index;
    while (child > 0) {
      const parent = Math.floor((child - 1) / 2);
      if (this.items[parent].priority <= this.items[child].priority) break;
      this.swap(parent, child);
      child = parent;
    }
  }

  /** Move the root down until both children are no smaller than it. */
  siftDown(index) {
    const count = this.items.length;
    let parent = index;
    while (true) {
      const left = 2 * parent + 1;
      const right = 2 * parent + 2;
      let smallest = parent;
      if (left < count && this.items[left].priority < this.items[smallest].priority) smallest = left;
      if (right < count && this.items[right].priority < this.items[smallest].priority) smallest = right;
      if (smallest === parent) break;
      this.swap(parent, smallest);
      parent = smallest;
    }
  }

  swap(a, b) {
    const held = this.items[a];
    this.items[a] = this.items[b];
    this.items[b] = held;
  }

  /** Copy of the heap array in its stored order (not sorted). */
  toArray() {
    const copy = [];
    for (let i = 0; i < this.items.length; i += 1) copy[i] = this.items[i];
    return copy;
  }
}
