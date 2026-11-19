const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "../examples/v2");

function element() {
    const listeners = new Map();
    const classes = new Set();
    return {
        value: "", textContent: "", hidden: false, disabled: false, checked: false,
        attributes: {}, dataset: {}, children: [],
        classList: {
            contains: (name) => classes.has(name),
            remove: (name) => classes.delete(name),
            toggle(name, enabled) { if (enabled) classes.add(name); else classes.delete(name); }
        },
        setAttribute(name, value) { this.attributes[name] = value; },
        removeAttribute(name) { delete this.attributes[name]; if (name === "src") this.src = ""; },
        closest() { return this; },
        replaceChildren() { this.children = []; },
        appendChild(child) { this.children.push(child); },
        addEventListener(name, callback) {
            if (!listeners.has(name)) listeners.set(name, new Set());
            listeners.get(name).add(callback);
        },
        removeEventListener(name, callback) { listeners.get(name)?.delete(callback); },
        listenerCount(name) { return listeners.get(name)?.size || 0; },
        emit(name) {
            this[`on${name}`]?.({currentTarget: this});
            for (const callback of [...(listeners.get(name) || [])]) callback({currentTarget: this});
        }
    };
}

async function fixture(example, options = {}) {
    const nodes = {};
    const html = await fs.readFile(path.join(root, `streaming/${example}/${example}.html`), "utf8");
    for (const match of html.matchAll(/<\w+\b([^>]*\bid="([^"]+)"[^>]*)>/g)) {
        const node = element();
        node.hidden = /\bhidden\b/.test(match[1]);
        node.option = /\bdata-hls-option\b/.test(match[1]);
        nodes[match[2]] = node;
    }
    const video = nodes.remoteVideo;
    Object.assign(video, {
        src: "", plays: 0, pauses: 0, loads: 0, videoWidth: 1280, videoHeight: 720,
        canPlayType: () => options.nativeUnsupported ? "" : "maybe",
        play() { this.plays += 1; return options.playPromise || Promise.resolve(); },
        pause() { this.pauses += 1; this.emit("pause"); },
        load() { this.loads += 1; }
    });
    const players = [];
    class Hls {
        static Events = {MANIFEST_PARSED: "manifest", ERROR: "error"};
        static isSupported() { return !options.hlsUnsupported; }
        constructor(config) {
            this.config = config;
            this.callbacks = {};
            this.levels = [{height: 360, bitrate: 500000}, {height: 720, bitrate: 1500000}];
            this.currentLevel = -1;
            this.stops = 0;
            this.destroys = 0;
            players.push(this);
        }
        on(event, callback) { this.callbacks[event] = callback; }
        emit(event, data) { this.callbacks[event]?.(event, data); }
        loadSource(source) { this.source = source; if (options.loadError) throw new Error("source load failed"); }
        attachMedia(media) { this.video = media; }
        stopLoad() { this.stops += 1; }
        destroy() { this.destroys += 1; }
    }
    const timers = new Map();
    let timerId = 0;
    const body = element();
    const window = Object.assign(element(), {
        Hls, Flashphoner: {Browser: {isSafariWebRTC: () => !options.notSafari, isiOS: () => Boolean(options.ios)}},
        location: {protocol: "https:", hostname: "wcs.example", search: options.search || "",
            href: `https://wcs.example/client2/examples/v2/streaming/${example}/${example}.html${options.search || ""}`}
    });
    const document = {
        readyState: "complete", body,
        getElementById: (id) => nodes[id] || null,
        createElement: element,
        querySelectorAll: () => Object.values(nodes).filter((node) => node.option)
    };
    const context = vm.createContext({window, document, URL, URLSearchParams, console,
        setInterval(callback) { const id = ++timerId; timers.set(id, callback); return id; },
        clearInterval(id) { timers.delete(id); }
    });
    const modules = new Map();
    async function load(file) {
        if (modules.has(file)) return modules.get(file);
        const module = new vm.SourceTextModule(await fs.readFile(file, "utf8"), {context, identifier: file});
        modules.set(file, module);
        await module.link((specifier, reference) => load(path.resolve(path.dirname(reference.identifier), specifier)));
        return module;
    }
    const module = await load(path.join(root, `streaming/${example}/${example}.js`));
    await module.evaluate();
    return {nodes, video, players, timers, window, body, options,
        click() { assert.equal(nodes.applyBtn.disabled, false); nodes.applyBtn.onclick(); },
        flush: async () => { await Promise.resolve(); await Promise.resolve(); }
    };
}

