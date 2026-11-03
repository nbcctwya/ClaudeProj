/* Selark Console — a drop-in front end for `selark dashboard`.
 *
 * Live mode : served by Selark's dashboard (127.0.0.1) → talks to /api/session, /api/snapshot,
 *             /api/records, /api/logs, /api/backups and /api/model-approval exactly like the
 *             bundled UI (same headers, same session handling, same CSP constraints).
 * Demo mode : opened anywhere else (file://, static host, ?demo) → an in-browser mock backend
 *             that returns the very same JSON shapes, so every page is fully interactive.
 *
 * CSP notes: no inline scripts/styles, no data: URIs, no external resources. Dynamic sizes and
 * colours are applied through CSSOM (`el.style.setProperty`) from `data-css` attributes.
 */
"use strict";
(() => {
  /* ======================================================================================
   * Boot / mode detection
   * ==================================================================================== */
  const hashParams = new URLSearchParams(location.hash.slice(1));
  const searchParams = new URLSearchParams(location.search);
  let bootstrap = hashParams.get("login");
  const LIVE_HOST = /^https?:$/.test(location.protocol) && location.hostname === "127.0.0.1";
  let DEMO = !LIVE_HOST || searchParams.has("demo");
  const replaceUrl = (url) => { try { history.replaceState(null, "", url); } catch { /* file:// documents may refuse */ } };
  if (location.hash) replaceUrl(location.pathname + (searchParams.has("demo") ? "?demo" : ""));

  const SESSION_KEY = "selark-dashboard-session";
  let adminSession = null;
  try { adminSession = sessionStorage.getItem(SESSION_KEY); } catch { /* memory-only */ }
  function saveSession(value) {
    adminSession = value;
    try { value ? sessionStorage.setItem(SESSION_KEY, value) : sessionStorage.removeItem(SESSION_KEY); } catch { /* memory-only */ }
  }
  const sessionHeaders = () => ({ "X-Selark-Dashboard": "1", "X-Selark-Session": adminSession || "" });

  /* ======================================================================================
   * Utilities
   * ==================================================================================== */
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const h = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const css = (vars) => ` data-css="${h(Object.entries(vars).map(([k, v]) => `--${k}:${v}`).join(";"))}"`;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const isNum = (v) => typeof v === "number" && Number.isFinite(v);
  const number = (v) => (v == null ? "未知" : new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 }).format(v));
  const compact = (v) => (v == null ? "—" : new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(v));
  const percent = (v, d = 1) => (v == null ? "—" : `${(v * 100).toFixed(d)}%`);
  const duration = (v) => (v == null ? "—" : v < 1000 ? `${Math.round(v)} ms` : v < 60000 ? `${(v / 1000).toFixed(2)} s` : `${(v / 60000).toFixed(1)} min`);
  const SYMBOLS = { USD: "$", CNY: "¥", EUR: "€", GBP: "£", JPY: "¥" };
  function money(value, currency) {
    const n = Number(value);
    if (!Number.isFinite(n)) return "未知";
    const digits = n === 0 ? 2 : n >= 100 ? 2 : n >= 1 ? 3 : Math.min(9, Math.max(4, 2 - Math.floor(Math.log10(Math.abs(n))) + 2));
    const text = new Intl.NumberFormat("en", { minimumFractionDigits: n >= 1 ? 2 : 0, maximumFractionDigits: digits }).format(n);
    return currency ? `${SYMBOLS[currency] ?? currency + " "}${text}` : text;
  }
  const validDate = (v) => v != null && Number.isFinite(new Date(v).getTime());
  const time = (v) => (v == null ? "尚无记录" : validDate(v) ? new Date(v).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }) : "时间未知");
  const fullTime = (v) => (v == null ? "—" : validDate(v) ? new Date(v).toLocaleString("zh-CN", { hour12: false }) : "时间未知");
  const clock = (v) => (validDate(v) ? new Date(v).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }) : "—");
  function ago(v) {
    if (!validDate(v)) return "时间未知";
    const s = (Date.now() - new Date(v).getTime()) / 1000;
    if (s < 45) return "刚刚";
    if (s < 3600) return `${Math.round(s / 60)} 分钟前`;
    if (s < 86400) return `${Math.round(s / 3600)} 小时前`;
    if (s < 86400 * 30) return `${Math.round(s / 86400)} 天前`;
    return time(v);
  }

  /* ======================================================================================
   * Icons (stroke, 24×24)
   * ==================================================================================== */
  const ICONS = {
    overview: '<rect x="3" y="3" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="2"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2"/>',
    resources: '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12.5 9 5 9-5M3 17l9 5 9-5"/>',
    chart: '<path d="M4 3v17h17"/><path d="m7 14 4-4 3 3 6-6"/>',
    apps: '<rect x="3" y="3" width="18" height="18" rx="5"/><path d="M8 12h8M12 8v8"/>',
    pulse: '<path d="M2 12h4.5l2.5-7 4.5 14 3-7H22"/>',
    shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5Z"/>',
    auto: '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18Z" fill="currentColor"/>',
    lock: '<rect x="5" y="10.5" width="14" height="10.5" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
    unlock: '<rect x="5" y="10.5" width="14" height="10.5" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 0 1 7.7-1.5"/>',
    refresh: '<path d="M20.5 8A8.5 8.5 0 0 0 4.8 6.6L3.5 8"/><path d="M3.5 3.5V8H8"/><path d="M3.5 16a8.5 8.5 0 0 0 15.7 1.4l1.3-1.4"/><path d="M20.5 20.5V16H16"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    tokens: '<path d="m12 2.5 8.5 4.75v9.5L12 21.5l-8.5-4.75v-9.5L12 2.5Z"/><path d="m3.5 7.25 8.5 4.75 8.5-4.75M12 12v9.5"/>',
    requests: '<path d="M4 7h11M4 12h16M4 17h8"/><circle cx="19" cy="7" r="1.5"/>',
    cost: '<circle cx="12" cy="12" r="9"/><path d="M15 8.5h-4.25a2 2 0 0 0 0 4h2.5a2 2 0 0 1 0 4H9M12 6.5v11"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
    arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
    chevron: '<path d="m9 6 6 6-6 6"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9m-3 3 3 3m-6 0 2 2"/>',
    database: '<ellipse cx="12" cy="5.5" rx="8" ry="3"/><path d="M4 5.5v13c0 1.7 3.6 3 8 3s8-1.3 8-3v-13M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
    archive: '<rect x="3" y="4" width="18" height="5" rx="1.5"/><path d="M5 9v9.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V9M10 13h4"/>',
    layers: '<path d="M12 3 3 8l9 5 9-5-9-5Z"/><path d="m3 16 9 5 9-5"/>',
    sparkle: '<path d="M12 3v4m0 10v4M3 12h4m10 0h4M6 6l2.5 2.5m7 7L18 18M6 18l2.5-2.5m7-7L18 6"/>',
    alert: '<path d="M12 3 2 20h20L12 3Z"/><path d="M12 10v4.5M12 17.5v.01"/>',
    flask: '<path d="M9 3h6M10 3v6L4.5 18.5A2 2 0 0 0 6.2 21.5h11.6a2 2 0 0 0 1.7-3L14 9V3"/><path d="M7 15h10"/>',
    terminal: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="m7 9 3 3-3 3M13 15h4"/>',
    filter: '<path d="M4 5h16l-6 7.5V19l-4 2v-8.5L4 5Z"/>',
    queue: '<path d="M4 6h16M4 12h16M4 18h10"/>',
    gauge: '<path d="M4 18a8 8 0 1 1 16 0"/><path d="m12 18 4-6"/>',
  };
  const icon = (name, size = 18) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ICONS.resources}</svg>`;
  const hydrateIcons = (root = document) => $$("[data-icon]", root).forEach((el) => { el.innerHTML = icon(el.dataset.icon, 18); });
  hydrateIcons();

  /* ======================================================================================
   * Theme
   * ==================================================================================== */
  let theme = "system";
  try { theme = localStorage.getItem("selark-theme") || "system"; } catch { /* preference only */ }
  if (!["light", "dark", "system"].includes(theme)) theme = "system";
  const media = matchMedia("(prefers-color-scheme: dark)");
  function applyTheme() {
    document.documentElement.dataset.theme = theme === "system" ? (media.matches ? "dark" : "light") : theme;
    $("#theme-icon").innerHTML = icon({ system: "auto", light: "sun", dark: "moon" }[theme], 18);
    $("#theme").title = { system: "主题：跟随系统", light: "主题：浅色", dark: "主题：深色" }[theme];
    if (state?.snapshot) { tips.clear(); redrawCharts(); }
  }
  function cycleTheme() {
    theme = { system: "light", light: "dark", dark: "system" }[theme];
    try { localStorage.setItem("selark-theme", theme); } catch { /* preference only */ }
    applyTheme();
    toast({ system: "主题：跟随系统", light: "已切换为浅色主题", dark: "已切换为深色主题" }[theme]);
  }
  media.addEventListener("change", applyTheme);

  /* ======================================================================================
   * Demo backend — mirrors selark/dashboard_data.py projections
   * ==================================================================================== */
  function createDemoBackend() {
    let seed = 0x5e1a7c;
    const rnd = () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const pick = (items) => { const total = items.reduce((s, [, w]) => s + w, 0); let r = rnd() * total; for (const [v, w] of items) { if ((r -= w) <= 0) return v; } return items[items.length - 1][0]; };
    const between = (a, b) => a + (b - a) * rnd();
    const logn = (median, spread) => median * Math.exp((rnd() + rnd() + rnd() - 1.5) * spread);
    const hex = (n) => Array.from({ length: n }, () => "0123456789abcdef"[Math.floor(rnd() * 16)]).join("");
    const iso = (ms) => new Date(ms).toISOString().replace("Z", "+00:00");
    const NOW = Date.now();
    const DAY = 86400000;

    const PRICE = { // per 1M tokens: [input, output]
      "mimo-v2-flash": [0.7, 2.1, "CNY"], "mimo-v2-pro": [4, 16, "CNY"],
      "deepseek-chat": [2, 3, "CNY"], "deepseek-reasoner": [4, 16, "CNY"],
      "gpt-5.1": [1.25, 10, "USD"], "gpt-5.1-mini": [0.25, 2, "USD"],
      "claude-sonnet-4-5": [3, 15, "USD"], "claude-haiku-4-5": [1, 5, "USD"],
      "qwen3-max": [1.2, 6, "USD"], "kimi-k2": [0.6, 2.5, "USD"],
    };
    const SPEED = { // [median latency ms, ms per output token]
      "mimo-v2-flash": [700, 6], "mimo-v2-pro": [1600, 14], "deepseek-chat": [1100, 12], "deepseek-reasoner": [5200, 18],
      "gpt-5.1": [2100, 16], "gpt-5.1-mini": [900, 8], "claude-sonnet-4-5": [1800, 15], "claude-haiku-4-5": [800, 7],
      "qwen3-max": [1900, 17], "kimi-k2": [1500, 13], "kimi-for-coding": [1700, 14], "glm-4.6": [1500, 12], "gpt-5.1-codex": [2600, 18],
    };

    const connections = [
      { id: "openai-personal", name: "OpenAI Personal", provider: "openai", resource_type: "api", enabled: true, revision: 12, protocol: "chat-completions",
        discovered: ["gpt-5.1", "gpt-5.1-mini", "gpt-5-nano", "gpt-4.1", "gpt-4.1-mini", "gpt-4o", "gpt-4o-mini", "o3", "o4-mini", "gpt-realtime", "gpt-image-1", "text-embedding-3-large", "tts-1"],
        approved: ["gpt-5.1", "gpt-5.1-mini"], default_model: "gpt-5.1-mini" },
      { id: "anthropic", name: "Anthropic", provider: "anthropic", resource_type: "api", enabled: true, revision: 5, protocol: "anthropic-messages",
        discovered: ["claude-opus-4-1", "claude-sonnet-4-5", "claude-haiku-4-5"], approved: ["claude-sonnet-4-5", "claude-haiku-4-5"], default_model: "claude-sonnet-4-5" },
      { id: "deepseek", name: "DeepSeek", provider: "deepseek", resource_type: "api", enabled: true, revision: 4, protocol: "chat-completions",
        discovered: ["deepseek-chat", "deepseek-reasoner"], approved: ["deepseek-chat", "deepseek-reasoner"], default_model: "deepseek-chat" },
      { id: "mimo-default", name: "MiMo", provider: "mimo", resource_type: "api", enabled: true, revision: 9, protocol: "chat-completions",
        discovered: ["mimo-v2-flash", "mimo-v2-pro", "mimo-v2-omni"], approved: ["mimo-v2-flash", "mimo-v2-pro"], default_model: "mimo-v2-flash" },
      { id: "coding", name: "Kimi Coding Plan", provider: "kimi-code", resource_type: "token_plan", enabled: true, revision: 3, protocol: "chat-completions",
        discovered: ["kimi-for-coding"], approved: ["kimi-for-coding"], default_model: "kimi-for-coding" },
      { id: "subscription", name: "ChatGPT Personal", provider: "chatgpt", resource_type: "chatgpt_subscription", enabled: true, revision: 6, protocol: "responses", oauth: true,
        discovered: ["gpt-5.1-codex", "gpt-5.1", "gpt-5.1-codex-mini"], approved: ["gpt-5.1-codex"], default_model: "gpt-5.1-codex" },
      { id: "relay-hub", name: "Relay Hub 中转", provider: "openai-compatible", resource_type: "api", enabled: true, revision: 8, protocol: "chat-completions", staleDiscovery: true,
        discovered: ["qwen3-max", "kimi-k2", "glm-4.6", "llama-4-maverick", "gemini-2.5-pro"], approved: ["qwen3-max", "kimi-k2"], default_model: "qwen3-max" },
      { id: "glm-plan", name: "GLM Coding Plan", provider: "glm-coding", resource_type: "token_plan", enabled: false, revision: 2, protocol: "chat-completions",
        discovered: ["glm-4.6", "glm-4.5-air"], approved: ["glm-4.6"], default_model: "glm-4.6" },
    ];
    const byConn = Object.fromEntries(connections.map((c) => [c.id, c]));

    const applications = [
      { id: "cursor-workspace", name: "Cursor Workspace", active: true, created_at: iso(NOW - 120 * DAY), revoked_at: null,
        policy: { allowed_connections: ["openai-personal", "anthropic", "deepseek", "coding"], allowed_models: null, allow_token_plans: true, allow_chatgpt_subscriptions: false, max_concurrent_requests: 4, requests_per_minute: 60, max_output_tokens: 16000, max_estimated_input_tokens: 200000, chatgpt_output_reservation: null, daily_token_limit: 6000000, daily_budget: "25", budget_currency: "USD" },
        routes: [["coding|kimi-for-coding", 34], ["anthropic|claude-sonnet-4-5", 30], ["openai-personal|gpt-5.1", 18], ["deepseek|deepseek-chat", 12], ["openai-personal|gpt-5.1-mini", 6]], weight: 38, prompt: 9000 },
      { id: "notebook", name: "Personal Notebook", active: true, created_at: iso(NOW - 150 * DAY), revoked_at: null,
        policy: { allowed_connections: null, allowed_models: null, allow_token_plans: false, allow_chatgpt_subscriptions: false, max_concurrent_requests: null, requests_per_minute: null, max_output_tokens: null, max_estimated_input_tokens: null, chatgpt_output_reservation: null, daily_token_limit: null, daily_budget: null, budget_currency: "USD" },
        routes: [["openai-personal|gpt-5.1-mini", 30], ["mimo-default|mimo-v2-flash", 28], ["deepseek|deepseek-chat", 20], ["anthropic|claude-haiku-4-5", 14], ["relay-hub|kimi-k2", 8]], weight: 24, prompt: 1600 },
      { id: "research", name: "Research Tools", active: true, created_at: iso(NOW - 95 * DAY), revoked_at: null,
        policy: { allowed_connections: ["deepseek", "mimo-default", "relay-hub"], allowed_models: null, allow_token_plans: false, allow_chatgpt_subscriptions: false, max_concurrent_requests: 2, requests_per_minute: 30, max_output_tokens: 8000, max_estimated_input_tokens: 120000, chatgpt_output_reservation: null, daily_token_limit: 1500000, daily_budget: "12", budget_currency: "CNY" },
        routes: [["deepseek|deepseek-reasoner", 34], ["mimo-default|mimo-v2-pro", 30], ["relay-hub|qwen3-max", 22], ["deepseek|deepseek-chat", 14]], weight: 20, prompt: 14000 },
      { id: "writing-desk", name: "Writing Desk", active: true, created_at: iso(NOW - 60 * DAY), revoked_at: null,
        policy: { allowed_connections: ["subscription", "anthropic"], allowed_models: ["gpt-5.1-codex", "claude-sonnet-4-5", "claude-haiku-4-5"], allow_token_plans: false, allow_chatgpt_subscriptions: true, max_concurrent_requests: 1, requests_per_minute: 12, max_output_tokens: 6000, max_estimated_input_tokens: 60000, chatgpt_output_reservation: 8000, daily_token_limit: 400000, daily_budget: null, budget_currency: "USD" },
        routes: [["subscription|gpt-5.1-codex", 60], ["anthropic|claude-haiku-4-5", 40]], weight: 12, prompt: 3200, since: NOW - 60 * DAY },
      { id: "tg-bot", name: "Telegram Bot", active: false, created_at: iso(NOW - 140 * DAY), revoked_at: iso(NOW - 21 * DAY),
        policy: { allowed_connections: ["mimo-default"], allowed_models: null, allow_token_plans: false, allow_chatgpt_subscriptions: false, max_concurrent_requests: 2, requests_per_minute: 20, max_output_tokens: 1200, max_estimated_input_tokens: 8000, chatgpt_output_reservation: null, daily_token_limit: 200000, daily_budget: null, budget_currency: "USD" },
        routes: [["mimo-default|mimo-v2-flash", 100]], weight: 6, prompt: 600, until: NOW - 21 * DAY },
    ];

    function permitted(policy, conn, model) {
      if (policy.allowed_connections != null && !policy.allowed_connections.includes(conn.id)) return false;
      if (policy.allowed_models != null && !policy.allowed_models.includes(model)) return false;
      if (conn.resource_type === "token_plan" && !policy.allow_token_plans) return false;
      if (conn.resource_type === "chatgpt_subscription" && !policy.allow_chatgpt_subscriptions) return false;
      return true;
    }

    /* ---- ledger ---- */
    const records = [];
    const FAIL = [["upstream_rate_limited", 429], ["upstream_bad_gateway", 502], ["upstream_timeout", 504], ["upstream_error", 500], ["upstream_overloaded", 529]];
    function makeRecord(app, startMs, forceStatus) {
      const [cid, model] = pick(app.routes).split("|");
      const conn = byConn[cid];
      const speed = SPEED[model] || [1500, 12];
      const hourLocal = (new Date(startMs).getUTCHours() + 8) % 24;
      const busy = hourLocal >= 10 && hourLocal <= 22;
      let status = forceStatus || pick([["success", 955], ["failed", 26], ["cancelled", 11], ["interrupted", 6]]);
      const localReject = status === "failed" && rnd() < 0.3;
      const prompt = Math.round(logn(app.prompt, 0.9));
      const completion = Math.round(logn(model.includes("reasoner") ? 1800 : 520, 0.8));
      const queue = busy && rnd() < 0.18 ? Math.round(logn(420, 1.1)) : Math.round(rnd() * 24);
      let dur = Math.round(logn(speed[0], 0.45) + completion * speed[1] * between(0.7, 1.3) + queue);
      const rec = {
        request_id: `req_${hex(24)}`, started_at: iso(startMs), finished_at: null, caller_id: app.id, connection_id: cid, model,
        resource_type: conn.resource_type, purpose: "chat", status, http_status: 200, upstream_status: 200, duration_ms: dur, queue_ms: queue,
        upstream_attempts: 1, upstream_result: "success", delivery_status: "sent", error_code: null, upstream_error_code: null, delivery_error_code: null,
        usage_final: true, usage_known: true, usage_consistency: "uncontradicted", prompt_tokens: prompt, completion_tokens: completion, total_tokens: prompt + completion,
        origin: "gateway", cost: {},
      };
      if (status === "failed" && localReject) {
        const [code, http] = pick([[["caller_rate_limited", 429], 5], [["daily_token_limit", 429], 2], [["model_not_permitted", 403], 2], [["queue_full", 503], 1]]);
        Object.assign(rec, { http_status: http, upstream_status: null, upstream_attempts: 0, upstream_result: null, delivery_status: "sent", error_code: code, duration_ms: Math.round(between(2, 18)), queue_ms: 0, prompt_tokens: null, completion_tokens: null, total_tokens: null, usage_known: false });
      } else if (status === "failed") {
        const [code, http] = FAIL[Math.floor(rnd() * FAIL.length)];
        Object.assign(rec, { http_status: http === 529 ? 502 : http, upstream_status: http, upstream_result: "failed", error_code: "upstream_failed", upstream_error_code: code, duration_ms: Math.round(code === "upstream_timeout" ? between(60000, 120000) : between(300, 4000)), prompt_tokens: null, completion_tokens: null, total_tokens: null, usage_known: false });
      } else if (status === "cancelled") {
        Object.assign(rec, { http_status: 499, upstream_result: "cancelled", delivery_status: "cancelled", error_code: "client_disconnected", delivery_error_code: "client_disconnected", duration_ms: Math.round(dur * between(0.2, 0.7)), completion_tokens: null, total_tokens: null, usage_final: false, usage_known: false });
      } else if (status === "interrupted") {
        Object.assign(rec, { upstream_result: "failed", delivery_status: "failed", error_code: "stream_interrupted", upstream_error_code: "stream_interrupted", delivery_error_code: "downstream_write_failed", completion_tokens: Math.round(completion * 0.4), total_tokens: null, usage_final: false, usage_known: false });
      } else if (status === "running") {
        Object.assign(rec, { http_status: 200, upstream_result: null, delivery_status: "pending", duration_ms: null, completion_tokens: null, total_tokens: null, prompt_tokens: null, usage_final: false, usage_known: false });
      }
      if (conn.resource_type === "chatgpt_subscription" && status === "success" && rnd() < 0.18) {
        Object.assign(rec, { prompt_tokens: null, completion_tokens: null, total_tokens: null, usage_final: false, usage_known: false });
      }
      if (status === "success" && rnd() < 0.006) rec.usage_consistency = pick([["inconsistent", 1], ["regressed", 1]]);
      if (rec.duration_ms != null) rec.finished_at = iso(startMs + rec.duration_ms);
      const price = PRICE[model];
      if (rec.upstream_attempts === 0) rec.cost = { estimated_cost: null, currency: null, cost_status: "not_priced", token_basis: null };
      else if (rec.total_tokens == null) rec.cost = { estimated_cost: null, currency: price ? price[2] : null, cost_status: price ? "unknown" : "not_priced", token_basis: "unknown_hold" };
      else if (!price) rec.cost = { estimated_cost: null, currency: null, cost_status: "not_priced", token_basis: "reported" };
      else rec.cost = { estimated_cost: ((rec.prompt_tokens * price[0] + rec.completion_tokens * price[1]) / 1e6).toFixed(9).replace(/0+$/, "").replace(/\.$/, ""), currency: price[2], cost_status: "estimated", token_basis: "reported" };
      return rec;
    }
    // ~92 days of history with daily rhythm, weekly rhythm and gentle growth.
    const start = Math.floor((NOW - 92 * DAY) / 3600000) * 3600000;
    for (let t = start; t < NOW; t += 3600000) {
      const d = new Date(t);
      const hourLocal = (d.getUTCHours() + 8) % 24;
      const weekday = new Date(t + 8 * 3600000).getUTCDay();
      const diurnal = [0.15, 0.08, 0.05, 0.04, 0.04, 0.06, 0.15, 0.35, 0.7, 1.0, 1.25, 1.2, 0.85, 1.0, 1.3, 1.35, 1.25, 1.05, 0.8, 0.85, 1.0, 1.05, 0.8, 0.4][hourLocal];
      const week = weekday === 0 || weekday === 6 ? 0.55 : 1;
      const growth = 0.55 + 0.45 * ((t - start) / (NOW - start));
      const lambda = 4.4 * diurnal * week * growth;
      let n = Math.floor(lambda + rnd());
      if (rnd() < 0.015) n += Math.floor(between(6, 18)); // occasional burst
      for (let i = 0; i < n; i++) {
        const ms = t + rnd() * 3600000;
        if (ms > NOW - 90000) continue;
        const app = pick(applications.filter((a) => (!a.since || ms > a.since) && (!a.until || ms < a.until)).map((a) => [a, a.weight]));
        records.push(makeRecord(app, ms));
      }
    }
    // A couple of in-flight requests and a few imported legacy rows without timestamps.
    records.push(makeRecord(applications[0], NOW - 4000, "running"), makeRecord(applications[2], NOW - 11000, "running"));
    for (let i = 0; i < 3; i++) { const r = makeRecord(applications[1], NOW - 100 * DAY, "success"); Object.assign(r, { started_at: null, finished_at: null, origin: "import" }); records.push(r); }
    records.sort((a, b) => (b.started_at || "").localeCompare(a.started_at || ""));

    /* ---- aggregation (selark.storage.Store.summary + dashboard_data.usage) ---- */
    const blankAgg = () => ({
      requests: 0, known_usage_requests: 0, missing_usage_requests: 0, local_rejected_requests: 0, unknown_consumption_requests: 0, in_flight_requests: 0,
      reported_usage_requests: 0, upstream_attempts: 0, unknown_attempt_count_requests: 0, unknown_time_requests: 0, status_counts: {},
      known_tokens: { prompt_tokens: null, completion_tokens: null, total_tokens: null }, missing_field_requests: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      estimated_cost_by_currency: {}, unknown_cost_requests: 0, billed_cost: null, resource_accounting: { scope: "Selark 0.5+ admissions", requests: 0, tokens_by_basis: {} },
      _lat: 0, _latN: 0,
    });
    function add(agg, r) {
      agg.requests++;
      agg.local_rejected_requests += r.upstream_attempts === 0 && r.status !== "running" ? 1 : 0;
      agg.in_flight_requests += r.status === "running" ? 1 : 0;
      agg.unknown_consumption_requests += r.upstream_attempts !== 0 && r.status !== "running" && (!r.usage_final || r.cost.token_basis === "unknown_hold") ? 1 : 0;
      const complete = ["prompt_tokens", "completion_tokens", "total_tokens"].every((f) => r[f] != null);
      agg[complete ? "known_usage_requests" : "missing_usage_requests"]++;
      agg.reported_usage_requests += r.prompt_tokens != null || r.total_tokens != null ? 1 : 0;
      if (r.cost.token_basis) { agg.resource_accounting.requests++; agg.resource_accounting.tokens_by_basis[r.cost.token_basis] = (agg.resource_accounting.tokens_by_basis[r.cost.token_basis] || 0) + (r.total_tokens || 0); }
      if (r.cost.estimated_cost != null) agg.estimated_cost_by_currency[r.cost.currency] = (agg.estimated_cost_by_currency[r.cost.currency] || 0) + Number(r.cost.estimated_cost);
      else if (r.upstream_attempts !== 0) agg.unknown_cost_requests++;
      agg.upstream_attempts += r.upstream_attempts || 0;
      agg.unknown_time_requests += r.started_at ? 0 : 1;
      agg.status_counts[r.status] = (agg.status_counts[r.status] || 0) + 1;
      for (const f of ["prompt_tokens", "completion_tokens", "total_tokens"]) {
        if (r[f] == null) agg.missing_field_requests[f]++; else agg.known_tokens[f] = (agg.known_tokens[f] || 0) + r[f];
      }
      if (["success", "failed", "cancelled", "interrupted"].includes(r.status) && r.duration_ms != null) { agg._lat += r.duration_ms; agg._latN++; }
    }
    function finish(agg) {
      const c = agg.status_counts;
      const done = ["success", "failed", "cancelled", "interrupted"].reduce((s, k) => s + (c[k] || 0), 0);
      agg.completed_requests = done;
      agg.success_rate = done ? (c.success || 0) / done : null;
      agg.average_latency_ms = agg._latN ? agg._lat / agg._latN : null;
      agg.latency_samples = agg._latN;
      for (const k of Object.keys(agg.estimated_cost_by_currency)) agg.estimated_cost_by_currency[k] = agg.estimated_cost_by_currency[k].toFixed(9).replace(/0+$/, "").replace(/\.$/, "");
      delete agg._lat; delete agg._latN;
      return agg;
    }

    function parseFilters(params) {
      const period = params.get("period") || "7d";
      const spans = { "24h": DAY, "7d": 7 * DAY, "30d": 30 * DAY, "90d": 90 * DAY };
      let since, until;
      if (period === "custom") { since = new Date(params.get("since")).getTime(); until = new Date(params.get("until")).getTime(); }
      else if (spans[period]) { until = Date.now(); since = until - spans[period]; }
      else throw Object.assign(new Error("时间范围不受支持。"), { status: 400 });
      if (!Number.isFinite(since) || !Number.isFinite(until) || since >= until || until - since > 366 * DAY) throw Object.assign(new Error("筛选无效；使用带时区的时间，范围不超过 366 天。"), { status: 400 });
      const f = { since: iso(since), until: iso(until), _s: since, _u: until };
      for (const k of ["caller_id", "connection_id", "model"]) if (params.get(k)) f[k] = params.get(k);
      return f;
    }
    const matchOther = (r, f) => (!f.caller_id || r.caller_id === f.caller_id) && (!f.connection_id || r.connection_id === f.connection_id) && (!f.model || r.model === f.model);
    const inRange = (r, f) => r.started_at && (() => { const t = new Date(r.started_at).getTime(); return t >= f._s && t < f._u; })();
    const publicFilters = (f) => Object.fromEntries(Object.entries(f).filter(([k]) => !k.startsWith("_")));

    function usage(f) {
      const rows = records.filter((r) => inRange(r, f) && matchOther(r, f));
      const total = blankAgg();
      const days = new Map(), models = new Map();
      for (const r of rows) {
        add(total, r);
        const day = r.started_at.slice(0, 10);
        if (!days.has(day)) days.set(day, Object.assign(blankAgg(), { day }));
        add(days.get(day), r);
        const mk = `${r.connection_id}|${r.model}`;
        if (!models.has(mk)) models.set(mk, Object.assign(blankAgg(), { connection_id: r.connection_id, model: r.model }));
        add(models.get(mk), r);
      }
      const trend = [];
      const first = new Date(new Date(f._s).toISOString().slice(0, 10) + "T00:00:00Z").getTime();
      const last = new Date(f._u - 1).toISOString().slice(0, 10);
      for (let t = first; ; t += DAY) {
        const key = new Date(t).toISOString().slice(0, 10);
        if (key > last) break;
        const g = days.get(key);
        trend.push(g ? finish(g) : { day: key, requests: 0, known_tokens: { total_tokens: null }, estimated_cost_by_currency: {}, success_rate: null, average_latency_ms: null, unknown_consumption_requests: 0 });
      }
      return {
        timezone: "UTC", filters: publicFilters(f), summary: finish(total), group_by: "day", trend,
        models: [...models.values()].map(finish).sort((a, b) => b.requests - a.requests).slice(0, 10),
        unknown_time_excluded: records.filter((r) => !r.started_at && matchOther(r, f)).length,
      };
    }

    function quota(app) {
      const day = new Date().toISOString().slice(0, 10);
      const rows = records.filter((r) => r.caller_id === app.id && r.started_at && r.started_at.startsWith(day));
      const p = app.policy;
      const unknown = rows.filter((r) => r.upstream_attempts !== 0 && r.total_tokens == null).length;
      const reserved = rows.filter((r) => r.status === "running" || (r.upstream_attempts !== 0 && r.total_tokens == null)).length * (p.max_output_tokens || 4000);
      const charged = rows.reduce((s, r) => s + (r.total_tokens || 0), 0) + reserved;
      const costs = {};
      for (const r of rows) if (r.cost.estimated_cost != null) costs[r.cost.currency] = (costs[r.cost.currency] || 0) + Number(r.cost.estimated_cost);
      const limit = p.daily_token_limit;
      return {
        day, timezone: "UTC", requests: rows.length, in_flight_requests: rows.filter((r) => r.status === "running").length, uncertain_requests: unknown,
        remaining_tokens: limit == null ? null : Math.max(0, limit - charged),
        token_quota_state: limit == null ? "unlimited" : charged >= limit ? "exhausted" : "limited",
        historical_requests_excluded: 0, charged_or_reserved_tokens: charged, unknown_token_requests: unknown, estimated_reserved_tokens: reserved,
        estimated_cost_or_reservation: Object.fromEntries(Object.entries(costs).map(([k, v]) => [k, v.toFixed(6)])),
        unknown_cost_requests: rows.filter((r) => r.upstream_attempts !== 0 && r.cost.estimated_cost == null).length, billed_cost: null,
      };
    }

    function evidenceFor(conn, model) {
      const out = [];
      for (const capability of ["text_stream", "text_nonstream"]) {
        const hit = records.find((r) => r.connection_id === conn.id && r.model === model && r.status === "success" && (capability === "text_stream" ? r.request_id.charCodeAt(5) % 3 !== 0 : r.request_id.charCodeAt(5) % 3 === 0));
        if (!hit) continue;
        const current = conn.id !== "relay-hub";
        out.push({ state: current ? "success" : "stale", outcome: "success", verified_at: hit.finished_at, request_id: hit.request_id, actual_model: model, protocol: conn.protocol, capability, scope: "text", current_configuration: current, account_access_observed: "allowed", live_availability: "unknown" });
      }
      const failed = records.find((r) => r.connection_id === conn.id && r.model === model && r.upstream_status === 403);
      if (failed) out.push({ state: "failed", outcome: "failed", verified_at: failed.finished_at, request_id: failed.request_id, actual_model: model, protocol: conn.protocol, capability: "text_nonstream", scope: "text", current_configuration: true, account_access_observed: "rejected", live_availability: "unknown" });
      return out;
    }

    function projectConnection(conn) {
      const activeApps = applications.filter((a) => a.active);
      const models = [...new Set([...conn.discovered, ...conn.approved])].map((id) => {
        const approved = conn.approved.includes(id);
        const authorized = activeApps.filter((a) => permitted(a.policy, conn, id)).map((a) => a.id);
        const verification = evidenceFor(conn, id);
        return {
          id, discovery: conn.discovered.includes(id) ? "listed" : "not_in_catalog", approved, default: id === conn.default_model,
          authorized_applications: authorized, effective_applications: conn.enabled && approved ? authorized : [],
          verification, verified_capabilities: verification.filter((v) => v.state === "success" && v.protocol === conn.protocol).map((v) => v.capability), live_availability: "unknown",
        };
      });
      const last = records.find((r) => r.connection_id === conn.id && r.status === "success");
      const checkedAt = iso(NOW - (conn.staleDiscovery ? 26 : 2) * DAY - 3600000 * 3);
      const blockers = [];
      if (!conn.enabled) blockers.push("connection_disabled");
      if (!conn.approved.length) blockers.push("models_not_configured");
      const plan = conn.resource_type !== "api";
      return {
        id: conn.id, name: conn.name, provider: conn.provider, resource_type: conn.resource_type, enabled: conn.enabled,
        models: [...conn.approved], default_model: conn.default_model, client_allowed_models: [...conn.approved],
        authorization: conn.oauth
          ? { kind: "oauth", state: "connected", credential_configured: true, remote_validity: "unknown", access_expired: false, expires_at: iso(NOW + 4.6 * DAY), refresh_available: true, refresh_state: "available", ready: true }
          : { kind: "api_key", state: "connected", credential_configured: true, remote_validity: "unknown", ready: true, ...(plan ? { plan_permission: "configured" } : {}) },
        verification: conn.staleDiscovery ? { state: "stale", previous_state: "success", verified_at: last?.finished_at, age_seconds: last ? (NOW - new Date(last.finished_at)) / 1000 : null, model: last?.model, scope: "text" }
          : last ? { state: "success", verified_at: last.finished_at, age_seconds: (NOW - new Date(last.finished_at)) / 1000, model: last.model, scope: "text" } : { state: "never" },
        availability: { state: blockers.length ? "blocked_locally" : "unknown", checked_live: false, blockers },
        discovery: { state: conn.staleDiscovery ? "stale" : "success", checked_at: checkedAt, discovered_at: checkedAt, current: !conn.staleDiscovery, count: conn.discovered.length },
        model_catalog: {
          counts: { discovered: conn.discovered.length, approved: conn.approved.length, application_authorized: models.filter((m) => m.effective_applications.length).length, historically_verified: models.filter((m) => m.verified_capabilities.length).length },
          protocol: conn.protocol, approval_revision: conn.revision, models,
        },
        provider_quota: conn.id === "coding"
          ? { state: "reported", remaining_tokens: null, current_remaining_tokens: null, historical_snapshot: true, checked_at: iso(NOW - 3 * 3600000), age_seconds: 10800, windows: [{ name: "5 小时窗口", used_ratio: 0.37, reset_at: iso(NOW + 2.2 * 3600000) }, { name: "每周窗口", used_ratio: 0.61, reset_at: iso(NOW + 3.4 * DAY) }], reported_counters: [{ window: "5h", unit: "requests", limit: 300, used: 111, remaining: 189, reset_at: iso(NOW + 2.2 * 3600000) }] }
          : conn.id === "subscription"
            ? { state: "reported", remaining_tokens: null, current_remaining_tokens: null, historical_snapshot: true, checked_at: iso(NOW - 5 * 3600000), age_seconds: 18000, windows: [{ name: "primary", used_ratio: 0.22, reset_at: iso(NOW + 3.1 * 3600000) }, { name: "secondary", used_ratio: 0.48, reset_at: iso(NOW + 4.2 * DAY) }], reported_counters: [] }
            : { state: "unknown", remaining_tokens: null, historical_snapshot: false, windows: [], reported_counters: [] },
      };
    }

    let pulse = 0;
    function snapshot(params) {
      const f = parseFilters(params);
      const conns = connections.map(projectConnection);
      const apps = applications.map(({ routes, weight, prompt, since, until, ...a }) => {
        const app = { ...a, policy: { ...a.policy }, quota: quota(a), effective_resources: [] };
        for (const c of connections) {
          const allowed = c.approved.filter((m) => a.active && c.enabled && permitted(a.policy, c, m));
          if (allowed.length) app.effective_resources.push({ id: c.id, name: c.name, resource_type: c.resource_type, models: allowed });
        }
        return app;
      });
      pulse++;
      const active = [1, 2, 3, 2, 1, 4, 2, 0, 1, 3][pulse % 10];
      return {
        checked_at: iso(Date.now()), version: "0.10.0", scope: "local_instance", ok: true, issues: [], connections: conns, applications: apps,
        service: { state: "running", reachable: true, version: "0.10.0", version_matches: true, pid: 48213, capacity: { active, queued: active >= 3 ? [1, 2, 0][pulse % 3] : 0, admitted: 18342 + pulse * 3, max_active: 4, max_queued: 16, accepting: true }, storage: { degraded: false, pending_records: active > 2 ? 1 : 0, invalid_records: 0, accepting: true } },
        usage: usage(f),
        options: { models: [...new Set(records.map((r) => r.model))].sort(), connections: [...new Set(records.map((r) => r.connection_id))].sort() },
        limits: { max_active_requests: 4, max_queued_requests: 16 },
        capabilities: { model_approval: true },
      };
    }

    function recordsPage(params) {
      const f = parseFilters(params);
      const offset = Number(params.get("offset") || 0);
      let rows = records.filter((r) => inRange(r, f) && matchOther(r, f));
      if (params.get("errors") === "true") rows = rows.filter((r) => ["failed", "cancelled", "interrupted"].includes(r.status));
      return { items: rows.slice(offset, offset + 25).map((r) => structuredClone(r)), total: rows.length, offset, limit: 25 };
    }

    function logs() {
      const items = [];
      for (const r of records.slice(0, 90)) {
        if (!r.started_at || r.status === "running") continue;
        items.push({ timestamp: r.finished_at || r.started_at, path: "/v1/chat/completions", status: r.http_status, duration_ms: r.duration_ms, queue_ms: r.queue_ms, upstream_attempts: r.upstream_attempts });
      }
      for (let i = 0; i < 22; i++) items.push({ timestamp: iso(NOW - i * 5 * 60000 - 7000), path: i % 6 === 3 ? "/v1/models" : "/health", status: 200, duration_ms: Math.round(between(1, 9)) });
      items.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      return { items: items.slice(0, 120), omitted: 4, window: 150 };
    }

    function backups() {
      const items = [];
      for (let i = 0; i < 9; i++) {
        const t = NOW - (i * 3.4 + 0.3) * DAY;
        const stamp = new Date(t).toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
        items.push({ name: `${stamp}-${hex(8)}`, integrity: "not_checked", created_at: iso(t), manifest: i >= 7 ? "legacy" : "sha256_present" });
      }
      return { items, total: 14, limit: 20 };
    }

    function approve(body) {
      const conn = byConn[body.connection_id];
      if (!conn) throw Object.assign(new Error("未找到连接。"), { status: 404 });
      const known = new Set([...conn.discovered, ...conn.approved]);
      if (!known.has(body.model)) throw Object.assign(new Error("模型不在该连接目录中。"), { status: 400 });
      if (body.revision !== conn.revision) throw Object.assign(new Error("连接配置已被其他标签页或 CLI 修改；请刷新后重新操作。"), { status: 409 });
      if (!body.enabled && conn.default_model === body.model && !body.clear_default) throw Object.assign(new Error("禁用默认模型需要确认清除默认值。"), { status: 409 });
      if (body.enabled && !conn.approved.includes(body.model)) conn.approved.push(body.model);
      if (!body.enabled) {
        conn.approved = conn.approved.filter((m) => m !== body.model);
        if (conn.default_model === body.model) conn.default_model = null;
      }
      conn.revision++;
      return { connection_id: conn.id, model: body.model, enabled: conn.approved.includes(body.model), default_model: conn.default_model };
    }

    return {
      async request(path, options = {}) {
        await new Promise((r) => setTimeout(r, 160 + Math.random() * 260));
        const [name, query = ""] = path.split("?");
        const params = new URLSearchParams(query);
        if (name === "snapshot") return snapshot(params);
        if (name === "records") return recordsPage(params);
        if (name === "logs") return logs();
        if (name === "backups") return backups();
        if (name === "model-approval") return approve(JSON.parse(options.body));
        throw Object.assign(new Error("未找到只读接口。"), { status: 404 });
      },
    };
  }
  let demoBackend = null;
  const demo = () => (demoBackend ||= createDemoBackend());

  /* ======================================================================================
   * API
   * ==================================================================================== */
  async function api(path, signal) {
    if (DEMO) return demo().request(path);
    const response = await fetch(`/api/${path}`, { headers: sessionHeaders(), credentials: "omit", mode: "same-origin", redirect: "error", cache: "no-store", signal });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(body.error || "本地数据读取失败。"), { status: response.status });
    return body;
  }
  async function postApproval(payload, signal) {
    if (DEMO) return demo().request("model-approval", { body: JSON.stringify(payload) });
    const response = await fetch("/api/model-approval", { method: "POST", headers: { "Content-Type": "application/json", ...sessionHeaders() }, credentials: "omit", mode: "same-origin", redirect: "error", cache: "no-store", signal, body: JSON.stringify(payload) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(result.error || "模型设置保存失败。"), { status: response.status });
    return result;
  }

  /* ======================================================================================
   * Labels & vocab
   * ==================================================================================== */
  const LABELS = {
    api: "API", token_plan: "Token Plan", chatgpt_subscription: "ChatGPT 订阅", success: "成功", failed: "失败", cancelled: "已取消", interrupted: "已中断",
    running: "进行中", unknown: "未知", never: "从未验证", stale: "配置已变化", connected: "已授权", not_connected: "未授权", disconnected: "未授权",
    unreadable: "不可读", reported: "历史已报告", not_checked: "未检查", not_configured: "未配置", unreachable_or_invalid: "未响应 / 无效", degraded: "运行异常",
    sent: "已发送", pending: "待完成", estimated: "估算", not_priced: "未定价", blocked_unknown_usage: "未知用量，已暂停", exhausted: "已耗尽",
    unlimited: "未设上限", limited: "有限额", inconsistent: "计数矛盾", regressed: "计数回退", uncontradicted: "未发现矛盾", unscoped: "范围未知",
  };
  const label = (v) => LABELS[v] || v || "未知";
  const tone = (v) => (["success", "connected", "running_ok"].includes(v) ? "ok" : ["failed", "unreadable", "degraded", "unreachable_or_invalid"].includes(v) ? "bad" : ["stale", "cancelled", "interrupted", "blocked_unknown_usage", "exhausted"].includes(v) ? "warn" : v === "running" ? "info" : "");
  const badge = (text, t = "", plain = false) => `<span class="badge ${t}${plain ? " plain" : ""}">${h(text)}</span>`;
  const empty = (title, desc, ic = "chart") => `<div class="empty"><span class="empty-icon">${icon(ic, 22)}</span><h3>${h(title)}</h3><p>${h(desc)}</p></div>`;
  const STATUS_COLORS = { success: "var(--ok)", failed: "var(--bad)", cancelled: "var(--warn)", interrupted: "var(--accent-3)", running: "var(--info)", unknown: "var(--faint)" };
  const PROVIDER_STYLE = {
    mimo: ["#fb923c", "#e11d48", "Mi"], deepseek: ["#60a5fa", "#4338ca", "DS"], zhipu: ["#818cf8", "#3730a3", "GL"], kimi: ["#94a3b8", "#1e293b", "Ki"],
    openai: ["#34d399", "#0f766e", "OA"], chatgpt: ["#2dd4bf", "#0e7490", "GP"], anthropic: ["#fdba74", "#b45309", "An"], "openai-compatible": ["#c4b5fd", "#7c3aed", "RL"],
    "kimi-code": ["#e879f9", "#6d28d9", "KC"], "glm-coding": ["#22d3ee", "#4338ca", "GC"],
  };
  function avatar(provider, name, cls = "") {
    const [a, b, text] = PROVIDER_STYLE[provider] || ["#94a3b8", "#475569", (name || provider || "?").slice(0, 2)];
    return `<span class="avatar ${cls}"${css({ h1: a, h2: b })}>${h(text)}</span>`;
  }
  function appAvatar(app, cls = "") {
    let hash = 0; for (const ch of app.id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    const pal = [["#5eead4", "#6366f1"], ["#f9a8d4", "#a855f7"], ["#fcd34d", "#f97316"], ["#93c5fd", "#2563eb"], ["#86efac", "#059669"], ["#c4b5fd", "#db2777"]][hash % 6];
    return `<span class="avatar ${cls}${app.active ? "" : " muted"}"${css({ h1: pal[0], h2: pal[1] })}>${h(app.name.slice(0, 1).toUpperCase())}</span>`;
  }

  /* ======================================================================================
   * State
   * ==================================================================================== */
  const PAGES = {
    overview: ["资源概览", "YOUR AI, AT A GLANCE", "连接、用量与运行状态，都在这里。"],
    resources: ["连接与模型", "ONE PLACE FOR EVERY CONNECTION", "发现、启用、应用获权与历史能力，四层状态一目了然。"],
    usage: ["用量分析", "MAKE EVERY TOKEN VISIBLE", "从真实调用记录，看清你的 AI 使用方式。"],
    applications: ["应用管理", "EVERY CALLER, CLEARLY BOUNDED", "各应用的访问权限、并发限制与本地配额。"],
    monitor: ["运行监控", "KEEP A PULSE ON YOUR GATEWAY", "本机服务、队列、异常、日志与备份。"],
  };
  const PERIODS = { "24h": "过去 24 小时", "7d": "过去 7 天", "30d": "过去 30 天", "90d": "过去 90 天", custom: "所选时间段" };
  const METRICS = { tokens: "Token", requests: "调用", cost: "费用估算", success: "成功率", latency: "耗时" };
  const state = {
    view: "overview", metric: "tokens", currency: "", snapshot: null, rows: null, logs: null, backups: null,
    offset: 0, errorsOnly: false, authorized: false, query: new URLSearchParams({ period: "7d" }),
    detail: null, modelSearch: "", modelScope: "all", modelBusy: false, controller: null, version: 0, refreshing: false,
  };
  const canManage = () => Boolean(state.snapshot?.capabilities?.model_approval);
  const appName = (id) => state.snapshot?.applications.find((a) => a.id === id)?.name || id || "未知应用";
  const connName = (id) => state.snapshot?.connections.find((c) => c.id === id)?.name || id || "未知连接";

  /* ======================================================================================
   * Refresh cycle
   * ==================================================================================== */
  function notice(message, kind = "") {
    const el = $("#notice");
    if (!message) { el.hidden = true; return; }
    el.className = `notice ${kind}`;
    el.innerHTML = kind === "demo" ? `${icon("flask", 18)}<span>${message}</span>` : h(message);
    el.hidden = false;
  }
  function setFreshness(text, cls = "") { $("#freshness").textContent = text; $("#fresh-dot").className = `fresh-dot ${cls}`; }

  function gate(message = "从运行 selark dashboard 的本机终端，打开一次性管理链接。") {
    saveSession(null);
    Object.assign(state, { authorized: false, snapshot: null, rows: null, logs: null, backups: null });
    $("#filters").hidden = true;
    if ($("#drawer").open) $("#drawer").close();
    notice("");
    $("#content").innerHTML = `<section class="gate"><div class="panel gate-card">
      <span class="gate-icon">${icon("lock", 28)}</span>
      <h2>需要本机管理会话</h2><p>${h(message)}</p>
      <div class="terminal"><div><span class="prompt">❯</span> selark dashboard</div><div class="dim">Selark Dashboard V0.2 · 模型启用管理 · Ctrl+C 关闭服务</div><div class="dim">一次性管理链接（5 分钟内有效，请勿分享）：</div><div>http://127.0.0.1:8790/#login=••••••••</div></div>
      <div class="gate-actions"><button class="grad-button" data-action="enter-demo">${icon("flask", 16)}浏览演示数据</button><button class="outline-button" data-action="retry">${icon("refresh", 16)}重新检查</button></div>
    </div></section>`;
    setFreshness("未登录");
    updateChrome();
  }

  function populateFilters() {
    const s = state.snapshot;
    const set = (id, values, all) => {
      const el = $(`#${id}`), current = state.query.get(id) || "";
      const html = `<option value="">${all}</option>` + values.map(([v, n]) => `<option value="${h(v)}">${h(n)}</option>`).join("");
      if (el.dataset.html !== html) { el.innerHTML = html; el.dataset.html = html; }
      el.value = current;
    };
    set("caller_id", s.applications.map((a) => [a.id, a.name]), "全部应用");
    const cids = [...new Set([...s.connections.map((c) => c.id), ...s.options.connections])].sort();
    set("connection_id", cids.map((id) => [id, connName(id)]), "全部连接");
    const models = [...new Set([...s.connections.flatMap((c) => c.models), ...s.options.models])].sort();
    set("model", models.map((m) => [m, m]), "全部模型");
    const period = state.query.get("period") || "7d";
    $$("[data-period]").forEach((b) => b.classList.toggle("active", b.dataset.period === period));
  }

  function updateChrome() {
    const s = state.snapshot;
    const pill = $("#mode-pill");
    const mode = DEMO ? ["demo", "flask", "演示数据"] : s && canManage() ? ["manage", "unlock", "模型管理"] : ["", "lock", s ? "只读模式" : "未登录"];
    pill.className = `mode-pill ${mode[0]}`;
    $("#mode-icon").innerHTML = icon(mode[1], 15);
    $("#dashboard-mode").textContent = mode[2];
    $("#access-mode").textContent = DEMO ? "浏览器内置模拟后端 · 无网络请求" : s ? `127.0.0.1 · ${canManage() ? "模型启用管理" : "只读访问"}` : "127.0.0.1 · 等待管理会话";
    $("#version").textContent = s ? `v${s.version}` : "Selark";
    const svc = s?.service, cap = svc?.capacity || {};
    const running = svc?.state === "running";
    $("#gw-dot").className = `pulse-dot ${running ? "on" : svc?.state === "degraded" ? "bad" : ""}`;
    $("#gw-state").textContent = svc ? (running ? "运行中" : label(svc.state)) : "—";
    const bar = (id, v, max) => $(id).style.setProperty("--w", isNum(v) && max ? `${clamp((v / max) * 100, v ? 4 : 0, 100)}%` : "0%");
    bar("#gw-active", cap.active, cap.max_active); bar("#gw-queued", cap.queued, cap.max_queued);
    $("#gw-active-n").textContent = isNum(cap.active) ? `${cap.active}/${cap.max_active ?? "?"}` : "—";
    $("#gw-queued-n").textContent = isNum(cap.queued) ? `${cap.queued}/${cap.max_queued ?? "?"}` : "—";
  }

  async function refresh() {
    if (!state.authorized) return false;
    state.controller?.abort();
    const controller = (state.controller = new AbortController());
    const signal = controller.signal, version = ++state.version;
    const deadline = setTimeout(() => controller.abort(new DOMException("本地读取超时，请稍后刷新。", "TimeoutError")), 20000);
    state.refreshing = true;
    $("#refresh").classList.add("spinning");
    setFreshness("读取中…");
    try {
      const next = await api(`snapshot?${state.query}`, signal);
      if (version !== state.version) return false;
      state.snapshot = next;
      populateFilters();
      updateChrome();
      if (DEMO) notice("演示模式 · 数据由浏览器内的模拟后端生成，JSON 结构与 Selark <code>/api</code> 完全一致；通过 <code>selark dashboard</code> 打开即读取真实本地数据。", "demo");
      else notice(next.issues.join(" "));
      if (["overview", "usage", "monitor"].includes(state.view)) {
        const rq = new URLSearchParams(state.query);
        if (next.usage) { rq.set("period", "custom"); rq.set("since", next.usage.filters.since); rq.set("until", next.usage.filters.until); }
        rq.set("offset", state.offset); rq.set("errors", state.errorsOnly);
        const results = await Promise.allSettled([api(`records?${rq}`, signal), ...(state.view === "monitor" ? [api("logs", signal), api("backups", signal)] : [])]);
        if (version !== state.version) return false;
        const expired = results.find((r) => r.status === "rejected" && r.reason.status === 401);
        if (expired) throw expired.reason;
        state.rows = results[0].status === "fulfilled" ? results[0].value : null;
        state.rowsFailed = !state.rows;
        if (state.view === "monitor") { state.logs = results[1].status === "fulfilled" ? results[1].value : null; state.backups = results[2].status === "fulfilled" ? results[2].value : null; }
        if (results.some((r) => r.status === "rejected")) notice("部分记录暂时不可读；可稍后刷新，或在终端检查 selark status --offline。");
      }
      render();
      setFreshness(`快照 ${clock(next.checked_at)}`, "ok");
      return true;
    } catch (error) {
      if (version !== state.version) return false;
      if (error.name === "AbortError" && !String(error.message).includes("超时")) return false;
      if (error.status === 401) gate(error.message);
      else {
        if (!state.rows) state.rowsFailed = true;
        notice(`${error.message} ${state.snapshot ? "下方保留的是上次成功读取的快照。" : ""}`);
        setFreshness("刷新失败 · 数据可能过期", "stale");
        if (!state.snapshot) $("#content").innerHTML = `<section class="panel">${empty("暂时无法读取工作空间", "请确认 Dashboard 进程仍在运行，再点击刷新。", "pulse")}</section>`;
      }
      return false;
    } finally {
      clearTimeout(deadline);
      if (version === state.version) { state.refreshing = false; $("#refresh").classList.remove("spinning"); }
    }
  }

  /* ======================================================================================
   * Charts
   * ==================================================================================== */
  let gid = 0;
  const tips = new Map();
  function gradient(id, dir = "v", a = "a", b = "b", o1 = 1, o2 = 1) {
    const [x2, y2] = dir === "v" ? [0, 1] : [1, 0];
    return `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}"><stop offset="0" class="stop-${a}" stop-opacity="${o1}"/><stop offset="1" class="stop-${b}" stop-opacity="${o2}"/></linearGradient>`;
  }
  function niceMax(v) {
    if (!(v > 0)) return 1;
    const p = 10 ** Math.floor(Math.log10(v));
    for (const m of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p >= v * 1.06) return m * p;
    return 10 * p;
  }
  function smoothPath(pts) {
    if (pts.length < 2) return pts.length ? `M${pts[0][0]} ${pts[0][1]}` : "";
    let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      const t = 0.18;
      const c1 = [p1[0] + (p2[0] - p0[0]) * t, p1[1] + (p2[1] - p0[1]) * t];
      const c2 = [p2[0] - (p3[0] - p1[0]) * t, p2[1] - (p3[1] - p1[1]) * t];
      const lo = Math.min(p1[1], p2[1]), hi = Math.max(p1[1], p2[1]);
      c1[1] = clamp(c1[1], lo, hi); c2[1] = clamp(c2[1], lo, hi);
      d += ` C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
    }
    return d;
  }
  function pointValue(p, metric = state.metric) {
    if (metric === "tokens") return p.known_tokens?.total_tokens ?? null;
    if (metric === "requests") return p.requests;
    if (metric === "cost") return p.estimated_cost_by_currency?.[state.currency] == null ? null : Number(p.estimated_cost_by_currency[state.currency]);
    if (metric === "success") return p.success_rate == null ? null : p.success_rate * 100;
    return p.average_latency_ms ?? null;
  }
  function metricLabel(v, metric = state.metric) {
    if (v == null) return "未知 / 无记录";
    if (metric === "success") return `${v.toFixed(1)}%`;
    if (metric === "latency") return duration(v);
    if (metric === "cost") return money(v, state.currency);
    return number(Math.round(v));
  }
  function axisLabel(v, metric = state.metric) {
    if (metric === "success") return `${Math.round(v)}%`;
    if (metric === "latency") return v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}s` : `${Math.round(v)}ms`;
    if (metric === "cost") return v === 0 ? "0" : money(v);
    return compact(v);
  }

  function drawTrend(host, animate = true) {
    const usage = state.snapshot?.usage;
    if (!usage) return;
    const metric = state.metric, pts = usage.trend;
    if (!usage.summary.requests) { host.innerHTML = empty("这个时段还没有调用记录", "开始使用 Selark 后，这里会呈现真实的使用趋势。"); return; }
    const vals = pts.map((p) => pointValue(p, metric));
    const avail = vals.filter(isNum);
    if (!avail.length) { host.innerHTML = empty("此指标暂无已知数据", "所选范围内没有可绘制的值，未知值不会按零处理。"); return; }
    const W = Math.max(300, host.clientWidth - 24), H = 270, L = 50, R = 10, T = 16, B = 32, pw = W - L - R, ph = H - T - B;
    const max = metric === "success" ? 100 : niceMax(Math.max(...avail));
    const step = pw / pts.length, x = (i) => L + step * (i + 0.5), y = (v) => T + ph * (1 - v / max);
    const id = `g${++gid}`, bars = ["tokens", "requests", "cost"].includes(metric);
    let grid = "";
    for (let i = 0; i <= 4; i++) { const v = (max * i) / 4, py = y(v); grid += `<line x1="${L}" x2="${W - R}" y1="${py}" y2="${py}" class="chart-grid"/><text x="${L - 10}" y="${py + 3.5}" class="chart-axis" text-anchor="end">${h(axisLabel(v, metric))}</text>`; }
    let cols = "", line = "", area = "";
    const barW = clamp(step * 0.56, 2, 30);
    vals.forEach((v, i) => {
      const p = pts[i], key = `t${id}-${i}`;
      tips.set(key, `<div class="tt-title">${h(p.day)} · UTC</div><div class="tt-row"><span>${h(METRICS[metric])}</span><b>${h(metricLabel(v, metric))}</b></div><div class="tt-row"><span>调用</span><b>${number(p.requests)}</b></div>${p.requests ? `<div class="tt-row"><span>成功率</span><b>${percent(p.success_rate)}</b></div><div class="tt-row"><span>未知消耗</span><b>${number(p.unknown_consumption_requests)}</b></div>` : ""}`);
      let mark = "";
      if (isNum(v)) {
        if (bars) mark = `<rect class="chart-bar${animate ? " grow" : ""}" x="${x(i) - barW / 2}" y="${y(v)}" width="${barW}" height="${Math.max(1.5, ph - (y(v) - T))}" rx="${Math.min(6, barW / 2.5)}" fill="url(#${id}b)"${css({ d: `${(i / pts.length) * 0.45}s` })}/>`;
        else mark = `<circle class="chart-dot" cx="${x(i)}" cy="${y(v)}" r="4.5" fill="url(#${id}l)"/>`;
      }
      cols += `<g class="chart-col" data-tip="${key}"><rect class="chart-hit" x="${L + step * i}" y="${T}" width="${step}" height="${ph}"/><line class="chart-cross" x1="${x(i)}" x2="${x(i)}" y1="${T}" y2="${T + ph}"/>${mark}</g>`;
    });
    if (!bars) {
      const segments = []; let cur = [];
      vals.forEach((v, i) => { if (isNum(v)) cur.push([x(i), y(v)]); else if (cur.length) { segments.push(cur); cur = []; } });
      if (cur.length) segments.push(cur);
      for (const seg of segments) {
        const d = smoothPath(seg);
        if (seg.length > 1) area += `<path d="${d} L${seg[seg.length - 1][0]} ${T + ph} L${seg[0][0]} ${T + ph} Z" fill="url(#${id}a)"/>`;
        line += seg.length > 1 ? `<path class="chart-line${animate ? " draw" : ""}" d="${d}" stroke="url(#${id}l)" pathLength="1000"${css({ len: 1000 })}/>` : `<circle cx="${seg[0][0]}" cy="${seg[0][1]}" r="3" fill="url(#${id}l)"/>`;
      }
    }
    const stride = Math.max(1, Math.ceil(pts.length / Math.max(3, Math.floor(pw / 74))));
    let xl = "";
    pts.forEach((p, i) => { if (i % stride === 0) xl += `<text x="${x(i)}" y="${H - 9}" class="chart-axis" text-anchor="middle">${h(p.day.slice(5).replace("-", "/"))}</text>`; });
    host.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${h(METRICS[metric])}每日趋势（UTC）"><defs>${gradient(`${id}b`, "v", "a", "b")}${gradient(`${id}l`, "h", "a", "c")}${gradient(`${id}a`, "v", "b", "b", 0.28, 0)}</defs>${grid}${area}${line}<g class="${bars ? "chart-bars" : ""}">${cols}</g>${xl}</svg>`;
    paint(host);
  }

  function sparkline(values, cls = "a") {
    const v = values.map((n) => (isNum(n) ? n : null));
    const avail = v.filter((n) => n != null);
    if (avail.length < 2) return "";
    const max = Math.max(...avail), min = Math.min(...avail, 0), W = 120, H = 40;
    const x = (i) => (i / (v.length - 1)) * W, y = (n) => H - 3 - ((n - min) / (max - min || 1)) * (H - 8);
    const pts = v.map((n, i) => (n == null ? null : [x(i), y(n)])).filter(Boolean);
    const d = smoothPath(pts), id = `s${++gid}`;
    return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><defs>${gradient(id, "v", cls, cls, 0.32, 0)}${gradient(`${id}l`, "h", cls, cls === "a" ? "b" : cls, 0.5, 1)}</defs><path d="${d} L${pts[pts.length - 1][0]} ${H} L${pts[0][0]} ${H} Z" fill="url(#${id})"/><path d="${d}" class="spark-line" stroke="url(#${id}l)" vector-effect="non-scaling-stroke"/></svg>`;
  }

  function donut(segments, center, caption, size = 150) {
    const total = segments.reduce((s, x) => s + x.value, 0);
    const r = 56, C = 2 * Math.PI * r;
    let offset = 0, arcs = "";
    const gap = segments.filter((s) => s.value).length > 1 ? 2.2 : 0;
    for (const s of segments) {
      if (!s.value) continue;
      const len = (s.value / total) * C;
      arcs += `<circle class="seg" cx="70" cy="70" r="${r}" fill="none" stroke-width="13" stroke-dasharray="${Math.max(0.5, len - gap)} ${C}" stroke-dashoffset="${-offset}" stroke-linecap="butt"${css({ c: s.color })}><title>${h(s.label)} ${s.value}</title></circle>`;
      offset += len;
    }
    return `<svg width="${size}" height="${size}" viewBox="0 0 140 140" role="img" aria-label="${h(caption)}"><circle cx="70" cy="70" r="${r}" fill="none" class="ring-track" stroke-width="13"/><g transform="rotate(-90 70 70)">${arcs}</g><text x="70" y="72" text-anchor="middle" class="donut-center">${h(center)}</text><text x="70" y="90" text-anchor="middle" class="donut-caption">${h(caption)}</text></svg>`;
  }

  function ring(ratio, size = 96, stroke = 9, cls = "") {
    const id = `r${++gid}`, r = 50 - stroke / 2 - 1;
    const pct = ratio == null ? 0 : clamp(ratio, 0, 1) * 100;
    return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true"><defs>${gradient(id, "h", cls === "warn" ? "w" : "a", cls === "warn" ? "c" : "b")}</defs><circle cx="50" cy="50" r="${r}" fill="none" class="ring-track" stroke-width="${stroke}"/>${ratio == null ? "" : `<circle cx="50" cy="50" r="${r}" fill="none" stroke="url(#${id})" stroke-width="${stroke}" stroke-linecap="round" pathLength="100" stroke-dasharray="${pct} 100" class="ring-value"/>`}</svg>`;
  }

  function gauge(ratio, text) {
    const id = `ga${++gid}`, pct = ratio == null ? 0 : clamp(ratio, 0, 1) * 100;
    const arc = "M14 74 A52 52 0 0 1 118 74";
    return `<svg class="gauge" viewBox="0 0 132 84" aria-hidden="true"><defs>${gradient(id, "h", "a", pct > 75 ? "c" : "b")}</defs><path d="${arc}" fill="none" class="ring-track" stroke-width="11" stroke-linecap="round"/>${ratio == null ? "" : `<path d="${arc}" fill="none" stroke="url(#${id})" stroke-width="11" stroke-linecap="round" pathLength="100" stroke-dasharray="${Math.max(pct, 0.01)} 100"/>`}<text x="66" y="70" text-anchor="middle" class="gauge-text">${h(text)}</text></svg>`;
  }

  function paint(root) {
    $$("[data-css]", root).forEach((el) => {
      for (const part of el.dataset.css.split(";")) {
        const i = part.indexOf(":");
        if (i < 0) continue;
        const k = part.slice(0, i).trim(), v = part.slice(i + 1).trim();
        if (k.startsWith("--")) el.style.setProperty(k, v);
      }
    });
  }
  function redrawCharts(root = document, animate = false) { $$("[data-chart]", root).forEach((host) => { if (host.dataset.chart === "trend") drawTrend(host, animate); }); }
  function hydrate(root) { hydrateIcons(root); paint(root); redrawCharts(root, true); }

  /* ======================================================================================
   * Page sections
   * ==================================================================================== */
  function greeting() {
    const hr = new Date().getHours();
    return hr < 5 ? "夜深了" : hr < 11 ? "早上好" : hr < 13 ? "中午好" : hr < 18 ? "下午好" : "晚上好";
  }
  function hero() {
    const s = state.snapshot, u = s.usage?.summary;
    const period = PERIODS[state.query.get("period") || "7d"];
    const filtered = ["caller_id", "connection_id", "model"].some((k) => state.query.get(k));
    const activeApps = s.applications.filter((a) => a.active).length;
    const enabledConns = s.connections.filter((c) => c.enabled).length;
    const line = u
      ? `${period}${filtered ? "（已筛选）" : ""}，<em>${number(activeApps)}</em> 个有效应用经由 <em>${number(enabledConns)}</em> 个已启用连接发出 <em>${number(u.requests)}</em> 次调用，已报告 <em>${compact(u.known_tokens.total_tokens)}</em> tokens${u.success_rate == null ? "。" : `，完成成功率 <em>${percent(u.success_rate)}</em>。`}`
      : "用量账本暂不可读；资源与应用状态仍可浏览。";
    const svc = s.service;
    const approved = s.connections.reduce((n, c) => n + c.models.length, 0);
    return `<section class="panel hero">
      <div><p class="hero-greet">${greeting()} · ${new Date().toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "long" })}</p>
      <p class="hero-line">${line}</p>
      <div class="hero-tags">
        <span class="tag">${icon("layers", 14)}<b>${s.connections.length}</b> 个连接 · <b>${approved}</b> 个启用模型</span>
        <span class="tag"><span class="dot ${svc.state === "running" ? "ok" : svc.state === "degraded" ? "bad" : ""}"></span>网关 ${h(svc.state === "running" ? "运行中" : label(svc.state))}</span>
        ${u?.unknown_consumption_requests ? `<span class="tag">${icon("alert", 14)}<b>${number(u.unknown_consumption_requests)}</b> 次消耗未知（不计为零）</span>` : ""}
        ${u?.in_flight_requests ? `<span class="tag">${icon("clock", 14)}<b>${number(u.in_flight_requests)}</b> 次进行中</span>` : ""}
      </div></div>
      <div class="hero-ring">${ring(u?.success_rate ?? null, 132, 10)}<div class="ring-label"><b>${percent(u?.success_rate)}</b><small>完成成功率</small></div></div>
    </section>`;
  }

  function kpis() {
    const u = state.snapshot.usage;
    if (!u) return "";
    const s = u.summary, trend = u.trend;
    const costs = Object.entries(s.estimated_cost_by_currency);
    const series = (m) => trend.map((p) => pointValue(p, m));
    const cards = [
      ["已报告 Token", compact(s.known_tokens.total_tokens), "tokens", `${number(s.known_usage_requests)} 次完整用量 · ${number(s.unknown_consumption_requests)} 次未知`, "feature", series("tokens"), "a"],
      ["调用次数", number(s.requests), "requests", `${number(s.upstream_attempts)} 次上游尝试 · ${number(s.local_rejected_requests)} 次本地拒绝`, "", series("requests"), "b"],
      ["费用估算", costs.length ? costs.map(([c, v]) => h(money(v, c))).join("<br>") : "—", "cost", costs.length ? `${number(s.unknown_cost_requests)} 次费用未知 · 非账单` : "尚无可估算费用 · 非零费用", costs.length > 1 ? "multi" : "", null, "c"],
      ["完成成功率", percent(s.success_rate), "check", `${number(s.completed_requests)} 次已知完成状态`, "", series("success"), "a"],
      ["平均耗时", duration(s.average_latency_ms), "clock", `${number(s.latency_samples)} 条有效耗时 · 含排队`, "", series("latency"), "b"],
    ];
    return `<section class="kpis" aria-label="所选范围的用量汇总">${cards.map(([name, value, ic, note, cls, ser, color]) => `
      <article class="kpi ${cls === "feature" ? "feature" : ""}"><div class="kpi-label">${h(name)}${icon(ic, 16)}</div>
      <div class="kpi-value ${cls === "multi" ? "multi" : ""}">${ic === "cost" ? value : h(value)}</div><div class="kpi-note">${h(note)}</div>
      <div class="kpi-spark">${ser ? sparkline(ser, color) : sparkline(trend.map((p) => { const v = Object.values(p.estimated_cost_by_currency || {})[0]; return v == null ? null : Number(v); }), color)}</div></article>`).join("")}</section>`;
  }

  function trendPanel() {
    const usage = state.snapshot.usage;
    if (!usage) return `<section class="panel">${empty("用量账本暂不可读", "Dashboard 不会自动迁移或修复账本，请在终端检查现有配置。", "database")}</section>`;
    const currencies = Object.keys(usage.summary.estimated_cost_by_currency);
    if (!currencies.includes(state.currency)) state.currency = currencies[0] || "USD";
    const foot = { cost: "按请求时价格快照估算；币种独立统计，未定价不计为零。", success: "成功 ÷ 已知完成状态；不含进行中与状态未知。", latency: "网关端到端平均耗时，包含排队；不代表首 Token 延迟。" }[state.metric] || "仅汇总账本已知值；未知消耗保留，不推算。";
    return `<section class="panel">
      <div class="panel-header"><div><h2>使用趋势</h2><p class="panel-sub">每一次调用，都有迹可循 · 按 UTC 日分组</p></div>${badge("历史记录", "grad", true)}</div>
      <div class="chart-toolbar"><div class="segments" role="group" aria-label="图表指标">${Object.entries(METRICS).map(([k, n]) => `<button data-metric="${k}" class="${state.metric === k ? "active" : ""}" aria-pressed="${state.metric === k}">${n}</button>`).join("")}</div>
      <div class="chart-meta"><span class="legend-dot"></span>${h(METRICS[state.metric])}${state.metric === "cost" && currencies.length ? `<select id="currency" aria-label="费用币种">${currencies.map((c) => `<option ${c === state.currency ? "selected" : ""}>${h(c)}</option>`).join("")}</select>` : ""}</div></div>
      <div class="chart-host" data-chart="trend"></div>
      <div class="panel-foot"><span>${h(foot)}</span><span>${number(usage.unknown_time_excluded)} 条时间未知记录未纳入</span></div>
      <details class="data-table"><summary>查看图表数据与统计口径</summary><p>时间区间包含开始、不包含结束；首尾日期可能是不完整的一天。空日期无记录；未知值保持空缺。成功率分母包含成功、失败、取消和中断。</p>
      <div class="table-wrap"><table><thead><tr><th>日期 · UTC</th><th class="num">${h(METRICS[state.metric])}</th><th class="num">调用</th><th class="num">未知消耗</th></tr></thead><tbody>${usage.trend.map((p) => `<tr><td class="mono">${h(p.day)}</td><td class="num">${h(metricLabel(pointValue(p)))}</td><td class="num">${number(p.requests)}</td><td class="num">${number(p.unknown_consumption_requests)}</td></tr>`).join("")}</tbody></table></div></details>
    </section>`;
  }

  const availabilityText = (c) => (c.availability.state === "blocked_locally" ? "本地受阻" : "实时可用性未知");
  function authorizationText(c) {
    const a = c.authorization;
    if (a.state === "unreadable") return "本地状态不可读";
    if (a.kind === "oauth") return a.access_expired ? "已到期，待刷新" : a.ready ? "OAuth 本地就绪" : "尚未授权 / 未就绪";
    return a.credential_configured === false ? "未配置凭据" : "已配置 Key";
  }

  function resourcePool() {
    const list = state.snapshot.connections;
    return `<section class="panel">
      <div class="panel-header"><div><h2>资源池 <span class="count">${list.length}</span></h2><p class="panel-sub">全部连接 · 与用量筛选无关</p></div><button class="link-button" data-navigate="resources">全部 ${icon("arrow", 14)}</button></div>
      ${list.length ? `<div class="res-list">${list.map((c) => `<button class="res-row" data-connection="${h(c.id)}">${avatar(c.provider, c.name, c.enabled ? "" : "muted")}
        <span><span class="res-name">${h(c.name)}</span><span class="res-sub">${h(label(c.resource_type))} · 已启用 ${c.models.length}${c.discovery?.discovered_at ? ` / 目录 ${c.discovery.count}` : ""}</span></span>
        <span class="res-state">${badge(c.enabled ? "已启用" : "已停用", c.enabled ? "ok" : "")}<span>${h(availabilityText(c))}</span></span></button>`).join("")}</div>` : empty("尚未配置连接", "已有资源会自动出现在这里。", "resources")}
      <div class="panel-foot"><span>本地授权与历史成功，均不代表上游当前可用。</span></div></section>`;
  }

  function statusPanel() {
    const u = state.snapshot.usage?.summary;
    if (!u) return "";
    const order = ["success", "failed", "cancelled", "interrupted", "running", "unknown"];
    const segs = order.filter((k) => u.status_counts[k]).map((k) => ({ label: label(k), value: u.status_counts[k], color: STATUS_COLORS[k] }));
    const total = segs.reduce((s, x) => s + x.value, 0);
    return `<section class="panel"><div class="panel-header"><div><h2>调用状态分布</h2><p class="panel-sub">最终状态 · 当前筛选范围</p></div>${icon("pulse", 17)}</div>
      <div class="panel-body">${total ? `<div class="donut-wrap">${donut(segs, compact(total), "次调用")}<ul class="legend">${segs.map((s) => `<li${css({ c: s.color })}><i></i><span>${h(s.label)}</span><b>${number(s.value)}<small>${((s.value / total) * 100).toFixed(1)}%</small></b></li>`).join("")}</ul></div>` : empty("暂无调用", "所选范围内还没有记录。")}</div></section>`;
  }

  function compositionPanel() {
    const u = state.snapshot.usage?.summary;
    if (!u) return "";
    const p = u.known_tokens.prompt_tokens, c = u.known_tokens.completion_tokens, t = (p || 0) + (c || 0);
    const costs = Object.entries(u.estimated_cost_by_currency);
    return `<section class="panel"><div class="panel-header"><div><h2>Token 构成</h2><p class="panel-sub">仅统计账本已报告字段</p></div>${icon("tokens", 17)}</div>
      <div class="panel-body">
        ${t ? `<div class="stack"><i${css({ w: `${(p / t) * 100}%`, c: "var(--accent)" })}></i><i${css({ w: `${(c / t) * 100}%`, c: "var(--accent-2)" })}></i></div>
        <div class="stack-legend"><span${css({ c: "var(--accent)" })}><i></i>输入 <b>${compact(p)}</b> · ${percent(p / t)}</span><span${css({ c: "var(--accent-2)" })}><i></i>输出 <b>${compact(c)}</b> · ${percent(c / t)}</span></div>` : `<p class="panel-sub">暂无已报告的输入 / 输出 Token。</p>`}
        <div class="policy-grid mt">
          <div class="policy">已报告用量<b>${number(u.reported_usage_requests)}</b></div>
          <div class="policy">消耗未知<b>${number(u.unknown_consumption_requests)}</b></div>
          <div class="policy">缺失输出字段<b>${number(u.missing_field_requests.completion_tokens)}</b></div>
          <div class="policy">本地拒绝（未发送）<b>${number(u.local_rejected_requests)}</b></div>
        </div>
        ${costs.length ? `<div class="d-note">费用估算：${costs.map(([cur, v]) => `<b>${h(money(v, cur))}</b> ${h(cur)}`).join(" · ")}；${number(u.unknown_cost_requests)} 次费用未知。按请求时价格快照估算，不是供应商账单。</div>` : ""}
      </div></section>`;
  }

  function ranking() {
    const models = state.snapshot.usage?.models || [], max = models[0]?.requests || 1;
    return `<section class="panel"><div class="panel-header"><div><h2>模型使用排行</h2><p class="panel-sub">按调用次数 · 前 10 个连接 / 模型组合</p></div>${icon("chart", 17)}</div>
      <div class="panel-body">${models.length ? `<div class="ranking">${models.map((m, i) => `<div class="rank-item"><span class="rank-n">${String(i + 1).padStart(2, "0")}</span><span class="rank-name" title="${h(m.model)}">${h(m.model || "未知模型")}</span><span class="rank-val">${number(m.requests)}</span><span class="rank-bar"><i${css({ w: `${(m.requests / max) * 100}%` })}></i></span><span class="rank-sub">${h(connName(m.connection_id))} · ${compact(m.known_tokens.total_tokens)} tokens · 成功 ${percent(m.success_rate)}</span></div>`).join("")}</div>` : empty("暂无模型用量", "模型分布会随真实调用记录更新。")}</div></section>`;
  }

  function serviceStrip() {
    const svc = state.snapshot.service, c = svc.capacity || {}, st = svc.storage || {};
    const running = svc.state === "running";
    return `<section class="panel strip"><span class="strip-title"><span class="pulse-dot ${running ? "on" : svc.state === "degraded" ? "bad" : ""}"></span>本机网关 ${badge(running ? "运行中" : label(svc.state), running ? "ok" : tone(svc.state))}</span>
      ${svc.reachable ? `<span class="strip-stat">执行 <b>${number(c.active)}</b>/ ${number(c.max_active)}</span><span class="strip-stat">排队 <b>${number(c.queued)}</b>/ ${number(c.max_queued)}</span><span class="strip-stat">落账 <b>${st.degraded == null ? "未知" : st.degraded ? "降级" : "正常"}</b></span>${svc.pid ? `<span class="strip-stat hide-sm">PID <b class="mono">${h(svc.pid)}</b></span>` : ""}` : `<span class="strip-stat">队列实时状态未知</span>`}
      <span class="spacer"></span><button class="link-button" data-navigate="monitor">运行详情 ${icon("arrow", 14)}</button></section>`;
  }

  function recordsPanel(limit) {
    const rows = state.rows;
    const items = limit ? (rows?.items || []).slice(0, limit) : rows?.items || [];
    const maxDur = Math.max(1, ...items.map((r) => r.duration_ms || 0));
    const title = state.errorsOnly ? "异常调用" : "最近调用";
    return `<section class="panel">
      <div class="panel-header"><div><h2>${title} ${rows ? `<span class="count">${number(rows.total)}</span>` : ""}</h2><p class="panel-sub">当前筛选范围 · 时间按浏览器本地时区显示</p></div>
      <button class="toggle-chip ${state.errorsOnly ? "on" : ""}" data-action="toggle-errors">${icon("filter", 14)}${state.errorsOnly ? "只看异常 · 开" : "只看异常"}</button></div>
      ${!rows && !state.rowsFailed ? `<div class="panel-body skeleton-rows">${'<span class="skeleton"></span>'.repeat(limit || 8)}</div>` : items.length ? `<div class="table-wrap"><table><thead><tr><th>模型 / 连接</th><th class="hide-sm">应用</th><th>状态</th><th class="num">Token</th><th class="num">耗时</th><th class="hide-sm">时间</th><th></th></tr></thead><tbody>
      ${items.map((r, i) => `<tr class="clickable" data-record="${i}"><td><span class="cell-main mono">${h(r.model || "未知模型")}</span><span class="cell-sub">${h(connName(r.connection_id))}</span></td>
        <td class="hide-sm">${h(appName(r.caller_id))}</td><td>${badge(label(r.status), tone(r.status))}</td>
        <td class="num">${r.total_tokens == null ? `<span class="cell-sub">${r.upstream_attempts === 0 ? "本地拒绝" : "未知"}</span>` : `${number(r.total_tokens)}${r.usage_known ? "" : `<span class="cell-sub">部分用量</span>`}`}</td>
        <td class="num"><span class="dur">${h(duration(r.duration_ms))}<span class="dur-bar"><i${css({ w: `${((r.duration_ms || 0) / maxDur) * 100}%`, c: (r.duration_ms || 0) > 30000 ? "var(--warn)" : "var(--accent-2)" })}></i></span></span></td>
        <td class="hide-sm"><span class="cell-main">${h(ago(r.started_at))}</span><span class="cell-sub">${h(time(r.started_at))}</span></td>
        <td><button class="row-button" data-record="${i}" aria-label="查看调用详情">${icon("chevron", 16)}</button></td></tr>`).join("")}
      </tbody></table></div>` : empty(rows ? "没有匹配的记录" : "调用记录不可读", rows ? "试试调整时间范围或筛选条件。" : "请稍后刷新，或在终端检查账本状态。", "requests")}
      ${limit ? `<div class="pagination"><span class="info">最近 ${items.length} 条 · 共 ${number(rows?.total ?? 0)} 条匹配</span><button class="link-button" data-navigate="usage">查看全部调用 ${icon("arrow", 14)}</button></div>`
        : `<div class="pagination"><span class="info">${rows?.total ? `${state.offset + 1}–${Math.min(state.offset + 25, rows.total)} / ${number(rows.total)}` : "0 条可显示记录"}</span><button class="page-btn" data-action="prev" ${state.offset === 0 ? "disabled" : ""}>上一页</button><button class="page-btn" data-action="next" ${!rows || state.offset + 25 >= rows.total ? "disabled" : ""}>下一页</button></div>`}
    </section>`;
  }

  function funnel(c) {
    const n = c.model_catalog?.counts || {};
    const base = Math.max(1, n.discovered || 0, n.approved ?? c.models.length);
    const rows = [["发现目录", c.discovery?.discovered_at ? n.discovered : null, "var(--faint)"], ["明确启用", n.approved ?? c.models.length, "var(--accent)"], ["应用获权", n.application_authorized, "var(--accent-2)"], ["历史能力", n.historically_verified, "var(--accent-3)"]];
    return `<div class="funnel" aria-label="模型四层状态">${rows.map(([name, v, color]) => `<div class="funnel-row"><span>${name}</span><span class="funnel-track"><i${css({ w: `${v == null ? 0 : (v / base) * 100}%`, c: color })}></i></span><b>${v == null ? "—" : number(v)}</b></div>`).join("")}</div>`;
  }

  function resourcesPage() {
    const list = state.snapshot.connections;
    const sum = (k) => list.reduce((s, c) => s + (c.model_catalog?.counts?.[k] || 0), 0);
    const tiles = [["01", "发现目录", sum("discovered"), "CLI 发现的供应商目录"], ["02", "明确启用", sum("approved"), "本机允许列表"], ["03", "应用获权", sum("application_authorized"), "至少一个有效应用"], ["04", "历史能力", sum("historically_verified"), "当前配置 · 历史证据"]];
    return `<div class="section-intro"><p>共 ${list.length} 个连接 · 发现不等于启用，启用不等于获权，获权不等于实际可用。</p>${badge(DEMO ? "演示 · 可启用/禁用模型" : canManage() ? "模型启用管理" : "全部资源 · 只读", canManage() ? "ok" : "")}</div>
      <section class="summary-tiles">${tiles.map(([n, name, v, note]) => `<article class="panel summary-tile"><div class="st-label"><i>${n}</i>${name}</div><div class="st-value">${number(v)}</div><div class="st-note">${note}</div></article>`).join("")}</section>
      ${list.length ? `<div class="cards">${list.map((c) => `<article class="panel card ${c.enabled ? "" : "disabled"}">
        <div class="card-head">${avatar(c.provider, c.name, `lg${c.enabled ? "" : " muted"}`)}<div><h3>${h(c.name)}</h3><div class="sub">${h(label(c.resource_type))} · <span class="mono">${h(c.id)}</span></div></div>${badge(c.enabled ? "已启用" : "已停用", c.enabled ? "ok" : "")}</div>
        <div class="facts"><div class="fact"><small>本地凭据</small><span>${h(authorizationText(c))}</span></div><div class="fact"><small>连接历史调用</small><span>${badge(label(c.verification.state), tone(c.verification.state))}</span></div>
        <div class="fact"><small>当前可用性</small><span>${h(availabilityText(c))}</span></div><div class="fact"><small>最近验证</small><span>${h(c.verification.verified_at ? ago(c.verification.verified_at) : "尚无记录")}</span></div></div>
        ${funnel(c)}
        ${c.provider_quota?.windows?.length ? `<div class="quota-mini">${c.provider_quota.windows.slice(0, 2).map((w) => `<div class="qm-row"><span>${h(w.name)}</span><span class="gw-bar"><i${css({ w: `${clamp((w.used_ratio || 0) * 100, 0, 100)}%` })}></i></span><b>${percent(w.used_ratio, 0)}</b></div>`).join("")}</div>` : ""}
        <div class="chips">${c.models.slice(0, 3).map((m) => `<span class="chip ${m === c.default_model ? "default" : ""}">${h(m)}</span>`).join("")}${c.models.length > 3 ? `<span class="chip">+${c.models.length - 3}</span>` : ""}${c.models.length ? "" : `<span class="panel-sub">尚未启用模型</span>`}</div>
        <div class="card-foot"><span>${h(c.model_catalog?.protocol || "")}</span><button class="link-button" data-connection="${h(c.id)}">${canManage() ? "管理模型" : "查看详情"} ${icon("arrow", 14)}</button></div>
      </article>`).join("")}</div>` : `<section class="panel">${empty("还没有可显示的连接", "请先在本机 CLI 配置连接，再在这里管理模型启用状态。", "resources")}</section>`}`;
  }

  function applicationsPage() {
    const list = state.snapshot.applications;
    return `<div class="section-intro"><p>本地应用配额按 UTC 今日计算，包含实际消耗与保守预留，不受用量筛选影响。</p>${badge(`${list.filter((a) => a.active).length} 个有效 · ${list.length} 个应用`, "", true)}</div>
      ${list.length ? `<div class="cards">${list.map((a) => {
        const q = a.quota, p = a.policy, limit = p.daily_token_limit;
        const ratio = limit ? q.charged_or_reserved_tokens / limit : null;
        const ringText = q.token_quota_state === "unlimited" ? "∞" : ratio == null ? "?" : `${Math.round(ratio * 100)}%`;
        const costs = Object.entries(q.estimated_cost_or_reservation || {});
        return `<article class="panel card ${a.active ? "" : "disabled"}">
          <div class="card-head">${appAvatar(a, "lg")}<div><h3>${h(a.name)}</h3><div class="sub mono">${h(a.id)}</div></div>${badge(a.active ? "令牌有效" : "已撤销", a.active ? "ok" : "")}</div>
          <div class="app-top"><div class="ring">${ring(ratio, 96, 9, ratio > 0.85 ? "warn" : "")}<div class="ring-text"><b>${ringText}</b><small>今日占用</small></div></div>
          <div class="app-quota-lines"><span>已用或预留 <b>${compact(q.charged_or_reserved_tokens)}</b>${limit ? ` / ${compact(limit)}` : ""}</span><span>${q.token_quota_state === "unlimited" ? "未设日 Token 上限" : q.remaining_tokens == null ? "剩余未知，已暂停" : `剩余 <b>${compact(q.remaining_tokens)}</b>`}</span><span>今日调用 <b>${number(q.requests)}</b> · 未知用量 <b>${number(q.unknown_token_requests)}</b></span>${costs.length ? `<span>估算 ${costs.map(([c, v]) => `<b>${h(money(v, c))}</b>`).join(" · ")}${p.daily_budget ? ` / ${h(money(p.daily_budget, p.budget_currency))}` : ""}</span>` : ""}</div></div>
          <div class="policy-grid">
            <div class="policy">连接<b>${p.allowed_connections == null ? "不限" : `${p.allowed_connections.length} 个`}</b></div>
            <div class="policy">并发<b>${p.max_concurrent_requests ?? "全局"}</b></div>
            <div class="policy ${p.allow_token_plans ? "on" : "off"}">Token Plan<b>${p.allow_token_plans ? "允许" : "未授权"}</b></div>
            <div class="policy ${p.allow_chatgpt_subscriptions ? "on" : "off"}">ChatGPT 订阅<b>${p.allow_chatgpt_subscriptions ? "允许" : "未授权"}</b></div>
          </div>
          <div class="chips">${a.effective_resources.slice(0, 4).map((r) => `<span class="chip">${h(r.name)} · ${r.models.length}</span>`).join("") || `<span class="panel-sub">当前无获准模型</span>`}</div>
          <div class="card-foot"><span>配额日 ${h(q.day)} UTC</span><button class="link-button" data-application="${h(a.id)}">权限与配额 ${icon("arrow", 14)}</button></div>
        </article>`;
      }).join("")}</div>` : `<section class="panel">${empty("尚无可显示的应用", "只展示普通调用方的身份与权限，不显示调用方令牌。", "apps")}</section>`}`;
  }

  function monitorPage() {
    const s = state.snapshot, svc = s.service, c = svc.capacity || {}, st = svc.storage || {};
    const running = svc.state === "running";
    const logs = state.logs, backups = state.backups;
    return `<div class="section-intro"><p>本机健康快照 · ${h(fullTime(s.checked_at))} · 上游可用性未探测</p>${badge(running ? "网关运行中" : label(svc.state), running ? "ok" : tone(svc.state))}</div>
      <div class="grid-3">
        <article class="panel gauge-card">${gauge(isNum(c.active) && c.max_active ? c.active / c.max_active : null, isNum(c.active) ? String(c.active) : "?")}<div><h3>正在执行</h3><div class="big">${number(c.active)}<small> / ${number(c.max_active)}</small></div><p>健康接口报告的全局并发</p></div></article>
        <article class="panel gauge-card">${gauge(isNum(c.queued) && c.max_queued ? c.queued / c.max_queued : null, isNum(c.queued) ? String(c.queued) : "?")}<div><h3>等待队列</h3><div class="big">${number(c.queued)}<small> / ${number(c.max_queued)}</small></div><p>配置上限不等于实时可用容量</p></div></article>
        <article class="panel gauge-card"><div class="backup-icon">${icon("database", 22)}</div><div><h3>落账状态</h3><div class="big">${st.degraded == null ? "未知" : st.degraded ? "降级" : "正常"}</div><p>待处理 ${number(st.pending_records)} · 无效 ${number(st.invalid_records)} · ${st.accepting == null ? "接收状态未知" : st.accepting ? "可接收请求" : "暂停接收"}</p></div></article>
      </div>
      ${recordsPanel()}
      <div class="grid-2 even">
        <section class="panel"><div class="panel-header"><div><h2>运行日志</h2><p class="panel-sub">最近 ${logs?.window ?? 150} 行窗口 · 仅结构化安全字段</p></div>${badge("日志快照", "", true)}</div>
          ${logs?.items.length ? `<ul class="timeline">${logs.items.map((e) => `<li${css({ c: e.status == null ? "var(--faint)" : e.status >= 500 ? "var(--bad)" : e.status >= 400 ? "var(--warn)" : "var(--ok)" })}><time>${h(clock(e.timestamp))}</time><span class="path">${h(e.path)}</span><span class="meta">${e.status == null ? "—" : e.status}<span>${h(duration(e.duration_ms))}</span></span></li>`).join("")}</ul>` : empty(logs ? "暂无结构化日志" : "日志暂不可读", logs ? "运行日志会在网关记录事件后出现。" : "请检查日志权限与路径。", "terminal")}
          <div class="panel-foot"><span>${logs ? `窗口内省略 ${logs.omitted} 行非结构化日志` : "日志读取失败"}</span><span>不受用量筛选影响</span></div></section>
        <section class="panel"><div class="panel-header"><div><h2>本地备份</h2><p class="panel-sub">最近 20 份 · ${backups ? number(backups.total) : "未知"} 份可识别</p></div>${icon("shield", 17)}</div>
          <div class="panel-body">${backups?.items.length ? backups.items.map((b) => `<div class="backup"><span class="backup-icon">${icon("archive", 18)}</span><div><strong>${h(b.created_at ? `${time(b.created_at)} · ${ago(b.created_at)}` : "时间未知")}</strong><p>${h(b.name)}</p></div>${badge(b.manifest === "sha256_present" ? "SHA-256 清单" : b.manifest === "legacy" ? "旧格式清单" : "清单不可读", b.manifest === "sha256_present" ? "info" : b.manifest === "legacy" ? "" : "warn")}</div>`).join("") : empty(backups ? "尚无备份记录" : "备份目录不可读", "此处仅列出已有备份；不会执行备份或恢复。", "archive")}</div>
          <div class="panel-foot"><span>完整性未检查 · 校验请使用 <code>selark backup verify</code></span></div></section>
      </div>`;
  }

  function render() {
    const s = state.snapshot;
    if (!s) return;
    $("#filters").hidden = !["overview", "usage", "monitor"].includes(state.view);
    const v = state.view;
    let html;
    if (v === "overview") html = `${hero()}${kpis()}<div class="grid-2">${trendPanel()}${resourcePool()}</div>${serviceStrip()}<div class="grid-2 even">${statusPanel()}${compositionPanel()}</div>${recordsPanel(6)}`;
    else if (v === "resources") html = resourcesPage();
    else if (v === "usage") html = `${kpis()}<div class="grid-2">${trendPanel()}${ranking()}</div><div class="grid-2 even">${statusPanel()}${compositionPanel()}</div>${recordsPanel()}`;
    else if (v === "applications") html = applicationsPage();
    else html = monitorPage();
    const content = $("#content");
    content.innerHTML = html;
    tips.clear();
    hydrate(content);
    if ($("#drawer").open && state.detail?.type === "connection") connectionDetails(state.detail.id, true);
  }

  function navigate(next, opts = {}) {
    if (!PAGES[next]) return;
    state.view = next; state.offset = 0; state.errorsOnly = opts.errors ?? next === "monitor";
    const [title, eyebrow, desc] = PAGES[next];
    $("#page-title").textContent = title; $("#breadcrumb").textContent = title; $("#eyebrow").textContent = eyebrow; $("#page-description").textContent = desc;
    $$("[data-view]").forEach((b) => { const on = b.dataset.view === next; b.classList.toggle("active", on); on ? b.setAttribute("aria-current", "page") : b.removeAttribute("aria-current"); });
    state.rows = null; state.rowsFailed = false;
    if (state.snapshot) render();
    scrollTo({ top: 0, behavior: "smooth" });
    refresh();
  }

  /* ======================================================================================
   * Drawer details
   * ==================================================================================== */
  const kv = (pairs) => `<dl class="kv">${pairs.map(([k, v]) => `<div><dt>${h(k)}</dt><dd>${h(v ?? "未知")}</dd></div>`).join("")}</dl>`;
  function openDrawer(kicker, html, detail) {
    state.detail = detail;
    $("#drawer-kicker").textContent = kicker;
    const content = $("#drawer-content");
    content.innerHTML = html;
    hydrate(content);
    if (!$("#drawer").open) $("#drawer").showModal();
  }

  const BLOCKERS = { connection_disabled: "连接已停用", models_not_configured: "未启用模型", authorization_not_ready: "授权尚未就绪", access_expired_refresh_required: "访问凭据已过期，需要刷新", plan_preset_only: "仅预设，不支持生成", local_state_unavailable: "本地状态不可读" };
  function connectionDetails(id, keep = false) {
    const c = state.snapshot?.connections.find((x) => x.id === id);
    if (!c) return;
    if (!keep && state.detail?.id !== id) { state.modelSearch = ""; state.modelScope = "all"; }
    const a = c.authorization, v = c.verification, q = c.provider_quota, n = c.model_catalog?.counts || {};
    const editable = canManage();
    const models = c.model_catalog?.models || [];
    const statusMsg = keep ? $("#model-status")?.outerHTML || "" : "";
    const html = `<div class="d-hero">${avatar(c.provider, c.name, "lg")}<div><h2 id="drawer-title">${h(c.name)}</h2><p>${h(label(c.resource_type))} · <span class="mono">${h(c.id)}</span> · ${h(c.model_catalog?.protocol || "")}</p></div></div>
      <div class="d-badges">${badge(c.enabled ? "连接已启用" : "连接已停用", c.enabled ? "ok" : "")}${badge(authorizationText(c), a.state === "connected" ? "info" : "")}${badge(`历史：${label(v.state)}`, tone(v.state))}${badge(availabilityText(c), c.availability.state === "blocked_locally" ? "warn" : "", true)}</div>
      <div class="d-section"><h3>模型四层状态</h3><div class="layers">
        <div class="layer"><small>01 发现目录</small><b>${c.discovery?.discovered_at ? number(n.discovered) : "—"}</b><span>${h({ never: "尚未查询", success: "目录已获取", failure: "最近发现失败", stale: "来源已变更" }[c.discovery?.state] || "未知")}</span></div>
        <div class="layer"><small>02 明确启用</small><b>${number(n.approved ?? c.models.length)}</b><span>本机允许列表</span></div>
        <div class="layer"><small>03 应用获权</small><b>${number(n.application_authorized)}</b><span>至少一个有效应用</span></div>
        <div class="layer"><small>04 历史能力</small><b>${number(n.historically_verified)}</b><span>当前配置 · 历史</span></div></div></div>
      <div class="d-section"><h3>模型目录与启用 ${badge(editable ? (DEMO ? "演示 · 可切换" : "可管理启用状态") : "只读模式", editable ? "ok" : "", !editable)}</h3>
        <div class="model-toolbar"><label class="search-input">${icon("search", 15)}<input id="model-search" type="search" placeholder="搜索模型名称" value="${h(state.modelSearch)}" autocomplete="off" aria-label="搜索模型"></label>
        <div class="segments" role="group" aria-label="启用状态">${[["all", "全部"], ["approved", "已启用"], ["disabled", "未启用"]].map(([k, t]) => `<button data-scope="${k}" class="${state.modelScope === k ? "active" : ""}">${t}</button>`).join("")}</div><span id="model-count" class="panel-sub"></span></div>
        ${statusMsg || `<div id="model-status" class="status-line" hidden></div>`}<div id="model-confirm" class="confirm" hidden></div>
        <div class="model-list">${models.map((m) => `<div class="model-item ${m.approved ? "on" : ""}" data-model-row="${h(m.id)}" data-approved="${m.approved}">
          <div><div class="m-name">${h(m.id)}</div><div class="m-meta">${m.default ? badge("默认模型", "grad", true) : ""}${badge(m.discovery === "listed" ? (c.discovery?.current ? "目录中" : "旧目录") : m.discovery === "not_in_catalog" ? "目录未列出" : "目录未知", m.discovery === "not_in_catalog" ? "warn" : "", true)}${badge(m.effective_applications.length ? `${m.effective_applications.length} 个应用获权` : "无有效授权", m.effective_applications.length ? "info" : "", true)}<span class="panel-sub">策略匹配 ${m.authorized_applications.length} 个应用</span></div></div>
          ${editable ? `<button class="switch ${state.modelBusy ? "busy" : ""}" role="switch" aria-checked="${m.approved}" aria-label="${m.approved ? "禁用" : "启用"} ${h(m.id)}" data-model-action="${h(m.id)}" ${state.modelBusy ? "disabled" : ""}></button>` : badge(m.approved ? "已启用" : "未启用", m.approved ? "ok" : "")}
          <div class="m-evidence">${m.verification.length ? m.verification.map((e) => `<span class="evidence ${e.state === "success" ? "ok" : e.state === "failed" ? "bad" : ""}" title="${h(e.request_id || "")}">${e.capability === "text_stream" ? "文本 SSE" : e.capability === "text_nonstream" ? "文本普通" : "能力范围未知"} · ${h(e.state === "unscoped" ? "范围未知" : label(e.state))} · ${h(ago(e.verified_at))}${e.account_access_observed === "rejected" ? " · 该次被拒绝" : ""}</span>`).join("") : `<span>尚无模型级证据</span>`}</div>
        </div>`).join("")}</div>
        <p id="model-none" class="panel-sub" hidden>没有匹配的模型。</p>
        <p class="d-note">启用只改变本地资源池，应用策略继续独立生效；不会设置默认模型、调用上游或改写应用白名单。禁用后不再接收该模型的新调用，已派发请求继续结算。</p></div>
      <div class="d-section"><h3>连接与授权</h3>${kv([["本地授权", authorizationText(c)], ["远端凭据有效性", "未知；未向供应商验证"], ["当前可用性", availabilityText(c)], ["本地阻碍", c.availability.blockers?.map((b) => BLOCKERS[b] || b).join("；") || "未发现已知本地阻碍"], ["历史验证", label(v.state)], ["验证时间", v.verified_at ? fullTime(v.verified_at) : "尚无记录"], ["历史验证模型", v.model || "未知"], ["默认模型", c.default_model || "未设置"], ["OAuth 访问到期", a.expires_at == null ? "不适用 / 未知" : fullTime(a.expires_at)], ["可用刷新凭据", a.refresh_available == null ? "不适用 / 未知" : a.refresh_available ? "本地存在" : "未提供"]])}
        <p class="d-note">当前 CLI 调用方获准模型：${h(c.client_allowed_models?.join("、") || "无")}</p></div>
      <div class="d-section"><h3>供应商额度 · 历史快照</h3>${kv([["当前剩余 Token", "未知"], ["历史快照", q.historical_snapshot ? label(q.state) : "未提供"], ["快照时间", q.checked_at ? fullTime(q.checked_at) : "尚无记录"], ["快照年龄", q.age_seconds == null ? "—" : ago(new Date(Date.now() - q.age_seconds * 1000))]])}
        ${q.windows?.length ? `<div class="quota-mini d-section">${q.windows.map((w) => `<div class="qm-row"><span>${h(w.name)}</span><span class="gw-bar"><i${css({ w: `${clamp((w.used_ratio || 0) * 100, 0, 100)}%` })}></i></span><b>${percent(w.used_ratio, 0)}</b></div>`).join("")}</div>` : ""}
        ${q.reported_counters?.length ? `<div class="table-wrap d-section"><table><thead><tr><th>窗口</th><th>单位</th><th class="num">上限 / 已用 / 剩余</th></tr></thead><tbody>${q.reported_counters.map((w) => `<tr><td>${h(w.window)}</td><td>${h(w.unit)}</td><td class="num">${h(w.limit ?? "未知")} / ${h(w.used ?? "未知")} / ${h(w.remaining ?? "未知")}</td></tr>`).join("")}</tbody></table></div>` : ""}
        <p class="d-note">历史成功仅对应当时的配置与模型。套餐快照是历史证据，供应商单位不换算为 Token；控制台不刷新 OAuth、不发现模型、不查询套餐或发起模型调用。</p></div>`;
    openDrawer("CONNECTION", html, { type: "connection", id });
    filterModels();
  }
  function filterModels() {
    let visible = 0;
    $$("[data-model-row]").forEach((row) => {
      row.hidden = !row.dataset.modelRow.toLowerCase().includes(state.modelSearch.toLowerCase()) || (state.modelScope !== "all" && (row.dataset.approved === "true") !== (state.modelScope === "approved"));
      if (!row.hidden) visible++;
    });
    if ($("#model-count")) $("#model-count").textContent = `${visible} 个模型`;
    if ($("#model-none")) $("#model-none").hidden = visible !== 0;
  }
  function modelMessage(message, failed = false) {
    const el = $("#model-status");
    if (!el) return;
    el.textContent = message; el.hidden = !message; el.classList.toggle("error", failed);
  }
  async function changeModel(modelId, clearDefault = false) {
    if (state.modelBusy || !canManage()) return;
    const id = state.detail?.id, c = state.snapshot.connections.find((x) => x.id === id), m = c?.model_catalog.models.find((x) => x.id === modelId);
    if (!m) return;
    if (m.approved && m.default && !clearDefault) {
      const box = $("#model-confirm");
      box.innerHTML = `<p><strong class="mono">${h(modelId)}</strong> 是当前默认模型。禁用会清除默认值，之后需显式指定模型或在 CLI 选择新默认。</p><div><button class="warn-button" data-model-confirm="${h(modelId)}">禁用并清除默认</button><button class="ghost-button" data-action="cancel-confirm">取消</button></div>`;
      box.hidden = false; $("[data-model-confirm]").focus();
      return;
    }
    state.modelBusy = true; $("#model-confirm").hidden = true;
    $$("[data-model-action],[data-model-confirm]").forEach((b) => { b.disabled = true; });
    const sw = $(`[data-model-action="${CSS.escape(modelId)}"]`);
    if (sw) { sw.classList.add("busy"); sw.setAttribute("aria-checked", String(!m.approved)); }
    modelMessage("正在保存模型启用设置…");
    const ctl = new AbortController(), deadline = setTimeout(() => ctl.abort(), 20000);
    let saved = false;
    try {
      const result = await postApproval({ connection_id: id, model: modelId, enabled: !m.approved, revision: c.model_catalog.approval_revision, clear_default: clearDefault }, ctl.signal);
      saved = true;
      state.modelBusy = false;
      const fresh = await refresh();
      if (!fresh) throw new Error("设置已保存，快照暂时未刷新；请刷新确认后再操作。");
      if ($("#drawer").open && state.detail?.id === id) { connectionDetails(id, true); modelMessage(`${modelId} 已${result.enabled ? "启用" : "禁用"}。应用权限保持不变。`); }
      toast(`${modelId} 已${result.enabled ? "启用" : "禁用"}`);
    } catch (error) {
      state.modelBusy = false;
      if (error.status === 401) gate(error.message);
      else if ($("#drawer").open && state.detail?.id === id) {
        if (error.status === 409 && (await refresh())) connectionDetails(id, true);
        else connectionDetails(id, true);
        modelMessage(error.name === "AbortError" ? "请求超时，结果尚未确认。请刷新查看，操作不会自动重试。" : error.message || "连接中断，请刷新确认操作结果。", true);
      } else notice(saved ? "模型设置已保存，请刷新查看。" : "模型操作结果未确认，请刷新查看。");
    } finally {
      clearTimeout(deadline); state.modelBusy = false;
      $$("[data-model-action],[data-model-confirm]").forEach((b) => { b.disabled = false; b.classList.remove("busy"); });
    }
  }

  function applicationDetails(id) {
    const a = state.snapshot?.applications.find((x) => x.id === id);
    if (!a) return;
    const p = a.policy, q = a.quota;
    const allowed = (v) => (v == null ? "未限定列表（仍受资源类型授权约束）" : v.length ? v.join("、") : "空列表：全部拒绝");
    const ratio = p.daily_token_limit ? q.charged_or_reserved_tokens / p.daily_token_limit : null;
    const html = `<div class="d-hero">${appAvatar(a, "lg")}<div><h2 id="drawer-title">${h(a.name)}</h2><p class="mono">${h(a.id)}</p></div></div>
      <div class="d-badges">${badge(a.active ? "令牌有效" : "令牌已撤销", a.active ? "ok" : "")}${badge(label(q.token_quota_state), tone(q.token_quota_state), true)}${badge(`创建于 ${time(a.created_at)}`, "", true)}</div>
      <div class="d-section"><h3>今日本地配额 · ${h(q.day)} UTC</h3>
        <div class="app-top"><div class="ring">${ring(ratio, 96, 9, ratio > 0.85 ? "warn" : "")}<div class="ring-text"><b>${q.token_quota_state === "unlimited" ? "∞" : ratio == null ? "?" : `${Math.round(ratio * 100)}%`}</b><small>已用或预留</small></div></div>
        ${kv([["日 Token 上限", p.daily_token_limit == null ? "未设上限" : number(p.daily_token_limit)], ["今日实际或预留", number(q.charged_or_reserved_tokens)], ["保守预留", number(q.estimated_reserved_tokens)], ["剩余 Token", q.token_quota_state === "unlimited" ? "未设上限" : number(q.remaining_tokens)]])}</div>
        ${kv([["日估算预算", p.daily_budget == null ? "未设上限" : money(p.daily_budget, p.budget_currency)], ["估算费用或预留", Object.entries(q.estimated_cost_or_reservation || {}).map(([cur, v]) => money(v, cur)).join("；") || "无已知金额"], ["未知费用请求", number(q.unknown_cost_requests)], ["账本在途请求", number(q.in_flight_requests)], ["未知用量请求", number(q.unknown_token_requests)], ["未纳入配额的旧记录", number(q.historical_requests_excluded)]])}</div>
      <div class="d-section"><h3>当前配置下获准的模型</h3>${a.effective_resources.length ? `<div class="model-list">${a.effective_resources.map((r) => { const c = state.snapshot.connections.find((x) => x.id === r.id); return `<div class="model-item"><div><div class="m-name">${h(r.name)}</div><div class="m-meta">${badge(label(r.resource_type), "", true)}</div></div>${c ? avatar(c.provider, c.name) : ""}<div class="m-evidence chips">${r.models.map((m) => `<span class="chip">${h(m)}</span>`).join("")}</div></div>`; }).join("")}</div>` : `<p class="panel-sub">无获准模型</p>`}
        <p class="d-note">此处为连接开启、模型启用与应用策略的交集；不代表供应商可用或额度足够。</p></div>
      <div class="d-section"><h3>访问策略</h3>${kv([["允许连接", allowed(p.allowed_connections)], ["允许模型", allowed(p.allowed_models)], ["Token Plan", p.allow_token_plans ? "明确允许" : "未授权"], ["ChatGPT 订阅", p.allow_chatgpt_subscriptions ? "明确允许" : "未授权"], ["并发上限", p.max_concurrent_requests ?? "未单独限制"], ["每分钟请求", p.requests_per_minute ?? "未单独限制"], ["单次输出上限", p.max_output_tokens ?? "未单独限制"], ["估算输入上限", p.max_estimated_input_tokens ?? "未单独限制"], ["订阅输出预留", p.chatgpt_output_reservation ?? "未配置"], ["撤销时间", a.revoked_at ? fullTime(a.revoked_at) : "未撤销"]])}
        <p class="d-note">本地配额包含实际消耗与保守预留，不等于供应商额度；无单独并发上限仍受全局限制。账本在途状态并非实时队列。不显示调用方令牌明文或摘要。</p></div>`;
    openDrawer("APPLICATION", html, { type: "application", id });
  }

  function recordDetails(index) {
    const r = state.rows?.items[index];
    if (!r) return;
    const total = r.duration_ms || 0, queue = Math.min(r.queue_ms || 0, total);
    const phases = total ? `<div class="phase"><div class="phase-bar"><i${css({ w: `${(queue / total) * 100}%`, c: "var(--warn)" })}></i><i${css({ w: `${((total - queue) / total) * 100}%`, c: "var(--accent-2)" })}></i></div>
      <div class="phase-legend"><span${css({ c: "var(--warn)" })}><i></i>排队 <b>${duration(r.queue_ms)}</b></span><span${css({ c: "var(--accent-2)" })}><i></i>上游与交付 <b>${duration(total - queue)}</b></span><span>端到端 <b>${duration(total)}</b></span></div></div>` : `<p class="panel-sub">耗时未知或尚未完成。</p>`;
    const conn = state.snapshot.connections.find((c) => c.id === r.connection_id);
    const html = `<div class="d-hero">${conn ? avatar(conn.provider, conn.name, "lg") : `<span class="avatar lg">?</span>`}<div><h2 id="drawer-title" class="mono">${h(r.model || "调用记录")}</h2><p class="mono">${h(r.request_id)}</p></div></div>
      <div class="d-badges">${badge(label(r.status), tone(r.status))}${r.http_status ? badge(`HTTP ${r.http_status}`, r.http_status >= 400 ? "warn" : "", true) : ""}${badge(appName(r.caller_id), "", true)}${badge(r.origin === "import" ? "导入历史" : "网关记录", "", true)}</div>
      <div class="d-section"><h3>耗时构成</h3>${phases}</div>
      <div class="d-section"><h3>上游 · 交付 · 最终</h3><div class="flow"><div><small>上游结果</small><b>${h(label(r.upstream_result))}</b><small>${r.upstream_attempts === 0 ? "本地拒绝，未发送" : `${number(r.upstream_attempts)} 次上游尝试 · ${r.upstream_status ?? "状态未知"}`}</small></div><div><small>下游交付</small><b>${h(label(r.delivery_status))}</b><small>${h(r.delivery_error_code || "无交付错误")}</small></div><div><small>最终状态</small><b>${h(label(r.status))}</b><small>${h(r.error_code || "无已记录错误")}</small></div></div></div>
      <div class="d-section"><h3>用量与费用</h3>${kv([["输入 Token", number(r.prompt_tokens)], ["输出 Token", number(r.completion_tokens)], ["总 Token", number(r.total_tokens)], ["用量一致性", label(r.usage_consistency)], ["用量已定稿", r.usage_final ? "是" : "否"], ["费用估算", r.cost?.estimated_cost == null ? "未知 / 未定价" : money(r.cost.estimated_cost, r.cost.currency)], ["费用口径", label(r.cost?.cost_status)], ["Token 依据", r.cost?.token_basis === "unknown_hold" ? "未知用量 · 保守预留" : r.cost?.token_basis || "—"]])}</div>
      <div class="d-section"><h3>元数据</h3>${kv([["应用", appName(r.caller_id)], ["连接", connName(r.connection_id)], ["资源类型", label(r.resource_type)], ["开始时间", fullTime(r.started_at)], ["结束时间", fullTime(r.finished_at)], ["错误代码", [r.error_code, r.upstream_error_code, r.delivery_error_code].filter(Boolean).join(" / ") || "无已记录错误"]])}
        <p class="d-note">仅展示调用元数据；原始错误正文、请求与响应内容、敏感凭据不会发送到浏览器。费用为历史价格快照估算，不是供应商账单。</p></div>`;
    openDrawer("REQUEST", html, { type: "record", id: r.request_id });
  }

  /* ======================================================================================
   * Command palette
   * ==================================================================================== */
  let paletteItems = [], paletteIndex = 0;
  function paletteSource() {
    const items = Object.entries(PAGES).map(([k, [name]], i) => ({ group: "页面", icon: { overview: "overview", resources: "resources", usage: "chart", applications: "apps", monitor: "pulse" }[k], text: name, hint: String(i + 1), run: () => navigate(k) }));
    const s = state.snapshot;
    if (s) {
      s.connections.forEach((c) => items.push({ group: "连接", icon: "layers", text: c.name, hint: `${label(c.resource_type)} · ${c.id}`, run: () => connectionDetails(c.id) }));
      s.applications.forEach((a) => items.push({ group: "应用", icon: "apps", text: a.name, hint: a.active ? "令牌有效" : "已撤销", run: () => applicationDetails(a.id) }));
    }
    items.push({ group: "操作", icon: "alert", text: "查看异常调用", hint: "用量分析 · 只看异常", run: () => navigate("usage", { errors: true }) });
    items.push({ group: "操作", icon: "refresh", text: "刷新数据", hint: "R", run: refresh });
    items.push({ group: "操作", icon: theme === "dark" ? "auto" : theme === "light" ? "moon" : "sun", text: "切换主题", hint: "跟随系统 / 浅色 / 深色", run: cycleTheme });
    if (!DEMO && LIVE_HOST) items.push({ group: "操作", icon: "flask", text: "进入演示模式", hint: "浏览器内模拟数据", run: enterDemo });
    return items;
  }
  function renderPalette() {
    const q = $("#palette-input").value.trim().toLowerCase();
    paletteItems = paletteSource().filter((it) => !q || `${it.text} ${it.hint} ${it.group}`.toLowerCase().includes(q));
    paletteIndex = clamp(paletteIndex, 0, Math.max(0, paletteItems.length - 1));
    let last = "", html = "";
    paletteItems.forEach((it, i) => {
      if (it.group !== last) { html += `<div class="palette-group">${h(it.group)}</div>`; last = it.group; }
      html += `<button class="palette-item ${i === paletteIndex ? "active" : ""}" data-palette="${i}" role="option" aria-selected="${i === paletteIndex}"><span class="p-icon">${icon(it.icon, 16)}</span>${h(it.text)}<small>${h(it.hint)}</small></button>`;
    });
    $("#palette-list").innerHTML = html || `<div class="palette-empty">没有匹配的结果</div>`;
    $(".palette-item.active")?.scrollIntoView({ block: "nearest" });
  }
  function openPalette() {
    if ($("#drawer").open) $("#drawer").close();
    $("#palette-input").value = ""; paletteIndex = 0; renderPalette();
    $("#palette").showModal(); $("#palette-input").focus();
  }
  function runPalette(i) { const it = paletteItems[i]; if (!it) return; $("#palette").close(); it.run(); }

  /* ======================================================================================
   * Toasts & tooltip
   * ==================================================================================== */
  function toast(message, error = false) {
    const el = document.createElement("div");
    el.className = `toast ${error ? "error" : ""}`;
    el.innerHTML = `${icon(error ? "alert" : "check", 16)}<span>${h(message)}</span>`;
    $("#toasts").append(el);
    setTimeout(() => { el.classList.add("out"); setTimeout(() => el.remove(), 320); }, 2600);
  }
  const tooltip = $("#tooltip");
  document.addEventListener("pointermove", (e) => {
    const target = e.target.closest?.("[data-tip]");
    if (!target || !tips.has(target.dataset.tip)) { tooltip.hidden = true; return; }
    if (tooltip.dataset.key !== target.dataset.tip) { tooltip.innerHTML = tips.get(target.dataset.tip); tooltip.dataset.key = target.dataset.tip; }
    tooltip.hidden = false;
    const w = tooltip.offsetWidth, hgt = tooltip.offsetHeight;
    const x = e.clientX + 16 + w > innerWidth ? e.clientX - w - 16 : e.clientX + 16;
    const y = clamp(e.clientY - hgt - 12, 8, innerHeight - hgt - 8);
    tooltip.style.setProperty("--tx", `${x}px`); tooltip.style.setProperty("--ty", `${y}px`);
  }, { passive: true });
  document.addEventListener("pointerleave", () => { tooltip.hidden = true; });

  /* ======================================================================================
   * Filters
   * ==================================================================================== */
  function applyFilters(period) {
    const params = new URLSearchParams();
    params.set("period", period || state.query.get("period") || "7d");
    for (const k of ["caller_id", "connection_id", "model"]) { const v = $(`#${k}`).value; if (v) params.set(k, v); }
    if (params.get("period") === "custom") {
      const start = new Date($("#since").value), end = new Date($("#until").value);
      if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start >= end || end - start > 366 * 86400000) { notice("请选择有效的开始和结束时间，范围不超过 366 天。"); return; }
      params.set("since", start.toISOString()); params.set("until", end.toISOString());
    }
    state.query = params; state.offset = 0;
    $$("[data-period]").forEach((b) => b.classList.toggle("active", b.dataset.period === params.get("period")));
    refresh();
  }
  function localInput(d) { const p = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; }

  /* ======================================================================================
   * Events
   * ==================================================================================== */
  function enterDemo() {
    DEMO = true; state.authorized = true;
    if (LIVE_HOST) replaceUrl(`${location.pathname}?demo`);
    $("#content").innerHTML = `<div class="loading"><span class="loader"><i></i><i></i><i></i></span><h2>正在生成演示工作空间</h2><p>约 3,000 条模拟调用，全部在浏览器本地完成。</p></div>`;
    refresh();
  }

  document.addEventListener("click", (e) => {
    const el = e.target.closest("button, tr[data-record]");
    if (!el) return;
    const d = el.dataset;
    if (d.view) navigate(d.view);
    else if (d.navigate) navigate(d.navigate);
    else if (d.metric) { state.metric = d.metric; render(); $(`[data-metric="${state.metric}"]`)?.focus(); }
    else if (d.connection) connectionDetails(d.connection);
    else if (d.application) applicationDetails(d.application);
    else if (d.record != null) recordDetails(Number(d.record));
    else if (d.modelAction) changeModel(d.modelAction);
    else if (d.modelConfirm) changeModel(d.modelConfirm, true);
    else if (d.scope) { state.modelScope = d.scope; $$("[data-scope]").forEach((b) => b.classList.toggle("active", b.dataset.scope === d.scope)); filterModels(); }
    else if (d.palette != null) runPalette(Number(d.palette));
    else if (d.period) {
      $("#custom-range").hidden = d.period !== "custom";
      if (d.period === "custom") {
        if (!$("#since").value) { const now = new Date(); $("#until").value = localInput(now); $("#since").value = localInput(new Date(now - 14 * 86400000)); }
        $$("[data-period]").forEach((b) => b.classList.toggle("active", b === el));
        notice("设置开始和结束时间后点击“应用”。当前图表仍使用上一次的筛选范围。");
      } else applyFilters(d.period);
    } else if (d.action === "toggle-errors") { state.errorsOnly = !state.errorsOnly; state.offset = 0; refresh(); }
    else if (d.action === "prev") { state.offset = Math.max(0, state.offset - 25); refresh(); }
    else if (d.action === "next") { state.offset += 25; refresh(); }
    else if (d.action === "cancel-confirm") $("#model-confirm").hidden = true;
    else if (d.action === "enter-demo") enterDemo();
    else if (d.action === "retry") location.reload();
  });
  $("#content").addEventListener("change", (e) => { if (e.target.id === "currency") { state.currency = e.target.value; render(); } });
  $("#drawer-content").addEventListener("input", (e) => { if (e.target.id === "model-search") { state.modelSearch = e.target.value; filterModels(); } });
  ["caller_id", "connection_id", "model"].forEach((k) => $(`#${k}`).addEventListener("change", () => applyFilters()));
  $("#apply-range").addEventListener("click", () => applyFilters("custom"));
  $("#reset-filters").addEventListener("click", () => { ["caller_id", "connection_id", "model"].forEach((k) => { $(`#${k}`).value = ""; }); $("#custom-range").hidden = true; applyFilters("7d"); });
  $("#refresh").addEventListener("click", () => refresh());
  $("#theme").addEventListener("click", cycleTheme);
  $("#open-palette").addEventListener("click", openPalette);
  $("#close-drawer").addEventListener("click", () => $("#drawer").close());
  $("#drawer").addEventListener("close", () => { state.detail = null; });
  for (const dlg of [$("#drawer"), $("#palette")]) {
    dlg.addEventListener("click", (e) => {
      if (e.target !== dlg) return;
      const r = dlg.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dlg.close();
    });
  }
  $("#palette-input").addEventListener("input", () => { paletteIndex = 0; renderPalette(); });
  $("#palette-input").addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); paletteIndex = Math.min(paletteItems.length - 1, paletteIndex + 1); renderPalette(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); paletteIndex = Math.max(0, paletteIndex - 1); renderPalette(); }
    else if (e.key === "Enter") { e.preventDefault(); runPalette(paletteIndex); }
  });
  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); $("#palette").open ? $("#palette").close() : openPalette(); return; }
    const typing = /^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement?.tagName || "") || $("#palette").open;
    if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === "/") { e.preventDefault(); openPalette(); }
    else if (/^[1-5]$/.test(e.key) && state.authorized) navigate(Object.keys(PAGES)[Number(e.key) - 1]);
    else if (e.key.toLowerCase() === "r" && state.authorized && !$("#drawer").open) refresh();
  });
  document.addEventListener("visibilitychange", () => { if (!document.hidden && state.authorized && !$("#drawer").open) refresh(); });
  let resizeTimer;
  addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { if (state.snapshot) { tips.clear(); redrawCharts(); } }, 150); });
  setInterval(() => {
    if (!document.hidden && state.authorized && !state.refreshing && !$("#drawer").open && !$("#palette").open && !$("#content").contains(document.activeElement)) refresh();
  }, 30000);

  /* ======================================================================================
   * Start
   * ==================================================================================== */
  applyTheme();
  async function start() {
    if (DEMO) { enterDemo(); return; }
    try {
      if (bootstrap) {
        saveSession(null);
        const body = JSON.stringify({ token: bootstrap });
        bootstrap = null;
        const response = await fetch("/api/session", { method: "POST", headers: { "Content-Type": "application/json" }, body, credentials: "omit", mode: "same-origin", redirect: "error", cache: "no-store" });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || "登录失败。");
        if (typeof result.session_token !== "string" || !result.session_token) throw new Error("管理会话无效，请重新运行 selark dashboard。");
        saveSession(result.session_token);
      }
      if (!adminSession) { gate(); return; }
      state.authorized = true;
      await refresh();
    } catch (error) { bootstrap = null; gate(error.message); }
  }
  start();
})();
