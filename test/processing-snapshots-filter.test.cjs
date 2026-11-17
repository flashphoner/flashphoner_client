const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "../examples/v2");

async function example(stem = "stream-snapshot") {
    const html = await fs.readFile(path.join(root, "streaming", stem, `${stem}.html`), "utf8");
    const nodes = new Map();
    for (const [, tag, attrs, id] of html.matchAll(/<(input|button|select|span|div|img|canvas)\b([^>]*\bid="([^"]+)"[^>]*)>/g)) {
        const listeners = {};
        const node = {
            tagName: tag.toUpperCase(), value: attrs.match(/\bvalue="([^"]*)"/)?.[1] ?? "",
            hidden: /\bhidden\b/.test(attrs), disabled: /\bdisabled\b/.test(attrs), textContent: "", attributes: {}, listeners, dataset: {},
            classList: {toggle() {}}, closest() { return {classList: {toggle() {}}}; },
            setAttribute(name, value) { this.attributes[name] = value; },
            addEventListener(name, callback) { listeners[name] = callback; },
            focus() { this.focused = true; },
            click() { if (!this.disabled) return this.onclick?.(); }
        };
        nodes.set(id, node);
    }
    if (nodes.has("filter")) nodes.get("filter").value = "0";
    const draws = [];
    const writes = [];
    let pixels = new Uint8ClampedArray([100, 150, 200, 255]);
    let canvasError;
    const context2d = {
        drawImage(...args) { if (canvasError) throw canvasError; draws.push(args); },
        getImageData() { return {data: pixels.slice()}; },
        putImageData(frame) { writes.push(Array.from(frame.data)); }
    };
    const video = {videoWidth: 1280, videoHeight: 720};
    const canvas = {width: 640, height: 360, getContext: () => context2d, querySelector: () => video};
    nodes.get("localVideo").querySelector = (selector) => selector === "canvas" ? canvas : video;
    if (nodes.has("snapshotCanvas")) Object.assign(nodes.get("snapshotCanvas"), {
        getContext: () => context2d,
        toDataURL: () => "data:image/png;base64,LOCAL_FRAME"
    });
    const sessions = [];
    const streams = [];
    const timers = new Map();
    const cleared = [];
    let timerIndex = 0;
    const statuses = (values) => Object.fromEntries(values.map((value) => [value, value]));
    const api = {
        constants: {
            SESSION_STATUS: statuses(["CONNECTED", "ESTABLISHED", "DISCONNECTED", "FAILED"]),
            STREAM_STATUS: statuses(["NEW", "PENDING", "PUBLISHING", "UNPUBLISHED", "PLAYING", "STOPPED", "FAILED", "SNAPSHOT_COMPLETE"]),
            STREAM_EVENT: "STREAM_EVENT", STREAM_EVENT_TYPE: statuses(["SNAPSHOT_COMPLETED", "SNAPSHOT_FAILED"]),
            STREAM_STATUS_INFO: {}, ERROR_INFO: {}
        },
        getMediaProviders: () => ["WebRTC"],
        createSession(options) {
            const handlers = {};
            const sessionStreams = [];
            let state = "CONNECTING";
            const session = {
                options, status: () => state,
                on(type, callback) { handlers[type] = callback; return this; },
                emit(type) {
                    state = type;
                    if (["DISCONNECTED", "FAILED"].includes(type)) {
                        for (const stream of sessionStreams) {
                            if (["PUBLISHING", "PLAYING", "PENDING"].includes(stream.status())) stream.emit("FAILED");
                        }
                    }
                    handlers[type]?.(this);
                },
                disconnect() { this.emit("DISCONNECTED"); },
                createStream(streamOptions) {
                    const streamHandlers = {};
                    let streamState = "NEW";
                    const stream = {
                        options: streamOptions, stopped: 0, snapshotCount: 0, info: "Stream failure",
                        name: () => streamOptions.name, status: () => streamState, getInfo() { return this.info; },
                        on(type, callback) { streamHandlers[type] = callback; return this; },
                        emit(type, payload) { if (type !== "STREAM_EVENT") streamState = type; streamHandlers[type]?.(payload ?? this); },
                        publish() { this.kind = "publish"; streamState = "PENDING"; },
                        play() { this.kind = "play"; streamState = "PENDING"; },
                        stop() {
                            this.stopped++;
                            this.emit(streamState === "NEW" ? "FAILED" : this.kind === "publish" ? "UNPUBLISHED" : "STOPPED");
                        },
                        snapshot() { this.snapshotCount++; },
                        available() { return new Promise((resolve, reject) => { this.resolve = resolve; this.reject = reject; }); }
                    };
                    streams.push(stream);
                    sessionStreams.push(stream);
                    return stream;
                }
            };
            sessions.push(session);
            return session;
        }
    };
    const taskWindow = {
        Flashphoner: api, WCS_SERVER_URL: "wss://selected-wcs.example:9443",
        location: {protocol: "https:", hostname: "panel.example", search: ""},
        crypto: {getRandomValues: (bytes) => bytes.fill(7)},
        setInterval(callback) { const id = ++timerIndex; timers.set(id, callback); return id; },
        clearInterval(id) { cleared.push(id); timers.delete(id); }
    };
    const context = vm.createContext({console, URL, URLSearchParams, Uint8Array, Map, Set, document: {getElementById: (id) => nodes.get(id)}, window: taskWindow});
    const helpers = new vm.SyntheticModule(["initializeSDK", "setStatus", "setError", "setInvalid", "validateRequired", "bindResize"], function () {
        this.setExport("initializeSDK", (callback) => callback(api));
        this.setExport("setStatus", (id, status) => { nodes.get(id).textContent = status; });
        this.setExport("setError", (id, message) => { nodes.get(id).textContent = message; nodes.get(id).hidden = !message; });
        this.setExport("setInvalid", (id, invalid) => nodes.get(id).setAttribute("aria-invalid", String(invalid)));
        this.setExport("validateRequired", (id) => Boolean(nodes.get(id).value.trim()));
        this.setExport("bindResize", () => () => {});
    }, {context});
    const modules = new Map();
    async function moduleAt(filename) {
        if (filename === path.join(root, "dependencies/js/streaming.js")) return helpers;
        if (modules.has(filename)) return modules.get(filename);
        const module = new vm.SourceTextModule(await fs.readFile(filename, "utf8"), {context, identifier: filename});
        modules.set(filename, module);
        await module.link((specifier, importer) => moduleAt(path.resolve(path.dirname(importer.identifier), specifier)));
        return module;
    }
    await (await moduleAt(path.join(root, "streaming", stem, `${stem}.js`))).evaluate();
    return {
        sessions, streams, timers, cleared, draws, writes, video, canvas, node: (id) => nodes.get(id),
        setPixels(value) { pixels = new Uint8ClampedArray(value); }, setCanvasError(error) { canvasError = error; },
        connect() { nodes.get(stem === "stream_filter" ? "connectBtn" : "publishBtn").click(); sessions.at(-1).emit("ESTABLISHED"); },
        publish() {
            if (stem === "stream_filter") nodes.get("publishBtn").click();
            streams.at(-1).emit("PUBLISHING");
            return streams.at(-1);
        },
        draw() { for (const callback of timers.values()) callback(); }
    };
}

