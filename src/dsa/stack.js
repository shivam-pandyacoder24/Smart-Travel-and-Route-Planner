/**
 * Stack: last in, first out (LIFO).
 *
 * Kept in an array with a `top` counter, the same way it is written in C.
 *
 * Used in this project for:
 *   - Route history: every route you find is pushed, and "Back" pops it.
 *   - Backtracking: a finished search only knows each place's previous place,
 *     so the route is walked backwards from the destination and reversed with a stack.
 *   - Depth-first search over the campus graph.
 */
export class Stack {
  constructor() {
    this.items = [];
    this.top = 0; // how many items are on the stack; the top item is items[top - 1]
  }

  push(value) {
    this.items[this.top] = value;
    this.top += 1;
  }

  pop() {
    if (this.top === 0) return undefined; // underflow
    this.top -= 1;
    const value = this.items[this.top];
    this.items.length = this.top; // drop the slot so it can be reused
    return value;
  }

  peek() {
    return this.top === 0 ? undefined : this.items[this.top - 1];
  }

  isEmpty() {
    return this.top === 0;
  }

  get size() {
    return this.top;
  }

  clear() {
    this.items = [];
    this.top = 0;
  }

  /** Copy of the contents, bottom first and top last. */
  toArray() {
    const copy = [];
    for (let i = 0; i < this.top; i += 1) copy[i] = this.items[i];
    return copy;
  }
}
