const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "../examples/v2");

async function example(stem = "streamer", options = {}) {
    const html = await fs.readFile(path.join(root, "streaming", stem, `${stem}.html`), "utf8");
    const nodes = new Map();
    for (const match of html.matchAll(/<(input|button|select|span|div|p|a)\b([^>]*\bid="([^"]+)"[^>]*)>/g)) {
        const [, tag, attributes, id] = match;
        const classes = new Set();
        const validationGroup = {classList: {
            toggle(name, enabled) {
                if (enabled) classes.add(name);
                else classes.delete(name);
            },
            contains(name) { return classes.has(name); }
        }};
        nodes.set(id, {
            value: attributes.match(/\bvalue="([^"]*)"/)?.[1] ?? "",
            checked: /\bchecked\b/.test(attributes), disabled: /\bdisabled\b/.test(attributes),
            hidden: /\bhidden\b/.test(attributes), textContent: "", attributes: {},
            options: tag === "select" ? [{value: ""}] : [],
            appendChild(option) { this.options.push(option); },
            setAttribute(name, value) { this.attributes[name] = value; },
            removeAttribute(name) { delete this.attributes[name]; },
            closest() { return validationGroup; },
            focus() { this.focused = true; },
            querySelector() { return null; },
            click() { if (!this.disabled) return this.onclick?.(); }
        });
    }
    const sessions = [];
    const streams = [];
    const intervals = [];
    const installed = [];
    const opened = [];
    const track = {};
    let initOptions;
    let mediaRequests = 0;
    const browserName = options.browser ?? "Chrome";
    const statuses = (values) => Object.fromEntries(values.map((value) => [value, value]));
    const api = {
        constants: {
            SESSION_STATUS: statuses(["ESTABLISHED", "DISCONNECTED", "FAILED"]),
            STREAM_STATUS: statuses(["PUBLISHING", "UNPUBLISHED", "PLAYING", "STOPPED", "FAILED"])
        },
        Browser: {
            isChrome: () => browserName === "Chrome", isFirefox: () => browserName === "Firefox",
            isSafari: () => browserName === "Safari", isAndroid: () => Boolean(options.mobile), isiOS: () => false
        },
        firefoxScreenSharingExtensionInstalled: options.firefoxExtension ?? true,
        getMediaDevices: async () => {
            mediaRequests++;
            return {audio: [{id: "mic-1", label: "USB microphone"}, {id: "mic-1", label: "duplicate"}]};
        },
        createSession(sessionOptions) {
            const handlers = {};
            const sessionStreams = [];
            const session = {
                options: sessionOptions, state: "CONNECTING", status() { return this.state; },
                on(status, callback) { handlers[status] = callback; return this; },
                emit(status) {
                    this.state = status;
                    // Match SDK ordering: terminal session status, stream failures, session callback.
                    if (["DISCONNECTED", "FAILED"].includes(status)) {
                        for (const stream of sessionStreams) {
                            if (["FAILED", "UNPUBLISHED", "STOPPED"].includes(stream.status())) continue;
                            stream.info = "Session does not exist";
                            stream.emit("FAILED");
                        }
                    }
                    handlers[status]?.(this);
                },
                disconnect() { this.emit("DISCONNECTED"); },
                createStream(streamOptions) {
                    const streamHandlers = {};
                    const stream = {
                        options: streamOptions, state: "NEW", kind: null, stopCount: 0, info: "",
                        on(status, callback) { streamHandlers[status] = callback; return this; },
                        emit(status) { this.state = status; streamHandlers[status]?.(this); },
                        publish() { this.kind = "publish"; },
                        play() { this.kind = "play"; this.emit("PLAYING"); },
                        stop() { this.stopCount++; this.emit(this.kind === "publish" ? "UNPUBLISHED" : "STOPPED"); },
                        getInfo() { return this.info; }, status() { return this.state; },
                        id() { return `video-${streams.indexOf(this)}`; }
                    };
                    streams.push(stream);
                    sessionStreams.push(stream);
                    if (streamOptions.constraints) {
                        nodes.set(stream.id(), {srcObject: {getVideoTracks: () => [track]}});
                    }
                    return stream;
                }
            };
            sessions.push(session);
            return session;
        }
    };
    const taskWindow = {
        Flashphoner: api,
        location: {protocol: "https:", hostname: "demo.example", search: options.search ?? ""},
        crypto: {getRandomValues: (bytes) => bytes.fill(7)},
        navigator: {mediaDevices: options.nativeCapture === false ? {} : {getDisplayMedia() {}}},
        setInterval(callback) { intervals.push(callback); return intervals.length; },
        clearInterval() {},
        open(...args) { opened.push(args); },
        InstallTrigger: {install(value) { installed.push(value); }}
    };
    taskWindow.self = taskWindow;
    taskWindow.top = options.iframe ? {} : taskWindow;
    if (options.chromeExtension) {
        taskWindow.chrome = {runtime: {sendMessage(id, request, callback) { callback({installed: true}); }}};
    }
    const context = vm.createContext({
        console, URL, URLSearchParams, Uint8Array,
        document: {getElementById: (id) => nodes.get(id), createElement: () => ({})},
        window: taskWindow
    });
    let realHelpers;
    const helpers = new vm.SyntheticModule(["initializeSDK", "setStatus", "setError", "setInvalid", "bindResize", "queryParam"], function () {
        this.setExport("initializeSDK", (callback, settings = {}) => { initOptions = settings; callback(api); });
        this.setExport("setStatus", (id, status) => { nodes.get(id).textContent = status; });
        this.setExport("setError", (id, message) => { nodes.get(id).textContent = message; nodes.get(id).hidden = !message; });
        this.setExport("setInvalid", realHelpers.setInvalid);
        this.setExport("bindResize", () => () => {});
        this.setExport("queryParam", (name) => new URLSearchParams(taskWindow.location.search).get(name));
    }, {context});
    const modules = new Map();
    async function moduleAt(filename) {
        if (filename === path.join(root, "dependencies/js/streaming.js")) return helpers;
        if (!modules.has(filename)) {
            const module = new vm.SourceTextModule(await fs.readFile(filename, "utf8"), {context, identifier: filename});
            modules.set(filename, module);
            await module.link((specifier, importer) => moduleAt(path.resolve(path.dirname(importer.identifier), specifier)));
        }
        return modules.get(filename);
    }
    const helperPath = path.join(root, "dependencies/js/streaming.js");
    const actualHelpers = new vm.SourceTextModule(await fs.readFile(helperPath, "utf8"), {context, identifier: helperPath});
    await actualHelpers.link((specifier, importer) => moduleAt(path.resolve(path.dirname(importer.identifier), specifier)));
    await actualHelpers.evaluate();
    realHelpers = actualHelpers.namespace;
    await (await moduleAt(path.join(root, "streaming", stem, `${stem}.js`))).evaluate();
    await Promise.resolve();
    return {
        api, sessions, streams, track, intervals, installed, opened, initOptions,
        mediaRequests: () => mediaRequests,
        node: (id) => nodes.get(id),
        connect() {
            nodes.get(stem === "streamer" ? "publishBtn" : "connectBtn").click();
            sessions.at(-1)?.emit("ESTABLISHED");
        },
        publish() {
            if (stem !== "streamer") nodes.get("publishBtn").click();
            const publisher = streams.at(-1);
            publisher.emit("PUBLISHING");
            return publisher;
        }
    };
}

