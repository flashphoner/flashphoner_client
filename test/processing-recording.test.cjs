const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "../examples/v2");
const examples = {
    rtmp: "webrtc-as-rtmp-republishing/webrtc-as-rtmp-republishing",
    recording: "stream_recording/recording",
    several: "several_streams_recording/several_streams_recording"
};

async function example(kind, options = {}) {
    const stem = path.join(root, "streaming", examples[kind]);
    const html = await fs.readFile(`${stem}.html`, "utf8");
    const nodes = new Map();
    for (const match of html.matchAll(/<(input|button|select|span|div|p|a|video|textarea)\b([^>]*\bid="([^"]+)"[^>]*)>/g)) {
        const [, , attributes, id] = match;
        nodes.set(id, {
            value: attributes.match(/\bvalue="([^"]*)"/)?.[1] ?? "",
            disabled: /\bdisabled\b/.test(attributes), hidden: /\bhidden\b/.test(attributes),
            textContent: "", className: "", attributes: {}, parentElement: {dataset: {}},
            setAttribute(name, value) { this.attributes[name] = value; },
            removeAttribute(name) { delete this.attributes[name]; if (["src", "href"].includes(name)) delete this[name]; },
            closest() { return {classList: {toggle() {}}}; },
            querySelectorAll() { return []; }, focus() { this.focused = true; },
            pause() {}, load() {},
            click() { if (!this.disabled) return this.onclick?.(); }
        });
    }
    const sessions = [];
    const streams = [];
    const constants = (values) => Object.fromEntries(values.map((value) => [value, value]));
    const api = {
        constants: {
            SESSION_STATUS: constants(["ESTABLISHED", "DISCONNECTED", "FAILED"]),
            STREAM_STATUS: constants(["PUBLISHING", "UNPUBLISHED", "FAILED"])
        },
        init() {},
        createSession(sessionOptions) {
            const handlers = {};
            const sessionStreams = [];
            const session = {
                options: sessionOptions, state: "CONNECTING", disconnectCount: 0,
                on(status, callback) { handlers[status] = callback; return this; },
                status() { return this.state; },
                emit(status) {
                    this.state = status;
                    if (["FAILED", "DISCONNECTED"].includes(status)) {
                        for (const stream of sessionStreams) {
                            if (!["FAILED", "UNPUBLISHED"].includes(stream.status())) {
                                stream.info = "Session does not exist";
                                stream.emit("FAILED");
                            }
                        }
                    }
                    handlers[status]?.(this);
                },
                disconnect() { this.disconnectCount++; this.state = "DISCONNECTED"; handlers.DISCONNECTED?.(this); },
                createStream(streamOptions) {
                    const callbacks = {};
                    const stream = {
                        options: streamOptions, state: "NEW", stopCount: 0, info: "", record: "", recordUrl: null,
                        name() { return this.options.name; }, status() { return this.state; },
                        getInfo() { return this.info; }, getRecordInfo() { return this.record; },
                        getRecordUrl() { return this.recordUrl; },
                        on(status, callback) { callbacks[status] = callback; return this; },
                        emit(status) { this.state = status; callbacks[status]?.(this); },
                        publish() { if (options.autoPublish) this.emit("PUBLISHING"); },
                        stop() {
                            this.stopCount++;
                            if (!options.holdStops) this.emit("UNPUBLISHED");
                        }
                    };
                    sessionStreams.push(stream);
                    streams.push(stream);
                    return stream;
                }
            };
            sessions.push(session);
            return session;
        }
    };
    let random = 0;
    const taskWindow = {
        Flashphoner: api,
        location: {protocol: "https:", hostname: "panel.example", host: "panel.example", origin: "https://panel.example", search: ""},
        WCS_SERVER_URL: "wss://selected-wcs.example:8443",
        WCS_WEB_URL: "https://selected-wcs.example:8444",
        crypto: {getRandomValues(bytes) { return bytes.fill(++random); }}
    };
    const context = vm.createContext({
        console, URL, URLSearchParams, Uint8Array, window: taskWindow, SERVER_PORTS: options.ports,
        document: {readyState: "complete", getElementById: (id) => nodes.get(id)}
    });
    const modules = new Map();
    async function load(filename) {
        if (!modules.has(filename)) {
            const module = new vm.SourceTextModule(await fs.readFile(filename, "utf8"), {context, identifier: filename});
            modules.set(filename, module);
            await module.link((specifier, importer) => load(path.resolve(path.dirname(importer.identifier), specifier)));
        }
        return modules.get(filename);
    }
    await (await load(`${stem}.js`)).evaluate();
    await tick();
    return {nodes, sessions, streams, click: (id) => nodes.get(id).click(), value: (id, value) => { nodes.get(id).value = value; }};
}

