const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "../examples/v2");
const statuses = Object.fromEntries(["CONNECTED", "ESTABLISHED", "DISCONNECTED", "FAILED", "PENDING", "PLAYING", "STOPPED"].map((value) => [value, value]));
const streamEvents = {NOT_ENOUGH_BANDWIDTH: "NOT_ENOUGH_BANDWIDTH", UNMUTE_REQUIRED: "UNMUTE_REQUIRED", RESIZE: "RESIZE"};

function element(tagName = "DIV") {
    const handlers = new Map();
    return {
        tagName, value: "", textContent: "", hidden: false, disabled: false, style: {}, dataset: {}, children: [],
        parentElement: {dataset: {}, clientWidth: 640, clientHeight: 480},
        attributes: {}, classList: {toggle() {}}, clientWidth: 640, clientHeight: 480,
        addEventListener(name, callback) {
            if (!handlers.has(name)) handlers.set(name, new Set());
            handlers.get(name).add(callback);
        },
        removeEventListener(name, callback) { handlers.get(name)?.delete(callback); },
        emit(name) { [...(handlers.get(name) || [])].forEach((callback) => callback({target: this, currentTarget: this})); },
        listenerCount(name) { return handlers.get(name)?.size || 0; },
        setAttribute(name, value) { this.attributes[name] = value; },
        closest() { return this; },
        querySelectorAll() { return this.children.filter((child) => ["VIDEO", "CANVAS"].includes(child.tagName)); }
    };
}

