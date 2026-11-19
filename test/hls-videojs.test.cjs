const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "../examples/v2");

function element(tagName = "DIV") {
    const listeners = new Map();
    const attributes = new Map();
    return {
        tagName, value: "", hidden: false, disabled: false, textContent: "", children: [],
        addEventListener(event, handler) {
            if (!listeners.has(event)) listeners.set(event, new Set());
            listeners.get(event).add(handler);
        },
        removeEventListener(event, handler) { listeners.get(event)?.delete(handler); },
        emit(event) { for (const callback of listeners.get(event) || []) callback({currentTarget: this}); },
        setAttribute(key, value) { attributes.set(key, value); },
        getAttribute(key) { return attributes.get(key); },
        appendChild(child) { this.children.push(child); return child; },
        replaceChildren(...children) { this.children = children; },
        remove() { this.removed = true; }
    };
}

function eventSource(source = {}) {
    const callbacks = new Map();
    source.on = (name, handler) => {
        if (!callbacks.has(name)) callbacks.set(name, []);
        callbacks.get(name).push(handler);
        return source;
    };
    source.emit = (name) => { for (const handler of callbacks.get(name) || []) handler(); };
    return source;
}

async function fixture(options = {}) {
    const html = await fs.readFile(path.join(root, "streaming/hls-player/hls-player.html"), "utf8");
    const nodes = {};
    for (const [, tag, attributes, id] of html.matchAll(/<([a-z]+)\b([^>]*\bid="([^"]+)"[^>]*)>/g)) {
        nodes[id] = element(tag.toUpperCase());
        nodes[id].hidden = /\bhidden\b/.test(attributes);
        nodes[id].disabled = /\bdisabled\b/.test(attributes);
    }
    nodes.videojsInput.value = "videojs7";
    const calls = {assets: [], players: [], stats: [], fullscreen: [], permalinks: []};
    const windowEvents = new Map();
    const timers = new Map();
    let nextTimer = 1;
    const parameters = {src: options.src || "", version: options.version || null, autoplay: Boolean(options.autoplay)};
    const document = {
        readyState: "complete", getElementById: (id) => nodes[id], createElement: (tag) => element(tag.toUpperCase()),
        head: {appendChild(asset) {
            calls.assets.push(asset.src || asset.href);
            queueMicrotask(() => asset.emit(options.failAsset === (asset.src || asset.href) ? "error" : "load"));
        }}
    };
    const window = {
        addEventListener(name, handler) { windowEvents.set(name, handler); },
        videojs(video, settings) {
            const levels = eventSource([
                {height: 360, bitrate: 400000, enabled: true},
                {height: 720, bitrate: 1000000, enabled: true}
            ]);
            let currentTime = 125;
            const current = eventSource({
                settings, video, levels, plays: 0, disposals: 0,
                el: () => ({querySelector: () => video}),
                qualityLevels: () => levels,
                seekable: () => ({length: 1, start: () => 100, end: () => 140}),
                currentTime(value) { if (value !== undefined) currentTime = value; return currentTime; },
                liveTracker: {isLive: () => false, atLiveEdge: () => false, liveWindow: () => 40,
                    seekToLiveEdge() { currentTime = 140; }},
                src(value) { this.source = value; },
                error() { return this.failure; },
                play() { this.plays += 1; return this.playPromise || Promise.resolve(); },
                dispose() { this.disposals += 1; nodes.videoContainer.replaceChildren(); }
            });
            calls.players.push(current);
            return current;
        }
    };
    const context = vm.createContext({window, document, console, Promise, Map,
        setInterval(callback) { const id = nextTimer++; timers.set(id, callback); return id; },
        clearInterval(id) { timers.delete(id); }});
    const helpers = {
        readHlsParameters: () => parameters,
        initializeHlsPage(value) {
            if (options.initializationError) throw new Error("Invalid embedded HLS server URL");
            nodes.fullLink.value = value.src;
            calls.autoplay = Boolean(value.autoplay && value.src);
            return {autoplay: calls.autoplay};
        },
        getHlsSource: () => options.invalidSource ? "" : nodes.fullLink.value || "https://wcs.example:8445/sample/sample.m3u8",
        setHlsState(state, message = "") {
            calls.state = state;
            nodes.status.textContent = state;
            nodes.info.textContent = message;
            nodes.info.hidden = !message;
            nodes.applyBtn.textContent = ["LOADING", "PLAYING"].includes(state) ? "Stop" : "Play";
        },
        showHlsPermalink(source, extra) { calls.permalinks.push({source, extra}); },
        createPlaybackStats() {
            const stats = {starts: 0, stops: 0, start() { this.starts++; }, stop() { this.stops++; }};
            calls.stats.push(stats);
            return stats;
        },
        setNativeFullscreenHandlers(video, startFullscreen) {
            const registration = {video, startFullscreen, released: 0};
            calls.fullscreen.push(registration);
            return () => { registration.released++; };
        }
    };
    const common = new vm.SyntheticModule(Object.keys(helpers), function () {
        for (const [name, value] of Object.entries(helpers)) this.setExport(name, value);
    }, {context});
    const modules = new Map();
    async function load(file) {
        if (file.endsWith("/hls.js")) return common;
        if (modules.has(file)) return modules.get(file);
        const module = new vm.SourceTextModule(await fs.readFile(file, "utf8"), {context, identifier: file});
        modules.set(file, module);
        await module.link((specifier, reference) => load(path.resolve(path.dirname(reference.identifier), specifier)));
        return module;
    }
    await (await load(path.join(root, "streaming/hls-player/hls-player.js"))).evaluate();
    async function settle() { for (let i = 0; i < 12; i++) await Promise.resolve(); }
    await settle();
    return {nodes, calls, timers, options, settle,
        async click(id) { assert.equal(nodes[id].disabled, false, `${id} must be enabled`); nodes[id].onclick(); await settle(); },
        pagehide: () => windowEvents.get("pagehide")()
    };
}

