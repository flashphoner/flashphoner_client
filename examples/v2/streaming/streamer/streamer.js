import * as dom from "../../dependencies/js/dom.js";
import {getWebsocketUrl, readStreamAddress} from "../../dependencies/js/server-url.js";
import {createStreamName} from "../../dependencies/js/identifiers.js";
import {initializeSDK, setStatus, setError, setInvalid, bindResize} from "../../dependencies/js/streaming.js";

let api;
let sessionStatus;
let streamStatus;
let session;
let publisher;
let preview;
let run = 0;
let connectionRun = 0;
let failed = false;
let stopping = false;

initializeSDK((sdk) => {
    api = sdk;
    sessionStatus = api.constants.SESSION_STATUS;
    streamStatus = api.constants.STREAM_STATUS;
    dom.setValue("url", `${getWebsocketUrl()}/${createStreamName(8)}`);
    bindResize(dom.byId("localVideo"));
    bindResize(dom.byId("remoteVideo"));
    ready();
});

function ready() {
    dom.setButton("publishBtn", "Start", start);
    dom.setDisabled("url", Boolean(session));
}

function readAddress() {
    const address = readStreamAddress(dom.value("url"));
    if (address) {
        setInvalid("url", false);
        return address;
    }
    setInvalid("url", true);
    setError("info", "Enter a URL such as wss://server:8443/stream.");
    dom.byId("url").focus();
    return null;
}

function start() {
    const address = readAddress();
    if (!address) return;
    failed = false;
    stopping = false;
    setError("info", "");
    dom.setDisabled("url", true);
    dom.setDisabled("publishBtn", true);
    const attempt = ++run;
    if (session) {
        publish(address.name, attempt);
        return;
    }
    setStatus("status", "CONNECTING");
    const connection = ++connectionRun;
    try {
        session = api.createSession({urlServer: address.server})
            .on(sessionStatus.ESTABLISHED, (connected) => {
                if (connection !== connectionRun || attempt !== run) return;
                session = connected;
                publish(address.name, attempt);
            })
            .on(sessionStatus.DISCONNECTED, () => {
                if (connection === connectionRun) disconnected(sessionStatus.DISCONNECTED);
            }).on(sessionStatus.FAILED, () => {
                if (connection === connectionRun) disconnected(sessionStatus.FAILED);
            });
    } catch (error) {
        ++connectionRun;
        session = null;
        fail(error.message);
        ready();
    }
}

function disconnected(status) {
    const wasStreaming = Boolean(publisher);
    ++connectionRun;
    ++run;
    publisher = null;
    preview = null;
    session = null;
    setStatus("status", status);
    if (wasStreaming) setError("info", "Connection closed. Streaming stopped.");
    else if (status === sessionStatus.FAILED) setError("info", "Failed to connect to the WebSocket server.");
    ready();
}

function publish(name, attempt) {
    try {
        publisher = session.createStream({
            name,
            display: dom.byId("localVideo"),
            cacheLocalResources: true,
            receiveVideo: false,
            receiveAudio: false
        }).on(streamStatus.PUBLISHING, (stream) => {
            if (attempt !== run) return;
            publisher = stream;
            setStatus("status", streamStatus.PUBLISHING);
            dom.setButton("publishBtn", "Stop", stop);
            playPreview(name, attempt);
        }).on(streamStatus.UNPUBLISHED, () => finished(attempt, streamStatus.UNPUBLISHED))
            .on(streamStatus.FAILED, (stream) => {
                if (attempt !== run || sessionTerminated()) return;
                fail(stream.getInfo());
                finished(attempt, streamStatus.FAILED);
            });
        publisher.publish();
    } catch (error) {
        fail(error.message);
        finished(attempt, streamStatus.FAILED);
    }
}

function playPreview(name, attempt) {
    try {
        preview = session.createStream({name, display: dom.byId("remoteVideo")})
            .on(streamStatus.PLAYING, () => {
                if (attempt !== run) return;
                dom.setButton("publishBtn", "Stop", stop);
            }).on(streamStatus.STOPPED, () => {
                if (attempt !== run) return;
                preview = null;
                stop();
            }).on(streamStatus.FAILED, (stream) => {
                if (attempt !== run || sessionTerminated()) return;
                preview = null;
                fail(stream.getInfo());
                stop();
            });
        preview.play();
    } catch (error) {
        fail(error.message);
        stop();
    }
}

function sessionTerminated() {
    return [sessionStatus.DISCONNECTED, sessionStatus.FAILED].includes(session?.status());
}

function stop() {
    if (stopping) return;
    stopping = true;
    dom.setDisabled("publishBtn", true);
    const player = preview;
    preview = null;
    try {
        player?.stop();
    } catch (error) {
        fail(error.message);
    }
    try {
        publisher?.stop();
    } catch (error) {
        fail(error.message);
        finished(run, streamStatus.FAILED);
    }
}

function finished(attempt, status) {
    if (attempt !== run) return;
    ++run;
    const player = preview;
    preview = null;
    publisher = null;
    try {
        player?.stop();
    } catch (error) {
        fail(error.message);
    }
    if (!failed) setStatus("status", status);
    ready();
}

function fail(message) {
    failed = true;
    setStatus("status", "FAILED");
    setError("info", message || "Streaming failed.");
}
