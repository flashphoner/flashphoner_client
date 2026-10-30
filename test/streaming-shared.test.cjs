const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "../examples/v2");
const examples = ["streamer/streamer", "player/player", "two_way_streaming/two_way_streaming",
    "firewall-traversal-streaming/firewall-traversal-streaming", "screen-sharing/screen-sharing", "2players/2players"];

async function loadHelpers(globals) {
    const context = vm.createContext({console: {error() {}}, URLSearchParams, ...globals});
    const modules = new Map();
    async function load(filename) {
        if (!modules.has(filename)) {
            const module = new vm.SourceTextModule(await fs.readFile(filename, "utf8"), {context, identifier: filename});
            modules.set(filename, module);
            await module.link((specifier, parent) => load(path.resolve(path.dirname(parent.identifier), specifier)));
        }
        return modules.get(filename);
    }
    const module = await load(path.join(root, "dependencies/js/streaming.js"));
    await module.evaluate();
    return module.namespace;
}

function errorDOM() {
    const error = {textContent: "", hidden: false};
    return {error, document: {readyState: "complete", getElementById: () => error}};
}

test("Invalid fields expose their error visually and to assistive technology, and clear both on revalidation", async () => {
    const classes = new Set();
    const group = {classList: {toggle(name, enabled) {
        if (enabled) classes.add(name);
        else classes.delete(name);
    }}};
    const field = {
        value: "", attributes: {},
        setAttribute(name, value) { this.attributes[name] = value; },
        closest(selector) {
            assert.equal(selector, ".control-group, .field-row");
            return group;
        }
    };
    const helpers = await loadHelpers({window: {}, document: {getElementById: () => field}});
    helpers.setInvalid("name", true);
    assert.equal(field.attributes["aria-invalid"], "true");
    assert.equal(classes.has("has-error"), true);
    helpers.setInvalid("name", false);
    assert.equal(field.attributes["aria-invalid"], "false");
    assert.equal(classes.has("has-error"), false);
    assert.equal(helpers.validateRequired("name"), false);
    assert.equal(field.attributes["aria-invalid"], "true");
    assert.equal(classes.has("has-error"), true);
    field.value = "sample";
    assert.equal(helpers.validateRequired("name"), true);
    assert.equal(field.attributes["aria-invalid"], "false");
    assert.equal(classes.has("has-error"), false);
});

test("Streaming initialization catches asynchronous SDK failures and leaves controls unbound", async () => {
    const {error, document} = errorDOM();
    let called = false;
    const helpers = await loadHelpers({document, window: {Flashphoner: {
        constants: {}, init: async () => { throw new Error("Media providers unavailable"); }
    }}});
    await helpers.initializeSDK(() => { called = true; });
    assert.equal(called, false);
    assert.equal(error.hidden, false);
    assert.equal(error.textContent, "Media providers unavailable");
});

test("Streaming initialization waits for the SDK and passes its API and options", async () => {
    const {document} = errorDOM();
    let resolve;
    let received;
    let called = false;
    const api = {constants: {}, init(options) { received = options; return new Promise((done) => { resolve = done; }); }};
    const helpers = await loadHelpers({document, window: {Flashphoner: api}});
    const options = {preferredMediaProvider: "MSE"};
    const pending = helpers.initializeSDK((value) => { assert.equal(value, api); called = true; }, options);
    assert.equal(called, false);
    resolve();
    await pending;
    assert.equal(called, true);
    assert.equal(received, options);
});

test("Missing SDK produces a fatal notice; initialization waits for DOM readiness", async () => {
    const {error, document} = errorDOM();
    const helpers = await loadHelpers({document, window: {}});
    await helpers.initializeSDK(() => assert.fail("Missing SDK callback"));
    assert.match(error.textContent, /not available/);
    let handler;
    document.readyState = "loading";
    document.addEventListener = (name, callback, options) => {
        assert.equal(name, "DOMContentLoaded"); assert.equal(options.once, true); handler = callback;
    };
    error.textContent = "";
    helpers.initializeSDK(() => assert.fail("Missing SDK callback"));
    assert.equal(error.textContent, "");
    await handler();
    assert.match(error.textContent, /not available/);
});