for (const stem of ["stream-snapshot", "stream-local-snapshot"]) {
    test(`${stem}: validates combined stream address and uses selected WCS signaling`, async () => {
        const page = await example(stem);
        assert.equal(page.node("url").value, "wss://selected-wcs.example:9443/77777777");
        page.node("url").value = "wss://server:8443/bad%escape";
        page.node("publishBtn").click();
        assert.equal(page.sessions.length, 0);
        assert.equal(page.node("url").attributes["aria-invalid"], "true");
        page.node("url").value = "wss://server:8443/s%203";
        page.connect();
        assert.equal(page.sessions[0].options.urlServer, "wss://server:8443");
        const publisher = page.publish();
        assert.equal(publisher.options.name, "s 3");
        assert.equal(publisher.options.receiveAudio, false);
        assert.equal(page.node("snapshotBtn").disabled, false);
        page.node("publishBtn").click();
        assert.equal(publisher.stopped, 1);
        assert.equal(page.node("snapshotBtn").disabled, true);
        page.node("publishBtn").click();
        assert.equal(page.sessions.length, 1);
        assert.equal(page.streams.length, 2);
    });

    test(`${stem}: connection loss restores controls and stale events cannot affect a new run`, async () => {
        const page = await example(stem);
        page.connect();
        const publisher = page.publish();
        const old = page.sessions[0];
        old.emit("DISCONNECTED");
        assert.equal(page.node("status").textContent, "DISCONNECTED");
        assert.equal(page.node("url").disabled, false);
        assert.equal(page.node("publishBtn").disabled, false);
        page.connect();
        page.publish();
        old.emit("ESTABLISHED");
        old.emit("FAILED");
        publisher.emit("UNPUBLISHED");
        assert.equal(page.node("status").textContent, "PUBLISHING");
        assert.equal(page.node("snapshotBtn").disabled, false);
    });
}