async function fixture(example, options = {}) {
    const nodes = {};
    const html = await fs.readFile(path.join(root, `streaming/${example}/${example}.html`), "utf8");
    for (const match of html.matchAll(/<([a-z]+)\b([^>]*\bid="([^"]+)"[^>]*)>/g)) {
        nodes[match[3]] = element(match[1].toUpperCase());
        const value = match[2].match(/\bvalue="([^"]*)"/);
        if (value) nodes[match[3]].value = value[1];
        nodes[match[3]].disabled = /\bdisabled\b/.test(match[2]);
        nodes[match[3]].hidden = /\bhidden\b/.test(match[2]);
    }
    const mutationObservers = [];
    const resizeObservers = [];
    class Observer {
        constructor(callback, observers) { this.callback = callback; this.disconnects = 0; observers.push(this); }
        observe(target) { this.target = target; }
        disconnect() { this.disconnects += 1; }
    }
    class MutationObserver extends Observer {
        constructor(callback) { super(callback, mutationObservers); }
    }
    class ResizeObserver extends Observer {
        constructor(callback) { super(callback, resizeObservers); }
    }
    function replaceChildren(display, children) {
        for (const previous of display.children) previous.parentElement = null;
        display.children = children;
        for (const child of children) child.parentElement = display;
        for (const observer of mutationObservers) {
            if (observer.target === display && !observer.disconnects) {
                observer.callback([{type: "childList", target: display}]);
            }
        }
    }
    function removeMedia(stream) {
        const display = stream.settings.display;
        if (display.children.includes(stream.media)) {
            replaceChildren(display, display.children.filter((child) => child !== stream.media));
        }
        if (nodes[stream.id()] === stream.media) delete nodes[stream.id()];
    }
    const sessions = [];
    const streams = [];
    const calls = {sound: 0, preloader: 0};
    function eventSource(source) {
        source.callbacks = {};
        source.on = function (name, callback) { this.callbacks[name] = callback; return this; };
        source.emit = function (name, data = this) {
            this.state = name;
            // The SDK changes session state, fails its streams, then calls session listeners.
            if (this.sessionStreams && ["DISCONNECTED", "FAILED"].includes(name)) {
                for (const stream of this.sessionStreams) {
                    if (["FAILED", "STOPPED"].includes(stream.status())) continue;
                    stream.info = "Session does not exist";
                    stream.emit("FAILED");
                }
            }
            if (this.media && ["STOPPED", "FAILED"].includes(name)) removeMedia(this);
            this.callbacks[name]?.(data);
        };
        return source;
    }
    const api = {
        constants: {SESSION_STATUS: statuses, STREAM_STATUS: statuses, STREAM_EVENT: "STREAM_EVENT", STREAM_EVENT_TYPE: streamEvents},
        Browser: {
            isSafari: () => Boolean(options.safari),
            isiOS: () => Boolean(options.ios),
            isSafariWebRTC: () => Boolean(options.safari),
            isAndroidFirefox: () => Boolean(options.firefox)
        },
        init(settings) { calls.settings = settings; if (options.initError) throw new Error("SDK unavailable"); return Promise.resolve(); },
        getMediaProviders: () => [options.provider || "WebRTC"],
        getSessions: () => sessions.filter((session) => session.state === "ESTABLISHED"),
        playFirstSound() { calls.sound += 1; },
        playFirstVideo(display, local, url, controls) {
            calls.preloader += 1;
            calls.preloaderArgs = {display, local, url, controls};
            return options.preloaderError ? Promise.reject(new Error("gesture needed")) : Promise.resolve();
        },
        createSession(settings) {
            if (options.sessionError) throw new Error("Bad server URL");
            const session = eventSource({
                settings, sessionStreams: [], state: "CONNECTING", status() { return this.state; }, getServerUrl() { return settings.urlServer; },
                disconnect() { this.disconnects = (this.disconnects || 0) + 1; this.emit("DISCONNECTED"); },
                createStream(settings) {
                    if (options.streamError) throw new Error("Bad stream options");
                    const streamId = `media-${streams.length}`;
                    const media = element(options.provider === "WSPlayer" ? "CANVAS" : "VIDEO");
                    Object.assign(media, {parentElement: settings.display, videoWidth: 640, videoHeight: 480, width: 640, height: 480,
                        paused: true, muted: settings.unmutePlayOnStart === false, resumes: 0,
                        play() { this.resumes += 1; return Promise.resolve(); }});
                    replaceChildren(settings.display, [media]);
                    nodes[streamId] = media;
                    const stream = eventSource({
                        settings, media, state: "CREATED", plays: 0, stops: 0, volumes: [], unmuted: 0, info: "Stream not found",
                        status() { return this.state; }, id: () => streamId, getInfo() { return this.info; }, videoResolution: () => ({width: 640, height: 480}),
                        isRemoteAudioMuted() { return this.media.muted; },
                        unmuteRemoteAudio() { this.unmuted += 1; this.media.muted = false; this.media.emit("volumechange"); },
                        setVolume(value) { this.volumes.push(value); }, fullScreen() { this.fullscreens = (this.fullscreens || 0) + 1; },
                        play() { this.plays += 1; this.emit("PENDING"); return this; },
                        stop() { this.stops += 1; this.emit("STOPPED"); }
                    });
                    streams.push(stream);
                    session.sessionStreams.push(stream);
                    return stream;
                }
            });
            sessions.push(session);
            return session;
        }
    };
    const document = {readyState: "complete", getElementById: (id) => nodes[id] || null, addEventListener() {}};
    const window = {Flashphoner: api, location: {protocol: "https:", hostname: "test.example", search: options.search || ""},
        MutationObserver, ResizeObserver, addEventListener() {}, removeEventListener() {}};
    const context = vm.createContext({window, document, URLSearchParams, console: {log() {}, error() {}, warn() {}}, setTimeout, clearTimeout});
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
    await Promise.resolve();
    await Promise.resolve();
    return {nodes, sessions, streams, mutationObservers, resizeObservers, calls, api,
        async click(id) { assert.equal(nodes[id].disabled, false, `${id} must be enabled`); await nodes[id].onclick({currentTarget: nodes[id]}); },
        establish() { sessions.at(-1).emit("ESTABLISHED"); },
        event(stream, type, payload = {}) { stream.callbacks.STREAM_EVENT({type, payload}); },
        replaceMedia(stream, tagName, dimensions) {
            const media = Object.assign(element(tagName), {muted: false, paused: false,
                videoWidth: 0, videoHeight: 0, width: 640, height: 480, ...dimensions});
            stream.media = media;
            nodes[stream.id()] = media;
            replaceChildren(stream.settings.display, [media]);
            return media;
        }
    };
}