async function tick() {
    for (let i = 0; i < 8; i++) await Promise.resolve();
}

test("RTMP publishes to the entered destination and uses selected WCS for localhost playback", async () => {
    const e = await example("rtmp");
    e.value("streamName", "demo one");
    e.click("publishBtn");
    assert.equal(e.sessions[0].options.urlServer, "wss://selected-wcs.example:8443");
    e.sessions[0].emit("ESTABLISHED");
    assert.equal(e.streams[0].options.rtmpUrl, "rtmp://localhost:1935/live");
    assert.equal(e.streams[0].options.name, "demo one");
    e.streams[0].emit("PUBLISHING");
    assert.equal(e.nodes.get("player").textContent, "rtmp://selected-wcs.example:1935/live/rtmp_demo%20one");
    assert.equal(e.nodes.get("playback").hidden, false);
    e.click("publishBtn");
    assert.equal(e.streams[0].stopCount, 1);
    assert.equal(e.sessions[0].disconnectCount, 1);
    assert.equal(e.nodes.get("publishBtn").textContent, "Start");
});

test("RTMP preserves an explicit external destination and query", async () => {
    const e = await example("rtmp");
    e.value("rtmpUrl", "rtmps://remote.example:443/live?token=test");
    e.value("streamName", "demo");
    e.click("publishBtn");
    e.sessions[0].emit("ESTABLISHED");
    e.streams[0].emit("PUBLISHING");
    assert.equal(e.nodes.get("player").textContent, "rtmps://remote.example:443/live/rtmp_demo?token=test");
    e.streams[0].emit("PUBLISHING");
    assert.equal(e.nodes.get("player").textContent, "rtmps://remote.example:443/live/rtmp_demo?token=test");
});

test("RTMP does not stop a stream twice after a terminal stream event", async () => {
    const e = await example("rtmp");
    e.click("publishBtn");
    e.sessions[0].emit("ESTABLISHED");
    e.streams[0].emit("UNPUBLISHED");
    assert.equal(e.streams[0].stopCount, 0);
    assert.equal(e.nodes.get("publishBtn").textContent, "Start");
});

test("RTMP waits for asynchronous unpublish before allowing the same stream name to restart", async () => {
    const e = await example("rtmp", {holdStops: true});
    e.click("publishBtn");
    e.sessions[0].emit("ESTABLISHED");
    const previous = e.streams[0];
    previous.emit("PUBLISHING");
    e.click("publishBtn");
    assert.equal(e.nodes.get("status").textContent, "PROCESSING");
    assert.equal(e.nodes.get("publishBtn").disabled, true);
    assert.equal(e.nodes.get("streamName").disabled, true);
    assert.equal(e.sessions[0].disconnectCount, 0);
    e.click("publishBtn");
    assert.equal(e.sessions.length, 1);
    previous.emit("PUBLISHING");
    assert.equal(e.nodes.get("status").textContent, "PROCESSING");
    previous.emit("UNPUBLISHED");
    assert.equal(previous.stopCount, 1);
    assert.equal(e.sessions[0].disconnectCount, 1);
    assert.equal(e.nodes.get("publishBtn").disabled, false);
    e.click("publishBtn");
    e.sessions[1].emit("ESTABLISHED");
    e.streams[1].emit("PUBLISHING");
    assert.equal(e.streams[1].options.name, previous.options.name);
    previous.emit("UNPUBLISHED");
    assert.equal(e.nodes.get("status").textContent, "PUBLISHING");
});

test("RTMP rejects invalid signaling and destination without opening a session", async () => {
    const e = await example("rtmp");
    e.value("url", "https://wrong.example");
    e.click("publishBtn");
    assert.equal(e.sessions.length, 0);
    assert.equal(e.nodes.get("url").attributes["aria-invalid"], "true");
    e.value("url", "wss://valid.example:8443");
    e.value("rtmpUrl", "javascript:alert(1)");
    e.click("publishBtn");
    assert.equal(e.sessions.length, 0);
    assert.equal(e.nodes.get("rtmpUrl").attributes["aria-invalid"], "true");
});