test("HLS.js preserves LL loading policies, quality selection and repeated Stop/Play cleanup", async () => {
    const app = await fixture("hls-js-player", {search: "?llhls=true"});
    app.nodes.playStream.value = "sample";
    app.click();
    const player = app.players[0];
    assert.equal(player.source, "https://wcs.example:8445/sample/sample.m3u8");
    assert.equal(player.config.lowLatencyMode, true);
    assert.equal(player.config.liveSyncDuration, 0.5);
    assert.equal(player.config.liveMaxLatencyDuration, 5);
    assert.equal(player.config.fragLoadPolicy.default.errorRetry.maxNumRetry, 6);
    assert.equal(player.config.manifestLoadPolicy.default.timeoutRetry.maxNumRetry, 2);
    assert.equal(app.nodes.status.textContent, "LOADING");
    assert.equal(app.nodes.applyBtn.textContent, "Stop");
    assert.equal(app.nodes.fullLink.disabled, true);
    assert.equal(app.nodes.llHlsEnabled.disabled, true);
    player.emit("manifest");
    assert.equal(app.video.plays, 1);
    assert.equal(app.nodes.qualityBtns.children.length, 3);
    assert.equal(app.nodes.quality.hidden, true);
    app.video.emit("playing");
    assert.equal(app.nodes.status.textContent, "PLAYING");
    assert.equal(app.nodes.quality.hidden, false);
    assert.equal(app.timers.size, 1);
    assert.equal(new URL(app.nodes.permalink.href).searchParams.get("llhls"), "true");
    app.nodes.qualityBtns.children[1].onclick();
    assert.equal(player.currentLevel, 1);
    assert.equal(app.nodes.qualityBtns.children[1].attributes["aria-pressed"], "true");
    app.nodes.qualityBtns.children[2].onclick();
    assert.equal(player.currentLevel, -1);
    const stalePlaying = app.video.onplaying;
    app.click();
    assert.equal(player.stops, 1);
    assert.equal(player.destroys, 1);
    assert.equal(app.video.src, "");
    assert.equal(app.timers.size, 0);
    assert.equal(app.nodes.qualityBtns.children.length, 0);
    assert.equal(app.nodes.llHlsEnabled.disabled, false);
    assert.equal(app.nodes.status.textContent, "STOPPED");
    app.nodes.llHlsEnabled.checked = false;
    app.click();
    assert.equal(app.players.length, 2);
    assert.equal(app.players[1].config.lowLatencyMode, false);
    assert.equal(app.players[1].config.liveSyncDuration, undefined);
    stalePlaying();
    player.emit("manifest");
    player.emit("error", {fatal: true, details: "old request"});
    assert.equal(app.nodes.status.textContent, "LOADING");
    assert.equal(app.video.plays, 1);
    app.window.emit("pagehide");
    assert.equal(app.players[1].destroys, 1);
});

test("HLS.js fatal errors release the engine and permit retry while nonfatal errors keep playing", async () => {
    const app = await fixture("hls-js-player");
    app.nodes.fullLink.value = "https://media.example/test.m3u8";
    app.click();
    const player = app.players[0];
    player.emit("error", {fatal: false, details: "retrying"});
    assert.equal(player.destroys, 0);
    player.emit("error", {fatal: true, details: "manifestLoadError"});
    assert.equal(app.nodes.status.textContent, "FAILED");
    assert.match(app.nodes.info.textContent, /manifestLoadError/);
    assert.equal(app.nodes.applyBtn.textContent, "Play");
    assert.equal(app.nodes.fullLink.disabled, false);
    assert.equal(player.destroys, 1);
    app.click();
    assert.equal(app.players.length, 2);
    app.window.emit("pagehide");
});

test("HLS.js handles synchronous loading failures and unsupported browsers explicitly", async () => {
    const app = await fixture("hls-js-player", {loadError: true});
    app.nodes.playStream.value = "sample";
    app.click();
    assert.equal(app.nodes.status.textContent, "FAILED");
    assert.match(app.nodes.info.textContent, /source load failed/);
    assert.equal(app.players[0].destroys, 1);
    const unsupported = await fixture("hls-js-player", {hlsUnsupported: true});
    assert.equal(unsupported.nodes.applyBtn.disabled, true);
    assert.match(unsupported.nodes.info.textContent, /MSE/);
});