test("Streamer connects automatically then publishes and previews the generated stream", async () => {
    const page = await example();
    assert.equal(page.node("url").value, "wss://demo.example:8443/77777777");
    page.node("publishBtn").click();
    assert.equal(page.sessions[0].options.urlServer, "wss://demo.example:8443");
    assert.equal(page.streams.length, 0);
    page.sessions[0].emit("ESTABLISHED");
    const publisher = page.publish();
    assert.equal(publisher.options.name, "77777777");
    assert.equal(publisher.options.cacheLocalResources, true);
    assert.equal(publisher.options.receiveAudio, false);
    assert.equal(publisher.options.receiveVideo, false);
    assert.equal(page.streams[1].options.name, publisher.options.name);
    assert.equal(page.streams[1].options.display, page.node("remoteVideo"));
    assert.equal(page.node("publishBtn").textContent, "Stop");
});

for (const stem of ["streamer", "screen-sharing"]) {
    test(`${stem} publishes and previews the decoded stream name through the shared address parser`, async () => {
        for (const [pathName, name] of [["s 3", "s 3"], ["поток", "поток"], ["s%203", "s 3"], ["%D0%BF%D0%BE%D1%82%D0%BE%D0%BA", "поток"], ["%2520", "%20"]]) {
            const page = await example(stem);
            page.node("url").value = `wss://demo.example:8443/${pathName}`;
            page.connect();
            const publisher = page.publish();
            assert.equal(page.sessions[0].options.urlServer, "wss://demo.example:8443");
            assert.equal(publisher.options.name, name);
            assert.equal(page.streams[1].options.name, name);
        }
    });

    test(`${stem} rejects malformed percent encoding before connecting`, async () => {
        const page = await example(stem);
        const button = stem === "streamer" ? "publishBtn" : "connectBtn";
        for (const pathName of ["bad%escape", "%E0%A4%A"]) {
            page.node("url").value = `wss://demo.example:8443/${pathName}`;
            page.node(button).click();
            assert.equal(page.sessions.length, 0);
            assert.equal(page.node("url").attributes["aria-invalid"], "true");
            assert.equal(page.node("url").focused, true);
        }
    });

    test(`${stem} highlights invalid combined URLs and clears the error after successful revalidation`, async () => {
        const page = await example(stem);
        const connectButton = stem === "streamer" ? "publishBtn" : "connectBtn";
        page.node("url").value = "wss://demo.example:8443/";
        page.node(connectButton).click();
        assert.equal(page.sessions.length, 0);
        assert.equal(page.node("url").attributes["aria-invalid"], "true");
        assert.equal(page.node("url").closest().classList.contains("has-error"), true);
        assert.match(page.node("info").textContent, /wss:\/\/server:8443\/stream/);
        page.node("url").value = "wss://demo.example:8443/sample";
        page.node(connectButton).click();
        assert.equal(page.sessions.length, 1);
        assert.equal(page.node("url").attributes["aria-invalid"], "false");
        assert.equal(page.node("url").closest().classList.contains("has-error"), false);
        assert.equal(page.node("info").hidden, true);
    });
}

