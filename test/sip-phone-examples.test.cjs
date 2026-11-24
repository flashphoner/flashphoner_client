const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "../examples/v2/sip");

function events() {
    const handlers = new Map();
    return {
        on(event, callback) {
            handlers.set(event, callback);
            return this;
        },
        emit(event, ...args) {
            handlers.get(event)?.(...args);
        }
    };
}

function mockCall(options) {
    return {
        ...events(),
        options,
        actions: [],
        caller: () => "incoming",
        visibleName: () => "Remote User",
        call() { this.actions.push("dial"); },
        answer(answerOptions) { this.answerOptions = answerOptions; },
        hangup() { this.actions.push("hangup"); },
        hold() { this.actions.push("hold"); },
        unhold() { this.actions.push("unhold"); },
        muteAudio() { this.actions.push("muteAudio"); },
        unmuteAudio() { this.actions.push("unmuteAudio"); },
        muteVideo() { this.actions.push("muteVideo"); },
        setAudioOutputId(id) { this.audioOutput = id; },
        getStats(callback) { this.stats = callback; },
        async switchToScreen() { throw new Error("Capture cancelled"); }
    };
}

async function open(example) {
    const file = path.join(root, example, example);
    const html = fs.readFileSync(`${file}.html`, "utf8");
    const elements = new Map();
    for (const [, tag, attributes, id] of html.matchAll(/<([a-z]+)\b([^>]*\sid="([^"]+)"[^>]*)>/g)) {
        const node = {
            value: attributes.match(/\bvalue="([^"]*)"/)?.[1] ?? "",
            checked: /\bchecked\b/.test(attributes),
            disabled: /\bdisabled\b/.test(attributes),
            hidden: /\bhidden\b/.test(attributes),
            textContent: "",
            parentElement: {dataset: {}},
            attributes: {},
            classList: {toggle() {}},
            closest: () => null,
            checkValidity: () => true,
            setAttribute(name, value) { this.attributes[name] = value; },
            querySelector: () => null,
            querySelectorAll: () => [],
            click() { if (!this.disabled) return this.onclick?.(); }
        };
        if (tag === "select") {
            node.options = [{value: ""}];
            node.add = option => node.options.push(option);
        }
        elements.set(id, node);
    }
    const sessions = [];
    const timers = new Map();
    let timerId = 0;
    const constants = statuses => Object.fromEntries(statuses.split(" ").map(status => [status, status]));
    const api = {
        constants: {
            SESSION_STATUS: constants("ESTABLISHED REGISTERED UNREGISTERED DISCONNECTED FAILED INCOMING_CALL"),
            CALL_STATUS: constants("TRYING RING SESSION_PROGRESS ESTABLISHED HOLD FINISH FAILED BUSY"),
            MEDIA_DEVICE_KIND: {ALL: "all"}
        },
        Browser: {isSafariWebRTC: () => false, isChrome: () => true, isAndroid: () => false, isiOS: () => false},
        init() {},
        async getMediaDevices() {
            return {
                audio: [{id: "speaker-1", type: "speaker"}, {id: "mic-1", type: "mic"}],
                video: [{id: "cam-1", type: "camera"}]
            };
        },
        createSession(options) {
            const session = {
                ...events(),
                options,
                calls: [],
                createCall(callOptions) {
                    const call = mockCall(callOptions);
                    this.calls.push(call);
                    return call;
                },
                disconnect() {
                    this.disconnected = true;
                    this.emit("DISCONNECTED", this);
                }
            };
            sessions.push(session);
            return session;
        }
    };
    const context = vm.createContext({
        URL, console,
        Option: class { constructor(text, value) { Object.assign(this, {text, value}); } },
        window: {Flashphoner: api, WCS_SERVER_URL: "wss://selected.example:5443"},
        document: {getElementById: id => elements.get(id)},
        navigator: {mediaDevices: {getDisplayMedia() {}}},
        setInterval(callback) { timers.set(++timerId, callback); return timerId; },
        clearInterval(id) { timers.delete(id); }
    });
    const modules = new Map();
    function moduleAt(filename) {
        if (!modules.has(filename)) {
            const source = fs.readFileSync(filename, "utf8");
            modules.set(filename, new vm.SourceTextModule(source, {context, identifier: filename}));
        }
        return modules.get(filename);
    }
    const entry = moduleAt(`${file}.js`);
    await entry.link((specifier, importer) => moduleAt(path.resolve(path.dirname(importer.identifier), specifier)));
    await entry.evaluate();
    const node = id => elements.get(id);
    const enterCredentials = () => {
        node("sipLogin").value = "alice";
        node("sipAuthenticationName").value = "auth-alice";
        node("sipPassword").value = " password ";
        node("sipDomain").value = "pbx.example";
        node("sipOutboundProxy").value = "proxy.example";
        node("callee").value = "bob";
    };
    return {node, api, sessions, timers, enterCredentials};
}