test("HLS.js ignores a rejected play promise after Stop", async () => {
    let reject;
    const app = await fixture("hls-js-player", {playPromise: new Promise((_resolve, fail) => { reject = fail; })});
    app.nodes.playStream.value = "sample";
    app.click();
    app.players[0].emit("manifest");
    app.click();
    reject(new Error("late play rejection"));
    await app.flush();
    assert.equal(app.nodes.status.textContent, "STOPPED");
    assert.equal(app.nodes.info.hidden, true);
});

for (const example of ["hls-js-player", "hls-native"]) {
    test(`${example} can resume after pausing before playback starts`, async () => {
        let reject;
        const app = await fixture(example, {playPromise: new Promise((_resolve, fail) => { reject = fail; })});
        app.nodes.playStream.value = "sample";
        app.click();
        const player = app.players[0];
        if (player) player.emit("manifest");
        else app.video.emit("loadedmetadata");
        assert.equal(app.video.plays, 1);

        app.video.pause();
        reject(new DOMException("Playback was interrupted by pause()", "AbortError"));
        await app.flush();
        assert.equal(app.nodes.status.textContent, "LOADING");
        assert.equal(app.nodes.info.hidden, true);
        assert.equal(app.nodes.applyBtn.textContent, "Stop");
        if (player) assert.equal(player.destroys, 0);
        else assert.equal(app.video.src, "https://wcs.example:8445/sample/sample.m3u8");

        app.options.playPromise = Promise.resolve();
        await app.video.play();
        app.video.emit("playing");
        assert.equal(app.nodes.status.textContent, "PLAYING");
        assert.equal(app.nodes.permalink.hidden, false);
        app.click();
        assert.equal(app.nodes.status.textContent, "STOPPED");
    });
}

test("Native HLS can stop before metadata and ignores callbacks from previous attempts", async () => {
    const app = await fixture("hls-native", {ios: true});
    app.nodes.playStream.value = "sample";
    app.click();
    assert.equal(app.nodes.status.textContent, "LOADING");
    assert.equal(app.nodes.applyBtn.textContent, "Stop");
    assert.equal(app.video.listenerCount("webkitendfullscreen"), 1);
    const staleMetadata = app.video.onloadedmetadata;
    const stalePlaying = app.video.onplaying;
    app.click();
    assert.equal(app.nodes.status.textContent, "STOPPED");
    assert.equal(app.video.listenerCount("webkitendfullscreen"), 0);
    assert.equal(app.video.src, "");
    staleMetadata();
    stalePlaying();
    assert.equal(app.video.plays, 0);
    app.click();
    app.video.emit("loadedmetadata");
    app.video.emit("playing");
    assert.equal(app.video.plays, 1);
    assert.equal(app.nodes.status.textContent, "PLAYING");
    assert.equal(app.timers.size, 1);
    assert.equal(app.nodes.permalink.hidden, false);
    app.video.emit("webkitendfullscreen");
    assert.equal(app.video.plays, 2);
    app.click();
    assert.equal(app.video.plays, 2, "Stop must not trigger the fullscreen pause-resume workaround");
    assert.equal(app.timers.size, 0);
    assert.equal(app.video.listenerCount("webkitendfullscreen"), 0);
});

test("Native HLS errors restore controls and allow another attempt", async () => {
    const app = await fixture("hls-native");
    app.nodes.playStream.value = "sample";
    app.click();
    app.video.error = {message: "The playlist was not found"};
    app.video.emit("error");
    assert.equal(app.nodes.status.textContent, "FAILED");
    assert.match(app.nodes.info.textContent, /playlist was not found/);
    assert.equal(app.nodes.applyBtn.textContent, "Play");
    assert.equal(app.nodes.playStream.disabled, false);
    assert.equal(app.video.src, "");
    app.click();
    app.video.emit("loadedmetadata");
    app.video.emit("playing");
    app.window.emit("pagehide");
    assert.equal(app.nodes.status.textContent, "STOPPED");
    assert.equal(app.timers.size, 0);
});

