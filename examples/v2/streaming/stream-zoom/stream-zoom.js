import * as dom from "../../dependencies/js/dom.js";
import {getWebsocketUrl, readStreamAddress} from "../../dependencies/js/server-url.js";
import {createStreamName} from "../../dependencies/js/identifiers.js";
import {initializeSDK, setStatus, setError, setInvalid, bindResize} from "../../dependencies/js/streaming.js";

initializeSDK((api) => {
    const {SESSION_STATUS, STREAM_STATUS} = api.constants;
    let session;
    let publisher;
    let preview;
    let run = 0;
    let connectionRun = 0;
    let busy = false;
    let zoomRequest = 0;

    dom.setValue("url", `${getWebsocketUrl()}/${createStreamName(8)}`);
    bindResize(dom.byId("localVideo"));
    bindResize(dom.byId("remoteVideo"));
    setStatus("status", SESSION_STATUS.DISCONNECTED);
    dom.byId("publishBtn").onclick = () => publisher ? finish(STREAM_STATUS.UNPUBLISHED) : start();
    updateControls();

    function updateControls() {
        dom.setDisabled("url", busy || Boolean(session));
        dom.setDisabled("publishBtn", busy);
        dom.setText("publishBtn", publisher ? "Stop" : "Start");
    }

    function start() {
        if (busy) return;
        const address = readStreamAddress(dom.value("url"));
        setInvalid("url", !address);
        if (!address) {
            setError("info", "Enter a URL such as wss://server:8443/stream.");
            return;
        }
        const attempt = ++run;
        busy = true;
        setError("info", "");
        setError("zoomError", "");
        dom.setText("zoomInfo", "Checking the camera's zoom support…");
        updateControls();
        if (session?.status() === SESSION_STATUS.ESTABLISHED) {
            publish(address.name, attempt);
            return;
        }
        setStatus("status", "CONNECTING");
        const connection = ++connectionRun;
        try {
            session = api.createSession({urlServer: address.server})
                .on(SESSION_STATUS.ESTABLISHED, (connected) => {
                    if (connection !== connectionRun || attempt !== run) return;
                    session = connected;
                    publish(address.name, attempt);
                }).on(SESSION_STATUS.DISCONNECTED, () => disconnected(connection, SESSION_STATUS.DISCONNECTED))
                .on(SESSION_STATUS.FAILED, () => disconnected(connection, SESSION_STATUS.FAILED));
        } catch (error) {
            ++connectionRun;
            session = undefined;
            finish(STREAM_STATUS.FAILED, error.message);
        }
    }

    function publish(name, attempt) {
        try {
            publisher = session.createStream({
                name, display: dom.byId("localVideo"),
                receiveAudio: false, receiveVideo: false,
                constraints: {video: {zoom: true}, audio: true}
            }).on(STREAM_STATUS.PUBLISHING, (stream) => {
                if (attempt !== run) return;
                publisher = stream;
                setStatus("status", STREAM_STATUS.PUBLISHING);
                busy = false;
                updateControls();
                setUpZoom(stream, attempt);
                playPreview(name, attempt);
            }).on(STREAM_STATUS.UNPUBLISHED, () => {
                if (attempt === run) finish(STREAM_STATUS.UNPUBLISHED);
            }).on(STREAM_STATUS.FAILED, (stream) => {
                if (attempt === run && !sessionTerminated()) finish(STREAM_STATUS.FAILED, stream.getInfo());
            });
            publisher.publish();
        } catch (error) {
            finish(STREAM_STATUS.FAILED, error.message);
        }
    }

    function playPreview(name, attempt) {
        try {
            preview = session.createStream({name, display: dom.byId("remoteVideo")})
                .on(STREAM_STATUS.STOPPED, () => {
                    if (attempt === run) finish(STREAM_STATUS.UNPUBLISHED);
                }).on(STREAM_STATUS.FAILED, (stream) => {
                    if (attempt === run && !sessionTerminated()) finish(STREAM_STATUS.FAILED, stream.getInfo());
                });
            preview.play();
        } catch (error) {
            finish(STREAM_STATUS.FAILED, error.message);
        }
    }

    function setUpZoom(stream, attempt) {
        try {
            const capabilities = stream.getZoomCapabilities();
            if (!capabilities) {
                dom.setText("zoomInfo", "This camera does not support zoom.");
                return;
            }
            const control = dom.byId("zoom");
            control.min = capabilities.min;
            control.max = capabilities.max;
            control.step = capabilities.step;
            control.value = capabilities.value;
            control.disabled = false;
            dom.setText("zoomInfo", `Zoom: ${control.value}`);
            control.oninput = async () => {
                const request = ++zoomRequest;
                const value = Number(control.value);
                setError("zoomError", "");
                try {
                    await stream.setZoom(value);
                    if (attempt !== run || request !== zoomRequest) return;
                    dom.setText("zoomInfo", `Zoom: ${stream.getZoom()}`);
                } catch (error) {
                    if (attempt !== run || request !== zoomRequest) return;
                    control.value = stream.getZoom();
                    setError("zoomError", error.message || "Unable to change camera zoom.");
                }
            };
        } catch (error) {
            dom.setText("zoomInfo", "Camera zoom is unavailable.");
            setError("zoomError", error.message);
        }
    }

    function sessionTerminated() {
        return [SESSION_STATUS.DISCONNECTED, SESSION_STATUS.FAILED].includes(session?.status());
    }

    function disconnected(connection, status) {
        if (connection !== connectionRun) return;
        ++connectionRun;
        session = undefined;
        finish(status, status === SESSION_STATUS.FAILED ? "Unable to connect to the server." : "");
    }

    function finish(status, error = "") {
        ++run;
        ++zoomRequest;
        ++connectionRun;
        const streams = [preview, publisher];
        const connection = session;
        preview = publisher = session = undefined;
        busy = false;
        dom.setDisabled("zoom", true);
        dom.byId("zoom").oninput = null;
        dom.setText("zoomInfo", "Start streaming to check the camera's zoom support.");
        for (const stream of streams) {
            if (!stream || [STREAM_STATUS.STOPPED, STREAM_STATUS.UNPUBLISHED, STREAM_STATUS.FAILED].includes(stream.status())) continue;
            try { stream.stop(); } catch (failure) { error ||= failure.message; }
        }
        if (connection && ![SESSION_STATUS.DISCONNECTED, SESSION_STATUS.FAILED].includes(connection.status())) {
            try { connection.disconnect(); } catch (failure) { error ||= failure.message; }
        }
        setStatus("status", status);
        setError("info", error);
        updateControls();
    }
});