test("Phone Min waits for SIP registration, accepts incoming calls and supports token reconnect", async () => {
    const {node, sessions, enterCredentials} = await open("phone");
    assert.equal(node("urlServer").value, "wss://selected.example:5443");
    enterCredentials();
    await node("connectBtn").click();
    const session = sessions[0];
    assert.equal(session.options.sipOptions.password, " password ");
    assert.equal(session.options.sipOptions.registerRequired, true);
    session.emit("ESTABLISHED", session, {authToken: "returned-token"});
    assert.equal(node("authToken").value, "returned-token");
    assert.equal(node("callBtn").disabled, true);
    session.emit("REGISTERED", session);
    assert.equal(node("callBtn").disabled, false);
    const incoming = mockCall();
    session.emit("INCOMING_CALL", incoming);
    assert.equal(node("incomingCallAlert").textContent, "Incoming call from Remote User");
    node("answerBtn").click();
    assert.equal(incoming.answerOptions.receiveVideo, false);
    assert.equal(node("holdBtn").disabled, true);
    incoming.emit("ESTABLISHED");
    node("holdBtn").click();
    assert.equal(node("holdBtn").disabled, true);
    incoming.emit("HOLD");
    assert.equal(node("holdBtn").textContent, "Unhold");
    node("holdBtn").click();
    incoming.emit("ESTABLISHED");
    node("muteAudioToggle").checked = true;
    node("muteAudioToggle").onchange();
    node("hangupBtn").click();
    incoming.emit("FINISH");
    assert.deepEqual(incoming.actions, ["hold", "unhold", "muteAudio", "hangup"]);
    assert.equal(node("callBtn").disabled, false);
    await node("connectBtn").click();
    await node("connectTokenBtn").click();
    assert.equal(sessions[1].options.authToken, "returned-token");
    assert.equal(sessions[1].options.sipOptions, undefined);
    session.emit("REGISTERED", session);
    assert.equal(node("regStatus").textContent, "CONNECTING");
});

test("Phone Video applies selected media settings and stops collecting stats after call failure", async () => {
    const {node, sessions, timers, enterCredentials} = await open("phone-video");
    enterCredentials();
    node("sipRegisterRequired").checked = false;
    await node("connectBtn").click();
    const session = sessions[0];
    session.emit("ESTABLISHED", session);
    node("cameraList").value = "cam-1";
    node("micList").value = "mic-1";
    node("speakerList").value = "speaker-1";
    node("sdpStringFind").value = "sendrecv";
    node("sdpStringReplace").value = "recvonly";
    node("callBtn").click();
    const call = session.calls[0];
    assert.equal(call.options.constraints.audio.deviceId.exact, "mic-1");
    assert.equal(call.options.constraints.video.deviceId.exact, "cam-1");
    assert.equal(call.options.constraints.video.width, 320);
    assert.equal(call.options.sdpHook({sdpString: "a=sendrecv"}), "a=recvonly");
    assert.equal(call.audioOutput, "speaker-1");
    call.emit("ESTABLISHED");
    assert.equal(timers.size, 1);
    timers.values().next().value();
    call.stats({outboundStream: {video: {bytesSent: 543, packetsSent: 12}}});
    assert.equal(node("videoBytes").textContent, 543);
    node("screenSharingToggle").checked = true;
    await node("screenSharingToggle").onchange();
    assert.equal(node("screenSharingToggle").checked, false);
    assert.equal(node("cameraList").disabled, false);
    call.emit("FAILED");
    assert.equal(timers.size, 0);
    assert.equal(node("videoBytes").textContent, "—");
    assert.equal(node("callBtn").disabled, false);
    call.stats({outboundStream: {video: {bytesSent: 1}}});
    assert.equal(node("videoBytes").textContent, "—");
});

test("Click to Call reveals missing credentials and releases each finished session", async () => {
    const {node, sessions, enterCredentials} = await open("click-to-call");
    await node("callBtn").click();
    assert.equal(node("sipFields").hidden, false);
    assert.equal(node("sipCredentialsBtn").attributes["aria-expanded"], "true");
    assert.equal(sessions.length, 0);
    enterCredentials();
    await node("callBtn").click();
    const session = sessions[0];
    session.emit("ESTABLISHED", session);
    const call = session.calls[0];
    assert.equal(call.options.callee, "bob");
    assert.equal(call.options.constraints.video, false);
    assert.equal(node("callBtn").textContent, "Hang up");
    node("callBtn").click();
    call.emit("FINISH");
    assert.equal(session.disconnected, true);
    assert.equal(node("callStatus").textContent, "FINISH");
    assert.equal(node("callBtn").textContent, "Call");
    await node("callBtn").click();
    session.emit("FAILED", session);
    assert.equal(node("regStatus").textContent, "CONNECTING");
    sessions[1].emit("FAILED", sessions[1]);
    assert.equal(node("callBtn").disabled, false);
});
