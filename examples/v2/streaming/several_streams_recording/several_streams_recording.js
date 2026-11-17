import * as dom from "../../dependencies/js/dom.js";
import {getWebsocketUrl} from "../../dependencies/js/server-url.js";
import {createStreamName} from "../../dependencies/js/identifiers.js";
import {initializeSDK, setStatus, setError, setInvalid, bindResize} from "../../dependencies/js/streaming.js";

let api;
let session;
let streams = [];
let run = 0;
let stopping = false;

initializeSDK((sdk) => {
    api = sdk;
    dom.setValue("url", getWebsocketUrl());
    bindResize(dom.byId("localVideo"));
    ready();
});

function ready() {
    dom.setDisabled("url", false);
    dom.setDisabled("countStreams", false);
    dom.setButton("publishBtn", "Start", start);
}

function log(message) {
    const output = dom.byId("statusLog");
    output.value += `${message}\n`;
    output.scrollTop = output.scrollHeight;
}

function logStream(stream) {
    log(`Stream: ${stream.name()} - ${stream.status()}${stream.getInfo() ? ` - ${stream.getInfo()}` : ""}`);
}

function start() {
    let server;
    try {
        server = new URL(dom.value("url").trim());
        if (!["ws:", "wss:"].includes(server.protocol) || server.pathname !== "/" || server.search || server.hash || server.username || server.password) throw new Error();
        setInvalid("url", false);
    } catch {
        setInvalid("url", true);
        setError("info", "Enter a WebSocket server URL such as wss://server:8443.");
        dom.byId("url").focus();
        return;
    }
    const count = Number(dom.value("countStreams"));
    const validCount = Number.isSafeInteger(count) && count > 0;
    setInvalid("countStreams", !validCount);
    if (!validCount) {
        setError("info", "Enter a positive whole number of local streams.");
        dom.byId("countStreams").focus();
        return;
    }
    setError("info", "");
    dom.setValue("statusLog", "");
    streams = [];
    stopping = false;
    const attempt = ++run;
    dom.setDisabled("url", true);
    dom.setDisabled("countStreams", true);
    dom.setButton("publishBtn", "Stop", () => stop(attempt));
    setStatus("status", "CONNECTING");
    try {
        session = api.createSession({urlServer: server.origin})
            .on(api.constants.SESSION_STATUS.ESTABLISHED, (connected) => {
                if (attempt !== run) return;
                session = connected;
                log(`Session: ${server.origin} - ESTABLISHED`);
                publishNext(count, attempt);
            }).on(api.constants.SESSION_STATUS.DISCONNECTED, () => {
                if (attempt !== run) return;
                log(`Session: ${server.origin} - DISCONNECTED`);
                finish(attempt, "DISCONNECTED");
            }).on(api.constants.SESSION_STATUS.FAILED, () => {
                if (attempt !== run) return;
                log(`Session: ${server.origin} - FAILED`);
                finish(attempt, "FAILED", "Failed to connect to the WebSocket server.");
            });
    } catch (error) {
        finish(attempt, "FAILED", error.message);
    }
}

function publishNext(count, attempt) {
    if (attempt !== run || stopping || streams.length >= count) return;
    try {
        const stream = session.createStream({
            name: createStreamName(8),
            display: dom.byId(streams.length ? "localTestVideo" : "localVideo"),
            record: true,
            receiveVideo: false,
            receiveAudio: false
        }).on(api.constants.STREAM_STATUS.PUBLISHING, (published) => {
            if (attempt !== run) return;
            logStream(published);
            if (stopping) return;
            if (streams.length < count) Promise.resolve().then(() => publishNext(count, attempt));
            else setStatus("status", "PUBLISHING");
        }).on(api.constants.STREAM_STATUS.UNPUBLISHED, (ended) => {
            if (attempt !== run) return;
            logStream(ended);
            if (stopping && streams.every(terminal)) finish(attempt, "UNPUBLISHED");
            else if (!stopping) finish(attempt, "UNPUBLISHED");
        }).on(api.constants.STREAM_STATUS.FAILED, (failed) => {
            if (attempt !== run) return;
            logStream(failed);
            const terminated = ["FAILED", "DISCONNECTED"].includes(session?.status());
            finish(attempt, terminated ? session.status() : "FAILED", failed.getInfo() || "Stream recording failed.");
        });
        streams.push(stream);
        logStream(stream);
        stream.publish();
    } catch (error) {
        finish(attempt, "FAILED", error.message);
    }
}

function terminal(stream) {
    return ["UNPUBLISHED", "FAILED"].includes(stream.status());
}

function stop(attempt) {
    if (attempt !== run || stopping) return;
    stopping = true;
    dom.setDisabled("publishBtn", true);
    setStatus("status", "PROCESSING");
    if (!streams.length || streams.every(terminal)) {
        finish(attempt, "UNPUBLISHED");
        return;
    }
    for (const stream of [...streams]) {
        if (attempt !== run) break;
        try {
            if (!terminal(stream)) stream.stop();
        } catch (error) {
            finish(attempt, "FAILED", error.message);
            break;
        }
    }
}

function finish(attempt, status, message = "") {
    if (attempt !== run) return;
    ++run;
    const active = streams;
    const connection = session;
    streams = [];
    session = null;
    for (const stream of active) {
        try {
            if (!terminal(stream)) stream.stop();
        } catch (error) { message ||= error.message; }
    }
    try { connection?.disconnect(); } catch (error) { message ||= error.message; }
    setStatus("status", status);
    setError("info", message);
    ready();
}
