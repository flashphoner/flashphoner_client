const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "../examples/v2");

async function example(stem, options = {}) {
    const directory = path.join(root, "streaming", stem);
    const html = await fs.readFile(path.join(directory, `${stem}.html`), "utf8");
    const nodes = new Map();
    for (const match of html.matchAll(/<(input|button|select|span|div|p)\b([^>]*\bid="([^"]+)"[^>]*)>/g)) {
        const [, tag, attributes, id] = match;
        const initialOption = tag === "select" && html.slice(match.index + match[0].length)
            .match(/^\s*<option value="([^"]*)">([^<]*)<\/option>/);
        const classes = new Set();
        const group = {classList: {toggle(name, enabled) { if (enabled) classes.add(name); else classes.delete(name); }}};
        nodes.set(id, {
            value: attributes.match(/\bvalue="([^"]*)"/)?.[1] ?? "",
            checked: /\bchecked\b/.test(attributes), disabled: /\bdisabled\b/.test(attributes),
            hidden: /\bhidden\b/.test(attributes), textContent: "", attributes: {},
            options: initialOption ? [{value: initialOption[1], textContent: initialOption[2]}] : [],
            parentElement: {dataset: {}},
            appendChild(option) { this.options.push(option); },
            setAttribute(name, value) { this.attributes[name] = value; },
            closest() { return group; }, querySelectorAll() { return []; },
            click() { if (!this.disabled) return this.onclick?.(); }
        });
    }
    const streams = [];
    const sessions = [];
    const timers = new Map();
    const deviceRequests = [];
    let timerId = 0;
    let now = 0;
    const statusNames = (values) => Object.fromEntries(values.map((value) => [value, value]));
    const api = {
        init() {},
        constants: {
            SESSION_STATUS: statusNames(["ESTABLISHED", "DISCONNECTED", "FAILED"]),
            STREAM_STATUS: statusNames(["PUBLISHING", "UNPUBLISHED", "PLAYING", "STOPPED", "FAILED"])
        },
        Browser: {
            isAndroid: () => Boolean(options.mobile), isiOS: () => false,
            isFirefox: () => options.browser === "Firefox", isSafari: () => options.browser === "Safari"
        },
        async getMediaDevices(...args) {
            deviceRequests.push(args);
            if (options.deviceError) throw new Error("Device permission denied");
            if (options.getMediaDevices) return options.getMediaDevices(deviceRequests.length);
            return {audio: [{id: "mic-1", label: "Microphone"}], video: [{id: "camera-1", label: "Camera"}]};
        },
        createSession(settings) {
            if (options.connectionThrow) throw new Error("Connection rejected");
            const handlers = {};
            const owned = [];
            const session = {
                settings, state: "CONNECTING", disconnectCount: 0,
                on(status, handler) { handlers[status] = handler; return this; },
                status() { return this.state; },
                emit(status) {
                    this.state = status;
                    if (["DISCONNECTED", "FAILED"].includes(status)) {
                        for (const stream of owned) {
                            if (!["FAILED", "STOPPED", "UNPUBLISHED"].includes(stream.status())) stream.emit("FAILED");
                        }
                    }
                    handlers[status]?.(this);
                },
                disconnect() { this.disconnectCount++; this.emit("DISCONNECTED"); },
                createStream(settings) {
                    if (options.streamThrow) throw new Error("Stream rejected");
                    const streamHandlers = {};
                    const track = {};
                    const stream = {
                        settings, state: "NEW", kind: null, stopCount: 0, track,
                        zoom: 1, zoomRequests: [], volumeRequests: [], fullscreenCount: 0,
                        on(status, handler) { streamHandlers[status] = handler; return this; },
                        status() { return this.state; }, name() { return settings.name; },
                        emit(status) { this.state = status; streamHandlers[status]?.(this); },
                        publish() { this.kind = "publish"; }, play() { this.kind = "play"; },
                        stop() {
                            this.stopCount++;
                            if (options.deferStop) this.state = "STOPPING";
                            else this.emit(this.kind === "publish" ? "UNPUBLISHED" : "STOPPED");
                        },
                        id() { return `video-${streams.indexOf(this)}`; },
                        getInfo() { return "Stream failed"; },
                        getStats(callback) { callback(this.stats); },
                        getZoomCapabilities() { return options.unsupportedZoom ? null : {min: 1, max: 4, step: 0.5, value: 1}; },
                        getZoom() { return this.zoom; },
                        async setZoom(value) {
                            this.zoomRequests.push(value);
                            if (options.zoomError) throw new Error("Zoom rejected");
                            this.zoom = value;
                        },
                        setVolume(value) { this.volumeRequests.push(value); },
                        fullScreen() { this.fullscreenCount++; }
                    };
                    streams.push(stream);
                    owned.push(stream);
                    nodes.set(stream.id(), {srcObject: {getVideoTracks: () => [track]}});
                    return stream;
                }
            };
            sessions.push(session);
            return session;
        }
    };
    const taskWindow = {
        Flashphoner: api,
        location: {protocol: "https:", hostname: "llcast.example", search: ""},
        WCS_SERVER_URL: "wss://selected-wcs.example:9443",
        crypto: {getRandomValues: (bytes) => bytes.fill(7)},
        setInterval(callback) { const id = ++timerId; timers.set(id, callback); return id; },
        clearInterval(id) { timers.delete(id); }
    };
    const context = vm.createContext({
        console, URL, URLSearchParams, Uint8Array,
        Date: class extends Date { static now() { return now; } },
        window: taskWindow,
        document: {readyState: "complete", getElementById: (id) => nodes.get(id), createElement: () => ({})}
    });
    const modules = new Map();
    async function moduleAt(filename) {
        if (!modules.has(filename)) {
            const module = new vm.SourceTextModule(await fs.readFile(filename, "utf8"), {context, identifier: filename});
            modules.set(filename, module);
            await module.link((specifier, importer) => moduleAt(path.resolve(path.dirname(importer.identifier), specifier)));
        }
        return modules.get(filename);
    }
    await (await moduleAt(path.join(directory, `${stem}.js`))).evaluate();
    await new Promise((resolve) => setImmediate(resolve));
    return {
        node: (id) => nodes.get(id), streams, sessions, timers, deviceRequests,
        tick(milliseconds = 1000) { now += milliseconds; for (const callback of timers.values()) callback(); },
        connect() { nodes.get("connectBtn").click(); sessions.at(-1)?.emit("ESTABLISHED"); }
    };
}

