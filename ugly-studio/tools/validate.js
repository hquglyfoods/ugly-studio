// tools/validate.js  ::  build-time proof for Ugly Studio
// Run: node tools/validate.js
const fs = require("fs");
const path = require("path");
const babel = require("@babel/standalone");

let fail = 0;
const ok = (m) => console.log("  \x1b[32m✓\x1b[0m " + m);
const bad = (m) => { console.log("  \x1b[31m✗ " + m + "\x1b[0m"); fail++; };

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

// 1. extract the babel script and transform it
console.log("\n[1] Babel transform (index.html JSX)");
const m = html.match(/<script type="text\/babel"[^>]*>([\s\S]*?)<\/script>/);
if (!m) bad("no babel script found");
else {
  try {
    babel.transform(m[1], { presets: ["react"] });
    ok("JSX compiles clean (" + m[1].length + " chars)");
  } catch (e) { bad("babel error: " + e.message); }
}

// 2. brace / paren balance in CSS block
console.log("\n[2] CSS brace balance");
const css = html.match(/<style>([\s\S]*?)<\/style>/);
if (css) {
  const o = (css[1].match(/{/g) || []).length, c = (css[1].match(/}/g) || []).length;
  o === c ? ok(`braces balanced ${o}/${c}`) : bad(`brace mismatch ${o} open / ${c} close`);
} else bad("no <style> block");

// 3. em-dash guard (hard brand rule: none anywhere)
console.log("\n[3] Em-dash guard (brand rule)");
const files = ["index.html", "sw.js", "supabase_schema.sql", "supabase_learnings.sql", "supabase_push.sql",
  "netlify/functions/ai-text.js", "netlify/functions/ai-image.js", "netlify/functions/ai-vision.js",
  "netlify/functions/push-notify.js", "netlify/functions/lib/push.js"];
let dash = 0;
for (const f of files) {
  const t = fs.readFileSync(path.join(root, f), "utf8");
  const n = (t.match(/\u2014/g) || []).length;
  if (n) { bad(`${f} contains ${n} em-dash`); dash += n; }
}
if (!dash) ok("no em-dashes in any deliverable");

// 4. node --check each function (spawned separately below)
console.log("\n[4] Function syntax checked separately (see run script)\n");

console.log(fail ? `\x1b[31mFAILED: ${fail} issue(s)\x1b[0m\n` : "\x1b[32mALL CHECKS PASSED\x1b[0m\n");
process.exit(fail ? 1 : 0);