test("Server Snapshot: renders returned PNG, reports failure and allows retry", async () => {
    const page = await example();
    page.connect();
    const publisher = page.publish();
    page.node("snapshotBtn").click();
    const snapshot = page.streams[1];
    assert.equal(snapshot.options.name, publisher.name());
    assert.equal(snapshot.snapshotCount, 1);
    assert.equal(page.node("snapshotStatus").textContent, "PROCESSING");
    assert.equal(page.node("snapshotBtn").disabled, true);
    snapshot.emit("STREAM_EVENT", {type: "SNAPSHOT_FAILED", payload: {info: "No keyframe"}});
    assert.equal(snapshot.stopped, 1);
    assert.equal(publisher.stopped, 0);
    assert.equal(page.node("snapshotError").textContent, "No keyframe");
    assert.equal(page.node("snapshotBtn").disabled, false);
    page.node("snapshotBtn").click();
    page.streams[2].emit("STREAM_EVENT", {type: "SNAPSHOT_COMPLETED", payload: {snapshot: "REAL_FRAME"}});
    assert.equal(page.streams[2].stopped, 1);
    assert.equal(publisher.stopped, 0);
    assert.equal(page.node("snapshotImg").src, "data:image/png;base64,REAL_FRAME");
    assert.equal(page.node("snapshotImg").hidden, false);
    assert.equal(page.node("snapshotStatus").textContent, "SNAPSHOT_COMPLETE");
    assert.equal(page.node("snapshotError").hidden, true);
    snapshot.emit("STREAM_EVENT", {type: "SNAPSHOT_COMPLETED", payload: {snapshot: "OLD_FRAME"}});
    assert.equal(page.node("snapshotImg").src, "data:image/png;base64,REAL_FRAME");
});

test("Server Snapshot: late response after stop cannot update the next publication", async () => {
    const page = await example();
    page.connect();
    page.publish();
    page.node("snapshotBtn").click();
    const oldSnapshot = page.streams[1];
    page.node("publishBtn").click();
    assert.equal(oldSnapshot.stopped, 1);
    page.node("publishBtn").click();
    page.publish();
    oldSnapshot.emit("STREAM_EVENT", {type: "SNAPSHOT_COMPLETED", payload: {snapshot: "OLD_FRAME"}});
    assert.equal(page.node("snapshotImg").hidden, true);
    assert.equal(page.node("snapshotBtn").disabled, false);
});

test("Client Snapshot: captures full native resolution and reports video-not-ready without a server request", async () => {
    const page = await example("stream-local-snapshot");
    page.connect();
    page.publish();
    page.video.videoWidth = 0;
    page.node("snapshotBtn").click();
    assert.match(page.node("snapshotError").textContent, /not ready/);
    page.video.videoWidth = 1280;
    page.node("snapshotBtn").click();
    assert.equal(page.node("snapshotCanvas").width, 1280);
    assert.equal(page.node("snapshotCanvas").height, 720);
    assert.deepEqual(page.draws[0], [page.video, 0, 0, 1280, 720]);
    assert.equal(page.node("snapshotImg").src, "data:image/png;base64,LOCAL_FRAME");
    assert.equal(page.node("snapshotError").hidden, true);
    assert.equal(page.streams.length, 1);
});

