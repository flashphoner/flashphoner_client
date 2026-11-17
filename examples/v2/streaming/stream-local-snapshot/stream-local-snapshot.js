import * as dom from "../../dependencies/js/dom.js";
import {getWebsocketUrl, readStreamAddress} from "../../dependencies/js/server-url.js";
import {createStreamName} from "../../dependencies/js/identifiers.js";
import {initializeSDK, setStatus, setError, setInvalid, bindResize} from "../../dependencies/js/streaming.js";

initializeSDK((api) => {
    const {SESSION_STATUS, STREAM_STATUS} = api.constants;
    let session;
    let publisher;
    let connectionAttempt = 0;
    let publishAttempt = 0;
    let busy = false;

    dom.setValue("url", `${getWebsocketUrl()}/${createStreamName(8)}`);
    dom.byId("publishBtn").onclick = publishButtonClick;
    dom.byId("snapshotBtn").onclick = takeSnapshot;
    bindResize(dom.byId("localVideo"));
    updateControls();

    function updateControls() {
        dom.setDisabled("url", Boolean(session) || busy);
        dom.setDisabled("publishBtn", busy);
        dom.setText("publishBtn", publisher ? "Stop" : "Start");
        dom.setDisabled("snapshotBtn", busy || publisher?.status() !== STREAM_STATUS.PUBLISHING);
    }

    function publishButtonClick() {
        if (busy) return;
        if (publisher) {
            busy = true;
            updateControls();
            try {
                publisher.stop();
            } catch (error) {
                busy = false;
                setError("info", error.message);
                updateControls();
            }
            return;
        }
        const address = readStreamAddress(dom.value("url"));
        setInvalid("url", !address);
        if (!address) {
            setError("info", "Enter a URL such as wss://server:8443/stream.");
            dom.byId("url").focus();
            return;
        }
        busy = true;
        setError("info", "");
        setError("snapshotError", "");
        setStatus("snapshotStatus", "");
        const attempt = ++publishAttempt;
        updateControls();
        if (session) {
            publish(address.name, attempt);
            return;
        }
        const connection = ++connectionAttempt;
        setStatus("status", "CONNECTING");
        try {
            session = api.createSession({urlServer: address.server});
            session.on(SESSION_STATUS.ESTABLISHED, (connected) => {
                if (connection !== connectionAttempt || attempt !== publishAttempt) return;
                session = connected;
                publish(address.name, attempt);
            }).on(SESSION_STATUS.DISCONNECTED, () => disconnected(connection, SESSION_STATUS.DISCONNECTED))
                .on(SESSION_STATUS.FAILED, () => disconnected(connection, SESSION_STATUS.FAILED));
        } catch (error) {
            disconnected(connection, SESSION_STATUS.FAILED);
            setError("info", error.message);
        }
    }

    function disconnected(connection, status) {
        if (connection !== connectionAttempt) return;
        connectionAttempt++;
        publishAttempt++;
        const active = Boolean(publisher);
        session = undefined;
        publisher = undefined;
        busy = false;
        setStatus("status", status);
        setStatus("snapshotStatus", "");
        setError("info", active ? "Connection closed. Publishing stopped." : status === SESSION_STATUS.FAILED ? "Can't connect to server." : "");
        updateControls();
    }

    function publish(name, attempt) {
        setStatus("status", "PENDING");
        try {
            const stream = session.createStream({name, display: dom.byId("localVideo"), cacheLocalResources: true, receiveVideo: false, receiveAudio: false});
            publisher = stream;
            stream.on(STREAM_STATUS.PUBLISHING, () => {
                if (attempt !== publishAttempt || publisher !== stream) return;
                busy = false;
                setStatus("status", STREAM_STATUS.PUBLISHING);
                updateControls();
            }).on(STREAM_STATUS.UNPUBLISHED, () => finished(stream, attempt, STREAM_STATUS.UNPUBLISHED))
                .on(STREAM_STATUS.FAILED, () => finished(stream, attempt, STREAM_STATUS.FAILED));
            stream.publish();
        } catch (error) {
            publisher = undefined;
            busy = false;
            setStatus("status", STREAM_STATUS.FAILED);
            setError("info", error.message);
            updateControls();
        }
    }

    function finished(stream, attempt, status) {
        if (attempt !== publishAttempt || publisher !== stream) return;
        if ([SESSION_STATUS.DISCONNECTED, SESSION_STATUS.FAILED].includes(session?.status())) return;
        publishAttempt++;
        publisher = undefined;
        busy = false;
        setStatus("status", status);
        setStatus("snapshotStatus", "");
        if (status === STREAM_STATUS.FAILED) setError("info", stream.getInfo() || "Publishing failed.");
        updateControls();
    }

    function takeSnapshot() {
        if (busy || publisher?.status() !== STREAM_STATUS.PUBLISHING) return;
        setError("snapshotError", "");
        try {
            const video = dom.byId("localVideo").querySelector("video");
            if (!video || !(video.videoWidth > 0) || !(video.videoHeight > 0)) {
                throw new Error("The local video is not ready. Try again when the camera preview appears.");
            }
            const canvas = dom.byId("snapshotCanvas");
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const context = canvas.getContext("2d");
            if (!context) throw new Error("This browser cannot capture a snapshot.");
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            dom.byId("snapshotImg").src = canvas.toDataURL("image/png");
            dom.setVisible("snapshotImg", true);
            finishSnapshot("SNAPSHOT_COMPLETE");
        } catch (error) {
            finishSnapshot("FAILED", error.message);
        }
    }

    function finishSnapshot(status, error = "") {
        setStatus("snapshotStatus", status);
        setError("snapshotError", error);
        updateControls();
    }
});