test("Native HLS autoplay stays muted with no statistics and rejects play failures visibly", async () => {
    const app = await fixture("hls-native", {
        search: "?autoplay=true&src=https%3A%2F%2Fmedia.example%2Ftest.m3u8"
    });
    assert.equal(app.video.src, "https://media.example/test.m3u8");
    assert.equal(app.video.muted, true);
    assert.equal(app.body.classList.contains("hls-autoplay"), true);
    app.video.emit("loadedmetadata");
    app.video.emit("playing");
    assert.equal(app.timers.size, 0);
    assert.equal(app.nodes.permalink.hidden, true);
    app.window.emit("pagehide");
    let reject;
    const failed = await fixture("hls-native", {playPromise: new Promise((_resolve, fail) => { reject = fail; })});
    failed.nodes.playStream.value = "sample";
    failed.click();
    failed.video.emit("loadedmetadata");
    reject(new Error("Playback permission denied"));
    await failed.flush();
    assert.equal(failed.nodes.status.textContent, "FAILED");
    assert.match(failed.nodes.info.textContent, /permission denied/);
});

test("Native HLS reports unsupported playback instead of leaving active controls", async () => {
    for (const options of [{nativeUnsupported: true}, {notSafari: true}]) {
        const app = await fixture("hls-native", options);
        assert.equal(app.nodes.status.textContent, "FAILED");
        assert.equal(app.nodes.applyBtn.disabled, true);
        assert.match(app.nodes.info.textContent, /native HLS playback/);
    }
});

test("HLS engines restore a complete manual player after failed muted autoplay", async () => {
    for (const example of ["hls-js-player", "hls-native"]) {
        let reject;
        const app = await fixture(example, {
            search: "?autoplay=true&src=https%3A%2F%2Fmedia.example%2Ftest.m3u8",
            playPromise: new Promise((_resolve, fail) => { reject = fail; })
        });
        if (example === "hls-js-player") app.players[0].emit("manifest");
        else app.video.emit("loadedmetadata");
        reject(new Error("Autoplay was blocked"));
        await app.flush();
        assert.equal(app.nodes.status.textContent, "FAILED");
        assert.equal(app.body.classList.contains("hls-autoplay"), false);
        app.options.playPromise = Promise.resolve();
        app.click();
        if (example === "hls-js-player") app.players[1].emit("manifest");
        else app.video.emit("loadedmetadata");
        app.video.emit("playing");
        assert.equal(app.video.muted, false);
        assert.equal(app.nodes.stats.hidden, false);
        assert.equal(app.timers.size, 1);
        app.window.emit("pagehide");
    }
});

test("HLS engines leave autoplay mode after an invalid source is corrected manually", async () => {
    for (const example of ["hls-js-player", "hls-native"]) {
        const app = await fixture(example, {search: "?autoplay=true&src=invalid-source"});
        assert.equal(app.nodes.status.textContent, "FAILED");
        assert.equal(app.body.classList.contains("hls-autoplay"), false);
        app.nodes.fullLink.value = "https://media.example/test.m3u8";
        app.click();
        if (example === "hls-js-player") app.players[0].emit("manifest");
        else app.video.emit("loadedmetadata");
        app.video.emit("playing");
        assert.equal(app.video.muted, false);
        assert.equal(app.nodes.stats.hidden, false);
        assert.equal(app.timers.size, 1);
        if (example === "hls-js-player") assert.equal(app.nodes.quality.hidden, false);
        app.window.emit("pagehide");
    }
});

test("HLS engines show manual replay controls when an autoplay stream ends", async () => {
    for (const example of ["hls-js-player", "hls-native"]) {
        const app = await fixture(example, {
            search: "?autoplay=true&src=https%3A%2F%2Fmedia.example%2Ftest.m3u8"
        });
        if (example === "hls-js-player") app.players[0].emit("manifest");
        else app.video.emit("loadedmetadata");
        app.video.emit("playing");
        app.video.emit("ended");
        assert.equal(app.nodes.status.textContent, "STOPPED");
        assert.equal(app.body.classList.contains("hls-autoplay"), false);
        assert.equal(app.nodes.applyBtn.textContent, "Play");
        assert.equal(app.video.src, "");
        app.click();
        if (example === "hls-js-player") app.players[1].emit("manifest");
        else app.video.emit("loadedmetadata");
        app.video.emit("playing");
        assert.equal(app.video.muted, false);
        assert.equal(app.nodes.stats.hidden, false);
        if (example === "hls-js-player") assert.equal(app.nodes.quality.hidden, false);
        app.window.emit("pagehide");
    }
});