test("Player preserves provider, resolution, MSE query options and muted autoplay", async () => {
    const app = await fixture("player", {provider: "MSE", firefox: true,
        search: "?streamName=sample&mediaProvider=MSE&resolution=1280x720&autoplay=true&mseCutByIFrameOnly=true"});
    assert.equal(app.calls.settings.preferredMediaProvider, "MSE");
    assert.equal(app.calls.settings.receiverLocation, "../../dependencies/websocket-player/WSReceiver2.js");
    assert.equal(app.sessions.length, 1);
    assert.equal(app.nodes.volumeControl.value, 0);
    app.establish();
    const stream = app.streams[0];
    assert.deepEqual(JSON.parse(JSON.stringify(stream.settings.mediaConnectionConstraints)), {cutByIFrameOnly: "true"});
    assert.equal(stream.settings.playWidth, "1280");
    assert.equal(stream.settings.playHeight, "720");
    assert.equal(stream.settings.unmutePlayOnStart, false);
    stream.emit("PLAYING");
    assert.equal(stream.media.resumes, 1);
    assert.equal(app.nodes.playBtn.textContent, "Stop");
    assert.equal(app.nodes.volumeControl.disabled, false);
    app.event(stream, "UNMUTE_REQUIRED");
    assert.equal(app.nodes.unmute.hidden, false);
    await app.click("unmuteBtn");
    assert.equal(stream.unmuted, 1);
    assert.equal(app.nodes.volumeControl.value, 50);
    assert.equal(app.nodes.unmute.hidden, true);
});

test("Player volume and fullscreen controls affect the current stream; warnings and failures remain visible", async () => {
    const app = await fixture("player", {search: "?streamName=sample"});
    await app.click("playBtn");
    app.establish();
    const stream = app.streams[0];
    stream.emit("PLAYING");
    app.nodes.volumeControl.value = "80";
    app.nodes.volumeControl.emit("input");
    assert.equal(stream.volumes.at(-1), 80);
    await app.click("fullScreenBtn");
    assert.equal(stream.fullscreens, 1);
    app.event(stream, "NOT_ENOUGH_BANDWIDTH", {info: "1500000/500000"});
    assert.equal(app.nodes.bandwidthWarning.hidden, false);
    assert.match(app.nodes.bandwidthWarning.textContent, /500 kbps; stream: 1500 kbps/);
    stream.emit("FAILED");
    assert.equal(app.nodes.info.textContent, "Stream not found");
    assert.equal(app.nodes.info.hidden, false);
    assert.equal(app.nodes.status.textContent, "FAILED");
    assert.equal(app.nodes.playBtn.disabled, false);
    assert.equal(app.nodes.url.disabled, false);
    assert.equal(app.nodes.volumeControl.disabled, true);
});

test("Player stop releases media listeners, reuses its session and ignores delayed old stream events", async () => {
    const app = await fixture("player", {search: "?streamName=sample"});
    await app.click("playBtn");
    app.establish();
    const old = app.streams[0];
    old.emit("PLAYING");
    assert.equal(old.media.listenerCount("playing"), 1);
    await app.click("playBtn");
    assert.equal(old.media.listenerCount("playing"), 0);
    assert.ok(app.resizeObservers.every((observer) => observer.disconnects === 1));
    assert.equal(app.mutationObservers.length, 1);
    assert.equal(app.mutationObservers[0].disconnects, 0);
    await app.click("playBtn");
    assert.equal(app.sessions.length, 1);
    app.streams[1].emit("PLAYING");
    old.emit("FAILED");
    assert.equal(app.nodes.status.textContent, "PLAYING");
    assert.equal(app.nodes.playBtn.textContent, "Stop");
    app.sessions[0].emit("DISCONNECTED");
    app.streams[1].emit("PLAYING");
    assert.equal(app.nodes.playBtn.textContent, "Start");
    assert.equal(app.nodes.connectStatus.textContent, "DISCONNECTED");
});

