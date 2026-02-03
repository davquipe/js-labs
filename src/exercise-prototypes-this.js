/**
 * Exercise — Prototypes + `this` (Node.js)
 * Run: node src/exercise-prototypes-this.js
 */

const log = console.log;

// --------------------
// Part A: `this` binding rules
// --------------------

function whoAmI() {
  return this?.name ?? "(no this)";
}

const obj = {
  name: "obj",
  whoAmI,
};

log("\n--- Part A: this binding ---");
log("A1:", obj.whoAmI()); // method call -> this = obj

const detached = obj.whoAmI;
log("A2:", detached()); // detached call -> this = undefined (in strict mode / ESM)

log("A3:", whoAmI.call({ name: "callCtx" })); // explicit binding
log("A4:", whoAmI.apply({ name: "applyCtx" })); // explicit binding

const bound = whoAmI.bind({ name: "boundCtx" });
log("A5:", bound()); // bound function keeps `this`

// Arrow functions: `this` is lexical, cannot be rebound.
const arrowObj = {
  name: "arrowObj",
  regular() {
    return this.name;
  },
  arrow: () => this?.name ?? "(lexical this)",
};

log("A6:", arrowObj.regular()); // "arrowObj"
log("A7:", arrowObj.arrow()); // not arrowObj

// --------------------
// Part B: prototype chain and property resolution
// --------------------

log("\n--- Part B: prototype chain ---");

function Animal(name) {
  this.name = name;
}
Animal.prototype.speak = function () {
  return `${this.name} makes a noise`;
};

function Dog(name) {
  Animal.call(this, name);
}
Dog.prototype = Object.create(Animal.prototype);
Dog.prototype.constructor = Dog;

Dog.prototype.speak = function () {
  // This override shadows Animal.prototype.speak
  return `${this.name} barks`;
};

const d = new Dog("Rex");
log("B1:", d.speak());

log("B2:", Object.getPrototypeOf(d) === Dog.prototype);
log("B3:", Object.getPrototypeOf(Dog.prototype) === Animal.prototype);

// Shadowing vs mutation:
log("B4:", d.hasOwnProperty("speak"), "(own speak?)"); // false; speak is on prototype

Dog.prototype.kind = "dog";
log("B5:", d.kind, "(inherited)");

d.kind = "custom";
log("B6:", d.kind, "(shadowed own prop)");
log("B7:", Dog.prototype.kind, "(prototype unchanged)");

// Delete own prop -> falls back to prototype.
delete d.kind;
log("B8:", d.kind, "(back to inherited)");

// --------------------
// Part C: `new` and return values
// --------------------

log("\n--- Part C: new behavior ---");

function ReturnsPrimitive() {
  this.tag = "instance";
  return 123; // ignored by `new`
}

function ReturnsObject() {
  this.tag = "instance";
  return { tag: "returned object" }; // overrides the implicit instance
}

const rp = new ReturnsPrimitive();
const ro = new ReturnsObject();

log("C1:", rp.tag);
log("C2:", ro.tag);

// --------------------
// Part D: tricky: prototype mutation after instantiation
// --------------------

log("\n--- Part D: prototype mutation timing ---");

function User(name) {
  this.name = name;
}

const u1 = new User("u1");

// Adding methods after creating instances still works (same prototype object).
User.prototype.say = function () {
  return `hi ${this.name}`;
};

log("D1:", u1.say());

const u2 = new User("u2");
log("D2:", u2.say());

// Replacing the prototype breaks linkage for older instances.
User.prototype = {
  say() {
    return `NEW hi ${this.name}`;
  },
};

const u3 = new User("u3");

log("D3:", u3.say());
log("D4:", typeof u1.say, "(u1 still points to old prototype)");

// --------------------
// Your task (do it before reading any solutions elsewhere)
// --------------------
//
// 1) Without running the file, write down what you think A1..D4 output will be.
// 2) Then run it and compare.
// 3) Explain these three in your own words:
//    - Why A2 differs from A1
//    - Why A7 is not "arrowObj"
//    - Why D4 is what it is
//
// If you paste your predicted output here, I will grade it.
