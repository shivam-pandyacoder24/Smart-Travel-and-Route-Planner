/**
 * General tree (each node can have any number of children).
 *
 * Used in this project for location categories:
 *
 *   Campus
 *   ├── Academics
 *   │   ├── Departments   → CSE Block, ECE Block, ...
 *   │   └── Study spaces  → Central Library, ...
 *   ├── Food
 *   └── ...
 *
 * Picking a category on the site collects every place in that node's subtree
 * with a depth-first traversal.
 */
import { Queue } from './queue.js';

class CategoryNode {
  constructor(id, name) {
    this.id = id;
    this.name = name;
    this.parent = null;
    this.children = [];
    this.items = []; // the places filed directly under this category
  }
}

export class CategoryTree {
  constructor(rootId, rootName) {
    this.root = new CategoryNode(rootId, rootName);
    this.nodeCount = 1;
  }

  /** Build a tree from nested data: { id, name, children: [ ... ] }. */
  static fromDefinition(definition) {
    const tree = new CategoryTree(definition.id, definition.name);
    function addChildren(parentId, children) {
      for (let i = 0; i < children.length; i += 1) {
        tree.add(parentId, children[i].id, children[i].name);
        addChildren(children[i].id, children[i].children || []);
      }
    }
    addChildren(definition.id, definition.children || []);
    return tree;
  }

  /** Find a node by id with a depth-first (pre-order) search. */
  find(id) {
    function search(node) {
      if (node.id === id) return node;
      for (let i = 0; i < node.children.length; i += 1) {
        const found = search(node.children[i]);
        if (found !== null) return found;
      }
      return null;
    }
    return search(this.root);
  }

  add(parentId, id, name) {
    const parent = this.find(parentId);
    if (parent === null) throw new Error(`No category called "${parentId}"`);
    const node = new CategoryNode(id, name);
    node.parent = parent;
    parent.children[parent.children.length] = node;
    this.nodeCount += 1;
    return node;
  }

  addItem(categoryId, item) {
    const node = this.find(categoryId);
    if (node === null) throw new Error(`No category called "${categoryId}"`);
    node.items[node.items.length] = item;
  }

  /** The chain of nodes from the root down to a category, e.g. Campus > Academics > Departments. */
  pathTo(id) {
    const upwards = [];
    let node = this.find(id);
    while (node !== null) {
      upwards[upwards.length] = node;
      node = node.parent;
    }
    const path = [];
    for (let i = upwards.length - 1; i >= 0; i -= 1) path[path.length] = upwards[i];
    return path;
  }

  /** Every place in a category and all of its sub-categories (pre-order traversal). */
  itemsUnder(id) {
    const start = this.find(id);
    const collected = [];
    function visit(node) {
      for (let i = 0; i < node.items.length; i += 1) collected[collected.length] = node.items[i];
      for (let i = 0; i < node.children.length; i += 1) visit(node.children[i]);
    }
    if (start !== null) visit(start);
    return collected;
  }

  /** Number of levels below the root. A tree with only a root has height 0. */
  height() {
    function measure(node) {
      let tallest = -1;
      for (let i = 0; i < node.children.length; i += 1) {
        const h = measure(node.children[i]);
        if (h > tallest) tallest = h;
      }
      return tallest + 1;
    }
    return measure(this.root);
  }

  /** Nodes in pre-order (parent before children), each with its depth. */
  preorder() {
    const visited = [];
    function visit(node, depth) {
      visited[visited.length] = { node, depth };
      for (let i = 0; i < node.children.length; i += 1) visit(node.children[i], depth + 1);
    }
    visit(this.root, 0);
    return visited;
  }

  /** Nodes level by level, using a queue (breadth-first traversal). */
  levelOrder() {
    const visited = [];
    const waiting = new Queue();
    waiting.enqueue({ node: this.root, depth: 0 });
    while (!waiting.isEmpty()) {
      const { node, depth } = waiting.dequeue();
      visited[visited.length] = { node, depth };
      for (let i = 0; i < node.children.length; i += 1) {
        waiting.enqueue({ node: node.children[i], depth: depth + 1 });
      }
    }
    return visited;
  }
}