test("Player Safari uses the preloader and native controls and resumes after leaving fullscreen", async () => {
    const app = await fixture("player", {safari: true, ios: true, search: "?streamName=sample"});
    assert.equal(app.nodes.fullScreen.hidden, true);
    assert.equal(app.nodes.volume.hidden, true);
    await app.click("playBtn");
    assert.equal(app.calls.preloader, 1);
    assert.equal(app.calls.preloaderArgs.local, false);
    assert.equal(app.calls.preloaderArgs.controls, true);
    app.establish();
    const stream = app.streams[0];
    assert.equal(stream.settings.useControls, true);
    assert.equal(app.nodes.preloader.hidden, false);
    stream.media.emit("playing");
    assert.equal(app.nodes.preloader.hidden, true);
    stream.media.emit("webkitendfullscreen");
    stream.media.emit("pause");
    assert.equal(stream.media.resumes, 2);
    stream.emit("PLAYING");
    await app.click("playBtn");
    assert.equal(stream.media.listenerCount("pause"), 0);
    assert.equal(stream.media.listenerCount("webkitendfullscreen"), 0);
});

test("Player Safari preloader rejection restores Start without opening a session", async () => {
    const app = await fixture("player", {safari: true, preloaderError: true, search: "?streamName=sample"});
    await app.click("playBtn");
    assert.equal(app.sessions.length, 0);
    assert.equal(app.nodes.playBtn.disabled, false);
    assert.equal(app.nodes.url.disabled, false);
    assert.equal(app.nodes.preloader.hidden, true);
    assert.equal(app.nodes.info.textContent, "gesture needed");
});

test("Player WSPlayer primes audio, fits canvas playback and hides the preloader when PLAYING", async () => {
    const app = await fixture("player", {provider: "WSPlayer", search: "?streamName=sample&resolution=640x480"});
    await app.click("playBtn");
    assert.equal(app.calls.sound, 1);
    app.establish();
    const stream = app.streams[0];
    stream.emit("PLAYING");
    assert.equal(app.nodes.preloader.hidden, true);
    stream.media.emit("resize");
    assert.equal(app.nodes.remoteVideo.style.width, "640px");
    assert.equal(app.nodes.remoteVideo.style.height, "480px");
});

for (const example of ["player", "2players"]) {
    test(`${example} keeps its display binding through metadata, media replacement and replay`, async () => {
        const app = await fixture(example, {search: "?streamName=sample"});
        const playButton = example === "player" ? "playBtn" : "playBtn1";
        const displayCount = example === "player" ? 1 : 2;
        assert.equal(app.mutationObservers.length, displayCount);
        await app.click(example === "player" ? "playBtn" : "connectBtn");
        app.establish();
        if (example === "2players") await app.click(playButton);
        const stream = app.streams[0];
        const video = stream.media;
        const display = stream.settings.display;
        const frame = display.parentElement;
        const originalObserver = app.resizeObservers[0];
        assert.equal(display.style.width, "640px");
        assert.equal(display.style.height, "480px");
        video.videoWidth = 1280;
        video.videoHeight = 720;
        video.emit("loadedmetadata");
        assert.equal(display.style.height, "360px");
        assert.equal(display.style.margin, "60px auto");
        frame.clientWidth = 320;
        frame.clientHeight = 240;
        originalObserver.callback();
        assert.equal(display.style.width, "320px");
        assert.equal(display.style.height, "180px");

        const canvas = app.replaceMedia(stream, "CANVAS", {width: 360, height: 640});
        assert.equal(display.style.width, "135px");
        assert.equal(display.style.height, "240px");
        assert.equal(originalObserver.disconnects, 1);
        assert.equal(video.listenerCount("loadedmetadata"), 0);
        assert.equal(video.listenerCount("resize"), 0);
        const movedDisplay = element();
        video.parentElement = movedDisplay;
        movedDisplay.style.width = "unchanged";
        originalObserver.callback();
        video.emit("loadedmetadata");
        assert.equal(movedDisplay.style.width, "unchanged", "removed media must ignore queued resize work");
        canvas.width = 1280;
        canvas.height = 720;
        canvas.emit("resize");
        assert.equal(display.style.width, "320px");
        assert.equal(display.style.height, "180px");

        stream.emit("PLAYING");
        await app.click(playButton);
        assert.ok(app.resizeObservers.every((observer) => observer.disconnects === 1));
        assert.equal(app.mutationObservers.length, displayCount);
        assert.ok(app.mutationObservers.every((observer) => observer.disconnects === 0));
        await app.click(playButton);
        assert.equal(app.sessions.length, 1);
        assert.equal(display.style.width, "320px");
        assert.equal(display.style.height, "240px");
        assert.equal(app.mutationObservers.length, displayCount);
        assert.equal(app.resizeObservers.at(-1).disconnects, 0);
    });
}