test("Zoom publishes the selected WCS stream and applies real camera zoom capabilities", async () => {
    const page = await example("stream-zoom");
    assert.equal(page.node("url").value, "wss://selected-wcs.example:9443/77777777");
    page.node("publishBtn").click();
    assert.equal(page.sessions[0].settings.urlServer, "wss://selected-wcs.example:9443");
    page.sessions[0].emit("ESTABLISHED");
    const publisher = page.streams[0];
    assert.equal(publisher.settings.constraints.video.zoom, true);
    assert.equal(publisher.settings.constraints.audio, true);
    publisher.emit("PUBLISHING");
    assert.equal(page.streams[1].settings.name, publisher.settings.name);
    assert.equal(page.node("zoom").min, 1);
    assert.equal(page.node("zoom").max, 4);
    assert.equal(page.node("zoom").step, 0.5);
    page.node("zoom").value = "2.5";
    await page.node("zoom").oninput();
    assert.deepEqual(publisher.zoomRequests, [2.5]);
    assert.equal(page.node("zoomInfo").textContent, "Zoom: 2.5");
    page.node("publishBtn").click();
    assert.equal(publisher.stopCount, 1);
    assert.equal(page.streams[1].stopCount, 1);
    assert.equal(page.node("zoom").disabled, true);
    assert.equal(page.node("zoom").oninput, null);
});

test("Zoom remains a working publisher when camera zoom is unsupported", async () => {
    const page = await example("stream-zoom", {unsupportedZoom: true});
    page.node("publishBtn").click();
    page.sessions[0].emit("ESTABLISHED");
    page.streams[0].emit("PUBLISHING");
    assert.equal(page.streams.length, 2);
    assert.equal(page.node("zoom").disabled, true);
    assert.match(page.node("zoomInfo").textContent, /does not support zoom/);
    assert.equal(page.node("publishBtn").textContent, "Stop");
});

