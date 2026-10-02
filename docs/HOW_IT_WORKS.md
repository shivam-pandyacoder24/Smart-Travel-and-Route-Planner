# How it works

A walk through every data structure in the project: what it is, why it was the right choice, where it lives in the code, how to show it on the site, and the questions an examiner is likely to ask. Back to the [README](../README.md).

- [A five-minute demo](#a-five-minute-demo)
- [Arrays](#arrays-location-information)
- [Hashing](#hashing-location-id-lookup)
- [Graph](#graph-paths-places-and-routes)
- [Queue](#queue-route-exploration)
- [Stack](#stack-route-history-and-backtracking)
- [Min-heap](#min-heap-the-priority-queue-behind-dijkstra)
- [Tree 1](#tree-1-location-categories)
- [Tree 2](#tree-2-destination-index)
- [Linked list](#linked-list-saved-trip-stops)
- [Searching](#searching-find-locations)
- [Sorting](#sorting-sort-destinations)
- [How the code is organised](#how-the-code-is-organised)

## A five-minute demo

1. **Find route** with *Central Library* to *CSE Block*. Point out the amber rings spreading from the library: that is Dijkstra's algorithm settling the nearest place each time. Under the map, the row of IDs is the **min-heap**.
2. Drag the slider back to step 3 to show that every step of the search was recorded.
3. Choose **Step-free**. The route changes from 365 m to 425 m because the *Science Steps* edge is switched off in the **graph**.
4. Choose **Fewest stops**. The row under the map is now a **queue**, and the search spreads out in rings: breadth-first search.
5. Click **Back** twice, then **Forward**: two **stacks**.
6. In **From**, type `ho`. The suggestions come from the **binary search tree**; the note under the list says how many nodes it visited.
7. Open the **Places** tab. Choose *Academics → Departments* (the **category tree**), search for `hostel` (**linear search**), set *Within* to a 5 minute walk (**binary search**) and switch *Sort with* between algorithms (**sorting**).
8. Open the **Trip** tab, load the sample trip, plan it, then reverse it: the **linked list**.
9. Scroll to **Inside the planner → Hashing** and type `LIB` to show the hash being worked out by hand.

## Arrays: location information

**What.** All 29 places are records in one array, `LOCATIONS`, in [`src/data/campus.js`](../src/data/campus.js). Each record has an ID, a name, a category, and x and y in metres.

**Why.** An array gives every place a fixed position (0 to 28). That number is also the place's vertex number in the graph, so the hash table, the trees and the graph all refer to a place with one small integer instead of copying its record.

**Cost.** Reading by position is O(1). Finding a place by scanning is O(n), which is why the hash table and the search tree exist.

**On the site.** *Inside the planner → Arrays* shows the array with its index column.

**You might be asked**
- *Why not keep the places only in the hash table?* A hash table has no order. Sorting, binary search and the graph's vertex numbering all need positions.

## Hashing: location-ID lookup

**What.** A hash table with **separate chaining**, in [`src/dsa/hash-table.js`](../src/dsa/hash-table.js). The key is a location ID such as `LIB`; the value is that place's position in the array.

**How the hash is worked out.** A polynomial rolling hash: start at 0, and for each character do `h = h × 31 + character code`. For `LIB`: `76`, then `76 × 31 + 73 = 2429`, then `2429 × 31 + 66 = 75365`. The bucket is `75365 mod 41 = 7`.

**Collisions.** Two IDs can land in the same bucket (`CAF` and `BUS` both land in bucket 11). Each bucket holds a small linked chain, and a lookup walks that chain comparing keys.

**Size.** 41 buckets for 29 entries: a prime number a little larger than the data, which spreads keys well. The load factor is 29 / 41 = 0.71. If it passes 0.75 the table doubles and every entry is rehashed.

**Cost.** O(1) on average. O(n) in the worst case, if every key landed in one bucket.

**On the site.** *Inside the planner → Hashing*. Type any ID to see the calculation, the bucket and the number of probes. Opening a shared link such as `?from=LIB&to=CSE` also goes through this table.

**You might be asked**
- *What other way is there to handle collisions?* Open addressing: put the entry in the next free slot (linear probing). Chaining was chosen because deleting is simple and a full table still works.
- *Why 31?* It is a small odd prime, so different letter orders give different hashes (`LIB` and `BIL` differ), and multiplying by 31 is cheap.
- *Why not use the hash table for name search too?* Hashing only finds exact keys. Finding every name that *starts with* "ho" needs keys kept in order, which is what the search tree does.

## Graph: paths, places and routes

**What.** A weighted, undirected graph stored as an **adjacency list**, in [`src/dsa/graph.js`](../src/dsa/graph.js). 29 vertices (places) and 55 edges (paths). An edge's weight is its length in metres. `adjacency[v]` is the list of edges leaving vertex `v`.

**Why an adjacency list.** A 29 × 29 matrix would have 841 cells for 55 paths, almost all empty. The list stores only the paths that exist, and "which places are next to this one?" is answered by reading one short list.

**Three algorithms run on it**

| Algorithm | Used for | Helper structure | Cost |
|---|---|---|---|
| Dijkstra | Shortest and Step-free routes, distances for "nearest" | Min-heap | O((V + E) log V) |
| Breadth-first search | Fewest stops | Queue | O(V + E) |
| Depth-first search | Checking which places can be reached | Stack | O(V + E) |

**Dijkstra in four lines.** Give the start distance 0 and every other place infinity. Take the nearest place not yet settled. For each of its paths, if going through it gives a shorter distance to the neighbour, record that (this is *relaxation*). Repeat until the destination is settled.

**Step-free and closed paths.** Every algorithm takes a `canUse(edge)` function. Step-free routes pass one that refuses stairs; closing a path makes it refuse that edge. The graph itself is never changed.

**On the site.** The map is the graph. *Inside the planner → Graph* shows the adjacency list and a step-by-step table of Dijkstra's run for the current route.

**You might be asked**
- *Why not breadth-first search for the shortest route?* It counts paths, not metres. Girls' Hostel to Guest House is 4 paths and 930 m by breadth-first search, but Dijkstra finds 5 paths and 720 m.
- *Does Dijkstra work with negative weights?* No. Here weights are distances, which are never negative.
- *Is the graph directed?* No. Every path is added in both directions, so a route is the same length both ways. A test checks this for all 406 pairs.
- *How do you know the campus is connected?* A depth-first traversal from the Main Gate reaches all 29 places. A test checks it.

## Queue: route exploration

**What.** A first-in, first-out queue built as a **circular array**, in [`src/dsa/queue.js`](../src/dsa/queue.js). `front` marks the oldest item and new items go at `(front + count) % capacity`, so nothing is shifted when an item leaves. When the array is full it is copied into one twice the size.

**Why.** Breadth-first search must visit places in the order they were discovered. That is exactly what a queue does: everything one path away comes out before anything two paths away, so the first time the destination comes out it has been reached in the fewest paths.

**Cost.** Enqueue and dequeue are both O(1).

**On the site.** Choose **Fewest stops** and watch the row under the map: it is the queue, front first. *Inside the planner → Queue* lists every step.

**You might be asked**
- *Why circular?* In a plain array, removing from the front means shifting everything left, which is O(n). Moving a `front` index instead is O(1).
- *Where else is it used?* The category tree's level-order traversal.

## Stack: route history and backtracking

**What.** A last-in, first-out stack kept in an array with a `top` counter, in [`src/dsa/stack.js`](../src/dsa/stack.js).

**Three uses**
1. **Back and Forward.** Finding a new route pushes the old one onto the Back stack and empties the Forward stack. *Back* pops the Back stack and pushes the current route onto Forward. *Forward* does the reverse. This is how a browser's buttons work.
2. **Backtracking.** A search only remembers, for each place, the place it was reached from. Following those links starts at the destination and ends at the start, which is backwards. Each place is pushed as it is passed, then popped, which hands them back in walking order.
3. **Depth-first search** uses an explicit stack instead of recursion.

**Cost.** Push and pop are O(1).

**On the site.** *Inside the planner → Stack* shows both history stacks and the pushes and pops for the current route.

**You might be asked**
- *Why does a new search clear Forward?* Once you go somewhere new, the routes you went "back" from are no longer ahead of you.
- *What happens if you pop an empty stack?* It returns `undefined` rather than crashing, and the Back button is disabled when its stack is empty.

## Min-heap: the priority queue behind Dijkstra

**What.** A binary min-heap stored in an array, in [`src/dsa/min-heap.js`](../src/dsa/min-heap.js). For the item at index `i`, its parent is at `(i - 1) / 2` and its children at `2i + 1` and `2i + 2`. Every parent is no bigger than its children, so the smallest is always at index 0.

**Why.** Dijkstra repeatedly needs "the nearest place not yet settled". Scanning all places each time is O(V). The heap gives it in O(log V).

**Detail worth knowing.** When a shorter way to a place is found, the place is pushed again with its new distance. The old entry stays in the heap and is skipped when it comes out. This is simpler than changing an entry in place and gives the same result.

**On the site.** Choose **Shortest** and watch the row under the map: it is the heap's contents, nearest first.

## Tree 1: location categories

**What.** A **general tree**, where a node can have any number of children, in [`src/dsa/category-tree.js`](../src/dsa/category-tree.js). 16 category nodes, height 2:

```
Campus
├── Academics
│   ├── Departments      CSE Block, ECE Block, Mechanical Block, Science Block, Management Block
│   └── Study spaces     Central Library, Lecture Hall Complex, Innovation Lab
├── Food
│   ├── Meals            Food Court, Hostel Mess
│   └── Snacks and drinks
├── Stay                 Boys' Hostel, Girls' Hostel, Guest House
├── Sports and leisure   (Sports, Event venues, Open spaces)
├── Services
└── Getting around       (Gates, Buses and parking)
```

**Operations**
- `find(id)`: depth-first search for a node
- `itemsUnder(id)`: every place in a branch, by a pre-order traversal (the node, then each child)
- `pathTo(id)`: follow parent pointers to the root, then reverse: "Campus › Academics › Departments"
- `levelOrder()`: breadth-first traversal using the queue

**On the site.** The category chips in the *Places* tab, and the line under them showing the path from the root. *Inside the planner → Tree 1* draws the whole tree; choose a node to filter the map.

**You might be asked**
- *Why a tree and not a list of categories?* Categories contain categories. Choosing *Academics* must include *Departments* and *Study spaces* without listing them by hand.

## Tree 2: destination index

**What.** A **binary search tree** in [`src/dsa/bst.js`](../src/dsa/bst.js), used like the index at the back of a book. Each key is a word from a place name ("library", "block", "hostel"). Each node stores the places that word appears in. 47 words, height 5.

**Why.** Typing in *From* or *To* should find places as you type. Reading every name is O(n). In a BST, smaller keys are on the left and bigger keys on the right, so each comparison throws away one side.

**Prefix search.** All words starting with "ho" sit next to each other in alphabetical order. At each node: if the word starts with the prefix, look both ways; otherwise only one side can still hold matches. Typing `ho` visits 7 of the 47 nodes and finds *hostel* and *house*.

**Keeping it balanced.** Inserting words in alphabetical order would make every node a right child: a chain of height 46, no better than a list. Instead the words are sorted first (merge sort), then the **middle** word is inserted first, then the middle of each half. That gives the smallest possible height.

**Cost.** Search is O(log n) when balanced, O(n) if it degenerates into a chain.

**On the site.** Type in *From* or *To*. *Inside the planner → Tree 2* draws the tree and highlights the nodes a search visits.

**You might be asked**
- *What if places are added later?* Middle-first only works when all the keys are known at the start. For keys that change, a self-balancing tree such as an AVL tree would be the next step.
- *What does in-order traversal give?* The words in alphabetical order. A test checks it.

## Linked list: saved trip stops

**What.** A **doubly linked list** in [`src/dsa/linked-list.js`](../src/dsa/linked-list.js). Each node holds a stop and pointers to the previous and next nodes. The list keeps `head` and `tail`.

**Why.** A trip is edited constantly: add a stop, remove one from the middle, swap two, reverse the lot. In a linked list each of those changes a few pointers. In an array, removing from the middle shifts everything after it.

**Operations and cost**
- Add at the end: O(1), using the tail pointer
- Remove a node: O(1) once it is found, by joining its two neighbours
- Reach the n-th stop: O(n), walking from the head
- Reverse: O(n), swapping every node's `prev` and `next`

**Planning the trip** walks the list from head to tail and finds a route between each node and the next.

**Shorten trip** keeps the first stop and then always goes to the nearest stop not yet visited. This greedy rule is fast and usually helps, but it does not promise the best order. Finding the true best order is the travelling salesman problem, which has no known fast solution. If the greedy order is not shorter, the original order is kept.

**On the site.** The *Trip* tab. *Inside the planner → Linked list* draws the nodes with their pointers.

## Searching: find locations

Both are in [`src/dsa/search.js`](../src/dsa/search.js).

**Linear search** checks every record in turn: O(n). *Search places* uses it because the text could be anywhere in a name, ID, description or category, so there is no order to exploit.

**Binary search** halves a sorted array at every step: O(log n). *Within a 5 minute walk* uses it. Dijkstra gives the distance from the starting place to every other place, merge sort orders them, and binary search finds the position where the distances pass 400 m. With 28 distances it needs 4 comparisons instead of 28.

**On the site.** *Inside the planner → Searching* shows both: every cell checked for the linear search, and only the numbered cells for the binary search.

**You might be asked**
- *Why can't binary search be used for the text search?* It needs sorted data and a single key to compare. "Contains this text anywhere" has neither.

## Sorting: sort destinations

Three algorithms in [`src/dsa/sorting.js`](../src/dsa/sorting.js), all taking the same compare function:

| Algorithm | Cost | Stable | Comparisons to sort 29 places by distance from the library |
|---|---|---|---|
| Insertion sort | O(n²) | Yes | 186 |
| Merge sort | O(n log n) always | Yes | 101 |
| Quick sort | O(n log n) on average, O(n²) worst case | No | 128 |

**Stable** means items that tie keep their original order. Merge sort is the default on the site, and it is what builds the word index, so ties are always broken the same way.

**On the site.** *Places* tab, *Sort by* and *Sort with*. *Inside the planner → Sorting* compares all three on the same list.

**You might be asked**
- *When is insertion sort the better choice?* On short or nearly sorted lists. On a list that is already sorted it needs only n − 1 comparisons. A test checks that.

## How the code is organised

```
index.html            the page
assets/style.css      colours, type, layout
src/data/campus.js    the campus as plain data
src/dsa/              one file per data structure, no page code
src/planner.js        RoutePlanner: fills the structures and answers questions
src/ui/               everything that touches the page
tests/                67 tests, run with: node --test
```

The rule that keeps it tidy: **`src/dsa/` and `src/planner.js` never touch the page, and `src/ui/` never does any routing.** That is why the same planner runs in the browser and in the tests.
