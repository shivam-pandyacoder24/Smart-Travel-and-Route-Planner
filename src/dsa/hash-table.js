/**
 * Hash table with separate chaining.
 *
 * A hash function turns a key such as "LIB" into a bucket number. Keys that land
 * in the same bucket are kept in a small linked chain. With a good spread of keys
 * a lookup touches one or two entries, so it is O(1) on average.
 *
 * Used in this project to go from a location ID to its record without scanning
 * the whole locations array.
 */
class ChainNode {
  constructor(key, value, next) {
    this.key = key;
    this.value = value;
    this.next = next;
  }
}

export class HashTable {
  constructor(bucketCount = 16) {
    this.bucketCount = bucketCount;
    this.buckets = new Array(bucketCount).fill(null);
    this.count = 0;
  }

  /**
   * Polynomial rolling hash: h = h * 31 + character code, for each character.
   * `>>> 0` keeps the number inside 32 unsigned bits, like an unsigned int in C.
   */
  hash(key) {
    let h = 0;
    for (let i = 0; i < key.length; i += 1) {
      h = (h * 31 + key.charCodeAt(i)) >>> 0;
    }
    return h;
  }

  indexFor(key) {
    return this.hash(key) % this.bucketCount;
  }

  set(key, value) {
    const index = this.indexFor(key);
    let node = this.buckets[index];
    while (node !== null) {
      if (node.key === key) {
        node.value = value; // key already stored: replace its value
        return;
      }
      node = node.next;
    }
    this.buckets[index] = new ChainNode(key, value, this.buckets[index]);
    this.count += 1;
    if (this.count / this.bucketCount > 0.75) this.resize(this.bucketCount * 2);
  }

  get(key) {
    return this.lookup(key).value;
  }

  has(key) {
    return this.lookup(key).found;
  }

  /** Same as get, but also reports how the lookup went. The site shows this. */
  lookup(key) {
    const hash = this.hash(key);
    const index = hash % this.bucketCount;
    let node = this.buckets[index];
    let probes = 0;
    while (node !== null) {
      probes += 1;
      if (node.key === key) return { found: true, value: node.value, hash, index, probes };
      node = node.next;
    }
    return { found: false, value: undefined, hash, index, probes };
  }

  remove(key) {
    const index = this.indexFor(key);
    let node = this.buckets[index];
    let previous = null;
    while (node !== null) {
      if (node.key === key) {
        if (previous === null) this.buckets[index] = node.next;
        else previous.next = node.next;
        this.count -= 1;
        return true;
      }
      previous = node;
      node = node.next;
    }
    return false;
  }

  /** Move every entry into a bigger table so the chains stay short. */
  resize(newBucketCount) {
    const oldBuckets = this.buckets;
    this.bucketCount = newBucketCount;
    this.buckets = new Array(newBucketCount).fill(null);
    this.count = 0;
    for (let i = 0; i < oldBuckets.length; i += 1) {
      let node = oldBuckets[i];
      while (node !== null) {
        this.set(node.key, node.value);
        node = node.next;
      }
    }
  }

  get size() {
    return this.count;
  }

  get loadFactor() {
    return this.count / this.bucketCount;
  }

  /** Every bucket as a plain array of { key, value }, for drawing the table. */
  snapshot() {
    const rows = [];
    for (let i = 0; i < this.bucketCount; i += 1) {
      const chain = [];
      let node = this.buckets[i];
      while (node !== null) {
        chain[chain.length] = { key: node.key, value: node.value };
        node = node.next;
      }
      rows[i] = chain;
    }
    return rows;
  }
}
