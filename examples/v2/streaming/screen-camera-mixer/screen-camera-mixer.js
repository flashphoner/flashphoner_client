import * as dom from "../../dependencies/js/dom.js";
import {getWebsocketUrl, readStreamAddress} from "../../dependencies/js/server-url.js";
import {createStreamName} from "../../dependencies/js/identifiers.js";
import {initializeSDK, setStatus, setError, setInvalid, validateRequired, bindResize} from "../../dependencies/js/streaming.js";

initializeSDK((api) => {
    const {SESSION_STATUS, STREAM_STATUS} = api.constants;
    const settings = ["screenWidth", "screenHeight", "screenFps", "cameraWidth", "cameraHeight", "cameraFps", "videoInput", "audioInput", "useMixer"];
    let session;
    let screen;
    let camera;
    let connecting = false;
    let active = false;
    let stopping = false;
    let run = 0;
    let connectionRun = 0;
    let address;
    const timers = new Set();

    dom.setValue("url", `${getWebsocketUrl()}/${createStreamName(8)}`);
    bindResize(dom.byId("localVideoScreen"));
    bindResize(dom.byId("localVideoCamera"));
    setStatus("status", SESSION_STATUS.DISCONNECTED);
    setStatus("screenStatus", SESSION_STATUS.DISCONNECTED);
    setStatus("cameraStatus", SESSION_STATUS.DISCONNECTED);
    dom.byId("connectBtn").onclick = connectClick;
    dom.byId("publishBtn").onclick = () => active ? stop() : start();
    dom.byId("useMixer").onchange = updateControls;
    updateControls();
    loadDevices();

    function connected() { return session?.status() === SESSION_STATUS.ESTABLISHED; }

    function updateControls() {
        dom.setDisabled("url", connecting || Boolean(session));
        dom.setDisabled("connectBtn", connecting);
        dom.setText("connectBtn", connected() ? "Disconnect" : "Connect");
        dom.setDisabled("publishBtn", !connected() || stopping);
        dom.setText("publishBtn", stopping ? "Stopping…" : active ? "Stop" : "Start");
        for (const id of settings) dom.setDisabled(id, active || stopping);
        dom.setDisabled("mixerName", active || stopping || !dom.checked("useMixer"));
    }

    async function loadDevices() {
        try {
            const devices = await api.getMediaDevices(null, false);
            for (const [kind, id] of [["video", "videoInput"], ["audio", "audioInput"]]) {
                const select = dom.byId(id);
                for (const device of devices[kind] || []) {
                    if (!device.id) continue;
                    const existing = [...select.options].find((option) => option.value === device.id);
                    if (existing) {
                        existing.textContent = device.label || device.id;
                        continue;
                    }
                    const option = document.createElement("option");
                    option.value = device.id;
                    option.textContent = device.label || device.id;
                    select.appendChild(option);
                }
            }
        } catch (error) { setError("deviceError", error.message || "Unable to list media devices. Default devices will be used."); }
    }

    function connectClick() {
        if (connecting) return;
        if (connected()) {
            try { session.disconnect(); }
            catch (error) { setError("info", error.message); }
            return;
        }
        address = readStreamAddress(dom.value("url"));
        setInvalid("url", !address);
        if (!address) {
            setError("info", "Enter a URL such as wss://server:8443/stream.");
            return;
        }
        const connection = ++connectionRun;
        connecting = true;
        setStatus("status", "CONNECTING");
        setError("info", "");
        updateControls();
        try {
            session = api.createSession({urlServer: address.server})
                .on(SESSION_STATUS.ESTABLISHED, (established) => {
                    if (connection !== connectionRun) return;
                    session = established;
                    connecting = false;
                    setStatus("status", SESSION_STATUS.ESTABLISHED);
                    updateControls();
                }).on(SESSION_STATUS.DISCONNECTED, () => disconnected(connection, SESSION_STATUS.DISCONNECTED))
                .on(SESSION_STATUS.FAILED, () => disconnected(connection, SESSION_STATUS.FAILED));
        } catch (error) {
            disconnected(connection, SESSION_STATUS.FAILED);
            setError("info", error.message);
        }
    }

    function disconnected(connection, status) {
        if (connection !== connectionRun) return;
        ++connectionRun;
        session = undefined;
        connecting = false;
        ++run;
        active = stopping = false;
        screen = camera = undefined;
        clearStats();
        for (const id of ["status", "screenStatus", "cameraStatus"]) setStatus(id, status);
        if (status === SESSION_STATUS.FAILED) setError("info", "Unable to connect to the server.");
        updateControls();
    }

    function start() {
        if (!connected() || active || stopping) return;
        let valid = true;
        for (const id of settings.filter((id) => /Width|Height|Fps/.test(id))) {
            const value = Number(dom.value(id));
            const positiveInteger = Number.isInteger(value) && value > 0;
            setInvalid(id, !positiveInteger);
            valid = positiveInteger && valid;
        }
        if (dom.checked("useMixer")) valid = validateRequired("mixerName") && valid;
        if (!valid) return;
        if (api.Browser.isAndroid() || api.Browser.isiOS()) {
            setError("info", "Screen sharing requires a desktop browser.");
            return;
        }
        const attempt = ++run;
        active = true;
        setError("info", "");
        setError("screenInfo", "");
        setError("cameraInfo", "");
        updateControls();
        const video = {
            width: Number(dom.value("screenWidth")), height: Number(dom.value("screenHeight")),
            frameRate: Number(dom.value("screenFps")), type: "screen", withoutExtension: true
        };
        if (api.Browser.isFirefox()) video.mediaSource = "screen";
        const options = {
            name: streamName("screen"), display: dom.byId("localVideoScreen"),
            receiveAudio: false, receiveVideo: false, constraints: {video}
        };
        if (api.Browser.isSafari()) options.disableConstraintsNormalization = true;
        try {
            screen = session.createStream(options)
                .on(STREAM_STATUS.PUBLISHING, (stream) => {
                    if (attempt !== run) return;
                    setStatus("screenStatus", STREAM_STATUS.PUBLISHING);
                    dom.setText("screenName", stream.name());
                    const track = document.getElementById(stream.id())?.srcObject?.getVideoTracks()[0];
                    if (track) track.onended = () => { if (attempt === run) stop(); };
                    startStats("screen", stream, attempt);
                    startCamera(attempt);
                }).on(STREAM_STATUS.UNPUBLISHED, (stream) => ended("screen", stream))
                .on(STREAM_STATUS.FAILED, (stream) => failed("screen", stream, attempt));
            setStatus("screenStatus", "PENDING");
            screen.publish();
        } catch (error) { failed("screen", {getInfo: () => error.message}, attempt); }
    }

    function streamName(type) {
        return `${address.name}-${type}${dom.checked("useMixer") ? `#${dom.value("mixerName").trim()}` : ""}`;
    }

    function startCamera(attempt) {
        const video = {
            width: Number(dom.value("cameraWidth")), height: Number(dom.value("cameraHeight")),
            frameRate: Number(dom.value("cameraFps"))
        };
        if (dom.value("videoInput")) video.deviceId = {exact: dom.value("videoInput")};
        const audio = dom.value("audioInput") ? {deviceId: {exact: dom.value("audioInput")}} : true;
        try {
            camera = session.createStream({
                name: streamName("camera"), display: dom.byId("localVideoCamera"),
                receiveAudio: false, receiveVideo: false, constraints: {video, audio}
            }).on(STREAM_STATUS.PUBLISHING, (stream) => {
                if (attempt !== run) return;
                setStatus("cameraStatus", STREAM_STATUS.PUBLISHING);
                dom.setText("cameraName", stream.name());
                startStats("camera", stream, attempt);
                loadDevices();
            }).on(STREAM_STATUS.UNPUBLISHED, (stream) => ended("camera", stream))
                .on(STREAM_STATUS.FAILED, (stream) => failed("camera", stream, attempt));
            setStatus("cameraStatus", "PENDING");
            camera.publish();
        } catch (error) { failed("camera", {getInfo: () => error.message}, attempt); }
    }

    function failed(type, stream, attempt) {
        if (attempt !== run && stream !== (type === "screen" ? screen : camera)) return;
        if ((attempt !== run && !stopping) || [SESSION_STATUS.DISCONNECTED, SESSION_STATUS.FAILED].includes(session?.status())) return;
        if (type === "screen" && screen === stream) screen = undefined;
        if (type === "camera" && camera === stream) camera = undefined;
        stop();
        setStatus(`${type}Status`, STREAM_STATUS.FAILED);
        setError(`${type}Info`, stream.getInfo() || "Unable to publish the stream.");
        completeStop();
    }

    function ended(type, stream) {
        if (type === "screen") {
            if (screen !== stream) return;
            screen = undefined;
        } else {
            if (camera !== stream) return;
            camera = undefined;
        }
        setStatus(`${type}Status`, STREAM_STATUS.UNPUBLISHED);
        if (!stopping) stop();
        completeStop();
    }

    function startStats(type, stream, attempt) {
        let bytes;
        let sampledAt;
        const timer = window.setInterval(() => {
            try {
                stream.getStats((stats) => {
                    if (attempt !== run || !active || !stats) return;
                    const now = Date.now();
                    const sent = stats.outboundStream?.video?.bytesSent;
                    if (sent !== undefined) {
                        if (bytes !== undefined && now > sampledAt) {
                            const bitrate = Math.max(0, Math.round((sent - bytes) * 8 * 1000 / (now - sampledAt)));
                            dom.setText(`${type}Bitrate`, `Bitrate: ${bitrate} bps`);
                        }
                        bytes = sent;
                        sampledAt = now;
                    }
                    const available = stats.otherStats?.availableOutgoingBitrate;
                    if (available !== undefined) dom.setText(`${type}AvailableBitrate`, `Available bitrate: ${Math.round(available)} bps`);
                });
            } catch (error) {
                if (attempt === run) setError(`${type}Info`, error.message || "Unable to read stream statistics.");
            }
        }, 1000);
        timers.add(timer);
    }

    function stop() {
        if (stopping) return;
        ++run;
        active = false;
        stopping = true;
        clearStats();
        updateControls();
        for (const [type, stream] of [["camera", camera], ["screen", screen]]) {
            if (!stream) continue;
            if ([STREAM_STATUS.UNPUBLISHED, STREAM_STATUS.FAILED].includes(stream.status())) {
                ended(type, stream);
                continue;
            }
            setStatus(`${type}Status`, "STOPPING");
            try { stream.stop(); }
            catch (error) { setError("info", `${error.message || "Unable to stop the stream."} Disconnect to release both captures.`); }
        }
        completeStop();
    }

    function completeStop() {
        if (screen || camera) return;
        stopping = false;
        updateControls();
    }

    function clearStats() {
        for (const timer of timers) window.clearInterval(timer);
        timers.clear();
        for (const type of ["screen", "camera"]) {
            dom.setText(`${type}Bitrate`, "");
            dom.setText(`${type}AvailableBitrate`, "");
        }
    }
});