test("Dynamic media sizing removes observers on replacement and ignores queued work after cleanup", async () => {
    const frame = {clientWidth: 400, clientHeight: 300};
    const display = {parentElement: frame, style: {}, nodes: [], querySelectorAll() { return this.nodes; }};
    let mutation;
    const observers = [];
    function video() {
        return {parentElement: display, tagName: "VIDEO", videoWidth: 640, videoHeight: 480,
            handlers: new Map(), addEventListener(name, handler) { this.handlers.set(name, handler); },
            removeEventListener(name) { this.handlers.delete(name); }};
    }
    const window = {
        MutationObserver: class {
            constructor(callback) { mutation = callback; }
            observe() {}
            disconnect() {}
        },
        ResizeObserver: class {
            constructor(callback) { this.callback = callback; observers.push(this); }
            observe() {}
            disconnect() { this.disconnected = true; }
        }
    };
    const helpers = await loadHelpers({window, document: {}});
    const cleanup = helpers.bindResize(display);
    const first = video();
    display.nodes = [first]; mutation();
    assert.equal(observers.length, 1);
    assert.equal(display.style.width, "400px");
    display.nodes = [video()]; mutation();
    assert.equal(observers[0].disconnected, true);
    assert.equal(first.handlers.size, 0);
    assert.equal(observers.length, 2);
    cleanup(); cleanup(); mutation();
    assert.equal(observers[1].disconnected, true);
    assert.equal(display.nodes[0].handlers.size, 0);
    assert.equal(observers.length, 2);
});

test("Streaming pages have valid local module/style references and labelled controls", async () => {
    for (const stem of examples) {
        const filename = path.join(root, "streaming", stem + ".html");
        const html = await fs.readFile(filename, "utf8");
        assert.match(html, /name="viewport"/);
        assert.match(html, /id="notifyFatal"[^>]*role="alert"/);
        assert.match(html, /type="module"/);
        assert.doesNotMatch(html, /jquery|bootstrap/i);
        const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
        assert.equal(new Set(ids).size, ids.length, stem + " duplicate DOM ids");
        for (const match of html.matchAll(/(?:href|src)="([^"#]+)"/g)) {
            if (/^https?:|flashphoner\.js$/.test(match[1])) continue;
            await fs.access(path.resolve(path.dirname(filename), match[1]));
        }
        for (const match of html.matchAll(/<(?:input|select|textarea)\b[^>]*>/g)) {
            const tag = match[0];
            if (/type="hidden"/.test(tag)) continue;
            const id = tag.match(/\bid="([^"]+)"/)?.[1];
            assert.ok(/aria-label="[^"]+"/.test(tag) || (id && html.includes(`for="${id}"`)),
                stem + " unlabeled control: " + tag);
        }
    }
});

test("Media Devices and Streaming pages share an explicitly selected light or dark theme", async () => {
    const common = await fs.readFile(path.join(root, "dependencies/css/examples.css"), "utf8");
    const light = common.match(/:root\s*\{([^}]+)\}/)?.[1];
    const dark = common.match(/:root\[data-wcs-theme="dark"\]\s*\{([^}]+)\}/)?.[1];
    assert.ok(light, "The shared stylesheet defines the default light theme");
    assert.ok(dark, "Media Devices must receive the dark theme without importing Streaming layouts");
    assert.match(light, /color-scheme:\s*light\s*;/);
    assert.match(dark, /color-scheme:\s*dark\s*;/);
    for (const token of ["page-background", "surface", "field-background", "text", "muted", "border",
        "primary", "primary-text", "success", "danger", "disabled-button-background", "disabled-control-text"]) {
        const declaration = new RegExp(`--${token}:\\s*([^;]+);`);
        assert.ok(light.match(declaration), `Light theme defines ${token}`);
        assert.ok(dark.match(declaration), `Dark theme defines ${token}`);
        assert.notEqual(light.match(declaration)[1], dark.match(declaration)[1], `${token} adapts to the theme`);
    }
    for (const stem of [...examples, "media_devices_manager/media_device_manager"]) {
        const html = await fs.readFile(path.join(root, "streaming", stem + ".html"), "utf8");
        assert.match(html, /<html\b[^>]*data-wcs-theme="light"/, stem + " exposes the same theme selector");
        const stylesheet = html.match(/<link\b[^>]*href="([^"]+\.css)"/)?.[1];
        assert.ok(stylesheet, stem + " stylesheet");
        if (stylesheet.endsWith("/streaming.css")) {
            const css = await fs.readFile(path.resolve(root, "streaming", path.dirname(stem), stylesheet), "utf8");
            assert.match(css, /@import\s+url\("examples\.css"\)/, stem + " includes the shared palette");
        } else {
            assert.ok(stylesheet.endsWith("/examples.css"), stem + " includes the shared palette directly");
        }
    }
});

test("Player identifies its stream and connection status separately", async () => {
    const html = await fs.readFile(path.join(root, "streaming/player/player.html"), "utf8");
    assert.match(html, /role="status"[^>]*aria-live="polite"[^>]*><span class="status-prefix">Stream:<\/span>\s*<span id="status">/);
    assert.match(html, /role="status"[^>]*aria-live="polite"[^>]*><span class="status-prefix">Connection:<\/span>\s*<span id="connectStatus">/);
});