test("recording waits for stop completion and exposes selected-WCS playback and download", async () => {
    const e = await example("recording", {holdStops: true});
    assert.equal(e.nodes.get("recVideo").hidden, true);
    e.value("url", "wss://selected-wcs.example:8443/stream%20one");
    e.click("publishBtn");
    e.sessions[0].emit("ESTABLISHED");
    assert.equal(e.streams[0].options.record, true);
    assert.equal(e.streams[0].options.name, "stream one");
    e.streams[0].emit("PUBLISHING");
    e.click("publishBtn");
    assert.equal(e.nodes.get("status").textContent, "PROCESSING");
    assert.equal(e.nodes.get("publishBtn").disabled, true);
    assert.equal(e.nodes.get("downloadDiv").hidden, true);
    e.streams[0].emit("PUBLISHING");
    assert.equal(e.nodes.get("status").textContent, "PROCESSING");
    e.streams[0].record = "record one?#.mp4";
    e.streams[0].emit("UNPUBLISHED");
    const expected = "https://selected-wcs.example:8444/client/records/record%20one%3F%23.mp4";
    assert.equal(e.nodes.get("link").href, expected + "?download=true");
    assert.equal(e.nodes.get("recVideo").src, expected);
    assert.equal(e.nodes.get("recVideo").hidden, false);
    assert.equal(e.nodes.get("downloadDiv").hidden, false);
    assert.equal(e.nodes.get("publishBtn").textContent, "Start");
    assert.equal(e.streams[0].stopCount, 1);
});

test("recording clears the prior result on restart and ignores callbacks from an older run", async () => {
    const e = await example("recording");
    e.click("publishBtn");
    e.sessions[0].emit("ESTABLISHED");
    e.streams[0].record = "first.mp4";
    e.streams[0].emit("UNPUBLISHED");
    assert.equal(e.nodes.get("downloadDiv").hidden, false);
    e.click("publishBtn");
    assert.equal(e.nodes.get("downloadDiv").hidden, true);
    assert.equal(e.nodes.get("recVideo").src, undefined);
    assert.equal(e.nodes.get("recVideo").hidden, true);
    e.streams[0].record = "old.mp4";
    e.streams[0].emit("UNPUBLISHED");
    assert.equal(e.nodes.get("status").textContent, "CONNECTING");
    assert.equal(e.nodes.get("downloadDiv").hidden, true);
    e.sessions[1].emit("ESTABLISHED");
    e.streams[1].emit("PUBLISHING");
    assert.equal(e.streams[1].options.name, e.streams[0].options.name);
    assert.equal(e.sessions[0].disconnectCount, 1);
});

test("recording does not create a link when no recorded file is returned", async () => {
    const e = await example("recording");
    e.click("publishBtn");
    e.sessions[0].emit("ESTABLISHED");
    e.streams[0].emit("UNPUBLISHED");
    assert.equal(e.nodes.get("downloadDiv").hidden, true);
    assert.equal(e.nodes.get("link").href, undefined);
});

test("recording preserves the file-specific access link on the selected WCS", async () => {
    const e = await example("recording");
    e.click("publishBtn");
    e.sessions[0].emit("ESTABLISHED");
    e.streams[0].record = "private-record.mp4";
    e.streams[0].recordUrl = "/client/records/private-record.mp4?token=ln-recording-access";
    e.streams[0].emit("UNPUBLISHED");
    const expected = "https://selected-wcs.example:8444/client/records/private-record.mp4?token=ln-recording-access";
    assert.equal(e.nodes.get("recVideo").src, expected);
    assert.equal(e.nodes.get("link").href, expected + "&download=true");
    assert.equal(e.sessions[0].disconnectCount, 1);
    e.click("publishBtn");
    assert.equal(e.nodes.get("link").href, undefined);
    assert.equal(e.nodes.get("recVideo").src, undefined);
});

test("recording rejects links to other origins, paths or recorded files", async () => {
    for (const recordUrl of ["https://other.example/client/records/record.mp4?token=private",
        "/admin/record.mp4?token=private", "/client/records/other.mp4?token=private",
        "https://user:password@selected-wcs.example:8444/client/records/record.mp4",
        "/client/records/record.mp4#fragment", "javascript:alert(1)"]) {
        const e = await example("recording");
        e.click("publishBtn");
        e.sessions[0].emit("ESTABLISHED");
        e.streams[0].record = "record.mp4";
        e.streams[0].recordUrl = recordUrl;
        e.streams[0].emit("UNPUBLISHED");
        assert.equal(e.nodes.get("link").href, undefined);
        assert.equal(e.nodes.get("recVideo").src, undefined);
        assert.equal(e.nodes.get("downloadDiv").hidden, true);
        assert.equal(e.nodes.get("status").textContent, "FAILED");
    }
});

test("recording accepts a selected remote WCS using the default HTTP or HTTPS port", async () => {
    for (const [signaling, web] of [["ws", "http"], ["wss", "https"]]) {
        for (const recordUrl of [null, "/client/records/record.mp4?token=ln-recording-access"]) {
            const e = await example("recording", {ports: {http: 80, https: 443}});
            e.value("url", `${signaling}://other-wcs.example/stream`);
            e.click("publishBtn");
            e.sessions[0].emit("ESTABLISHED");
            e.streams[0].record = "record.mp4";
            e.streams[0].recordUrl = recordUrl;
            e.streams[0].emit("UNPUBLISHED");
            const expectedPath = recordUrl ? recordUrl + "&download=true" : "/client/records/record.mp4?download=true";
            assert.equal(e.nodes.get("link").href,
                `${web}://other-wcs.example${expectedPath}`);
            assert.equal(e.nodes.get("recVideo").src, `${web}://other-wcs.example${recordUrl || "/client/records/record.mp4"}`);
            assert.equal(e.nodes.get("recVideo").hidden, false);
            assert.equal(e.nodes.get("status").textContent, "UNPUBLISHED");
        }
    }
});