test("Zoom reports rejected camera constraints and resets the control to actual zoom", async () => {
    const page = await example("stream-zoom", {zoomError: true});
    page.node("publishBtn").click();
    page.sessions[0].emit("ESTABLISHED");
    page.streams[0].emit("PUBLISHING");
    page.node("zoom").value = "3";
    await page.node("zoom").oninput();
    assert.equal(page.node("zoomError").textContent, "Zoom rejected");
    assert.equal(page.node("zoom").value, 1);
    assert.equal(page.streams[0].stopCount, 0);
});

test("Zoom preview failure stops publication; late stream events cannot restart playback", async () => {
    const page = await example("stream-zoom");
    page.node("publishBtn").click();
    page.sessions[0].emit("ESTABLISHED");
    page.streams[0].emit("PUBLISHING");
    page.streams[1].emit("FAILED");
    assert.equal(page.streams[0].stopCount, 1);
    assert.equal(page.node("status").textContent, "FAILED");
    page.streams[0].emit("PUBLISHING");
    assert.equal(page.streams.length, 2);
    assert.equal(page.node("zoom").disabled, true);
});

test("MCU keeps camera capture hidden while preserving publication, conference playback, audio and controls", async () => {
    const page = await example("mcu_client");
    assert.equal(page.node("localVideoContainer").hidden, true);
    page.node("login").value = "alice";
    page.node("room").value = "room7";
    page.node("hasAudio").checked = false;
    page.node("joinBtn").click();
    assert.equal(page.sessions[0].settings.urlServer, "wss://selected-wcs.example:9443");
    page.sessions[0].emit("ESTABLISHED");
    assert.equal(page.streams[0].settings.name, "alice#room7");
    assert.equal(page.streams[0].settings.display, page.node("localVideo"));
    assert.equal(page.streams[0].settings.constraints.video, true);
    assert.equal(page.streams[0].settings.constraints.audio, false);
    assert.equal(page.streams[0].settings.receiveVideo, false);
    assert.equal(page.streams[0].settings.receiveAudio, false);
    page.streams[0].emit("PUBLISHING");
    assert.equal(page.streams[1].settings.name, "room7-aliceroom7");
    assert.equal(page.streams[1].settings.display, page.node("remoteVideo"));
    assert.equal(page.streams[1].settings.constraints.audio, false);
    page.streams[1].emit("PLAYING");
    assert.equal(page.node("localVideoContainer").hidden, true);
    assert.deepEqual(page.streams[1].volumeRequests, [50]);
    page.node("volume").value = "80";
    page.node("volume").oninput();
    await page.node("fullScreenBtn").click();
    assert.deepEqual(page.streams[1].volumeRequests, [50, 80]);
    assert.equal(page.streams[1].fullscreenCount, 1);
    page.node("joinBtn").click();
    assert.equal(page.streams[0].stopCount, 1);
    assert.equal(page.streams[1].stopCount, 1);
    assert.equal(page.sessions[0].disconnectCount, 1);
    assert.equal(page.node("volume").disabled, true);
    assert.equal(page.node("login").disabled, false);
});

test("MCU validates fields, allows cancelling connection and ignores late callbacks", async () => {
    const page = await example("mcu_client");
    page.node("joinBtn").click();
    assert.equal(page.sessions.length, 0);
    assert.equal(page.node("login").attributes["aria-invalid"], "true");
    page.node("login").value = "alice";
    page.node("room").value = "room7";
    page.node("url").value += "/not-a-server";
    page.node("joinBtn").click();
    assert.equal(page.sessions.length, 0);
    page.node("url").value = "wss://selected-wcs.example:9443";
    page.node("joinBtn").click();
    page.node("joinBtn").click();
    page.sessions[0].emit("ESTABLISHED");
    assert.equal(page.streams.length, 0);
    assert.equal(page.node("joinBtn").textContent, "Join");
});

