/**
 * Exercise — Tiny Reconciler (Render phase -> Commit phase)
 * Run: node src/exercise-reconciler-render-commit.js
 */

const log = console.log;

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

/**
 * Model:
 * - "Render phase" computes a list of operations (pure, no side effects).
 * - "Commit phase" applies operations (side effects).
 *
 * We'll reconcile a "tree" represented as nested objects:
 * Node shape:
 * { type: string, key?: string, props?: object, children?: Node[] }
 *
 * Output operations:
 * - { op: "CREATE", path, type, props }
 * - { op: "REMOVE", path }
 * - { op: "REPLACE", path, type, props }
 * - { op: "UPDATE_PROPS", path, propsPatch }
 *
 * path is an array of indices from root (e.g. [0,2,1]).
 * This is intentionally simplified but shows the render/commit split.
 */

function nodeId(node) {
  return node.key ? `${node.type}:${node.key}` : node.type;
}

function shallowDiffProps(prev = {}, next = {}) {
  const patch = {};
  let changed = false;

  const keys = new Set([...Object.keys(prev), ...Object.keys(next)]);
  for (const k of keys) {
    if (!Object.is(prev[k], next[k])) {
      patch[k] = next[k];
      changed = true;
    }
  }
  return changed ? patch : null;
}

function reconcile(prevNode, nextNode, path = []) {
  const ops = [];

  if (!prevNode && nextNode) {
    ops.push({
      op: "CREATE",
      path,
      type: nextNode.type,
      props: nextNode.props ?? {},
    });
    // Children are created recursively.
    const kids = nextNode.children ?? [];
    for (let i = 0; i < kids.length; i++) {
      ops.push(...reconcile(null, kids[i], path.concat(i)));
    }
    return ops;
  }

  if (prevNode && !nextNode) {
    ops.push({ op: "REMOVE", path });
    return ops;
  }

  invariant(prevNode && nextNode, "unreachable");

  // If identity differs, replace whole subtree.
  if (nodeId(prevNode) !== nodeId(nextNode)) {
    ops.push({
      op: "REPLACE",
      path,
      type: nextNode.type,
      props: nextNode.props ?? {},
    });
    // Replace implies children are replaced too.
    const kids = nextNode.children ?? [];
    for (let i = 0; i < kids.length; i++) {
      ops.push(...reconcile(null, kids[i], path.concat(i)));
    }
    return ops;
  }

  // Same node identity: diff props, then reconcile children by index.
  const patch = shallowDiffProps(prevNode.props ?? {}, nextNode.props ?? {});
  if (patch) ops.push({ op: "UPDATE_PROPS", path, propsPatch: patch });

  const prevKids = prevNode.children ?? [];
  const nextKids = nextNode.children ?? [];
  const max = Math.max(prevKids.length, nextKids.length);

  for (let i = 0; i < max; i++) {
    ops.push(...reconcile(prevKids[i], nextKids[i], path.concat(i)));
  }

  return ops;
}

// ------------------------
// Commit phase (side effects)
// ------------------------

/**
 * Our "host" is just a Map from serialized path -> node record.
 * This is a stand-in for DOM operations.
 */
function createHost() {
  const map = new Map();

  function keyOf(path) {
    return path.join(".");
  }

  function apply(op) {
    const k = keyOf(op.path);

    if (op.op === "CREATE") {
      map.set(k, { type: op.type, props: { ...op.props } });
      log(`[host] CREATE ${k} ${op.type}`);
      return;
    }

    if (op.op === "REMOVE") {
      // Remove subtree: any key that starts with `${k}` or equals k.
      const prefix = k === "" ? "" : `${k}.`;
      for (const key of Array.from(map.keys())) {
        if (key === k || key.startsWith(prefix)) map.delete(key);
      }
      log(`[host] REMOVE ${k}`);
      return;
    }

    if (op.op === "REPLACE") {
      // Remove subtree then create current node.
      apply({ op: "REMOVE", path: op.path });
      apply({ op: "CREATE", path: op.path, type: op.type, props: op.props });
      return;
    }

    if (op.op === "UPDATE_PROPS") {
      const rec = map.get(k);
      invariant(rec, `missing host node at ${k} for UPDATE_PROPS`);
      Object.assign(rec.props, op.propsPatch);
      log(`[host] UPDATE_PROPS ${k} patch=${JSON.stringify(op.propsPatch)}`);
      return;
    }

    throw new Error(`unknown op: ${op.op}`);
  }

  function dump() {
    const sorted = Array.from(map.entries()).sort((a, b) =>
      a[0].localeCompare(b[0]),
    );
    log("\n[host] snapshot:");
    for (const [k, v] of sorted) {
      log(`  ${k || "(root)"} => ${v.type} ${JSON.stringify(v.props)}`);
    }
  }

  return { apply, dump };
}

// ------------------------
// Demo trees
// ------------------------

const prevTree = {
  type: "App",
  props: { title: "Hello" },
  children: [
    { type: "Header", props: { theme: "light" }, children: [] },
    {
      type: "List",
      children: [
        { type: "Item", key: "a", props: { text: "A" }, children: [] },
        { type: "Item", key: "b", props: { text: "B" }, children: [] },
      ],
    },
  ],
};

const nextTree = {
  type: "App",
  props: { title: "Hello!" }, // prop update
  children: [
    { type: "Header", props: { theme: "dark" }, children: [] }, // prop update
    {
      type: "List",
      children: [
        { type: "Item", key: "a", props: { text: "A" }, children: [] },
        { type: "Item", key: "c", props: { text: "C" }, children: [] }, // replace b -> c (by key)
      ],
    },
    { type: "Footer", props: {}, children: [] }, // insert
  ],
};

(function main() {
  log("Exercise: Reconciler Render/Commit — start");

  const host = createHost();

  const ops1 = reconcile(null, prevTree, []);
  log("\n[render] initial ops:");
  for (const op of ops1) log(op);
  for (const op of ops1) host.apply(op);
  host.dump();

  const ops2 = reconcile(prevTree, nextTree, []);
  log("\n[render] update ops:");
  for (const op of ops2) log(op);
  for (const op of ops2) host.apply(op);
  host.dump();

  log("\nExercise: Reconciler Render/Commit — done");
})();

/**
 * Your tasks:
 * 1) Keyed children diff:
 *    - Currently children are reconciled by index.
 *    - Implement keyed reconciliation for children arrays:
 *      - preserve nodes with same key even if order changes
 *      - emit MOVE ops (optional) or simulate with REMOVE+CREATE
 * 2) Two-phase safety:
 *    - Ensure render phase is pure (no host mutation).
 * 3) Add an "interruptible render":
 *    - chunk reconciliation work into slices and yield (like the scheduler exercise).
 */
