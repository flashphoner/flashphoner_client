import * as dom from "../../dependencies/js/dom.js";
import {getWebsocketUrl, getWebOrigin, readStreamAddress} from "../../dependencies/js/server-url.js";
import {createStreamName} from "../../dependencies/js/identifiers.js";
import {initializeSDK, setStatus, setError, setInvalid, bindResize} from "../../dependencies/js/streaming.js";

let api;
let session;
let publisher;
let run = 0;
let serverUrl;
let stopping = false;

initializeSDK((sdk) => {
    api = sdk;
    dom.setValue("url", `${getWebsocketUrl()}/${createStreamName(8)}`);
    bindResize(dom.byId("localVideo"));
    ready();
});

function ready() {
    dom.setDisabled("url", false);
    dom.setButton("publishBtn", "Start", start);
}

function start() {
    const address = readStreamAddress(dom.value("url"));
    setInvalid("url", !address);
    if (!address) {
        setError("info", "Enter a URL such as wss://server:8443/stream.");
        dom.byId("url").focus();
        return;
    }
    setError("info", "");
    clearRecording();
    serverUrl = address.server;
    stopping = false;
    const attempt = ++run;
    dom.setDisabled("url", true);
    dom.setButton("publishBtn", "Stop", () => stop(attempt));
    setStatus("status", "CONNECTING");
    try {
        session = api.createSession({urlServer: address.server})
            .on(api.constants.SESSION_STATUS.ESTABLISHED, (connected) => {
                if (attempt !== run) return;
                session = connected;
                publish(address.name, attempt);
            }).on(api.constants.SESSION_STATUS.DISCONNECTED, () => finish(attempt, "DISCONNECTED"))
            .on(api.constants.SESSION_STATUS.FAILED, () => finish(attempt, "FAILED", "Failed to connect to the WebSocket server."));
    } catch (error) {
        finish(attempt, "FAILED", error.message);
    }
}

function publish(name, attempt) {
    try {
        publisher = session.createStream({
            name,
            display: dom.byId("localVideo"),
            record: true,
            receiveVideo: false,
            receiveAudio: false
        }).on(api.constants.STREAM_STATUS.PUBLISHING, () => {
            if (attempt !== run || stopping) return;
            setStatus("status", "PUBLISHING");
        }).on(api.constants.STREAM_STATUS.UNPUBLISHED, (stream) => completed(stream, attempt, "UNPUBLISHED"))
            .on(api.constants.STREAM_STATUS.FAILED, (stream) => {
                if (attempt !== run) return;
                const terminated = ["FAILED", "DISCONNECTED"].includes(session?.status());
                completed(stream, attempt, terminated ? session.status() : "FAILED", stream.getInfo() || "Recording failed.");
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
    setStatus("status", "PROCESSING");
    dom.setDisabled("publishBtn", true);
    try {
        publisher.stop();
    } catch (error) {
        finish(attempt, "FAILED", error.message);
    }
}

function completed(stream, attempt, status, message = "") {
    if (attempt !== run) return;
    try {
        const filename = stream.getRecordInfo();
        if (typeof filename === "string" && filename && ![".", ".."].includes(filename)) {
            const origin = new URL(getWebOrigin(serverUrl)).origin;
            const recordUrl = stream.getRecordUrl?.() || `/client/records/${encodeURIComponent(filename)}`;
            const address = new URL(recordUrl, origin);
            const prefix = "/client/records/";
            if (address.origin !== origin || address.username || address.password || address.hash
                    || !address.pathname.startsWith(prefix)
                    || decodeURIComponent(address.pathname.slice(prefix.length)) !== filename) {
                throw new Error("Invalid recording URL returned by the server.");
            }
            const download = new URL(address.href);
            download.searchParams.set("download", "true");
            dom.byId("link").href = download.href;
            dom.byId("recVideo").src = address.href;
            dom.setVisible("recVideo", true);
            dom.setVisible("downloadDiv", true);
        }
    } catch (error) {
        status = "FAILED";
        message ||= error.message;
    }
    finish(attempt, status, message);
}

function clearRecording() {
    dom.setVisible("downloadDiv", false);
    dom.setVisible("recVideo", false);
    dom.byId("link").removeAttribute("href");
    const video = dom.byId("recVideo");
    video.pause();
    video.removeAttribute("src");
    video.load();
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
