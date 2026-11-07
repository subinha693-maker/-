// Turns dist/index.html into a body-only page (dist/play.html) for publishing as a hosted preview.
const fs = require('fs');
const html = fs.readFileSync('dist/index.html', 'utf8');
const css = [...html.matchAll(/<link rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g)].map((m) => m[1]);
const js = [...html.matchAll(/<script type="module"[^>]*src="([^"]+)"[^>]*><\/script>/g)].map((m) => m[1]);
const page = `<title>통합인류행정부</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>:root{color-scheme:dark;background:#070b0f}body{background:#070b0f;color:#d9e2e8}</style>
${css.map((h) => `<link rel="stylesheet" href="${h}">`).join('\n')}
<div id="root"></div>
${js.map((s) => `<script type="module" src="${s}"></script>`).join('\n')}
`;
fs.writeFileSync('dist/play.html', page);
console.log(page);