test("Screen Sharing disconnect of active publisher and preview stays quiet in SDK event order", async () => {
    const page = await example("screen-sharing");
    page.connect();
    const publisher = page.publish();
    const preview = page.streams.at(-1);
    page.node("connectBtn").click();
    assert.equal(publisher.status(), "FAILED");
    assert.equal(preview.status(), "FAILED");
    assert.equal(publisher.stopCount, 0);
    assert.equal(preview.stopCount, 0);
    assert.equal(page.node("status").textContent, "DISCONNECTED");
    assert.equal(page.node("info").hidden, true);
    assert.equal(page.node("connectBtn").textContent, "Connect");
    assert.equal(page.node("publishBtn").disabled, true);
    assert.equal(page.node("width").disabled, false);
    page.connect();
    const replacement = page.publish();
    publisher.emit("FAILED");
    preview.emit("FAILED");
    assert.equal(replacement.status(), "PUBLISHING");
    assert.equal(page.node("status").textContent, "PUBLISHING");
    assert.equal(page.node("info").hidden, true);
});

for (const stem of ["streamer", "screen-sharing"]) {
    test(`${stem} reports unexpected session loss without processing SDK-generated stream failures`, async () => {
        for (const terminal of ["DISCONNECTED", "FAILED"]) {
            const page = await example(stem);
            page.connect();
            const publisher = page.publish();
            const preview = page.streams.at(-1);
            page.sessions[0].emit(terminal);
            assert.equal(publisher.status(), "FAILED");
            assert.equal(preview.status(), "FAILED");
            assert.equal(publisher.stopCount, 0);
            assert.equal(preview.stopCount, 0);
            assert.equal(page.node("status").textContent, terminal);
            assert.equal(page.node("info").textContent, stem === "streamer" ? "Connection closed. Streaming stopped." : "Connection closed. Screen sharing stopped.");
            assert.equal(page.node("url").disabled, false);
            page.connect();
            const replacement = page.publish();
            publisher.emit("FAILED");
            preview.emit("FAILED");
            assert.equal(replacement.status(), "PUBLISHING");
            assert.equal(page.node("status").textContent, "PUBLISHING");
            assert.equal(page.node("info").hidden, true);
        }
    });
}