test("MCU playback failure frees the publisher and restores join controls", async () => {
    const page = await example("mcu_client");
    page.node("login").value = "alice";
    page.node("room").value = "room7";
    page.node("joinBtn").click();
    page.sessions[0].emit("ESTABLISHED");
    page.streams[0].emit("PUBLISHING");
    page.streams[1].emit("FAILED");
    assert.equal(page.streams[0].stopCount, 1);
    assert.equal(page.node("status").textContent, "FAILED");
    assert.equal(page.node("preloader").hidden, true);
    assert.equal(page.node("joinBtn").textContent, "Join");
});

test("Mixer publishes screen then camera with mixer names and original capture constraints", async () => {
    const page = await example("screen-camera-mixer");
    page.node("url").value = "wss://selected-wcs.example:9443/s%203";
    page.node("useMixer").checked = true;
    page.node("mixerName").value = "mix7";
    page.node("videoInput").value = "camera-1";
    page.node("audioInput").value = "mic-1";
    page.connect();
    page.node("publishBtn").click();
    const screen = page.streams[0];
    assert.equal(screen.settings.name, "s 3-screen#mix7");
    assert.equal(page.sessions[0].settings.urlServer, "wss://selected-wcs.example:9443");
    assert.equal(screen.settings.constraints.video.type, "screen");
    assert.equal(screen.settings.constraints.video.withoutExtension, true);
    assert.equal(screen.settings.constraints.video.width, 1280);
    assert.equal(screen.settings.constraints.video.height, 720);
    assert.equal(screen.settings.constraints.video.frameRate, 5);
    assert.equal(page.streams.length, 1);
    screen.emit("PUBLISHING");
    const camera = page.streams[1];
    assert.equal(camera.settings.name, "s 3-camera#mix7");
    assert.equal(camera.settings.constraints.video.width, 640);
    assert.equal(camera.settings.constraints.video.frameRate, 24);
    assert.equal(camera.settings.constraints.video.deviceId.exact, "camera-1");
    assert.equal(camera.settings.constraints.audio.deviceId.exact, "mic-1");
    camera.emit("PUBLISHING");
    assert.equal(page.node("screenName").textContent, "s 3-screen#mix7");
    assert.equal(page.timers.size, 2);
    screen.track.onended();
    assert.equal(screen.stopCount, 1);
    assert.equal(camera.stopCount, 1);
    assert.equal(page.timers.size, 0);
    assert.equal(page.node("publishBtn").textContent, "Start");
});

for (const browser of ["Firefox", "Safari"]) {
    test(`Mixer retains ${browser} screen capture options`, async () => {
        const page = await example("screen-camera-mixer", {browser});
        page.connect();
        page.node("publishBtn").click();
        const settings = page.streams[0].settings;
        if (browser === "Firefox") assert.equal(settings.constraints.video.mediaSource, "screen");
        else assert.equal(settings.disableConstraintsNormalization, true);
    });
}

test("Mixer stats use elapsed time and are cleared when either publisher fails", async () => {
    const page = await example("screen-camera-mixer");
    page.connect();
    page.node("publishBtn").click();
    page.streams[0].emit("PUBLISHING");
    page.streams[1].emit("PUBLISHING");
    page.streams[0].stats = {outboundStream: {video: {bytesSent: 1000}}, otherStats: {availableOutgoingBitrate: 32000}};
    page.tick();
    page.streams[0].stats.outboundStream.video.bytesSent = 4000;
    page.tick(2000);
    assert.equal(page.node("screenBitrate").textContent, "Bitrate: 12000 bps");
    assert.equal(page.node("screenAvailableBitrate").textContent, "Available bitrate: 32000 bps");
    page.streams[1].emit("FAILED");
    assert.equal(page.streams[0].stopCount, 1);
    assert.equal(page.node("cameraStatus").textContent, "FAILED");
    assert.equal(page.timers.size, 0);
    assert.equal(page.node("screenBitrate").textContent, "");
});

test("Mixer waits for both server stop acknowledgements before allowing another publication", async () => {
    const page = await example("screen-camera-mixer", {deferStop: true});
    page.connect();
    page.node("publishBtn").click();
    page.streams[0].emit("PUBLISHING");
    page.streams[1].emit("PUBLISHING");
    page.node("publishBtn").click();
    assert.equal(page.node("publishBtn").disabled, true);
    assert.equal(page.node("publishBtn").textContent, "Stopping…");
    assert.equal(page.node("cameraFps").disabled, true);
    page.streams[0].emit("UNPUBLISHED");
    assert.equal(page.node("publishBtn").disabled, true);
    page.streams[1].emit("UNPUBLISHED");
    assert.equal(page.node("publishBtn").disabled, false);
    assert.equal(page.node("publishBtn").textContent, "Start");
    assert.equal(page.node("cameraFps").disabled, false);
});