test("VideoJS chooser loads version 7 and its quality plugin; playback preserves quality and seek controls", async () => {
    const app = await fixture();
    assert.deepEqual(app.calls.assets, []);
    await app.click("videojsBtn");
    assert.deepEqual(app.calls.assets, ["videojs7/video.js", "videojs7/video-js.css", "videojs7/videojs-contrib-quality-levels.js"]);
    assert.equal(app.nodes.applyBtn.disabled, false);
    assert.equal(app.nodes.videojsInputForm.hidden, true);
    await app.click("applyBtn");
    const current = app.calls.players.at(-1);
    assert.equal(current.source.src, "https://wcs.example:8445/sample/sample.m3u8");
    assert.deepEqual(Array.from(current.settings.playbackRates), [0.1, 0.25, 0.5, 1, 1.5, 2]);
    current.emit("playing");
    assert.equal(app.calls.state, "PLAYING");
    assert.equal(app.calls.permalinks[0].extra.version, "videojs7");
    assert.equal(app.calls.stats.at(-1).starts, 1);
    assert.equal(app.nodes.qualityBtns.children.length, 3);
    app.nodes.qualityBtns.children[1].onclick();
    assert.equal(current.levels[0].enabled, false);
    assert.equal(current.levels[1].enabled, true);
    app.nodes.qualityBtns.children.at(-1).onclick();
    assert.equal(current.levels[0].enabled, true);
    await app.click("backBtn30");
    assert.equal(current.currentTime(), 100, "rewind is clamped to the buffered window");
    await app.click("liveBtn");
    assert.equal(current.currentTime(), 140);
    await app.click("backBtn10");
    assert.equal(current.currentTime(), 130);
    await app.click("backBtnMax");
    assert.equal(current.currentTime(), 100);
    app.pagehide();
    assert.equal(current.disposals, 1);
    assert.equal(app.timers.size, 0);
});

test("VideoJS version 8 query autoplays muted without statistics or permalink and keeps iOS playback inline", async () => {
    const app = await fixture({version: "videojs8", src: "https://media.example/live.m3u8", autoplay: true});
    assert.deepEqual(app.calls.assets, ["videojs8/video.js", "videojs8/video-js.css"]);
    const current = app.calls.players.at(-1);
    assert.equal(current.source.src, "https://media.example/live.m3u8");
    assert.equal(current.settings.muted, true);
    assert.equal(app.calls.fullscreen.at(-1).startFullscreen, false);
    current.emit("playing");
    assert.equal(app.calls.permalinks.length, 0);
    assert.equal(app.calls.stats.at(-1).starts, 0);
    assert.equal(app.nodes.playbackControls.hidden, true);
    app.pagehide();
    assert.equal(app.calls.fullscreen.at(-1).released, 1);
});

