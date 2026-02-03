/**
 * Exercise — LRU Cache (O(1))
 * Run: node src/exercise-lru-cache.js
 */

const log = console.log;

class LRUCache {
  constructor(limit) {
    if (!Number.isInteger(limit) || limit <= 0)
      throw new Error("limit must be > 0");
    this.limit = limit;
    this.map = new Map(); // key -> node
    this.head = null; // most recent
    this.tail = null; // least recent
  }

  get size() {
    return this.map.size;
  }

  get(key) {
    const node = this.map.get(key);
    if (!node) return undefined;
    this.#touch(node);
    return node.value;
  }

  set(key, value) {
    const existing = this.map.get(key);
    if (existing) {
      existing.value = value;
      this.#touch(existing);
      return;
    }

    const node = { key, value, prev: null, next: null };
    this.map.set(key, node);
    this.#insertHead(node);

    if (this.map.size > this.limit) this.#evictTail();
  }

  has(key) {
    return this.map.has(key);
  }

  delete(key) {
    const node = this.map.get(key);
    if (!node) return false;
    this.#remove(node);
    this.map.delete(key);
    return true;
  }

  keys() {
    const out = [];
    let cur = this.head;
    while (cur) {
      out.push(cur.key);
      cur = cur.next;
    }
    return out;
  }

  #touch(node) {
    if (node === this.head) return;
    this.#remove(node);
    this.#insertHead(node);
  }

  #insertHead(node) {
    node.prev = null;
    node.next = this.head;
    if (this.head) this.head.prev = node;
    this.head = node;
    if (!this.tail) this.tail = node;
  }

  #remove(node) {
    if (node.prev) node.prev.next = node.next;
    if (node.next) node.next.prev = node.prev;
    if (node === this.head) this.head = node.next;
    if (node === this.tail) this.tail = node.prev;
    node.prev = node.next = null;
  }

  #evictTail() {
    const node = this.tail;
    if (!node) return;
    this.#remove(node);
    this.map.delete(node.key);
  }
}

// ---------------- Demo ----------------
(function main() {
  log("Exercise: LRU Cache — start");

  const lru = new LRUCache(3);

  lru.set("a", 1);
  lru.set("b", 2);
  lru.set("c", 3);
  log("keys:", lru.keys()); // c b a (head->tail)

  lru.get("a"); // touch a -> most recent
  log("keys after get(a):", lru.keys()); // a c b

  lru.set("d", 4); // evict least recent (b)
  log("has b:", lru.has("b")); // false
  log("keys:", lru.keys()); // d a c

  log("Exercise: LRU Cache — done");

  /**
   * Your tasks:
   * 1) Add getOrSet(key, factory) that caches factory result.
   * 2) Add maxSizeBytes (approx): each entry has a size, evict until under limit.
   * 3) Add TTL per entry (expired entries behave like missing).
   */
})();
