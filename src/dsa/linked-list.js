/**
 * Doubly linked list: each node points to the node before and after it.
 *
 * Adding, removing and reordering a stop only changes a few pointers; nothing
 * is shifted the way it would be in an array.
 *
 * Used in this project for the saved trip: the stops you want to visit, in order.
 */
class ListNode {
  constructor(value) {
    this.value = value;
    this.prev = null;
    this.next = null;
  }
}

export class LinkedList {
  constructor() {
    this.head = null;
    this.tail = null;
    this.length = 0;
  }

  get size() {
    return this.length;
  }

  isEmpty() {
    return this.length === 0;
  }

  /** Add at the end. O(1) because the list keeps a tail pointer. */
  append(value) {
    const node = new ListNode(value);
    if (this.tail === null) {
      this.head = node;
      this.tail = node;
    } else {
      node.prev = this.tail;
      this.tail.next = node;
      this.tail = node;
    }
    this.length += 1;
    return node;
  }

  /** Add at the start. O(1). */
  prepend(value) {
    const node = new ListNode(value);
    if (this.head === null) {
      this.head = node;
      this.tail = node;
    } else {
      node.next = this.head;
      this.head.prev = node;
      this.head = node;
    }
    this.length += 1;
    return node;
  }

  /** Walk from the head to the node at a position. O(n). */
  nodeAt(position) {
    if (position < 0 || position >= this.length) return null;
    let node = this.head;
    for (let i = 0; i < position; i += 1) node = node.next;
    return node;
  }

  valueAt(position) {
    const node = this.nodeAt(position);
    return node === null ? undefined : node.value;
  }

  /** Position of the first node holding this value, or -1. */
  indexOf(value) {
    let node = this.head;
    let position = 0;
    while (node !== null) {
      if (node.value === value) return position;
      node = node.next;
      position += 1;
    }
    return -1;
  }

  /** Unlink a node by joining its two neighbours to each other. */
  removeAt(position) {
    const node = this.nodeAt(position);
    if (node === null) return undefined;
    if (node.prev === null) this.head = node.next;
    else node.prev.next = node.next;
    if (node.next === null) this.tail = node.prev;
    else node.next.prev = node.prev;
    this.length -= 1;
    return node.value;
  }

  /**
   * Swap the stop at `position` with the one after it.
   * The nodes stay where they are and trade values, which is the simplest correct swap.
   */
  swapWithNext(position) {
    const node = this.nodeAt(position);
    if (node === null || node.next === null) return false;
    const held = node.value;
    node.value = node.next.value;
    node.next.value = held;
    return true;
  }

  /** Reverse the list in place by swapping every node's prev and next pointers. */
  reverse() {
    let node = this.head;
    while (node !== null) {
      const next = node.next;
      node.next = node.prev;
      node.prev = next;
      node = next;
    }
    const oldHead = this.head;
    this.head = this.tail;
    this.tail = oldHead;
  }

  clear() {
    this.head = null;
    this.tail = null;
    this.length = 0;
  }

  /** Copy of the values from head to tail. */
  toArray() {
    const values = [];
    let node = this.head;
    while (node !== null) {
      values[values.length] = node.value;
      node = node.next;
    }
    return values;
  }
}