test("Two Players shares one session and stops or fails each playback independently", async () => {
    const app = await fixture("2players", {provider: "WSPlayer"});
    assert.equal(app.nodes.playBtn1.disabled, true);
    assert.equal(app.nodes.playBtn2.disabled, true);
    await app.click("connectBtn");
    app.establish();
    await app.click("playBtn1");
    await app.click("playBtn2");
    assert.equal(app.sessions.length, 1);
    assert.equal(app.calls.sound, 2);
    const [first, second] = app.streams;
    assert.equal(first.settings.name, "streamName1");
    assert.equal(second.settings.name, "streamName2");
    first.emit("PLAYING");
    second.emit("PLAYING");
    await app.click("playBtn1");
    assert.equal(first.stops, 1);
    assert.equal(second.stops, 0);
    assert.equal(app.nodes.playBtn1.textContent, "Play");
    assert.equal(app.nodes.playBtn2.textContent, "Stop");
    assert.equal(app.nodes.streamName2.disabled, true);
    await app.click("playBtn1");
    const replay = app.streams[2];
    replay.emit("PLAYING");
    first.emit("FAILED");
    assert.equal(app.nodes.status1.textContent, "PLAYING");
    second.emit("FAILED");
    assert.equal(app.nodes.error2.textContent, "Stream not found");
    assert.equal(app.nodes.playBtn2.textContent, "Play");
    assert.equal(app.nodes.playBtn1.textContent, "Stop");
});

test("Two Players disconnect releases media observers, retains display bindings and blocks delayed playback events", async () => {
    const app = await fixture("2players");
    await app.click("connectBtn");
    app.establish();
    await app.click("playBtn1");
    await app.click("playBtn2");
    app.streams.forEach((stream) => stream.emit("PLAYING"));
    await app.click("connectBtn");
    assert.ok(app.streams.every((stream) => stream.status() === "FAILED"));
    assert.equal(app.nodes.playBtn1.disabled, true);
    assert.equal(app.nodes.playBtn2.disabled, true);
    assert.equal(app.nodes.url.disabled, false);
    assert.equal(app.nodes.connectBtn.textContent, "Connect");
    assert.equal(app.nodes.connectError.hidden, true);
    assert.equal(app.nodes.error1.hidden, true);
    assert.equal(app.nodes.error2.hidden, true);
    assert.ok(app.resizeObservers.every((observer) => observer.disconnects === 1));
    assert.equal(app.mutationObservers.length, 2);
    assert.ok(app.mutationObservers.every((observer) => observer.disconnects === 0));
    app.streams.forEach((stream) => stream.emit("PLAYING"));
    assert.equal(app.nodes.playBtn1.disabled, true);
    assert.equal(app.nodes.status1.textContent, "STOPPED");
});

