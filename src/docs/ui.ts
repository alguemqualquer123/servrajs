import type { DocsOptions } from '../core/types';

export function renderDocsHtml(options: Required<DocsOptions>): string {
  const title = escapeHtml(options.title);
  const description = escapeHtml(options.description);
  const storageKey = escapeHtml(options.security.storageKey ?? 'loa_docs_key');
  const specUrl = `${options.path}/spec.json`;
  const tryUrl = `${options.path}/try`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #030303;
      --panel: #0b0b0d;
      --panel-2: #111116;
      --line: #24242b;
      --line-strong: #383842;
      --text: #f5f5f6;
      --muted: #a2a2ad;
      --soft: #74747f;
      --accent: #39ff88;
      --accent-2: #72a7ff;
      --danger: #ff5c7a;
      --warn: #ffcc66;
      --radius: 8px;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      background: var(--bg);
      color: var(--text);
      letter-spacing: 0;
    }
    button, input, textarea, select {
      font: inherit;
    }
    .shell {
      display: grid;
      grid-template-columns: 360px minmax(0, 1fr);
      min-height: 100vh;
    }
    aside {
      border-right: 1px solid var(--line);
      background: #060607;
      padding: 24px;
      position: sticky;
      top: 0;
      height: 100vh;
      overflow: auto;
    }
    main {
      padding: 28px;
      min-width: 0;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 18px;
    }
    .mark {
      width: 34px;
      height: 34px;
      border: 1px solid var(--line-strong);
      border-radius: 8px;
      display: grid;
      place-items: center;
      color: var(--accent);
      font-weight: 800;
      background: #0d0d10;
    }
    h1, h2, h3 {
      margin: 0;
      letter-spacing: 0;
    }
    h1 {
      font-size: 18px;
      line-height: 1.2;
    }
    h2 {
      font-size: 24px;
      margin-bottom: 8px;
    }
    h3 {
      font-size: 14px;
      margin-bottom: 10px;
      color: var(--muted);
      text-transform: uppercase;
    }
    .muted {
      color: var(--muted);
      line-height: 1.5;
    }
    .auth {
      border: 1px solid var(--line);
      background: var(--panel);
      border-radius: var(--radius);
      padding: 14px;
      margin: 18px 0;
    }
    label {
      display: block;
      color: var(--muted);
      font-size: 12px;
      margin-bottom: 6px;
    }
    input, textarea, select {
      width: 100%;
      border: 1px solid var(--line);
      background: #050506;
      color: var(--text);
      border-radius: 6px;
      padding: 10px 11px;
      outline: none;
    }
    textarea {
      resize: vertical;
      min-height: 112px;
      font-family: ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", monospace;
      font-size: 12px;
      line-height: 1.45;
    }
    input:focus, textarea:focus, select:focus {
      border-color: var(--accent-2);
    }
    .row {
      display: flex;
      gap: 8px;
      align-items: center;
    }
    .row > * {
      min-width: 0;
    }
    button {
      border: 1px solid var(--line-strong);
      background: #141419;
      color: var(--text);
      border-radius: 6px;
      padding: 9px 12px;
      cursor: pointer;
      white-space: nowrap;
    }
    button.primary {
      background: var(--accent);
      border-color: var(--accent);
      color: #061007;
      font-weight: 800;
    }
    button.ghost {
      background: transparent;
    }
    button:hover {
      border-color: var(--accent-2);
    }
    .status {
      margin-top: 10px;
      color: var(--muted);
      font-size: 12px;
      min-height: 18px;
    }
    .search {
      margin: 16px 0;
    }
    .nav {
      display: grid;
      gap: 8px;
    }
    .nav button {
      text-align: left;
      display: grid;
      gap: 4px;
      background: transparent;
      border-color: var(--line);
    }
    .nav button.active {
      background: var(--panel-2);
      border-color: var(--line-strong);
    }
    .method {
      display: inline-flex;
      width: max-content;
      min-width: 62px;
      justify-content: center;
      border-radius: 5px;
      padding: 3px 6px;
      font-size: 11px;
      font-weight: 900;
      color: #020202;
    }
    .GET { background: #72a7ff; }
    .POST { background: #39ff88; }
    .PUT { background: #ffcc66; }
    .PATCH { background: #b98cff; }
    .DELETE { background: #ff5c7a; }
    .OPTIONS, .HEAD { background: #d8d8df; }
    .path {
      font-family: ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", monospace;
      font-size: 13px;
      overflow-wrap: anywhere;
    }
    .hero {
      border-bottom: 1px solid var(--line);
      padding-bottom: 22px;
      margin-bottom: 22px;
    }
    .grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 420px;
      gap: 18px;
      align-items: start;
    }
    .panel {
      border: 1px solid var(--line);
      background: var(--panel);
      border-radius: var(--radius);
      padding: 16px;
      min-width: 0;
    }
    .stack {
      display: grid;
      gap: 14px;
    }
    .tabs {
      display: flex;
      gap: 6px;
      border-bottom: 1px solid var(--line);
      margin-bottom: 12px;
      overflow-x: auto;
    }
    .tabs button {
      border: 0;
      border-bottom: 2px solid transparent;
      border-radius: 0;
      background: transparent;
      color: var(--muted);
    }
    .tabs button.active {
      color: var(--text);
      border-bottom-color: var(--accent);
    }
    pre {
      margin: 0;
      overflow: auto;
      border: 1px solid var(--line);
      border-radius: 6px;
      padding: 12px;
      background: #050506;
      color: #e8e8ec;
      font-family: ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", monospace;
      font-size: 12px;
      line-height: 1.5;
      max-height: 430px;
    }
    .kv {
      display: grid;
      grid-template-columns: 110px minmax(0, 1fr);
      gap: 8px;
      color: var(--muted);
      font-size: 13px;
    }
    .empty {
      border: 1px dashed var(--line-strong);
      border-radius: var(--radius);
      padding: 26px;
      text-align: center;
      color: var(--muted);
    }
    .response-status {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      width: max-content;
      border-radius: 6px;
      padding: 6px 8px;
      background: #101014;
      border: 1px solid var(--line);
      margin-bottom: 10px;
      font-weight: 800;
    }
    .ok { color: var(--accent); }
    .fail { color: var(--danger); }
    @media (max-width: 1040px) {
      .shell { grid-template-columns: 1fr; }
      aside { position: static; height: auto; }
      .grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="shell">
    <aside>
      <div class="brand">
        <div class="mark">L</div>
        <div>
          <h1>${title}</h1>
          <div class="muted" id="version">Docs</div>
        </div>
      </div>
      <div class="auth">
        <label for="docs-key">Docs access key</label>
        <div class="row">
          <input id="docs-key" type="password" autocomplete="off" placeholder="Enter key" />
          <button class="primary" id="load">Load</button>
        </div>
        <div class="status" id="auth-status">Key is required to load routes and execute requests.</div>
      </div>
      <div class="search">
        <label for="search">Search endpoints</label>
        <input id="search" placeholder="GET /users, tag, summary" />
      </div>
      <div class="nav" id="nav"></div>
    </aside>
    <main>
      <section class="hero">
        <h2 id="api-title">${title}</h2>
        <div class="muted">${description}</div>
      </section>
      <section id="content" class="empty">Enter a docs key to load the API contract.</section>
    </main>
  </div>
  <script>
    const storageKey = "${storageKey}";
    const specUrl = "${specUrl}";
    const tryUrl = "${tryUrl}";
    const keyInput = document.getElementById('docs-key');
    const statusEl = document.getElementById('auth-status');
    const navEl = document.getElementById('nav');
    const contentEl = document.getElementById('content');
    const searchEl = document.getElementById('search');
    const versionEl = document.getElementById('version');
    let spec = null;
    let selected = null;

    keyInput.value = localStorage.getItem(storageKey) || '';
    document.getElementById('load').addEventListener('click', loadSpec);
    keyInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') loadSpec();
    });
    searchEl.addEventListener('input', renderNav);

    if (keyInput.value) loadSpec();

    async function loadSpec() {
      const key = keyInput.value.trim();
      statusEl.textContent = 'Loading...';
      try {
        const response = await fetch(specUrl, {
          headers: docsHeaders(key),
        });
        if (!response.ok) {
          throw new Error(await response.text());
        }
        spec = await response.json();
        localStorage.setItem(storageKey, key);
        versionEl.textContent = spec.info.version || 'Docs';
        statusEl.textContent = 'Authorized. Routes loaded.';
        selected = spec.routes[0] || null;
        renderNav();
        renderSelected();
      } catch (error) {
        statusEl.textContent = normalizeError(error);
        contentEl.className = 'empty';
        contentEl.textContent = 'Unable to load docs. Check the key and server configuration.';
      }
    }

    function docsHeaders(key) {
      const headers = {};
      if (key) headers[spec.security.headerName] = key;
      return headers;
    }

    function renderNav() {
      navEl.innerHTML = '';
      if (!spec) return;
      const query = searchEl.value.trim().toLowerCase();
      const routes = spec.routes.filter((route) => {
        const haystack = [route.method, route.path, route.summary, route.description, ...(route.tags || [])]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(query);
      });
      for (const route of routes) {
        const button = document.createElement('button');
        button.className = selected && selected.id === route.id ? 'active' : '';
        button.innerHTML = '<span class="method ' + route.method + '">' + route.method + '</span>' +
          '<span class="path">' + escapeText(route.path) + '</span>' +
          '<span class="muted">' + escapeText(route.summary || 'No summary') + '</span>';
        button.addEventListener('click', () => {
          selected = route;
          renderNav();
          renderSelected();
        });
        navEl.appendChild(button);
      }
    }

    function renderSelected() {
      if (!selected) {
        contentEl.className = 'empty';
        contentEl.textContent = 'No routes registered.';
        return;
      }
      contentEl.className = 'grid';
      const samplePath = buildSamplePath(selected);
      const bodyValue = selected.request && selected.request.body !== undefined
        ? JSON.stringify(selected.request.body, null, 2)
        : '';
      const headersValue = selected.request && selected.request.headers
        ? JSON.stringify(selected.request.headers, null, 2)
        : '{}';
      contentEl.innerHTML = '<div class="stack">' +
        '<section class="panel">' +
          '<div class="row" style="justify-content: space-between; align-items: start;">' +
            '<div><span class="method ' + selected.method + '">' + selected.method + '</span>' +
            '<h2 class="path" style="margin-top: 12px;">' + escapeText(selected.path) + '</h2>' +
            '<div class="muted">' + escapeText(selected.description || selected.summary || '') + '</div></div>' +
          '</div>' +
        '</section>' +
        renderModels(selected) +
        renderExamples(selected, samplePath, bodyValue) +
      '</div>' +
      '<aside class="panel">' +
        '<h3>Try Request</h3>' +
        '<label>Path</label><input id="try-path" value="' + escapeAttr(samplePath) + '" />' +
        '<label style="margin-top: 12px;">Headers JSON</label><textarea id="try-headers">' + escapeText(headersValue) + '</textarea>' +
        '<label style="margin-top: 12px;">Body</label><textarea id="try-body">' + escapeText(bodyValue) + '</textarea>' +
        '<div class="row" style="margin-top: 12px;"><button class="primary" id="execute">Execute</button><button class="ghost" id="clear-response">Clear</button></div>' +
        '<div class="status" id="try-status"></div>' +
        '<div id="try-response" style="margin-top: 12px;"></div>' +
      '</aside>';
      document.getElementById('execute').addEventListener('click', executeSelected);
      document.getElementById('clear-response').addEventListener('click', () => {
        document.getElementById('try-response').innerHTML = '';
        document.getElementById('try-status').textContent = '';
      });
    }

    function renderModels(route) {
      return '<section class="panel"><h3>Request Model</h3>' +
        '<pre>' + escapeText(JSON.stringify(route.request || {}, null, 2)) + '</pre></section>' +
        '<section class="panel"><h3>Responses</h3>' +
        '<pre>' + escapeText(JSON.stringify(route.responses || {}, null, 2)) + '</pre></section>';
    }

    function renderExamples(route, samplePath, bodyValue) {
      const base = window.location.origin;
      const http = route.method + ' ' + samplePath + ' HTTP/1.1\\nHost: ' + window.location.host +
        '\\nContent-Type: ' + ((route.request && route.request.contentType) || 'application/json') +
        (bodyValue ? '\\n\\n' + bodyValue : '');
      const curl = 'curl -X ' + route.method + ' ' + JSON.stringify(base + samplePath) +
        ' \\\\\\n  -H "Content-Type: ' + ((route.request && route.request.contentType) || 'application/json') + '"' +
        (bodyValue ? ' \\\\\\n  -d ' + JSON.stringify(bodyValue) : '');
      const fetchCode = 'await fetch(' + JSON.stringify(samplePath) + ', {\\n' +
        '  method: ' + JSON.stringify(route.method) + ',\\n' +
        '  headers: { "Content-Type": "' + ((route.request && route.request.contentType) || 'application/json') + '" },\\n' +
        (bodyValue ? '  body: JSON.stringify(' + bodyValue + '),\\n' : '') +
        '});';
      return '<section class="panel"><h3>Examples</h3>' +
        '<div class="tabs"><button class="active" data-tab="http">HTTP</button><button data-tab="curl">cURL</button><button data-tab="fetch">Fetch</button></div>' +
        '<pre id="example-code">' + escapeText(http) + '</pre>' +
        '</section>';
    }

    document.addEventListener('click', (event) => {
      const button = event.target.closest('[data-tab]');
      if (!button || !selected) return;
      const tab = button.dataset.tab;
      document.querySelectorAll('[data-tab]').forEach((item) => item.classList.remove('active'));
      button.classList.add('active');
      const samplePath = buildSamplePath(selected);
      const bodyValue = selected.request && selected.request.body !== undefined
        ? JSON.stringify(selected.request.body, null, 2)
        : '';
      const base = window.location.origin;
      const contentType = (selected.request && selected.request.contentType) || 'application/json';
      const values = {
        http: selected.method + ' ' + samplePath + ' HTTP/1.1\\nHost: ' + window.location.host + '\\nContent-Type: ' + contentType + (bodyValue ? '\\n\\n' + bodyValue : ''),
        curl: 'curl -X ' + selected.method + ' ' + JSON.stringify(base + samplePath) + ' \\\\\\n  -H "Content-Type: ' + contentType + '"' + (bodyValue ? ' \\\\\\n  -d ' + JSON.stringify(bodyValue) : ''),
        fetch: 'await fetch(' + JSON.stringify(samplePath) + ', {\\n  method: ' + JSON.stringify(selected.method) + ',\\n  headers: { "Content-Type": "' + contentType + '" },\\n' + (bodyValue ? '  body: JSON.stringify(' + bodyValue + '),\\n' : '') + '});',
      };
      document.getElementById('example-code').textContent = values[tab];
    });

    async function executeSelected() {
      const key = keyInput.value.trim();
      const status = document.getElementById('try-status');
      const output = document.getElementById('try-response');
      status.textContent = 'Executing...';
      output.innerHTML = '';
      try {
        const headersText = document.getElementById('try-headers').value.trim() || '{}';
        const headers = JSON.parse(headersText);
        const body = document.getElementById('try-body').value;
        const response = await fetch(tryUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...docsHeaders(key),
          },
          body: JSON.stringify({
            method: selected.method,
            path: document.getElementById('try-path').value,
            headers,
            body,
          }),
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(JSON.stringify(payload, null, 2));
        const ok = payload.statusCode >= 200 && payload.statusCode < 400;
        status.textContent = 'Done in ' + payload.durationMs + 'ms';
        output.innerHTML = '<div class="response-status ' + (ok ? 'ok' : 'fail') + '">' + payload.statusCode + '</div>' +
          '<h3>Response Headers</h3><pre>' + escapeText(JSON.stringify(payload.headers, null, 2)) + '</pre>' +
          '<h3 style="margin-top: 12px;">Response Body</h3><pre>' + escapeText(payload.body || '') + '</pre>';
      } catch (error) {
        status.textContent = normalizeError(error);
      }
    }

    function buildSamplePath(route) {
      let path = route.path;
      const params = (route.request && route.request.params) || {};
      path = path.replace(/:([A-Za-z0-9_]+)/g, (_, name) => encodeURIComponent(params[name] || sampleFor(name)));
      if (route.request && route.request.query && Object.keys(route.request.query).length > 0) {
        const search = new URLSearchParams();
        for (const [key, value] of Object.entries(route.request.query)) {
          search.set(key, String(value));
        }
        path += '?' + search.toString();
      }
      return path;
    }

    function sampleFor(name) {
      if (name.toLowerCase().includes('id')) return 'usr_1';
      return 'sample';
    }

    function normalizeError(error) {
      return error instanceof Error ? error.message : String(error);
    }

    function escapeText(value) {
      return String(value ?? '').replace(/[&<>"']/g, (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[char]);
    }

    function escapeAttr(value) {
      return escapeText(value).replace(/\`/g, '&#96;');
    }
  </script>
</body>
</html>`;
}

function escapeHtml(value: string | undefined): string {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[char] ?? char);
}