test("Mixer rejects invalid capture values and empty mixer names before capture", async () => {
    const page = await example("screen-camera-mixer");
    page.connect();
    page.node("screenFps").value = "1.5";
    page.node("useMixer").checked = true;
    page.node("mixerName").value = "";
    page.node("publishBtn").click();
    assert.equal(page.streams.length, 0);
    assert.equal(page.node("screenFps").attributes["aria-invalid"], "true");
    assert.equal(page.node("mixerName").attributes["aria-invalid"], "true");
});

test("Mixer device enumeration failure keeps default capture available", async () => {
    const page = await example("screen-camera-mixer", {deviceError: true});
    assert.equal(page.node("deviceError").textContent, "Device permission denied");
    page.connect();
    page.node("publishBtn").click();
    page.streams[0].emit("PUBLISHING");
    assert.equal(page.streams[1].settings.constraints.audio, true);
    assert.equal(page.streams[1].settings.constraints.video.deviceId, undefined);
});

test("Mixer enumerates devices without requesting camera or microphone permission on load", async () => {
    const page = await example("screen-camera-mixer");
    assert.deepEqual(page.deviceRequests, [[null, false]]);
    assert.equal(page.sessions.length, 0);
    assert.equal(page.streams.length, 0);
});

test("Mixer preserves default options with hidden device IDs and lists devices after camera publication", async () => {
    const page = await example("screen-camera-mixer", {
        getMediaDevices: (request) => request === 1 ? {
            video: [{id: "", label: "camera1"}], audio: [{id: "", label: "microphone1"}]
        } : {
            video: [{id: "camera-2", label: "USB Camera"}], audio: [{id: "mic-2", label: "USB Microphone"}]
        }
    });
    const video = page.node("videoInput");
    const audio = page.node("audioInput");
    const defaultCamera = {value: "", textContent: "Default camera"};
    const defaultMicrophone = {value: "", textContent: "Default microphone"};
    assert.deepEqual(video.options, [defaultCamera]);
    assert.deepEqual(audio.options, [defaultMicrophone]);

    page.connect();
    page.node("publishBtn").click();
    page.streams[0].emit("PUBLISHING");
    const camera = page.streams[1];
    assert.equal(camera.settings.constraints.video.deviceId, undefined);
    assert.equal(camera.settings.constraints.audio, true);
    camera.emit("PUBLISHING");
    await new Promise((resolve) => setImmediate(resolve));

    assert.deepEqual(page.deviceRequests, [[null, false], [null, false]]);
    assert.deepEqual(video.options, [defaultCamera, {value: "camera-2", textContent: "USB Camera"}]);
    assert.deepEqual(audio.options, [defaultMicrophone, {value: "mic-2", textContent: "USB Microphone"}]);
});

for (const stem of ["stream-zoom", "mcu_client", "screen-camera-mixer"]) {
    test(`${stem} restores controls after a terminal SDK session failure`, async () => {
        const page = await example(stem);
        if (stem === "mcu_client") {
            page.node("login").value = "alice";
            page.node("room").value = "room7";
            page.node("joinBtn").click();
        } else if (stem === "stream-zoom") page.node("publishBtn").click();
        else page.node("connectBtn").click();
        page.sessions[0].emit("ESTABLISHED");
        if (stem === "screen-camera-mixer") page.node("publishBtn").click();
        page.streams[0].emit("PUBLISHING");
        page.sessions[0].emit("FAILED");
        assert.equal(page.node("url").disabled, false);
        assert.equal(page.node("status").textContent, "FAILED");
        assert.equal(page.node(stem === "mcu_client" ? "joinBtn" : stem === "stream-zoom" ? "publishBtn" : "connectBtn").disabled, false);
        assert.equal(page.timers.size, 0);
    });
}