test("Streamer stops publisher and preview once and can restart the established session", async () => {
    const page = await example();
    page.connect();
    const publisher = page.publish();
    const preview = page.streams[1];
    page.node("publishBtn").click();
    assert.equal(preview.stopCount, 1);
    assert.equal(publisher.stopCount, 1);
    assert.equal(page.node("status").textContent, "UNPUBLISHED");
    assert.equal(page.node("publishBtn").disabled, false);
    page.node("publishBtn").click();
    assert.equal(page.sessions.length, 1);
    assert.equal(page.streams.length, 3);
});

test("Streamer preserves preview failure and ignores terminal callbacks from a previous run", async () => {
    const page = await example();
    page.connect();
    const publisher = page.publish();
    const preview = page.streams[1];
    preview.info = "Server preview unavailable";
    preview.emit("FAILED");
    assert.equal(publisher.stopCount, 1);
    assert.equal(page.node("status").textContent, "FAILED");
    assert.equal(page.node("info").textContent, "Server preview unavailable");
    page.node("publishBtn").click();
    const nextPublisher = page.publish();
    preview.emit("STOPPED");
    assert.equal(nextPublisher.stopCount, 0);
    assert.equal(page.node("status").textContent, "PUBLISHING");
    assert.equal(page.node("info").hidden, true);
});

test("Screen Sharing connects explicitly and validates capture settings before requesting media", async () => {
    const page = await example("screen-sharing");
    assert.equal(page.node("publishBtn").disabled, true);
    page.connect();
    assert.equal(page.streams.length, 0);
    page.node("fps").value = "0";
    page.node("width").value = "32.5";
    page.node("publishBtn").click();
    assert.equal(page.streams.length, 0);
    assert.equal(page.node("fps").attributes["aria-invalid"], "true");
    assert.equal(page.node("fps").closest().classList.contains("has-error"), true);
    assert.equal(page.node("width").attributes["aria-invalid"], "true");
    assert.equal(page.node("width").closest().classList.contains("has-error"), true);
    assert.equal(page.node("height").attributes["aria-invalid"], "false");
    assert.equal(page.node("height").closest().classList.contains("has-error"), false);
    assert.match(page.node("info").textContent, /positive whole numbers/);
    page.node("fps").value = "25";
    page.node("width").value = "640";
    page.node("useMic").checked = true;
    page.node("useMic").onchange();
    page.node("audioInput").value = "mic-1";
    const publisher = page.publish();
    for (const id of ["fps", "width", "height"]) {
        assert.equal(page.node(id).attributes["aria-invalid"], "false");
        assert.equal(page.node(id).closest().classList.contains("has-error"), false);
    }
    assert.equal(JSON.stringify(publisher.options.constraints), JSON.stringify({
        video: {type: "screen", width: 640, height: 480, frameRate: 25, withoutExtension: true},
        audio: {deviceId: {exact: "mic-1"}}
    }));
    assert.equal(page.node("audioInput").options.length, 2);
    assert.equal(page.initOptions.screenSharingExtensionId, "nlbaajplpmleofphigmgaifhoikjmbkg");
});

test("Native capture ending stops both Screen Sharing streams and unlocks settings", async () => {
    const page = await example("screen-sharing");
    page.connect();
    const publisher = page.publish();
    const preview = page.streams[1];
    assert.equal(page.node("width").disabled, true);
    page.track.onended();
    assert.equal(publisher.stopCount, 1);
    assert.equal(preview.stopCount, 1);
    assert.equal(page.node("width").disabled, false);
    assert.equal(page.node("publishBtn").textContent, "Start sharing");
    assert.equal(page.node("connectBtn").textContent, "Disconnect");
    assert.equal(page.node("woChromeExtension").disabled, true);
    assert.equal(page.node("audioInput").disabled, true);
});

test("Screen Sharing preserves Safari capture normalization and hides unsupported microphone controls", async () => {
    const page = await example("screen-sharing", {browser: "Safari"});
    page.connect();
    page.node("useMic").checked = true;
    const publisher = page.publish();
    assert.equal(publisher.options.disableConstraintsNormalization, true);
    assert.equal(publisher.options.constraints.video.withoutExtension, true);
    assert.equal(publisher.options.constraints.audio, undefined);
    assert.equal(page.node("mic").hidden, true);
    assert.equal(page.node("micInput").hidden, true);
    assert.equal(page.mediaRequests(), 0);
});

