const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "../examples/v2");

async function example(firewall = false, {connectedStatus = false} = {}) {
    const directory = firewall ? "firewall-traversal-streaming" : "two_way_streaming";
    const stem = firewall ? directory : "two_way_streaming";
    const entryFile = path.join(root, "streaming", directory, `${stem}.js`);
    const html = await fs.readFile(path.join(root, "streaming", directory, `${stem}.html`), "utf8");
    const elements = new Map();
    for (const match of html.matchAll(/<(input|button|textarea|span|div)\b([^>]*\bid="([^"]+)"[^>]*)>/g)) {
        const [, tag, attributes, id] = match;
        const listeners = {};
        const node = {
            value: attributes.match(/\bvalue="([^"]*)"/)?.[1] ?? "", checked: /\bchecked\b/.test(attributes),
            disabled: /\bdisabled\b/.test(attributes), hidden: /\bhidden\b/.test(attributes), textContent: "", dataset: {},
            scrollTop: 0, scrollHeight: 123, listeners, innerHTML: "",
            addEventListener(name, handler) { listeners[name] = handler; },
            setAttribute() {},
            classList: {toggle() {}},
            click() { if (!this.disabled) return this.onclick?.(); }
        };
        if (tag === "textarea") node.value = html.slice(match.index + match[0].length).split("</textarea>")[0];
        elements.set(id, node);
    }
    const sessions = [];
    const streams = [];
    const resizeBindings = [];
    const statuses = (values) => Object.fromEntries(values.map((value) => [value, value]));
    const api = {
        constants: {
            SESSION_STATUS: statuses([...(connectedStatus ? ["CONNECTED"] : []), "ESTABLISHED", "DISCONNECTED", "FAILED"]),
            STREAM_STATUS: statuses(["PENDING", "PUBLISHING", "UNPUBLISHED", "PLAYING", "STOPPED", "FAILED"]),
            STREAM_EVENT: "STREAM_EVENT", STREAM_EVENT_TYPE: {DATA: "DATA"},
            STREAM_STATUS_INFO: statuses(["STREAM_NAME_ALREADY_IN_USE", "SESSION_DOES_NOT_EXIST", "STOPPED_BY_PUBLISHER_STOP", "SESSION_NOT_READY", "RTSP_STREAM_NOT_FOUND", "FAILED_TO_CONNECT_TO_RTSP_STREAM", "FILE_NOT_FOUND", "FILE_HAS_WRONG_FORMAT", "TRANSCODING_REQUIRED_BUT_DISABLED", "NO_AVAILABLE_TRANSCODERS"]),
            ERROR_INFO: {LOCAL_ERROR: "LOCAL_ERROR"}
        },
        getMediaProviders: () => ["WebRTC"],
        playFirstSound() {},
        nextStreamError: null,
        nextSessionError: null,
        createSession(options) {
            if (api.nextSessionError) {
                const error = api.nextSessionError;
                api.nextSessionError = null;
                throw error;
            }
            let state = "CONNECTING";
            const handlers = {};
            const sessionStreams = [];
            const session = {
                options, handlers, status: () => state,
                on(type, handler) { handlers[type] = handler; return this; },
                emit(type) {
                    state = type;
                    // The SDK fails streams after changing session status, before the session callback.
                    if (["DISCONNECTED", "FAILED"].includes(type)) {
                        for (const stream of sessionStreams) {
                            if (["FAILED", "UNPUBLISHED", "STOPPED"].includes(stream.status())) continue;
                            stream.info = "Session does not exist";
                            stream.emit("FAILED");
                        }
                    }
                    handlers[type]?.(this);
                },
                disconnect() { this.emit("DISCONNECTED"); },
                createStream(streamOptions) {
                    if (api.nextStreamError) {
                        const error = api.nextStreamError;
                        api.nextStreamError = null;
                        throw error;
                    }
                    let streamState = "NEW";
                    const streamHandlers = {};
                    const stream = {
                        options: streamOptions, handlers: streamHandlers, sent: [], kind: null, info: "",
                        status: () => streamState, getInfo() { return this.info; }, getErrorInfo: () => "Permission denied",
                        on(type, handler) { streamHandlers[type] = handler; return this; },
                        emit(type, event) {
                            if (type !== "STREAM_EVENT") streamState = type;
                            streamHandlers[type]?.(event ?? this);
                        },
                        publish() { this.kind = "publish"; this.emit("PUBLISHING"); },
                        play() { this.kind = "play"; this.emit("PENDING"); this.emit("PLAYING"); },
                        stop() { this.emit(this.kind === "publish" ? "UNPUBLISHED" : "STOPPED"); },
                        sendData(payload) { this.sent.push(payload); },
                        available() {
                            this.kind = "available";
                            return new Promise((resolve, reject) => { this.resolve = resolve; this.reject = reject; });
                        }
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
    const context = vm.createContext({
        console, Date, Map, Set, Uint8Array,
        document: {getElementById: (id) => elements.get(id)},
        window: {Flashphoner: api, location: {protocol: "https:", hostname: "demo.example"}, crypto: {getRandomValues: (bytes) => bytes.fill(7)}}
    });
    const helpers = new vm.SyntheticModule(["initializeSDK", "setStatus", "setError", "validateRequired", "bindResize"], function () {
        this.setExport("initializeSDK", (callback) => callback(api));
        this.setExport("setStatus", (id, status) => { elements.get(id).textContent = status; });
        this.setExport("setError", (id, message) => { const node = elements.get(id); node.textContent = message; node.hidden = !message; });
        this.setExport("validateRequired", (id) => Boolean(elements.get(id).value.trim()));
        this.setExport("bindResize", (display) => { resizeBindings.push(display); return () => {}; });
    }, {context});
    // A copied example includes its own scenario and these small utilities only.
    // Loading another scenario, including one hidden in dependencies, must fail.
    const copiedFiles = new Set([
        entryFile,
        ...["dom.js", "identifiers.js", "server-url.js"].map((name) => path.join(root, "dependencies/js", name))
    ]);
    const modules = new Map();
    async function moduleAt(file) {
        if (file === path.join(root, "dependencies/js/streaming.js")) return helpers;
        assert.ok(copiedFiles.has(file), `Copied ${directory} example cannot load scenario module ${path.relative(root, file)}`);
        if (modules.has(file)) return modules.get(file);
        const module = new vm.SourceTextModule(await fs.readFile(file, "utf8"), {context, identifier: file});
        modules.set(file, module);
        await module.link((specifier, importing) => moduleAt(path.resolve(path.dirname(importing.identifier), specifier)));
        return module;
    }
    const entry = await moduleAt(entryFile);
    await entry.evaluate();
    return {
        api, sessions, streams, resizeBindings,
        node: (id) => elements.get(id),
        connect() { elements.get("connectBtn").click(); sessions.at(-1).emit("ESTABLISHED"); return sessions.at(-1); }
    };
}

function testBothExamples(description, run) {
    for (const [name, firewall] of [["Two Way", false], ["Firewall", true]]) {
        test(`${name}: ${description}`, () => run(firewall));
    }
}

test("Two Way publishes and plays independently, sends JSON and displays received data safely", async () => {
    const page = await example();
    assert.equal(page.node("publishBtn").disabled, true);
    assert.equal(page.node("playBtn").disabled, true);
    assert.equal(page.node("urlServer").value, "wss://demo.example:8443");
    assert.equal(page.node("publishStream").value, page.node("playStream").value);
    const session = page.connect();
    assert.deepEqual(Object.keys(session.options), ["urlServer"]);
    page.node("publishBtn").click();
    const publisher = page.streams.at(-1);
    assert.equal(publisher.options.cacheLocalResources, true);
    assert.equal(publisher.options.receiveAudio, false);
    assert.equal(publisher.options.receiveVideo, false);
    assert.equal(page.node("sendDataBtn").disabled, false);
    page.node("streamData").value = "{";
    page.node("sendDataBtn").click();
    assert.match(page.node("dataError").textContent, /Invalid JSON payload/);
    assert.equal(publisher.sent.length, 0);
    page.node("streamData").value = '{"count":23}';
    page.node("sendDataBtn").click();
    assert.equal(JSON.stringify(publisher.sent[0]), '{"count":23}');
    assert.equal(page.node("dataError").hidden, true);
    page.node("playBtn").click();
    const player = page.streams.at(-1);
    player.emit("STREAM_EVENT", {type: "DATA", payload: {text: "<img src=x onerror=alert(1)>"}});
    assert.match(page.node("receivedData").value, /<img src=x onerror=alert\(1\)>/);
    assert.equal(page.node("receivedData").innerHTML, "");
    assert.equal(page.node("receivedData").scrollTop, page.node("receivedData").scrollHeight);
    page.node("publishBtn").click();
    assert.equal(player.status(), "PLAYING");
    assert.equal(page.node("playBtn").textContent, "Stop");
    assert.equal(page.node("sendDataBtn").disabled, true);
});

test("availability uses a separate request and ignores stale responses after disconnect", async () => {
    const page = await example();
    page.connect();
    const check = page.node("availableBtn").click();
    const available = page.streams.at(-1);
    assert.equal(available.kind, "available");
    assert.equal(page.node("availableBtn").disabled, true);
    available.resolve(available);
    await check;
    assert.equal(page.node("availableStatus").textContent, "AVAILABLE");
    assert.equal(page.node("playBtn").textContent, "Play");
    const next = page.node("availableBtn").click();
    const stale = page.streams.at(-1);
    page.node("connectBtn").click();
    stale.info = "Stream not found";
    stale.reject(stale);
    await next;
    assert.equal(page.node("availableStatus").textContent, "");
    assert.equal(page.node("availableError").hidden, true);
    assert.equal(page.node("playBtn").disabled, true);
});

test("Firewall forwards TURN settings and forces relay with UDP for both streams", async () => {
    const page = await example(true);
    page.node("usernameTurnServer").value = "test-user";
    page.node("credentialTurnServer").value = "test-credential";
    const session = page.connect();
    const ice = session.options.mediaOptions;
    assert.equal(ice.iceTransportPolicy, "relay");
    assert.equal(ice.iceServers[0].url, "turn:turn.flashphoner.com:443?transport=tcp");
    assert.equal(ice.iceServers[0].username, "test-user");
    assert.equal(ice.iceServers[0].credential, "test-credential");
    assert.equal(page.node("forceRelay").disabled, true);
    page.node("publishBtn").click();
    page.node("playBtn").click();
    assert.equal(page.streams[0].options.transport, "UDP");
    assert.equal(page.streams[1].options.transport, "UDP");
    page.node("connectBtn").click();
    assert.equal(page.node("forceRelay").disabled, false);
    page.node("forceRelay").checked = false;
    const direct = page.connect();
    assert.equal("iceTransportPolicy" in direct.options.mediaOptions, false);
    page.node("publishBtn").click();
    page.node("playBtn").click();
    assert.equal("transport" in page.streams.at(-1).options, false);
    assert.equal("transport" in page.streams.at(-2).options, false);
});

testBothExamples("stream failures restore controls and retain publishing and playback error explanations", async (firewall) => {
    const page = await example(firewall);
    page.connect();
    page.api.nextStreamError = new Error("Cannot create stream");
    page.node("publishBtn").click();
    assert.equal(page.node("publishBtn").disabled, false);
    assert.equal(page.node("publishBtn").textContent, "Publish");
    assert.equal(page.node("publishError").textContent, "Cannot create stream");
    page.node("publishBtn").click();
    const publisher = page.streams.at(-1);
    publisher.info = "LOCAL_ERROR";
    publisher.emit("FAILED");
    assert.match(page.node("publishError").textContent, /Browser error detected: Permission denied/);
    page.node("playBtn").click();
    const player = page.streams.at(-1);
    player.info = "TRANSCODING_REQUIRED_BUT_DISABLED";
    player.emit("FAILED");
    assert.match(page.node("playError").textContent, /Transcoding is required but disabled/);
    assert.equal(page.node("playStream").disabled, false);
    assert.equal(page.resizeBindings.length, 2);
});

testBothExamples("late events from a stopped publisher do not alter its replacement", async (firewall) => {
    const page = await example(firewall);
    page.connect();
    page.node("publishBtn").click();
    const old = page.streams.at(-1);
    page.node("publishBtn").click();
    page.node("publishBtn").click();
    const replacement = page.streams.at(-1);
    old.info = "STREAM_NAME_ALREADY_IN_USE";
    old.emit("FAILED");
    assert.equal(replacement.status(), "PUBLISHING");
    assert.equal(page.node("publishStatus").textContent, "PUBLISHING");
    assert.equal(page.node("publishBtn").textContent, "Stop");
    assert.equal(page.node("publishError").hidden, true);
});

test("terminal connection failures show feedback and reject late establishment before and after reconnect", async () => {
    for (const firewall of [false, true]) {
        for (const terminal of ["FAILED", "DISCONNECTED"]) {
            const page = await example(firewall, {connectedStatus: true});
            page.node("connectBtn").click();
            const old = page.sessions.at(-1);
            old.emit(terminal);
            assert.equal(page.node("connectStatus").textContent, terminal);
            assert.equal(page.node("connectError").textContent, "Can't connect to server.");
            assert.equal(page.node("connectBtn").disabled, false);
            old.emit("ESTABLISHED");
            assert.equal(page.node("connectStatus").textContent, terminal);
            assert.equal(page.node("publishBtn").disabled, true);
            page.node("connectBtn").click();
            const replacement = page.sessions.at(-1);
            replacement.emit("CONNECTED");
            assert.equal(page.node("connectStatus").textContent, "CONNECTED");
            assert.equal(page.node("publishBtn").disabled, true);
            assert.equal(page.node("connectBtn").disabled, true);
            old.emit("ESTABLISHED");
            assert.equal(page.node("connectStatus").textContent, "CONNECTED");
            assert.equal(page.node("publishBtn").disabled, true);
            replacement.emit("ESTABLISHED");
            old.emit("FAILED");
            assert.equal(page.node("connectStatus").textContent, "ESTABLISHED");
            assert.equal(page.node("publishBtn").disabled, false);
            replacement.emit("FAILED");
            assert.equal(page.node("connectError").textContent, "Connection to server lost.");
            assert.equal(page.node("publishBtn").disabled, true);
        }
    }
});

testBothExamples("active publish/play disconnect stays quiet and unexpected loss is explained in SDK event order", async (firewall) => {
    const page = await example(firewall);
    page.connect();
    page.node("publishBtn").click();
    page.node("playBtn").click();
    const previous = page.streams.slice();
    page.node("connectBtn").click();
    assert.equal(page.node("connectError").hidden, true);
    assert.equal(page.node("publishError").hidden, true);
    assert.equal(page.node("playError").hidden, true);
    assert.equal(page.node("publishStatus").textContent, "UNPUBLISHED");
    assert.equal(page.node("playStatus").textContent, "STOPPED");
    assert.ok(previous.every((stream) => stream.status() === "FAILED"));
    const session = page.connect();
    page.node("publishBtn").click();
    page.node("playBtn").click();
    previous.forEach((stream) => stream.emit("FAILED"));
    assert.equal(page.node("publishStatus").textContent, "PUBLISHING");
    assert.equal(page.node("playStatus").textContent, "PLAYING");
    session.emit("DISCONNECTED");
    assert.equal(page.node("connectError").textContent, "Connection to server lost.");
    assert.equal(page.node("publishError").hidden, true);
    assert.equal(page.node("playError").hidden, true);
    assert.equal(page.node("publishStatus").textContent, "UNPUBLISHED");
    assert.equal(page.node("playStatus").textContent, "STOPPED");
    assert.equal(page.node("urlServer").disabled, false);
    const replacement = page.connect();
    page.node("publishBtn").click();
    page.node("playBtn").click();
    assert.equal(page.node("connectError").hidden, true);
    replacement.emit("FAILED");
    assert.equal(page.node("connectError").textContent, "Connection to server lost.");
    assert.equal(page.node("publishError").hidden, true);
    assert.equal(page.node("playError").hidden, true);
    assert.equal(page.resizeBindings.length, 2);
});

testBothExamples("synchronous connection failure restores Connect and displays its reason", async (firewall) => {
    const page = await example(firewall);
    page.api.nextSessionError = new Error("Invalid server URL");
    page.node("connectBtn").click();
    assert.equal(page.node("connectStatus").textContent, "FAILED");
    assert.equal(page.node("connectError").textContent, "Can't connect to server: Invalid server URL");
    assert.equal(page.node("connectBtn").disabled, false);
    assert.equal(page.node("connectBtn").textContent, "Connect");
    assert.equal(page.node("urlServer").disabled, false);
    assert.equal(page.node("publishBtn").disabled, true);
});