test("Stream Filter: publishes canvas frames with None, Sepia, Threshold and Invert", async () => {
    const page = await example("stream_filter");
    page.connect();
    const publisher = page.publish();
    assert.equal(publisher.options.useCanvasMediaStream, true);
    page.draw();
    assert.equal(page.draws.length, 1);
    assert.equal(page.writes.length, 0);
    page.node("filter").value = "3";
    page.draw();
    assert.deepEqual(page.writes.at(-1), [155, 105, 55, 255]);
    page.node("filter").value = "2";
    page.draw();
    assert.deepEqual(page.writes.at(-1), [255, 255, 255, 255]);
    page.setPixels([10, 10, 10, 255]);
    page.draw();
    assert.deepEqual(page.writes.at(-1), [0, 0, 0, 255]);
    page.setPixels([100, 150, 200, 255]);
    page.node("filter").value = "1";
    page.draw();
    assert.deepEqual(page.writes.at(-1), [192, 171, 134, 255]);
});

test("Stream Filter: independent playback and availability preserve publisher; stopping clears the draw timer", async () => {
    const page = await example("stream_filter");
    page.connect();
    const publisher = page.publish();
    page.node("playBtn").click();
    const player = page.streams[1];
    player.emit("PLAYING");
    const availability = page.node("availableBtn").click();
    page.streams[2].resolve();
    await availability;
    assert.equal(page.node("availableStatus").textContent, "AVAILABLE");
    assert.equal(page.streams[2].stopped, 1);
    assert.equal(page.streams[2].options.display, undefined);
    assert.equal(player.stopped, 0);
    page.node("playBtn").click();
    assert.equal(publisher.stopped, 0);
    assert.equal(page.timers.size, 1);
    const oldDraw = [...page.timers.values()][0];
    page.node("publishBtn").click();
    assert.equal(page.timers.size, 0);
    assert.equal(publisher.stopped, 1);
    oldDraw();
    assert.equal(page.draws.length, 0);
    page.node("publishBtn").click();
    page.publish();
    assert.equal(page.timers.size, 1);
    publisher.emit("UNPUBLISHED");
    assert.equal(page.timers.size, 1);
    page.node("connectBtn").click();
    assert.equal(page.timers.size, 0);
    assert.equal(page.node("connectStatus").textContent, "DISCONNECTED");
});

test("Stream Filter: rendering failures are visible and stop the timer", async () => {
    const page = await example("stream_filter");
    page.connect();
    page.publish();
    page.setCanvasError(new Error("Canvas is unavailable"));
    page.draw();
    assert.equal(page.timers.size, 0);
    assert.match(page.node("publishError").textContent, /Canvas is unavailable/);
    assert.equal(page.node("publishBtn").textContent, "Stop");
});

test("Stream Filter: editing the playback name releases a pending availability request", async () => {
    const page = await example("stream_filter");
    page.connect();
    const pending = page.node("availableBtn").click();
    const request = page.streams[0];
    page.node("playStream").value = "other-stream";
    page.node("playStream").listeners.input();
    assert.equal(request.stopped, 1);
    assert.equal(page.node("availableBtn").disabled, false);
    request.resolve();
    await pending;
    assert.equal(request.stopped, 1);
    assert.equal(page.node("availableStatus").textContent, "");
});

test("Stream Filter: stale availability and publication events cannot change a replacement connection", async () => {
    const page = await example("stream_filter");
    page.connect();
    const publisher = page.publish();
    const pending = page.node("availableBtn").click();
    const availability = page.streams[1];
    const session = page.sessions[0];
    session.emit("FAILED");
    assert.equal(page.timers.size, 0);
    assert.equal(page.node("publishBtn").disabled, true);
    assert.equal(page.node("connectBtn").disabled, false);
    page.connect();
    page.publish();
    availability.resolve();
    await pending;
    publisher.emit("PUBLISHING");
    session.emit("DISCONNECTED");
    assert.equal(page.node("availableStatus").textContent, "");
    assert.equal(page.node("connectStatus").textContent, "ESTABLISHED");
    assert.equal(page.node("publishStatus").textContent, "PUBLISHING");
    assert.equal(page.timers.size, 1);
});