for (const example of ["player", "2players"]) {
    test(`${example} reports connection loss once, cleans active streams and ignores stale failures after reconnect`, async () => {
        for (const terminal of ["DISCONNECTED", "FAILED"]) {
            const app = await fixture(example, {search: "?streamName=sample"});
            const connectButton = example === "player" ? "playBtn" : "connectBtn";
            await app.click(connectButton);
            app.establish();
            if (example === "2players") {
                await app.click("playBtn1");
                await app.click("playBtn2");
            }
            const old = app.streams.slice();
            old.forEach((stream) => stream.emit("PLAYING"));
            app.sessions[0].emit(terminal);
            assert.ok(old.every((stream) => stream.status() === "FAILED"));
            assert.equal(app.nodes.connectStatus.textContent, terminal);
            assert.equal(app.nodes.connectError.textContent, terminal === "DISCONNECTED" ? "Connection to server lost." : "Connection failed.");
            assert.equal(app.nodes.url.disabled, false);
            assert.ok(app.resizeObservers.every((observer) => observer.disconnects === 1));
            assert.equal(app.mutationObservers.length, example === "player" ? 1 : 2);
            assert.ok(app.mutationObservers.every((observer) => observer.disconnects === 0));
            if (example === "player") {
                assert.equal(app.nodes.status.textContent, "STOPPED");
                assert.equal(app.nodes.info.hidden, true);
                assert.equal(app.nodes.playBtn.textContent, "Start");
            } else {
                for (const number of [1, 2]) {
                    assert.equal(app.nodes[`status${number}`].textContent, "STOPPED");
                    assert.equal(app.nodes[`error${number}`].hidden, true);
                    assert.equal(app.nodes[`playBtn${number}`].disabled, true);
                }
            }
            await app.click(connectButton);
            app.establish();
            if (example === "2players") await app.click("playBtn1");
            const replacement = app.streams.at(-1);
            replacement.emit("PLAYING");
            assert.equal(replacement.settings.display.style.width, "640px");
            assert.equal(replacement.settings.display.style.height, "480px");
            assert.equal(app.mutationObservers.length, example === "player" ? 1 : 2);
            assert.ok(app.mutationObservers.every((observer) => observer.disconnects === 0));
            old.forEach((stream) => stream.emit("FAILED"));
            app.sessions[0].emit("FAILED");
            assert.equal(app.nodes[example === "player" ? "status" : "status1"].textContent, "PLAYING");
            assert.equal(app.nodes.connectStatus.textContent, "ESTABLISHED");
            assert.equal(app.nodes.connectError.hidden, true);
        }
    });
}

test("both playback examples reject empty names and restore controls after connection exceptions", async () => {
    const player = await fixture("player", {sessionError: true});
    await player.click("playBtn");
    assert.equal(player.sessions.length, 0);
    assert.equal(player.nodes.streamName.attributes["aria-invalid"], "true");
    player.nodes.streamName.value = "sample";
    await player.click("playBtn");
    assert.equal(player.nodes.playBtn.disabled, false);
    assert.equal(player.nodes.connectError.textContent, "Bad server URL");
    assert.equal(player.nodes.connectStatus.textContent, "FAILED");
    const pair = await fixture("2players", {sessionError: true});
    await pair.click("connectBtn");
    assert.equal(pair.nodes.connectBtn.disabled, false);
    assert.equal(pair.nodes.url.disabled, false);
    assert.equal(pair.nodes.connectError.textContent, "Bad server URL");
});

test("both playback examples expose SDK initialization failures without enabling playback", async () => {
    for (const example of ["player", "2players"]) {
        const app = await fixture(example, {initError: true});
        assert.equal(app.nodes.notifyFatal.textContent, "SDK unavailable");
        assert.equal(app.nodes.notifyFatal.hidden, false);
        assert.equal(app.nodes[example === "player" ? "playBtn" : "connectBtn"].disabled, true);
    }
});

test("both playback examples restore playable controls when stream creation fails", async () => {
    const player = await fixture("player", {streamError: true, search: "?streamName=sample"});
    await player.click("playBtn");
    player.establish();
    assert.equal(player.nodes.playBtn.disabled, false);
    assert.equal(player.nodes.url.disabled, false);
    assert.equal(player.nodes.info.textContent, "Bad stream options");
    const pair = await fixture("2players", {streamError: true});
    await pair.click("connectBtn");
    pair.establish();
    await pair.click("playBtn1");
    assert.equal(pair.nodes.playBtn1.disabled, false);
    assert.equal(pair.nodes.streamName1.disabled, false);
    assert.equal(pair.nodes.error1.textContent, "Bad stream options");
    assert.equal(pair.nodes.playBtn2.disabled, false);
});

test("both playback examples show connection progress and an error when the connection closes before establishment", async () => {
    for (const example of ["player", "2players"]) {
        const app = await fixture(example, {search: "?streamName=sample"});
        await app.click(example === "player" ? "playBtn" : "connectBtn");
        assert.equal(app.nodes.connectStatus.textContent, "CONNECTING");
        app.sessions[0].emit("CONNECTED");
        assert.equal(app.nodes.connectStatus.textContent, "CONNECTED");
        app.sessions[0].emit("DISCONNECTED");
        assert.equal(app.nodes.connectError.textContent, "Connection closed before it was established.");
        assert.equal(app.nodes.connectError.hidden, false);
        assert.equal(app.nodes[example === "player" ? "playBtn" : "connectBtn"].disabled, false);
    }
});
