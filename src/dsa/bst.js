/**
 * Binary search tree (BST).
 *
 * Every node's left subtree holds smaller keys and its right subtree holds
 * bigger keys, so a search throws away half of a balanced tree at every step.
 *
 * Used in this project as the destination index, like the index at the back of
 * a book: each key is a word from a place name ("library", "block", "hostel")
 * and the node stores the places that word appears in. Typing "lib" in the
 * From or To box walks this tree to find matching places.
 */
class BstNode {
  constructor(key) {
    this.key = key;
    this.values = []; // every place filed under this word
    this.left = null;
    this.right = null;
  }
}

export class BinarySearchTree {
  constructor() {
    this.root = null;
    this.nodeCount = 0;
  }

  get size() {
    return this.nodeCount;
  }

  /** Add a value under a key. A key that is already in the tree gets one more value. */
  insert(key, value) {
    if (this.root === null) {
      this.root = new BstNode(key);
      this.root.values[0] = value;
      this.nodeCount = 1;
      return;
    }
    let node = this.root;
    while (true) {
      if (key === node.key) {
        for (let i = 0; i < node.values.length; i += 1) {
          if (node.values[i] === value) return; // already filed here
        }
        node.values[node.values.length] = value;
        return;
      }
      if (key < node.key) {
        if (node.left === null) {
          node.left = new BstNode(key);
          node.left.values[0] = value;
          this.nodeCount += 1;
          return;
        }
        node = node.left;
      } else {
        if (node.right === null) {
          node.right = new BstNode(key);
          node.right.values[0] = value;
          this.nodeCount += 1;
          return;
        }
        node = node.right;
      }
    }
  }

  /** Exact search. Also returns the keys visited on the way down. */
  search(key) {
    const path = [];
    let node = this.root;
    while (node !== null) {
      path[path.length] = node.key;
      if (key === node.key) return { found: true, values: node.values, comparisons: path.length, path };
      node = key < node.key ? node.left : node.right;
    }
    return { found: false, values: [], comparisons: path.length, path };
  }

  /**
   * Every key that starts with `prefix`, in alphabetical order.
   *
   * Keys sharing a prefix sit next to each other in sorted order, so when a node
   * does not match, only one of its subtrees can still contain matches.
   */
  prefixSearch(prefix) {
    const entries = [];
    const path = [];
    function visit(node) {
      if (node === null) return;
      path[path.length] = node.key;
      if (node.key.startsWith(prefix)) {
        visit(node.left);
        entries[entries.length] = { key: node.key, values: node.values };
        visit(node.right);
      } else if (prefix < node.key) {
        visit(node.left);
      } else {
        visit(node.right);
      }
    }
    visit(this.root);
    return { entries, comparisons: path.length, path };
  }

  /** Left, node, right: visits the keys in alphabetical order. */
  inOrder() {
    const entries = [];
    function visit(node) {
      if (node === null) return;
      visit(node.left);
      entries[entries.length] = { key: node.key, values: node.values };
      visit(node.right);
    }
    visit(this.root);
    return entries;
  }

  /** Number of levels below the root. An empty tree has height -1. */
  height() {
    function measure(node) {
      if (node === null) return -1;
      const left = measure(node.left);
      const right = measure(node.right);
      return 1 + (left > right ? left : right);
    }
    return measure(this.root);
  }
}

/**
 * Fill a tree from entries that are already sorted by key, inserting the middle
 * entry first and then the middle of each half. This keeps the tree balanced;
 * inserting sorted keys one after another would make it a long chain instead.
 */
export function fillBalanced(tree, sortedEntries) {
  function insertRange(low, high) {
    if (low > high) return;
    const middle = Math.floor((low + high) / 2);
    const entry = sortedEntries[middle];
    for (let i = 0; i < entry.values.length; i += 1) tree.insert(entry.key, entry.values[i]);
    insertRange(low, middle - 1);
    insertRange(middle + 1, high);
  }
  insertRange(0, sortedEntries.length - 1);
}
