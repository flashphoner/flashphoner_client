import * as dom from "../../dependencies/js/dom.js";
import {getWebsocketUrl} from "../../dependencies/js/server-url.js";
import {createStreamName} from "../../dependencies/js/identifiers.js";
import {initializeSDK, setStatus, setError, setInvalid, bindResize} from "../../dependencies/js/streaming.js";

let api;
let session;
let publisher;
let run = 0;
let stopping = false;

initializeSDK((sdk) => {
    api = sdk;
    dom.setValue("url", getWebsocketUrl());
    dom.setValue("streamName", createStreamName(8));
    bindResize(dom.byId("localVideo"));
    ready();
});

function ready() {
    for (const id of ["url", "rtmpUrl", "streamName"]) dom.setDisabled(id, false);
    dom.setButton("publishBtn", "Start", start);
}

function readOptions() {
    let server;
    let destination;
    try {
        server = new URL(dom.value("url").trim());
        if (!["ws:", "wss:"].includes(server.protocol) || server.pathname !== "/" || server.search || server.hash || server.username || server.password) throw new Error();
        setInvalid("url", false);
    } catch {
        setInvalid("url", true);
        setError("info", "Enter a WebSocket server URL such as wss://server:8443.");
        dom.byId("url").focus();
        return null;
    }
    try {
        destination = new URL(dom.value("rtmpUrl").trim());
        if (!["rtmp:", "rtmps:"].includes(destination.protocol) || !destination.hostname || destination.hash) throw new Error();
        setInvalid("rtmpUrl", false);
    } catch {
        setInvalid("rtmpUrl", true);
        setError("info", "Enter an RTMP destination such as rtmp://server:1935/live.");
        dom.byId("rtmpUrl").focus();
        return null;
    }
    const name = dom.value("streamName").trim();
    setInvalid("streamName", !name);
    if (!name) {
        setError("info", "Enter a stream name.");
        dom.byId("streamName").focus();
        return null;
    }
    return {server: server.origin, rtmpUrl: dom.value("rtmpUrl").trim(), destination, name};
}

function start() {
    const options = readOptions();
    if (!options) return;
    setError("info", "");
    dom.setVisible("playback", false);
    for (const id of ["url", "rtmpUrl", "streamName"]) dom.setDisabled(id, true);
    stopping = false;
    const attempt = ++run;
    dom.setButton("publishBtn", "Stop", () => stop(attempt));
    setStatus("status", "CONNECTING");
    try {
        session = api.createSession({urlServer: options.server})
            .on(api.constants.SESSION_STATUS.ESTABLISHED, (connected) => {
                if (attempt !== run) return;
                session = connected;
                publish(options, attempt);
            }).on(api.constants.SESSION_STATUS.DISCONNECTED, () => finish(attempt, "DISCONNECTED"))
            .on(api.constants.SESSION_STATUS.FAILED, () => finish(attempt, "FAILED", "Failed to connect to the WebSocket server."));
    } catch (error) {
        finish(attempt, "FAILED", error.message);
    }
}

function publish(options, attempt) {
    try {
        publisher = session.createStream({
            name: options.name,
            display: dom.byId("localVideo"),
            cacheLocalResources: true,
            receiveVideo: false,
            receiveAudio: false,
            rtmpUrl: options.rtmpUrl
        }).on(api.constants.STREAM_STATUS.PUBLISHING, () => {
            if (attempt !== run || stopping) return;
            setStatus("status", "PUBLISHING");
            const address = new URL(options.destination.href);
            if (["localhost", "127.0.0.1", "[::1]"].includes(address.hostname)) {
                address.hostname = new URL(options.server).hostname;
            }
            address.pathname = `${address.pathname.replace(/\/$/, "")}/rtmp_${encodeURIComponent(options.name)}`;
            dom.setText("player", address.href);
            dom.setVisible("playback", true);
        }).on(api.constants.STREAM_STATUS.UNPUBLISHED, () => finish(attempt, "UNPUBLISHED"))
            .on(api.constants.STREAM_STATUS.FAILED, (stream) => {
                if (attempt !== run) return;
                const terminated = ["FAILED", "DISCONNECTED"].includes(session?.status());
                finish(attempt, terminated ? session.status() : "FAILED", stream.getInfo() || "RTMP publishing failed.");
            });
        publisher.publish();
    } catch (error) {
        finish(attempt, "FAILED", error.message);
    }
}

function stop(attempt) {
    if (attempt !== run || stopping) return;
    if (!publisher) {
        finish(attempt, "UNPUBLISHED");
        return;
    }
    stopping = true;
    dom.setDisabled("publishBtn", true);
    setStatus("status", "PROCESSING");
    try {
        publisher.stop();
    } catch (error) {
        finish(attempt, "FAILED", error.message);
    }
}

function finish(attempt, status, message = "") {
    if (attempt !== run) return;
    ++run;
    const stream = publisher;
    const connection = session;
    publisher = null;
    session = null;
    try {
        if (stream && !["UNPUBLISHED", "FAILED"].includes(stream.status())) stream.stop();
    } catch (error) { message ||= error.message; }
    try { connection?.disconnect(); } catch (error) { message ||= error.message; }
    setStatus("status", status);
    setError("info", message);
    ready();
}
