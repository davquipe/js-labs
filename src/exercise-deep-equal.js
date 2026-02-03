/**
 * Exercise — Deep Equal (with cycles)
 * Run: node src/exercise-deep-equal.js
 *
 * Task:
 * Implement `deepEqual(a, b)` with these requirements:
 * 1) Handles primitives correctly (including NaN, -0).
 * 2) Handles Objects, Arrays, Dates, RegExps, Maps, Sets.
 * 3) Handles cyclic references (no stack overflow / infinite recursion).
 * 4) Compares Maps/Sets by deep value (not by reference).
 * 5) Does not treat class instances as plain objects unless you choose to.
 *
 * Constraints:
 * - No JSON stringify.
 * - No external libraries.
 * - Must be deterministic.
 *
 * Output:
 * Run the test cases below; when all pass, you’re done.
 */

const log = console.log;

// ---------------------
// Your implementation
// ---------------------

function deepEqual(a, b) {
  // TODO:
  // - Use Object.is for primitives correctness (NaN, -0).
  // - Use a "seen" structure to handle cycles: WeakMap of pairs is a common approach.
  // - Compare tags via Object.prototype.toString.call(x).
  // - For Map/Set: compare size first, then match entries.
  //
  // Return true/false.
  throw new Error("TODO: implement deepEqual");
}

// ---------------------
// Test harness
// ---------------------

function test(name, fn) {
  try {
    fn();
    log(`good ${name}`);
  } catch (err) {
    log(`bad ${name}`);
    log(`   ${err.message}`);
    process.exitCode = 1;
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg);
}

function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(`${msg} (expected ${expected}, got ${actual})`);
  }
}

// ---------------------
// Cases: primitives
// ---------------------

test("primitives: NaN equals NaN", () => {
  assertEqual(deepEqual(NaN, NaN), true, "NaN should equal NaN");
});

test("primitives: -0 not equal 0 (Object.is semantics)", () => {
  assertEqual(deepEqual(-0, 0), false, "-0 should not equal 0");
});

test("primitives: numbers", () => {
  assertEqual(deepEqual(1, 1), true, "1 should equal 1");
  assertEqual(deepEqual(1, 2), false, "1 should not equal 2");
});

test("primitives: strings", () => {
  assertEqual(deepEqual("a", "a"), true, "a should equal a");
  assertEqual(deepEqual("a", "b"), false, "a should not equal b");
});

// ---------------------
// Cases: arrays/objects
// ---------------------

test("arrays: same values", () => {
  assertEqual(deepEqual([1, 2, 3], [1, 2, 3]), true, "arrays should match");
});

test("arrays: nested", () => {
  assertEqual(
    deepEqual([1, [2]], [1, [2]]),
    true,
    "nested arrays should match",
  );
});

test("objects: same keys, same values", () => {
  assertEqual(
    deepEqual({ a: 1, b: 2 }, { a: 1, b: 2 }),
    true,
    "objects should match",
  );
});

test("objects: different key order still equal", () => {
  assertEqual(
    deepEqual({ a: 1, b: 2 }, { b: 2, a: 1 }),
    true,
    "key order should not matter",
  );
});

test("objects: missing key not equal", () => {
  assertEqual(
    deepEqual({ a: 1 }, { a: 1, b: 2 }),
    false,
    "missing key should fail",
  );
});

// ---------------------
// Cases: Date / RegExp
// ---------------------

test("Date: same time", () => {
  assertEqual(
    deepEqual(new Date("2020-01-01"), new Date("2020-01-01")),
    true,
    "dates should match",
  );
});

test("Date: different time", () => {
  assertEqual(
    deepEqual(new Date("2020-01-01"), new Date("2020-01-02")),
    false,
    "dates should not match",
  );
});

test("RegExp: same source/flags", () => {
  assertEqual(deepEqual(/abc/gi, /abc/gi), true, "regex should match");
});

test("RegExp: different flags", () => {
  assertEqual(deepEqual(/abc/g, /abc/i), false, "regex flags differ");
});

// ---------------------
// Cases: Map / Set
// ---------------------

test("Map: deep keys/values", () => {
  const m1 = new Map([[{ x: 1 }, { y: 2 }]]);
  const m2 = new Map([[{ x: 1 }, { y: 2 }]]);
  assertEqual(deepEqual(m1, m2), true, "maps should match by deep entries");
});

test("Set: deep values", () => {
  const s1 = new Set([{ x: 1 }, { y: 2 }]);
  const s2 = new Set([{ y: 2 }, { x: 1 }]);
  assertEqual(
    deepEqual(s1, s2),
    true,
    "sets should match by deep values (order-independent)",
  );
});

// ---------------------
// Cases: cycles
// ---------------------

test("cycles: simple self-reference", () => {
  const a = {};
  a.self = a;

  const b = {};
  b.self = b;

  assertEqual(deepEqual(a, b), true, "cyclic objects should match");
});

test("cycles: different cycle shape should not match", () => {
  const a = { x: 1 };
  a.self = a;

  const b = { x: 1 };
  b.self = { x: 1 }; // not a self-cycle

  assertEqual(deepEqual(a, b), false, "cycle shape differs");
});

test("cycles: mutual reference", () => {
  const a1 = {};
  const a2 = {};
  a1.next = a2;
  a2.prev = a1;

  const b1 = {};
  const b2 = {};
  b1.next = b2;
  b2.prev = b1;

  assertEqual(deepEqual(a1, b1), true, "mutual cycles should match");
});

// ---------------------
// Cases: functions and symbols (decide policy)
// ---------------------

test("functions: only equal by reference", () => {
  const f = () => 1;
  assertEqual(deepEqual(f, f), true, "same function reference should be equal");
  assertEqual(
    deepEqual(
      () => 1,
      () => 1,
    ),
    false,
    "different function references should not be equal",
  );
});

test("symbols: only equal by reference", () => {
  const s = Symbol("x");
  assertEqual(deepEqual(s, s), true, "same symbol should be equal");
  assertEqual(
    deepEqual(Symbol("x"), Symbol("x")),
    false,
    "different symbols should not be equal",
  );
});

if (process.exitCode !== 1) {
  log("\nAll tests passed (once you implement deepEqual).");
}

/**
 * Your tasks (write your decisions in a short note in code):
 * 1) Do you compare class instances by prototype equality, or treat them as objects?
 * 2) Do you compare typed arrays / ArrayBuffer? (optional extension)
 * 3) Complexity: what is the worst case for Map/Set matching?
 */
