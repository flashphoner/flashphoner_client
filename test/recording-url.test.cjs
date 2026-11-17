const assert = require("node:assert/strict");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");

const src = path.resolve(__dirname, "../src");
const sockets = [];
class FakeWebSocket {
    static OPEN = 1;
    constructor() { this.readyState = 1; this.sent = []; sockets.push(this); }
    send(message) { this.sent.push(JSON.parse(message)); }
    close() {}
    deliver(message, ...data) { this.onmessage({data: JSON.stringify({message, data})}); }
}

const provider = {
    available: () => true,
    configure() {},
    getMediaAccess: () => Promise.resolve(),
    createConnection: () => Promise.resolve({
        createOffer: () => Promise.resolve({sdp: "v=0"}), close() {}, getVideoElement: () => null
    })
};
const unavailable = {available: () => false};
const providers = {
    "webrtc-media-provider": unavailable,
    "temasys-media-provider": {},
    "websocket-media-provider": provider,
    "media-source-media-provider": unavailable
};
const originalLoad = Module._load;
Module._load = function (request, parent) {
    if (parent?.filename === path.join(src, "flashphoner-core.js") && request.startsWith("./")) {
        const replacement = providers[request.slice(2).replace(/\.js$/, "")];
        if (replacement) return replacement;
    }
    return originalLoad.apply(this, arguments);
};
globalThis.window = {navigator: {appVersion: "test", userAgent: "test"}};
globalThis.navigator = globalThis.window.navigator;
globalThis.WebSocket = FakeWebSocket;
const sdk = require(path.join(src, "flashphoner-core.js"));

async function recording(fields, record = true) {
    await sdk.init({collectClientInfo: false});
    const session = sdk.createSession({urlServer: "wss://wcs:8443", sendClientInfo: false});
    const socket = sockets.at(-1);
    socket.onopen();
    socket.deliver("getUserData", {authToken: "session-token"});
    const stream = session.createStream({name: "recorded", record, display: {}, mediaProvider: "WSPlayer"});
    stream.publish();
    for (let i = 0; !socket.sent.some(item => item.message === "publishStream") && i < 50; i++) {
        await new Promise(resolve => setImmediate(resolve));
    }
    assert.ok(socket.sent.some(item => item.message === "publishStream"));
    let completed;
    stream.on(sdk.constants.STREAM_STATUS.UNPUBLISHED, current => {
        completed = {filename: current.getRecordInfo(), url: current.getRecordUrl()};
    });
    socket.deliver("notifyStreamStatusEvent", {mediaSessionId: stream.id(), status: "UNPUBLISHED", ...fields});
    assert.equal(stream.status(), sdk.constants.STREAM_STATUS.UNPUBLISHED);
    return completed;
}

test("recording status exposes a file-specific URL before invoking the completion callback", async () => {
    const url = "/client/records/recorded.mp4?token=ln-private-record";
    assert.deepEqual(await recording({recordName: "recorded.mp4", recordUrl: url}), {
        filename: "recorded.mp4", url
    });
});

test("older WCS recording events preserve the filename without inventing an access URL", async () => {
    assert.deepEqual(await recording({recordName: "legacy.mp4"}), {filename: "legacy.mp4", url: null});
});

test("non-recording streams do not expose recording metadata from status messages", async () => {
    assert.deepEqual(await recording({recordName: "unrelated.mp4", recordUrl: "/client/records/unrelated.mp4"}, false), {
        filename: null, url: null
    });
});
