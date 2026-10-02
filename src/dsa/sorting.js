/**
 * Sorting.
 *
 * Three algorithms with the same interface, so the site can run any of them on
 * the list of destinations and show how many comparisons each one needed:
 *
 *   insertion sort  O(n^2)       simple, good on small or nearly sorted lists
 *   merge sort      O(n log n)   always, and stable (ties keep their order)
 *   quick sort      O(n log n)   on average, sorts in place
 *
 * `compare(a, b)` returns a negative number when a comes first, a positive number
 * when b comes first, and 0 when they tie. None of these functions change the
 * array they are given; they sort a copy.
 */

function copyOf(items) {
  const copy = new Array(items.length);
  for (let i = 0; i < items.length; i += 1) copy[i] = items[i];
  return copy;
}

export function insertionSort(items, compare) {
  const list = copyOf(items);
  let comparisons = 0;
  for (let i = 1; i < list.length; i += 1) {
    const current = list[i];
    let j = i - 1;
    // Shift bigger items one step right until the gap is where `current` belongs.
    while (j >= 0) {
      comparisons += 1;
      if (compare(list[j], current) <= 0) break;
      list[j + 1] = list[j];
      j -= 1;
    }
    list[j + 1] = current;
  }
  return { sorted: list, comparisons };
}

export function mergeSort(items, compare) {
  let comparisons = 0;

  function merge(left, right) {
    const merged = [];
    let i = 0;
    let j = 0;
    while (i < left.length && j < right.length) {
      comparisons += 1;
      // `<=` takes from the left half on a tie, which is what makes merge sort stable.
      if (compare(left[i], right[j]) <= 0) {
        merged[merged.length] = left[i];
        i += 1;
      } else {
        merged[merged.length] = right[j];
        j += 1;
      }
    }
    while (i < left.length) { merged[merged.length] = left[i]; i += 1; }
    while (j < right.length) { merged[merged.length] = right[j]; j += 1; }
    return merged;
  }

  function sort(list) {
    if (list.length <= 1) return list;
    const middle = Math.floor(list.length / 2);
    const left = [];
    const right = [];
    for (let i = 0; i < middle; i += 1) left[i] = list[i];
    for (let i = middle; i < list.length; i += 1) right[i - middle] = list[i];
    return merge(sort(left), sort(right));
  }

  return { sorted: sort(copyOf(items)), comparisons };
}

export function quickSort(items, compare) {
  const list = copyOf(items);
  let comparisons = 0;

  // Lomuto partition with the middle item as the pivot: everything smaller than
  // the pivot ends up on its left, everything else on its right.
  function partition(low, high) {
    const middle = Math.floor((low + high) / 2);
    let held = list[middle];
    list[middle] = list[high];
    list[high] = held;
    const pivot = list[high];
    let boundary = low;
    for (let i = low; i < high; i += 1) {
      comparisons += 1;
      if (compare(list[i], pivot) < 0) {
        held = list[i];
        list[i] = list[boundary];
        list[boundary] = held;
        boundary += 1;
      }
    }
    held = list[boundary];
    list[boundary] = list[high];
    list[high] = held;
    return boundary;
  }

  function sort(low, high) {
    if (low >= high) return;
    const pivotIndex = partition(low, high);
    sort(low, pivotIndex - 1);
    sort(pivotIndex + 1, high);
  }

  sort(0, list.length - 1);
  return { sorted: list, comparisons };
}

export const SORTERS = {
  merge: { name: 'Merge sort', run: mergeSort },
  quick: { name: 'Quick sort', run: quickSort },
  insertion: { name: 'Insertion sort', run: insertionSort },
};