test("several recording publishes exactly the requested number and stops every stream", async () => {
    const e = await example("several", {autoPublish: true, holdStops: true});
    e.value("countStreams", "3");
    e.click("publishBtn");
    e.sessions[0].emit("ESTABLISHED");
    await tick();
    assert.equal(e.streams.length, 3);
    assert.equal(new Set(e.streams.map((stream) => stream.options.name)).size, 3);
    assert.ok(e.streams.every((stream) => stream.options.record === true));
    assert.equal(e.streams[0].options.display, e.nodes.get("localVideo"));
    assert.equal(e.streams[1].options.display, e.nodes.get("localTestVideo"));
    assert.equal(e.nodes.get("status").textContent, "PUBLISHING");
    e.click("publishBtn");
    assert.ok(e.streams.every((stream) => stream.stopCount === 1));
    assert.equal(e.nodes.get("status").textContent, "PROCESSING");
    for (const [index, stream] of e.streams.entries()) {
        stream.emit("UNPUBLISHED");
        if (index < e.streams.length - 1) {
            assert.equal(e.nodes.get("publishBtn").disabled, true);
            assert.equal(e.sessions[0].disconnectCount, 0);
        }
    }
    assert.equal(e.nodes.get("status").textContent, "UNPUBLISHED");
    assert.equal(e.nodes.get("countStreams").disabled, false);
    assert.match(e.nodes.get("statusLog").value, /ESTABLISHED/);
    assert.equal(e.nodes.get("statusLog").value.match(/ - UNPUBLISHED/g).length, 3);
});

test("several recording rejects invalid counts before opening a session", async () => {
    const e = await example("several");
    for (const count of ["0", "-1", "1.5", "", "Infinity"]) {
        e.value("countStreams", count);
        e.click("publishBtn");
        assert.equal(e.sessions.length, 0, count);
    }
});

test("several recording never exceeds the requested count after duplicate publishing events", async () => {
    const e = await example("several", {autoPublish: true});
    e.value("countStreams", "3");
    e.click("publishBtn");
    e.sessions[0].emit("ESTABLISHED");
    e.streams[0].emit("PUBLISHING");
    await tick();
    assert.equal(e.streams.length, 3);
    e.streams[2].emit("PUBLISHING");
    await tick();
    assert.equal(e.streams.length, 3);
});

test("several recording stops the group when a stream fails and can restart", async () => {
    const e = await example("several", {autoPublish: true});
    e.value("countStreams", "3");
    e.click("publishBtn");
    e.sessions[0].emit("ESTABLISHED");
    await tick();
    e.streams[1].info = "Recording unavailable";
    e.streams[1].emit("FAILED");
    assert.equal(e.nodes.get("status").textContent, "FAILED");
    assert.equal(e.nodes.get("info").textContent, "Recording unavailable");
    assert.equal(e.streams[0].stopCount, 1);
    assert.equal(e.streams[2].stopCount, 1);
    e.click("publishBtn");
    assert.equal(e.sessions.length, 2);
    assert.equal(e.nodes.get("status").textContent, "CONNECTING");
});

for (const kind of Object.keys(examples)) {
    test(`${kind} cancels connection and ignores its late establishment`, async () => {
        const e = await example(kind);
        e.click("publishBtn");
        e.click("publishBtn");
        assert.equal(e.sessions[0].disconnectCount, 1);
        assert.equal(e.nodes.get("publishBtn").textContent, "Start");
        e.sessions[0].emit("ESTABLISHED");
        assert.equal(e.streams.length, 0);
        e.click("publishBtn");
        e.sessions[0].emit("FAILED");
        assert.equal(e.nodes.get("status").textContent, "CONNECTING");
    });

    test(`${kind} handles terminal session events before session callback`, async () => {
        const e = await example(kind);
        e.click("publishBtn");
        e.sessions[0].emit("ESTABLISHED");
        e.streams[0].emit("PUBLISHING");
        e.sessions[0].emit("FAILED");
        assert.equal(e.nodes.get("status").textContent, "FAILED");
        assert.equal(e.nodes.get("publishBtn").textContent, "Start");
        assert.equal(e.nodes.get("url").disabled, false);
    });
}