test("Screen Sharing retains Firefox extension installation and screen mediaSource", async () => {
    const page = await example("screen-sharing", {browser: "Firefox", firefoxExtension: false});
    page.connect();
    assert.equal(page.node("publishBtn").disabled, true);
    page.node("installExtensionButton").click();
    const install = page.installed[0]["Flashphoner Screen Sharing"];
    const asset = path.resolve(root, "streaming/screen-sharing", install.URL);
    assert.ok((await fs.stat(asset)).isFile());
    page.api.firefoxScreenSharingExtensionInstalled = true;
    page.intervals[0]();
    const publisher = page.publish();
    assert.equal(publisher.options.constraints.video.mediaSource, "screen");
    assert.equal(publisher.options.constraints.video.withoutExtension, undefined);
    assert.equal(page.node("extension").hidden, true);
});

test("Screen Sharing retains Chrome extension capture and iframe installation fallback", async () => {
    const installed = await example("screen-sharing", {chromeExtension: true});
    installed.node("woChromeExtension").checked = false;
    installed.connect();
    const publisher = installed.publish();
    assert.equal(publisher.options.constraints.video.withoutExtension, undefined);
    assert.equal(installed.node("woChromeExtension").disabled, true);
    installed.node("publishBtn").click();
    assert.equal(installed.node("woChromeExtension").disabled, false);
    const fallback = await example("screen-sharing", {search: "?askExtension=true", iframe: true});
    assert.equal(fallback.node("woChromeExtension").checked, true);
    assert.equal(fallback.node("woChromeExtension").disabled, true);
    assert.equal(fallback.node("installFromMarket").hidden, false);
    assert.equal(fallback.node("installExtensionButton").hidden, true);
});

test("Screen Sharing reports capture and preview failures while keeping the connection reusable", async () => {
    const page = await example("screen-sharing");
    page.connect();
    page.node("publishBtn").click();
    const denied = page.streams[0];
    denied.info = "Screen access denied";
    denied.emit("FAILED");
    assert.equal(page.node("status").textContent, "FAILED");
    assert.equal(page.node("info").textContent, "Screen access denied");
    assert.equal(page.node("width").disabled, false);
    const publisher = page.publish();
    const preview = page.streams.at(-1);
    preview.info = "Preview unavailable";
    preview.emit("FAILED");
    assert.equal(publisher.stopCount, 1);
    assert.equal(page.node("status").textContent, "FAILED");
    assert.equal(page.node("info").textContent, "Preview unavailable");
    page.node("connectBtn").click();
    assert.equal(page.node("status").textContent, "DISCONNECTED");
    assert.equal(page.node("url").disabled, false);
    assert.equal(page.node("publishBtn").disabled, true);
});

test("Screen Sharing disables unsupported mobile capture and missing extension-only capture", async () => {
    const mobile = await example("screen-sharing", {mobile: true});
    assert.match(mobile.node("notifyFatal").textContent, /desktop/);
    assert.equal(mobile.node("connectBtn").disabled, true);
    const legacy = await example("screen-sharing", {nativeCapture: false});
    legacy.connect();
    assert.equal(legacy.node("publishBtn").disabled, true);
    assert.equal(legacy.node("installExtensionButton").hidden, false);
});

for (const stem of ["streamer", "screen-sharing"]) {
    test(`${stem} ignores late establishment and disconnect from replaced sessions`, async () => {
        const page = await example(stem);
        const connectButton = stem === "streamer" ? "publishBtn" : "connectBtn";
        page.node(connectButton).click();
        const old = page.sessions[0];
        old.emit("FAILED");
        old.emit("ESTABLISHED");
        assert.equal(page.node("status").textContent, "FAILED");
        assert.equal(page.streams.length, 0);
        if (stem === "screen-sharing") assert.equal(page.node("publishBtn").disabled, true);
        page.connect();
        const current = page.sessions[1];
        const publisher = page.publish();
        old.emit("DISCONNECTED");
        old.emit("FAILED");
        assert.equal(page.node("status").textContent, "PUBLISHING");
        assert.equal(page.node("url").disabled, true);
        assert.equal(publisher.stopCount, 0);
        page.node("publishBtn").click();
        current.emit("DISCONNECTED");
        assert.equal(page.node("status").textContent, "DISCONNECTED");
        assert.equal(page.node("url").disabled, false);
    });
}
