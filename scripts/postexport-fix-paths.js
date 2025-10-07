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

function createSpaFallbackIfMissing(dir) {
  const fallbackFile = path.join(dir, '404.html');
  if (fs.existsSync(fallbackFile)) {
    console.log(`[postexport-fix-paths] Skipped creating 404.html (already exists)`);
    return;
  }
  const fallbackContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>Redirecting...</title>
    <script>
      // __SPA_FALLBACK__ GitHub Pages SPA redirect
      (function(l){
        try {
          // Auto-detect base path depth (user.github.io/repo ... => keep 1 segment)
          var parts = l.pathname.split('/').filter(Boolean);
          var keep = parts.length > 0 ? 1 : 0; // project pages keep first segment
          var base = '/' + (parts.slice(0, keep).join('/'));
          if (base === '/') base = '';

          var fullPath = l.pathname;
          var redirectPath = fullPath.slice(base.length) || '/';
          l.replace(
            l.protocol + '//' + l.hostname + (l.port ? ':' + l.port : '') +
            base + '/?p=' + encodeURIComponent(redirectPath) +
            (l.search ? '&q=' + encodeURIComponent(l.search.slice(1)) : '') +
            l.hash
          );
        } catch (e) {
          console && console.warn && console.warn('SPA fallback error:', e);
        }
      })(window.location);
    </script>
    <noscript>This site requires JavaScript to handle deep links on GitHub Pages.</noscript>
    <meta http-equiv="refresh" content="0; url=./" />
    <style>html,body{margin:0;padding:0;font-family:sans-serif}</style>
  </head>
  <body>
    <p>Redirecting...</p>
  </body>
  </html>`;
  fs.writeFileSync(fallbackFile, fallbackContent, 'utf8');
  console.log(`[postexport-fix-paths] Created ${fallbackFile}`);
}

function injectSpaRestoreIntoIndex(dir) {
  const indexFile = path.join(dir, 'index.html');
  if (!fs.existsSync(indexFile)) return;
  const input = fs.readFileSync(indexFile, 'utf8');
  if (input.includes('__SPA_RESTORE__')) {
    console.log('[postexport-fix-paths] SPA restore script already present in index.html');
    return;
  }
  const restoreScript = `\n<script>\n// __SPA_RESTORE__ GitHub Pages SPA URL restore\n(function(l){\n  try {\n    if (!l.search) return;\n    var params = new URLSearchParams(l.search);\n    if (!params.has('p')) return;\n    var rawP = params.get('p') || '';\n    var p = decodeURIComponent(rawP.replace(/~and~/g, '&'));\n    var q = params.has('q') ? decodeURIComponent(params.get('q')) : '';\n    var parts = l.pathname.split('/').filter(Boolean);\n    var basePath = '/' + (parts[0] || '');\n    if (p && p.charAt(0) !== '/') p = '/' + p;\n    var newPath = basePath + p;\n    window.history.replaceState(null, null, newPath + (q ? ('?' + q) : '') + l.hash);\n  } catch (e) {\n    console && console.warn && console.warn('SPA restore error:', e);\n  }\n})(window.location);\n</script>\n`;
  // Insert restore script near top of <head>
  let output;
  if (input.includes('<head>')) {
    output = input.replace('<head>', '<head>' + restoreScript);
  } else {
    // Fallback: prepend
    output = restoreScript + input;
  }
  fs.writeFileSync(indexFile, output, 'utf8');
  console.log('[postexport-fix-paths] Injected SPA restore script into index.html');
}

function injectBaseTag(dir, base) {
  const indexFile = path.join(dir, 'index.html');
  if (!fs.existsSync(indexFile)) return;
  let html = fs.readFileSync(indexFile, 'utf8');
  const baseTag = `<base href="${base}">`;
  if (html.includes('<base ')) {
    // Replace existing base tag
    html = html.replace(/<base [^>]*>/i, baseTag);
  } else if (html.includes('<head>')) {
    html = html.replace('<head>', `<head>\n${baseTag}\n`);
  }
  fs.writeFileSync(indexFile, html, 'utf8');
  console.log('[postexport-fix-paths] Ensured <base> tag in index.html:', base);
}

function injectBaseGuards(dir, base) {
  const indexFile = path.join(dir, 'index.html');
  if (!fs.existsSync(indexFile)) return;
  let html = fs.readFileSync(indexFile, 'utf8');

  const guardMarker = '__SPA_BASE_GUARD__';
  const patchMarker = '__SPA_BASE_MONKEYPATCH__';
  const hostCheck = String(/\.github\.io$/);
  const guardScript = `\n<script>\n// ${guardMarker} Ensure URL stays under the project base on GitHub Pages\n(function(l){\n  try {\n    var BASE = '${base.replace(/\\/g, '')}';\n    if (!${hostCheck}.test(l.hostname)) return;\n    var path = l.pathname || '/';\n    if (path === BASE) {\n      window.history.replaceState(null, null, BASE + '/' + l.search + l.hash);\n      return;\n    }\n    if (path === '/' || !path.startsWith(BASE + '/')) {\n      var fixed = path === '/' ? (BASE + '/') : (BASE + (path.startsWith('/') ? '' : '/') + path);\n      window.history.replaceState(null, null, fixed + l.search + l.hash);\n    }\n  } catch (e) {\n    console && console.warn && console.warn('SPA base guard error:', e);\n  }\n})(window.location);\n</script>\n`;

  const monkeyScript = `\n<script>\n// ${patchMarker} Enforce base path on history.pushState/replaceState\n(function(history, l){\n  try {\n    var BASE = '${base.replace(/\\/g, '')}';\n    if (!${hostCheck}.test(l.hostname)) return;\n    function normalize(url) {\n      try {\n        var a = new URL(url, l.origin);\n        var p = a.pathname || '/';\n        if (p === BASE) p = BASE + '/';\n        if (p === '/' || !p.startsWith(BASE + '/')) {\n          a.pathname = BASE + (p.startsWith('/') ? '' : '/') + p.replace(/^\\/+/, '');\n          return a.pathname + a.search + a.hash;\n        }\n        return url;\n      } catch (e) {\n        return url;\n      }\n    }\n    var _replace = history.replaceState;\n    var _push = history.pushState;\n    history.replaceState = function(state, title, url) {\n      var u = (typeof url === 'string') ? normalize(url) : url;\n      return _replace.call(this, state, title, u);\n    };\n    history.pushState = function(state, title, url) {\n      var u = (typeof url === 'string') ? normalize(url) : url;\n      return _push.call(this, state, title, u);\n    };\n  } catch (e) {\n    console && console.warn && console.warn('SPA base monkeypatch error:', e);\n  }\n})(window.history, window.location);\n</script>\n`;

  if (!html.includes(guardMarker)) {
    html = html.replace('<head>', '<head>' + guardScript);
  }
  if (!html.includes(patchMarker)) {
    html = html.replace('<head>', '<head>' + monkeyScript);
  }
  fs.writeFileSync(indexFile, html, 'utf8');
  console.log('[postexport-fix-paths] Ensured base guards in index.html');
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
  // Ensure SPA behavior works on GitHub Pages
  injectSpaRestoreIntoIndex(DOCS_DIR);
  createSpaFallbackIfMissing(DOCS_DIR);
  injectBaseTag(DOCS_DIR, BASE);
  injectBaseGuards(DOCS_DIR, BASE);
  console.log(`[postexport-fix-paths] Done. Rewritten HTML files: ${changedFiles}. BASE=${BASE}`);
}

run();
