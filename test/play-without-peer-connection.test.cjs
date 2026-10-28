const assert = require("node:assert/strict");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");

const src = path.resolve(__dirname, "../src");
const sockets = [];

class FakeWebSocket {
    static OPEN = 1;
    constructor(url) {
        this.url = url;
        this.readyState = 1;
        this.sent = [];
        sockets.push(this);
    }
    send(message) {
        this.sent.push(JSON.parse(message));
    }
    close() {}
    deliver(message, ...data) {
        this.onmessage({data: JSON.stringify({message, data})});
    }
}

function providerWithoutPeerConnection() {
    return {
        available: () => true,
        configure() {},
        createConnection: () => Promise.resolve({
            createOffer: () => Promise.resolve({sdp: "v=0"}),
            close() {},
            getVideoElement: () => null
        })
    };
}

const unavailable = {available: () => false};
const stubs = {
    [path.join(src, "webrtc-media-provider")]: unavailable,
    [path.join(src, "temasys-media-provider")]: {},
    [path.join(src, "websocket-media-provider")]: unavailable,
    [path.join(src, "media-source-media-provider")]: unavailable
};

let installedProvider = {module: null, exports: null};
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
    if (parent && parent.filename.startsWith(src) && request.startsWith(".")) {
        const resolved = path.join(path.dirname(parent.filename), request).replace(/\.js$/, "");
        if (resolved === installedProvider.module) return installedProvider.exports;
        if (stubs[resolved]) return stubs[resolved];
    }
    return originalLoad.apply(this, arguments);
};

function loadSdkWith(providerName) {
    installedProvider = {
        module: path.join(src, providerName === "MSE" ? "media-source-media-provider" : "websocket-media-provider"),
        exports: providerWithoutPeerConnection()
    };
    for (const key of Object.keys(require.cache)) {
        if (key.startsWith(src)) delete require.cache[key];
    }
    return require(path.join(src, "flashphoner-core.js"));
}

async function sent(ws, message) {
    for (let attempt = 0; attempt < 50; attempt++) {
        const command = ws.sent.find(candidate => candidate.message === message);
        if (command) return command;
        await new Promise(resolve => setImmediate(resolve));
    }
    assert.fail(`${message} was never sent`);
}

globalThis.window = {navigator: {appVersion: "test", userAgent: "test"}};
globalThis.navigator = globalThis.window.navigator;
globalThis.WebSocket = FakeWebSocket;

for (const providerName of ["MSE", "WSPlayer"]) {
    test(`${providerName} player reaches PLAYING when the server enables WebRTC metrics`, async () => {
        const Flashphoner = loadSdkWith(providerName);
        await Flashphoner.init({collectClientInfo: false});
        const session = Flashphoner.createSession({urlServer: "wss://wcs:8443", sendClientInfo: false});
        const ws = sockets.at(-1);
        ws.onopen();
        ws.deliver("getUserData", {authToken: "token", webRTCMetricsServerDescription: {ingestPoint: "ws"}});

        const stream = session.createStream({name: "1602", mediaProvider: providerName, display: {}});
        const playing = new Promise(resolve => stream.on(Flashphoner.constants.STREAM_STATUS.PLAYING, resolve));
        stream.play();
        const playStream = await sent(ws, "playStream");

        ws.deliver("notifyStreamStatusEvent", {mediaSessionId: playStream.data[0].mediaSessionId, status: "PLAYING"});

        assert.equal(await playing, stream);
        assert.equal(stream.status(), Flashphoner.constants.STREAM_STATUS.PLAYING);
    });
}