test("VideoJS stop and retry dispose each player once and ignore delayed callbacks from the previous player", async () => {
    const app = await fixture({version: "videojs7"});
    await app.click("applyBtn");
    const old = app.calls.players.at(-1);
    old.emit("playing");
    const oldStats = app.calls.stats.at(-1);
    await app.click("applyBtn");
    assert.equal(old.disposals, 1);
    assert.equal(oldStats.stops, 1);
    assert.equal(app.calls.state, "STOPPED");
    assert.equal(app.timers.size, 0);
    await app.click("applyBtn");
    const next = app.calls.players.at(-1);
    next.emit("playing");
    old.failure = {code: 2, message: "Old network failure"};
    old.emit("error");
    old.emit("playing");
    assert.equal(app.calls.state, "PLAYING");
    next.failure = {code: 2, message: "HLS request failed"};
    next.emit("error");
    assert.equal(app.calls.state, "FAILED");
    assert.equal(app.nodes.info.textContent, "HLS request failed");
    assert.equal(next.disposals, 1);
});

test("VideoJS retries a decode failure once and leaves the second failure visible", async () => {
    const app = await fixture({version: "videojs8"});
    await app.click("applyBtn");
    const first = app.calls.players.at(-1);
    first.failure = {code: 3, message: "Decode failed"};
    first.emit("error");
    const retry = app.calls.players.at(-1);
    assert.notEqual(first, retry);
    assert.equal(retry.source.src, first.source.src);
    retry.failure = {code: 3, message: "Decode failed again"};
    retry.emit("error");
    assert.equal(app.calls.state, "FAILED");
    assert.equal(app.nodes.info.textContent, "Decode failed again");
});

test("VideoJS invalid versions do not load arbitrary assets or enter autoplay mode", async () => {
    const app = await fixture({version: "../../other", autoplay: true, src: "https://media.example/live.m3u8"});
    assert.equal(app.calls.autoplay, false);
    assert.equal(app.calls.assets.length, 0);
    assert.equal(app.nodes.videojsInputForm.hidden, false);
    assert.match(app.nodes.videojsError.textContent, /Unknown VideoJS version/);
});

test("VideoJS library load failure restores the chooser for another attempt", async () => {
    const app = await fixture({failAsset: "videojs7/video.js"});
    await app.click("videojsBtn");
    assert.match(app.nodes.videojsError.textContent, /Can't load videojs7\/video.js/);
    assert.equal(app.nodes.videojsInput.disabled, false);
    app.nodes.videojsInput.value = "videojs8";
    await app.click("videojsBtn");
    assert.equal(app.nodes.playerPage.hidden, false);
    assert.equal(app.nodes.videojsInputForm.hidden, true);
});

test("VideoJS failed autoplay returns to normal unmuted playback with statistics on manual retry", async () => {
    const app = await fixture({version: "videojs8", src: "https://media.example/live.m3u8", autoplay: true});
    const failed = app.calls.players.at(-1);
    failed.failure = {code: 2, message: "Network failed"};
    failed.emit("error");
    await app.click("applyBtn");
    const retried = app.calls.players.at(-1);
    assert.equal(retried.settings.muted, false);
    retried.emit("playing");
    assert.equal(app.calls.stats.at(-1).starts, 1);
    assert.equal(app.calls.permalinks.length, 1);
    app.pagehide();
});

test("VideoJS invalid autoplay source can be corrected for normal playback", async () => {
    const options = {version: "videojs8", src: "invalid", autoplay: true, invalidSource: true};
    const app = await fixture(options);
    options.invalidSource = false;
    app.nodes.fullLink.value = "https://media.example/live.m3u8";
    await app.click("applyBtn");
    const current = app.calls.players.at(-1);
    assert.equal(current.settings.muted, false);
    current.emit("playing");
    assert.equal(app.calls.stats.at(-1).starts, 1);
    app.pagehide();
});

test("VideoJS malformed embedded server URL leaves a visible initialization error", async () => {
    const app = await fixture({initializationError: true});
    assert.equal(app.calls.assets.length, 0);
    assert.match(app.nodes.videojsError.textContent, /Invalid embedded HLS server URL/);
    assert.equal(app.nodes.videojsBtn.disabled, true);
});

test("VideoJS autoplay end of stream permits normal manual replay", async () => {
    const app = await fixture({version: "videojs8", src: "https://media.example/recording.m3u8", autoplay: true});
    const ended = app.calls.players.at(-1);
    ended.emit("playing");
    ended.emit("ended");
    assert.equal(app.calls.state, "STOPPED");
    assert.equal(ended.disposals, 1);
    assert.equal(app.timers.size, 0);
    await app.click("applyBtn");
    const replay = app.calls.players.at(-1);
    assert.equal(replay.settings.muted, false);
    replay.emit("playing");
    assert.equal(app.calls.stats.at(-1).starts, 1);
    assert.equal(app.nodes.playbackControls.hidden, false);
    app.pagehide();
});
