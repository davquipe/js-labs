/**
 * Exercise — Immer-lite (produce with Proxy)
 * Run: node src/exercise-produce-immer-lite.js
 */

const log = console.log;

function isObject(x) {
  return x !== null && typeof x === "object";
}

function shallowCopy(base) {
  return Array.isArray(base) ? base.slice() : { ...base };
}

function produce(baseState, recipe) {
  if (!isObject(baseState))
    throw new Error("baseState must be an object/array");
  if (typeof recipe !== "function")
    throw new Error("recipe must be a function");

  const meta = new WeakMap(); // target -> { base, copy, modified, parentMeta, parentKey }

  function getMeta(target) {
    if (!meta.has(target)) {
      meta.set(target, {
        base: target,
        copy: null,
        modified: false,
        parent: null,
        parentKey: null,
      });
    }
    return meta.get(target);
  }

  function markChanged(m) {
    if (m.modified) return;
    m.modified = true;
    m.copy = shallowCopy(m.base);
    if (m.parent) {
      markChanged(m.parent);
      m.parent.copy[m.parentKey] = m.copy;
    }
  }

  function wrap(target, parentMeta, parentKey) {
    if (!isObject(target)) return target;

    const m = getMeta(target);
    if (parentMeta && !m.parent) {
      m.parent = parentMeta;
      m.parentKey = parentKey;
    }

    return new Proxy(target, {
      get(t, prop) {
        const cur = (m.modified ? m.copy : m.base)[prop];
        return isObject(cur) ? wrap(cur, m, prop) : cur;
      },
      set(t, prop, value) {
        markChanged(m);
        m.copy[prop] = value;
        return true;
      },
      deleteProperty(t, prop) {
        markChanged(m);
        delete m.copy[prop];
        return true;
      },
    });
  }

  const rootMeta = getMeta(baseState);
  const draft = wrap(baseState, null, null);

  recipe(draft);

  return rootMeta.modified ? rootMeta.copy : baseState;
}

// ---------------- Demo ----------------
(function main() {
  log("Exercise: Immer-lite — start");

  const base = { user: { name: "Ada", tags: ["a"] }, count: 1 };
  const next = produce(base, (d) => {
    d.count += 1;
    d.user.name = "Grace";
    d.user.tags.push("b");
  });

  log("base:", base);
  log("next:", next);
  log("base === next:", base === next);
  log("base.user === next.user:", base.user === next.user);

  const same = produce(base, (d) => {
    // no changes
    d.count = 1;
  });

  log("same === base:", same === base);

  log("Exercise: Immer-lite — done");

  /**
   * Your tasks:
   * 1) Support Map/Set (optional) with specialized handlers.
   * 2) Add "freeze" option: freeze result recursively.
   * 3) Add a patch generator (like Immer patches): record ops in set/delete.
   */
})();
