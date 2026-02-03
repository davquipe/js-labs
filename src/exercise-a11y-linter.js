/**
 * Exercise — Tiny A11y Linter (rule-based)
 * Run: node src/exercise-a11y-linter.js
 */

const log = console.log;

/**
 * Simplified node:
 * { type: string, props?: object, children?: Node[] }
 *
 * Rules (minimal but real):
 * - img must have non-empty alt
 * - button must have accessible name (text child OR aria-label)
 * - input(type=text|search|email|password) must have label (aria-label or aria-labelledby)
 * - elements with onClick should be keyboard-accessible (role=button + tabIndex or be a button/a)
 */

function walk(node, fn, path = []) {
  fn(node, path);
  const kids = node.children ?? [];
  for (let i = 0; i < kids.length; i++) walk(kids[i], fn, path.concat(i));
}

function textContent(node) {
  // In this simplified model, text nodes are { type:"#text", props:{ value:"..." } }
  if (!node) return "";
  if (node.type === "#text") return String(node.props?.value ?? "");
  return (node.children ?? []).map(textContent).join("");
}

function lint(tree) {
  const issues = [];

  walk(tree, (node, path) => {
    const p = node.props ?? {};
    const at = path.length ? path.join(".") : "(root)";

    if (node.type === "img") {
      const alt = p.alt;
      if (typeof alt !== "string" || alt.trim() === "") {
        issues.push({ rule: "img-alt", at, msg: "img requires non-empty alt" });
      }
    }

    if (node.type === "button") {
      const name = (p["aria-label"] ?? "").trim() || textContent(node).trim();
      if (!name)
        issues.push({
          rule: "button-name",
          at,
          msg: "button requires accessible name",
        });
    }

    if (node.type === "input") {
      const type = (p.type ?? "text").toLowerCase();
      const needsLabel = ["text", "search", "email", "password"].includes(type);
      if (needsLabel) {
        const has = !!(p["aria-label"] || p["aria-labelledby"]);
        if (!has)
          issues.push({
            rule: "input-label",
            at,
            msg: `input(type=${type}) requires aria-label or aria-labelledby`,
          });
      }
    }

    const hasOnClick = typeof p.onClick === "function";
    if (hasOnClick) {
      const isNative = node.type === "button" || node.type === "a";
      const role = p.role;
      const tabIndex = p.tabIndex;

      const keyboardOk =
        isNative || (role === "button" && (tabIndex === 0 || tabIndex === "0"));

      if (!keyboardOk) {
        issues.push({
          rule: "click-keyboard",
          at,
          msg: "clickable element must be keyboard-accessible (use button/a or role=button + tabIndex=0)",
        });
      }
    }
  });

  return issues;
}

// ---------------- Demo ----------------
(function main() {
  log("Exercise: A11y Linter — start");

  const tree = {
    type: "div",
    children: [
      { type: "img", props: { src: "x.png" } }, // missing alt
      { type: "button", children: [{ type: "#text", props: { value: "" } }] }, // no name
      { type: "input", props: { type: "search" } }, // no label
      {
        type: "div",
        props: { onClick() {} },
        children: [{ type: "#text", props: { value: "Click me" } }],
      }, // not keyboard accessible
    ],
  };

  const issues = lint(tree);
  for (const i of issues) log(`- [${i.rule}] at ${i.at}: ${i.msg}`);

  log("Exercise: A11y Linter — done");

  /**
   * Your tasks:
   * 1) Add rule: <a> must have href if clickable.
   * 2) Add rule: aria-hidden=true should not be focusable (tabIndex>=0).
   * 3) Add a fixer: return suggested patch operations for some rules.
   */
})();
