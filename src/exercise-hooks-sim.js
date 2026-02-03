/**
 * Exercise — Hook System Simulation (useState + useEffect)
 * Run: node src/exercise-hooks-sim.js
 */

const log = console.log;

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

/**
 * Minimal hooks runtime:
 * - A component is a function that reads hooks in a fixed order.
 * - Each render resets a hook cursor to 0.
 * - useState stores state in a hooks array by index.
 * - setState schedules a re-render.
 * - useEffect runs after commit; cleanup runs before next effect or unmount.
 *
 * This is intentionally tiny and synchronous, but the invariants mirror real hook rules.
 */

function createRuntime() {
  let currentComponent = null;
  let hookIndex = 0;

  const componentState = new Map(); // component -> { hooks: [], effects: [] }
  let renderQueue = [];
  let isFlushing = false;

  function getStore(comp) {
    if (!componentState.has(comp)) {
      componentState.set(comp, { hooks: [], effects: [] });
    }
    return componentState.get(comp);
  }

  function scheduleRender(comp) {
    renderQueue.push(comp);
    flush();
  }

  function flush() {
    if (isFlushing) return;
    isFlushing = true;

    try {
      while (renderQueue.length) {
        const comp = renderQueue.shift();
        render(comp);
        commitEffects(comp);
      }
    } finally {
      isFlushing = false;
    }
  }

  function render(comp) {
    currentComponent = comp;
    hookIndex = 0;

    log(`\n[render] ${comp.name}`);
    comp();

    currentComponent = null;
  }

  function commitEffects(comp) {
    const store = getStore(comp);

    for (const eff of store.effects) {
      if (!eff.shouldRun) continue;

      if (typeof eff.cleanup === "function") {
        eff.cleanup();
      }

      const cleanup = eff.create();
      eff.cleanup = typeof cleanup === "function" ? cleanup : null;
      eff.shouldRun = false;
    }
  }

  function useState(initial) {
    invariant(currentComponent, "useState must be called during render");

    const store = getStore(currentComponent);
    const idx = hookIndex++;

    if (store.hooks[idx] === undefined) {
      store.hooks[idx] = typeof initial === "function" ? initial() : initial;
    }

    const setState = (updater) => {
      const prev = store.hooks[idx];
      const next = typeof updater === "function" ? updater(prev) : updater;

      if (Object.is(prev, next)) return;

      store.hooks[idx] = next;
      scheduleRender(currentComponentRef);
    };

    // Capture component identity at hook creation time.
    const currentComponentRef = currentComponent;

    return [store.hooks[idx], setState];
  }

  function useEffect(create, deps) {
    invariant(currentComponent, "useEffect must be called during render");
    invariant(typeof create === "function", "useEffect requires a function");

    const store = getStore(currentComponent);
    const idx = hookIndex++;

    const prev = store.effects[idx];

    const depsArr = deps ?? null;
    const hasChanged =
      !prev ||
      depsArr === null ||
      prev.deps === null ||
      prev.deps.length !== depsArr.length ||
      prev.deps.some((x, i) => !Object.is(x, depsArr[i]));

    if (!prev) {
      store.effects[idx] = {
        create,
        deps: depsArr,
        cleanup: null,
        shouldRun: true,
      };
    } else {
      prev.create = create;
      prev.deps = depsArr;
      if (hasChanged) prev.shouldRun = true;
    }
  }

  function unmount(comp) {
    const store = componentState.get(comp);
    if (!store) return;

    for (const eff of store.effects) {
      if (typeof eff?.cleanup === "function") eff.cleanup();
    }
    componentState.delete(comp);
    log(`\n[unmount] ${comp.name}`);
  }

  return { useState, useEffect, scheduleRender, unmount };
}

// ------------------------
// Demo component
// ------------------------

const rt = createRuntime();
const { useState, useEffect, scheduleRender, unmount } = rt;

function Counter() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    log(`[effect] subscribe count=${count}`);
    return () => log(`[effect] cleanup count=${count}`);
  }, [count]);

  log(`[view] count=${count}`);

  // Simulate user clicking during first render.
  if (count < 2) {
    setCount((c) => c + 1);
  }
}

(function main() {
  log("Exercise: Hooks Simulation — start");

  scheduleRender(Counter);

  // Force another render without state change (should not rerun effect with deps).
  scheduleRender(Counter);

  unmount(Counter);

  log("\nExercise: Hooks Simulation — done");
})();

/**
 * Your tasks:
 * 1) Add useRef(initialValue) that returns { current } and never changes identity.
 * 2) Add batching:
 *    - multiple setState calls in the same tick trigger only one render.
 * 3) Add a hook order guard:
 *    - if a component calls fewer hooks than before, throw a descriptive error.
 */
