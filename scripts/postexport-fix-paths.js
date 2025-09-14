/**
 * Post-export path fixer for GitHub Pages subpath deployments.
 *
 * Rewrites root-absolute URLs (starting with "/") in exported HTML files under `docs/`
 * to be prefixed with the repository subpath (default: "/meine-tabelle/").
 * Also ensures a `.nojekyll` file exists so the `_expo` folder is served.
 */
const fs = require('fs');
const path = require('path');

const DOCS_DIR = path.resolve(__dirname, '..', 'docs');
// Allow override via env, but default to the repo name subpath
const BASE_PATH = (process.env.BASE_PATH || process.env.EXPO_PUBLIC_BASE_URL || '/meine-tabelle/').trim();

if (!BASE_PATH.startsWith('/') || !BASE_PATH.endsWith('/')) {
  console.warn(`[postexport-fix-paths] Normalizing BASE_PATH -> "/${BASE_PATH.replace(/^\/*/, '').replace(/\/*$/, '')}/"`);
}
const BASE = `/${BASE_PATH.replace(/^\/*/, '').replace(/\/*$/, '')}/`;

/**
 * Replace patterns in content:
 * - href="/..." -> href="/meine-tabelle/..."
 * - src="/..." -> src="/meine-tabelle/..."
 * - url(/...) -> url(/meine-tabelle/...)
 * Avoid double-prefix if it already starts with BASE.
 */
function rewriteHtml(content) {
  // Escape BASE for regex
  const BASE_REGEX = BASE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // href/src attributes with single or double quotes
  const attrPattern = new RegExp(`(href|src)=("|')/(?!${BASE_REGEX})`, 'g');
  let out = content.replace(attrPattern, `$1=$2${BASE}`);

  // url(/...) in inline styles
  const urlPattern = new RegExp(`url\\(/(?!${BASE_REGEX})`, 'g');
  out = out.replace(urlPattern, `url(${BASE}`);

  return out;
}

function ensureNoJekyll(dir) {
  const file = path.join(dir, '.nojekyll');
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, '', 'utf8');
    console.log(`[postexport-fix-paths] Created ${file}`);
  }
}

function createSpaFallback(dir) {
  const fallbackFile = path.join(dir, '404.html');
  const fallbackContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>Redirecting...</title>
    <script>
        // GitHub Pages SPA redirect hack
        // This script takes the current URL and redirects to the index page with the path as a query parameter
        // The index page will then use this to restore the correct route
        
        var pathSegmentsToKeep = 1; // Change this if you have a different base path depth
        var l = window.location;
        
        // Remove the base path segments (e.g., /meine-tabelle/)
        var pathSegments = l.pathname.split('/').slice(pathSegmentsToKeep);
        
        // Reconstruct the path and redirect to index.html with the path as query parameter
        var redirectPath = '/' + pathSegments.join('/');
        
        l.replace(
            l.protocol + '//' + l.hostname + (l.port ? ':' + l.port : '') +
            l.pathname.split('/').slice(0, pathSegmentsToKeep + 1).join('/') +
            '/?p=' + redirectPath +
            (l.search ? '&q=' + l.search.slice(1) : '') +
            l.hash
        );
    </script>
</head>
<body>
    <p>Redirecting...</p>
</body>
</html>`;
  
  fs.writeFileSync(fallbackFile, fallbackContent, 'utf8');
  console.log(`[postexport-fix-paths] Created ${fallbackFile}`);
}

function* walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      yield* walk(p);
    } else {
      yield p;
    }
  }
}

function run() {
  if (!fs.existsSync(DOCS_DIR)) {
    console.warn(`[postexport-fix-paths] Skipped: docs directory not found at ${DOCS_DIR}`);
    process.exit(0);
  }

  let changedFiles = 0;
  for (const file of walk(DOCS_DIR)) {
    // Only rewrite HTML files; they contain the href/src/url we need
    if (!file.endsWith('.html')) continue;
    const input = fs.readFileSync(file, 'utf8');
    const output = rewriteHtml(input);
    if (output !== input) {
      fs.writeFileSync(file, output, 'utf8');
      changedFiles++;
    }
  }
  ensureNoJekyll(DOCS_DIR);
  createSpaFallback(DOCS_DIR);
  console.log(`[postexport-fix-paths] Done. Rewritten HTML files: ${changedFiles}. BASE=${BASE}`);
}

run();
