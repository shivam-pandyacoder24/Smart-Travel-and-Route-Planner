/**
 * Queue: first in, first out (FIFO).
 *
 * Built as a circular array: `front` and `rear` chase each other around a fixed
 * block of slots, so nothing has to be shifted when an item leaves. When the
 * block is full it is copied into one twice the size.
 *
 * Used in this project for:
 *   - Breadth-first search ("fewest stops" routes): places wait in the queue
 *     in the order they were discovered, so the search spreads out level by level.
 *   - Level-order traversal of the category tree.
 */
export class Queue {
  constructor(capacity = 8) {
    this.slots = new Array(capacity);
    this.capacity = capacity;
    this.front = 0; // index of the oldest item
    this.count = 0; // how many items are waiting
  }

  enqueue(value) {
    if (this.count === this.capacity) this.grow();
    const rear = (this.front + this.count) % this.capacity;
    this.slots[rear] = value;
    this.count += 1;
  }

  dequeue() {
    if (this.count === 0) return undefined; // underflow
    const value = this.slots[this.front];
    this.slots[this.front] = undefined;
    this.front = (this.front + 1) % this.capacity;
    this.count -= 1;
    return value;
  }

  peek() {
    return this.count === 0 ? undefined : this.slots[this.front];
  }

  isEmpty() {
    return this.count === 0;
  }

  get size() {
    return this.count;
  }

  /** Copy of the contents, oldest first. */
  toArray() {
    const copy = [];
    for (let i = 0; i < this.count; i += 1) {
      copy[i] = this.slots[(this.front + i) % this.capacity];
    }
    return copy;
  }

  grow() {
    const bigger = new Array(this.capacity * 2);
    for (let i = 0; i < this.count; i += 1) {
      bigger[i] = this.slots[(this.front + i) % this.capacity];
    }
    this.slots = bigger;
    this.capacity *= 2;
    this.front = 0;
  }
}
