import * as dom from "../../dependencies/js/dom.js";
import {createStreamName} from "../../dependencies/js/identifiers.js";
import {getWebsocketUrl} from "../../dependencies/js/server-url.js";
import {initializeSDK, setStatus, setError, validateRequired, bindResize} from "../../dependencies/js/streaming.js";

initializeSDK((api) => {
    const {SESSION_STATUS, STREAM_STATUS, STREAM_EVENT, STREAM_EVENT_TYPE, STREAM_STATUS_INFO = {}, ERROR_INFO = {}} = api.constants;
    let session;
    let publisher;
    let player;
    let connectionBusy = false;
    let connectionEstablished = false;
    let disconnectRequested = false;
    let publishBusy = false;
    let playBusy = false;
    let availableBusy = false;
    let connectionAttempt = 0;
    let availabilityAttempt = 0;

    const connectionFields = ["urlServer"];
    const connected = () => session?.status() === SESSION_STATUS.ESTABLISHED;
    const message = (error) => error?.message || String(error);

    dom.setValue("urlServer", getWebsocketUrl());
    const name = createStreamName();
    dom.setValue("publishStream", name);
    dom.setValue("playStream", name);
    bindResize(dom.byId("localVideo"));
    bindResize(dom.byId("remoteVideo"));
    setStatus("connectStatus", SESSION_STATUS.DISCONNECTED);
    dom.byId("connectBtn").onclick = connectButtonClick;
    dom.byId("publishBtn").onclick = publishButtonClick;
    dom.byId("playBtn").onclick = playButtonClick;
    dom.byId("sendDataBtn").onclick = sendData;
    dom.byId("availableBtn").onclick = checkAvailability;
    dom.byId("playStream").addEventListener("input", () => {
        availabilityAttempt++;
        availableBusy = false;
        setStatus("availableStatus", "");
        setError("availableError", "");
        updateControls();
    });
    updateControls();

    function updateControls() {
        const established = connected();
        const locked = connectionBusy || established;
        connectionFields.forEach((id) => dom.setDisabled(id, locked));
        dom.setDisabled("connectBtn", connectionBusy);
        dom.setText("connectBtn", established ? "Disconnect" : "Connect");
        dom.setDisabled("publishStream", !established || publishBusy || Boolean(publisher));
        dom.setDisabled("publishBtn", !established || publishBusy);
        dom.setText("publishBtn", publisher ? "Stop" : "Publish");
        dom.setDisabled("playStream", !established || playBusy || Boolean(player));
        dom.setDisabled("playBtn", !established || playBusy);
        dom.setText("playBtn", player ? "Stop" : "Play");
        dom.setDisabled("sendDataBtn", !established || publishBusy || publisher?.status() !== STREAM_STATUS.PUBLISHING);
        dom.setDisabled("availableBtn", !established || availableBusy);
    }

    function connectButtonClick() {
        if (connectionBusy) return;
        if (connected()) {
            connectionBusy = true;
            disconnectRequested = true;
            updateControls();
            try {
                session.disconnect();
            } catch (error) {
                connectionBusy = false;
                disconnectRequested = false;
                setError("connectError", message(error));
                updateControls();
            }
            return;
        }
        if (!validateRequired("urlServer")) return;
        const options = {urlServer: dom.value("urlServer").trim()};
        const attempt = ++connectionAttempt;
        connectionBusy = true;
        connectionEstablished = false;
        disconnectRequested = false;
        setError("connectError", "");
        setStatus("connectStatus", "CONNECTING");
        updateControls();
        try {
            session = api.createSession(options);
            if (SESSION_STATUS.CONNECTED) {
                session.on(SESSION_STATUS.CONNECTED, () => {
                    if (attempt === connectionAttempt) setStatus("connectStatus", SESSION_STATUS.CONNECTED);
                });
            }
            session.on(SESSION_STATUS.ESTABLISHED, (establishedSession) => {
                if (attempt !== connectionAttempt) return;
                session = establishedSession;
                connectionBusy = false;
                connectionEstablished = true;
                setStatus("connectStatus", SESSION_STATUS.ESTABLISHED);
                updateControls();
            })
                .on(SESSION_STATUS.DISCONNECTED, () => disconnected(attempt, SESSION_STATUS.DISCONNECTED))
                .on(SESSION_STATUS.FAILED, () => disconnected(attempt, SESSION_STATUS.FAILED));
        } catch (error) {
            disconnected(attempt, SESSION_STATUS.FAILED);
            setError("connectError", `Can't connect to server: ${message(error)}`);
        }
    }

    function disconnected(attempt, status) {
        if (attempt !== connectionAttempt) return;
        connectionAttempt++;
        const error = disconnectRequested ? "" : connectionEstablished ? "Connection to server lost." : "Can't connect to server.";
        session = undefined;
        connectionBusy = false;
        connectionEstablished = false;
        disconnectRequested = false;
        availabilityAttempt++;
        availableBusy = false;
        if (publisher) setStatus("publishStatus", STREAM_STATUS.UNPUBLISHED);
        if (player) setStatus("playStatus", STREAM_STATUS.STOPPED);
        publisher = undefined;
        player = undefined;
        publishBusy = false;
        playBusy = false;
        setStatus("connectStatus", status);
        setError("connectError", error);
        setStatus("availableStatus", "");
        setError("availableError", "");
        updateControls();
    }

    function publishButtonClick() {
        if (!connected() || publishBusy) return;
        if (publisher) {
            stopStream(publisher, "publish");
            return;
        }
        if (!validateRequired("publishStream")) return;
        publishBusy = true;
        setError("publishError", "");
        const options = {
            name: dom.value("publishStream").trim(), display: dom.byId("localVideo"),
            cacheLocalResources: true, receiveVideo: false, receiveAudio: false
        };
        updateControls();
        try {
            const stream = session.createStream(options);
            publisher = stream;
            stream.on(STREAM_STATUS.PUBLISHING, () => {
                if (publisher !== stream) return;
                publishBusy = false;
                setStatus("publishStatus", STREAM_STATUS.PUBLISHING);
                updateControls();
            }).on(STREAM_STATUS.UNPUBLISHED, () => finishPublish(stream, STREAM_STATUS.UNPUBLISHED))
                .on(STREAM_STATUS.FAILED, () => finishPublish(stream, STREAM_STATUS.FAILED));
            setStatus("publishStatus", "PENDING");
            stream.publish();
        } catch (error) {
            publisher = undefined;
            publishBusy = false;
            setStatus("publishStatus", STREAM_STATUS.FAILED);
            setError("publishError", message(error));
            updateControls();
        }
    }

    function finishPublish(stream, status) {
        if (publisher !== stream) return;
        if (status === STREAM_STATUS.FAILED && sessionTerminated()) return;
        if (status === STREAM_STATUS.FAILED) setError("publishError", streamFailure(stream, true));
        publisher = undefined;
        publishBusy = false;
        setStatus("publishStatus", status);
        updateControls();
    }

    function playButtonClick() {
        if (!connected() || playBusy) return;
        if (player) {
            stopStream(player, "play");
            return;
        }
        if (!validateRequired("playStream")) return;
        playBusy = true;
        setError("playError", "");
        const options = {name: dom.value("playStream").trim(), display: dom.byId("remoteVideo")};
        updateControls();
        try {
            if (api.getMediaProviders()[0] === "WSPlayer") api.playFirstSound();
            const stream = session.createStream(options);
            player = stream;
            stream.on(STREAM_STATUS.PLAYING, () => {
                if (player !== stream) return;
                playBusy = false;
                setStatus("playStatus", STREAM_STATUS.PLAYING);
                updateControls();
            }).on(STREAM_STATUS.STOPPED, () => finishPlay(stream, STREAM_STATUS.STOPPED))
                .on(STREAM_STATUS.FAILED, () => finishPlay(stream, STREAM_STATUS.FAILED));
            stream.on(STREAM_EVENT, (event) => {
                if (player === stream && event.type === STREAM_EVENT_TYPE.DATA) appendPayload(event.payload);
            });
            setStatus("playStatus", "PENDING");
            stream.play();
        } catch (error) {
            player = undefined;
            playBusy = false;
            setStatus("playStatus", STREAM_STATUS.FAILED);
            setError("playError", message(error));
            updateControls();
        }
    }

    function finishPlay(stream, status) {
        if (player !== stream) return;
        if (status === STREAM_STATUS.FAILED && sessionTerminated()) return;
        if (status === STREAM_STATUS.FAILED) setError("playError", streamFailure(stream, false));
        player = undefined;
        playBusy = false;
        setStatus("playStatus", status);
        updateControls();
    }

    function sessionTerminated() {
        return [SESSION_STATUS.DISCONNECTED, SESSION_STATUS.FAILED].includes(session?.status());
    }

    function stopStream(stream, side) {
        if (side === "publish") publishBusy = true;
        else playBusy = true;
        updateControls();
        try {
            stream.stop();
        } catch (error) {
            if (side === "publish") publishBusy = false;
            else playBusy = false;
            setError(`${side}Error`, message(error));
            updateControls();
        }
    }

    function sendData() {
        if (!publisher || publisher.status() !== STREAM_STATUS.PUBLISHING || publishBusy) return;
        setError("dataError", "");
        let payload;
        try {
            payload = JSON.parse(dom.value("streamData"));
        } catch (error) {
            setError("dataError", `Invalid JSON payload: ${message(error)}`);
            return;
        }
        try {
            publisher.sendData(payload);
        } catch (error) {
            setError("dataError", `Failed to send payload: ${message(error)}`);
        }
    }

    function appendPayload(payload) {
        const now = new Date();
        const time = `${now.getHours()}:${String(now.getMinutes()).padStart(2, "0")}`;
        const log = dom.byId("receivedData");
        log.value += `${time} - ${JSON.stringify(payload)}\n`;
        log.scrollTop = log.scrollHeight;
    }

    async function checkAvailability() {
        if (!connected() || availableBusy || !validateRequired("playStream")) return;
        const attempt = ++availabilityAttempt;
        const currentSession = session;
        availableBusy = true;
        setStatus("availableStatus", "CHECKING");
        setError("availableError", "");
        updateControls();
        try {
            await currentSession.createStream({name: dom.value("playStream").trim(), display: dom.byId("remoteVideo")}).available();
            if (attempt !== availabilityAttempt || session !== currentSession) return;
            setStatus("availableStatus", "AVAILABLE");
        } catch (error) {
            if (attempt !== availabilityAttempt || session !== currentSession) return;
            setStatus("availableStatus", "UNAVAILABLE");
            setError("availableError", error?.getInfo?.() || message(error));
        } finally {
            if (attempt === availabilityAttempt && session === currentSession) {
                availableBusy = false;
                updateControls();
            }
        }
    }

    function streamFailure(stream, publishing) {
        const info = stream.getInfo();
        if (!info) return "Stream failed.";
        if (publishing) {
            if (info === STREAM_STATUS_INFO.STREAM_NAME_ALREADY_IN_USE) return "Server already has a publish stream with the same name, try using a different one.";
            if (info === ERROR_INFO.LOCAL_ERROR) return `Browser error detected: ${stream.getErrorInfo()}`;
        } else {
            const descriptions = new Map([
                [STREAM_STATUS_INFO.SESSION_DOES_NOT_EXIST, "Actual session does not exist."],
                [STREAM_STATUS_INFO.STOPPED_BY_PUBLISHER_STOP, "Related publisher stopped its stream or lost connection."],
                [STREAM_STATUS_INFO.SESSION_NOT_READY, "Session is not initialized or has terminated."],
                [STREAM_STATUS_INFO.RTSP_STREAM_NOT_FOUND, "RTSP stream not found: the server received 404 Not Found."],
                [STREAM_STATUS_INFO.FAILED_TO_CONNECT_TO_RTSP_STREAM, "Failed to connect to RTSP stream."],
                [STREAM_STATUS_INFO.FILE_NOT_FOUND, "File does not exist, check the filename."],
                [STREAM_STATUS_INFO.FILE_HAS_WRONG_FORMAT, "File format is not supported for VOD playback."],
                [STREAM_STATUS_INFO.TRANSCODING_REQUIRED_BUT_DISABLED, "Transcoding is required but disabled in settings."],
                [STREAM_STATUS_INFO.NO_AVAILABLE_TRANSCODERS, "No available transcoders for this stream."]
            ]);
            if (info && descriptions.has(info)) return descriptions.get(info);
        }
        return info || "Stream failed.";
    }
});
