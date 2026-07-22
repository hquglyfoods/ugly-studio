// Rigorous scope check: parse the real JSX and flag any identifier used but not
// defined in scope (the "Can't find variable: X" class of bug), including inside
// event handlers and async functions that the render harness never executes.
const fs = require("fs");
let Linter, babelParser;
try { ({ Linter } = require("eslint")); babelParser = require("@babel/eslint-parser"); }
catch { console.log("  (scope check skipped: dev deps not installed. run: npm i eslint @babel/eslint-parser @babel/preset-react)"); process.exit(0); }

const html = fs.readFileSync(require("path").join(__dirname, "..", "index.html"), "utf8");
const m = html.match(/<script type="text\/babel"[^>]*>([\s\S]*?)<\/script>/);
if (!m) { console.error("no babel script found"); process.exit(2); }
const code = m[1];

const linter = new Linter();
linter.defineParser("babel", babelParser);

// Everything legitimately available at runtime: browser + CDN globals + app libs.
const globals = {};
[
  "window","document","navigator","location","fetch","console","setTimeout","clearTimeout","setInterval","clearInterval",
  "Math","JSON","Date","Promise","Array","Object","String","Number","Boolean","RegExp","Map","Set","Symbol","Error","parseInt","parseFloat","isNaN","encodeURIComponent","decodeURIComponent",
  "URL","URLSearchParams","Blob","File","FileReader","Image","Audio","FormData","Headers","Request","Response","AbortController",
  "atob","btoa","crypto","localStorage","sessionStorage","caches","Notification","alert","confirm","prompt",
  "requestAnimationFrame","cancelAnimationFrame","getComputedStyle","matchMedia","IntersectionObserver","MutationObserver","ResizeObserver","DOMParser","TextEncoder","TextDecoder","structuredClone","queueMicrotask",
  "React","ReactDOM",              // provided by CDN, transform emits React.createElement
  "process"                        // never used client-side, but harmless
].forEach(g => { globals[g] = "readonly"; });

const messages = linter.verify(code, {
  parser: "babel",
  parserOptions: { ecmaVersion: 2022, sourceType: "script", requireConfigFile: false, babelOptions: { presets: ["@babel/preset-react"] }, ecmaFeatures: { jsx: true } },
  rules: { "no-undef": "error" },
  env: { browser: true, es2021: true },
  globals,
});

const undef = messages.filter(x => x.ruleId === "no-undef");
if (undef.length === 0) {
  console.log("  \x1b[32m✓\x1b[0m scope check: no undefined identifiers in any component or handler");
  process.exit(0);
}
console.log("  \x1b[31m✗ scope check found undefined identifiers:\x1b[0m");
for (const u of undef) console.log(`      line ${u.line}: ${u.message}`);
process.exit(1);
