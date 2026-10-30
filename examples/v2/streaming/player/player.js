import * as dom from "../../dependencies/js/dom.js";
import {getWebsocketUrl} from "../../dependencies/js/server-url.js";
import {resizeVideo} from "../../dependencies/js/media.js";
import {initializeSDK, setStatus, setError, validateRequired, bindResize, queryParam} from "../../dependencies/js/streaming.js";

const api = window.Flashphoner;
const {SESSION_STATUS = {}, STREAM_STATUS = {}, STREAM_EVENT, STREAM_EVENT_TYPE = {}} = api?.constants ?? {};
const Browser = api?.Browser;
const PRELOADER_URL = "../../assets/preloader.mp4";
const autoplay = Boolean(queryParam("autoplay"));
const resolution = queryParam("resolution");
const mediaProvider = queryParam("mediaProvider");
const mseCutByIFrameOnly = queryParam("mseCutByIFrameOnly");

let session;
let sessionEstablished = false;
let stream;
let remoteVideo;
let useVideoControls = false;
let currentVolume = 50;
let attempt = 0;
let releaseMediaListeners;

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initPage, {once: true});
} else {
    initPage();
}

function initPage() {
    remoteVideo = dom.byId("remoteVideo");
    dom.setValue("url", getWebsocketUrl());
    dom.setValue("streamName", queryParam("streamName"));
    dom.byId("volumeControl").addEventListener("input", (event) => {
        currentVolume = Number(event.currentTarget.value);
        setVolume();
    });
    dom.byId("unmuteBtn").onclick = () => {
        setVolume();
        dom.setValue("volumeControl", currentVolume);
    };
    dom.byId("fullScreenBtn").onclick = () => stream?.fullScreen();
    setStatus("connectStatus", SESSION_STATUS.DISCONNECTED ?? "DISCONNECTED");
    initializeSDK(() => {
        bindResize(remoteVideo);
        useVideoControls = Boolean(Browser.isSafari());
        dom.setVisible("fullScreen", !useVideoControls);
        dom.setVisible("volume", !(useVideoControls && Browser.isiOS()));
        onStopped();
        if (autoplay) {
            dom.setValue("volumeControl", 0);
            startPlayback();
        }
    }, {
        receiverLocation: "../../dependencies/websocket-player/WSReceiver2.js",
        decoderLocation: "../../dependencies/websocket-player/video-worker2.js",
        preferredMediaProvider: mediaProvider || null
    });
}

function onStopped() {
    attempt += 1;
    stream = undefined;
    releaseMediaListeners?.();
    releaseMediaListeners = undefined;
    dom.setButton("playBtn", "Start", startPlayback);
    dom.setDisabled("url", false);
    dom.setDisabled("streamName", false);
    dom.setDisabled("volumeControl", true);
    dom.setDisabled("fullScreenBtn", true);
    dom.setVisible("preloader", false);
    dom.setVisible("unmute", false);
}

async function startPlayback() {
    const validUrl = validateRequired("url");
    const validName = validateRequired("streamName");
    if (!validUrl || !validName) return;
    const currentAttempt = ++attempt;
    setError("info", "");
    setError("connectError", "");
    dom.setVisible("bandwidthWarning", false);
    dom.setDisabled("playBtn", true);
    dom.setDisabled("url", true);
    dom.setDisabled("streamName", true);
    dom.setVisible("preloader", true);
    try {
        if (api.getMediaProviders()[0] === "WSPlayer") {
            api.playFirstSound();
        } else if (Browser.isSafari()) {
            await api.playFirstVideo(remoteVideo, false, PRELOADER_URL, useVideoControls);
        }
        if (currentAttempt === attempt) connect(currentAttempt);
    } catch (error) {
        if (currentAttempt !== attempt) return;
        setStatus("status", STREAM_STATUS.FAILED ?? "FAILED");
        setError("info", error.message || "Unable to start playback.");
        onStopped();
    }
}

function connect(currentAttempt) {
    const url = dom.value("url");
    const existing = session || api.getSessions()[0];
    if (existing && existing.getServerUrl() === url && existing.status() === SESSION_STATUS.ESTABLISHED) {
        session = existing;
        bindSession(existing);
        setStatus("connectStatus", SESSION_STATUS.ESTABLISHED);
        playStream(existing, currentAttempt);
        return;
    }
    session = undefined;
    existing?.disconnect();
    setStatus("connectStatus", "CONNECTING");
    let created;
    try {
        created = api.createSession({urlServer: url});
    } catch (error) {
        setStatus("connectStatus", SESSION_STATUS.FAILED);
        setError("connectError", error.message || "Unable to connect.");
        onStopped();
        return;
    }
    session = created;
    bindSession(created);
    created.on(SESSION_STATUS.ESTABLISHED, (connected) => {
        if (session !== created || currentAttempt !== attempt) return;
        sessionEstablished = true;
        setStatus("connectStatus", connected.status());
        try {
            playStream(connected, currentAttempt);
        } catch (error) {
            setStatus("status", STREAM_STATUS.FAILED);
            setError("info", error.message || "Unable to create playback stream.");
            onStopped();
        }
    });
}

function bindSession(connected) {
    sessionEstablished = connected.status() === SESSION_STATUS.ESTABLISHED;
    if (SESSION_STATUS.CONNECTED) {
        connected.on(SESSION_STATUS.CONNECTED, () => {
            if (session === connected) setStatus("connectStatus", SESSION_STATUS.CONNECTED);
        });
    }
    connected.on(SESSION_STATUS.DISCONNECTED, () => {
        if (session !== connected) return;
        setError("connectError", sessionEstablished ? "Connection to server lost." : "Connection closed before it was established.");
        if (stream) setStatus("status", STREAM_STATUS.STOPPED);
        session = undefined;
        setStatus("connectStatus", SESSION_STATUS.DISCONNECTED);
        onStopped();
    }).on(SESSION_STATUS.FAILED, (failed) => {
        if (session !== connected) return;
        if (stream) setStatus("status", STREAM_STATUS.STOPPED);
        session = undefined;
        setStatus("connectStatus", SESSION_STATUS.FAILED);
        setError("connectError", failed?.getInfo?.() || "Connection failed.");
        onStopped();
    });
}

function playStream(connected, currentAttempt) {
    const options = {name: dom.value("streamName"), display: remoteVideo, useControls: useVideoControls};
    if (api.getMediaProviders()[0] === "MSE" && mseCutByIFrameOnly) {
        options.mediaConnectionConstraints = {cutByIFrameOnly: mseCutByIFrameOnly};
    }
    if (resolution) {
        const [width, height] = resolution.split("x");
        options.playWidth = width;
        options.playHeight = height;
    }
    if (autoplay) options.unmutePlayOnStart = false;
    const created = connected.createStream(options);
    stream = created;
    const isCurrent = () => stream === created && currentAttempt === attempt;
    created.on(STREAM_STATUS.PENDING, (pending) => {
        if (!isCurrent()) return;
        attachMediaListeners(pending);
    }).on(STREAM_STATUS.PLAYING, (playing) => {
        if (!isCurrent()) return;
        const video = document.getElementById(playing.id());
        if (api.getMediaProviders()[0] === "MSE" && autoplay && Browser.isAndroidFirefox() && video?.paused) {
            resumeVideo(video);
        }
        setStatus("status", playing.status());
        setError("info", "");
        dom.setButton("playBtn", "Stop", () => {
            dom.setDisabled("playBtn", true);
            try {
                created.stop();
            } catch (error) {
                setError("info", error.message || "Unable to stop playback.");
                dom.setDisabled("playBtn", false);
            }
        });
        dom.setDisabled("volumeControl", false);
        dom.setDisabled("fullScreenBtn", false);
        created.setVolume(currentVolume);
        if (video?.tagName !== "VIDEO") dom.setVisible("preloader", false);
    }).on(STREAM_STATUS.STOPPED, () => {
        if (!isCurrent()) return;
        setStatus("status", STREAM_STATUS.STOPPED);
        onStopped();
    }).on(STREAM_STATUS.FAILED, (failed) => {
        if (!isCurrent()) return;
        if ([SESSION_STATUS.DISCONNECTED, SESSION_STATUS.FAILED].includes(connected.status())) return;
        setStatus("status", STREAM_STATUS.FAILED);
        setError("info", failed.getInfo() || "Playback failed.");
        onStopped();
    }).on(STREAM_EVENT, (event) => {
        if (!isCurrent()) return;
        if (event.type === STREAM_EVENT_TYPE.NOT_ENOUGH_BANDWIDTH) {
            const [bitrate, bandwidth] = (event.payload?.info || "").split("/");
            const rates = bitrate && bandwidth && Number.isFinite(Number(bitrate)) && Number.isFinite(Number(bandwidth))
                ? ` Available: ${Math.round(Number(bandwidth) / 1000)} kbps; stream: ${Math.round(Number(bitrate) / 1000)} kbps.` : "";
            const warning = `Not enough bandwidth.${rates} Try a lower resolution or bitrate.`;
            dom.setText("bandwidthWarning", warning);
            dom.setVisible("bandwidthWarning", true);
        } else if (event.type === STREAM_EVENT_TYPE.UNMUTE_REQUIRED) {
            dom.setVisible("unmute", true);
        } else if (event.type === STREAM_EVENT_TYPE.RESIZE) {
            console.log(`New video size: ${event.payload.streamerVideoWidth}x${event.payload.streamerVideoHeight}`);
        }
    });
    created.play();
}

function attachMediaListeners(playing) {
    releaseMediaListeners?.();
    releaseMediaListeners = undefined;
    const video = document.getElementById(playing.id());
    if (!video) return;
    const listeners = [];
    const listen = (event, handler) => {
        video.addEventListener(event, handler);
        listeners.push([event, handler]);
    };
    if (video.tagName !== "VIDEO") {
        listen("resize", () => {
            const size = playing.videoResolution();
            resizeVideo(video, size?.width, size?.height);
        });
    }
    if (useVideoControls && Browser.isSafariWebRTC()) {
        let restartAfterFullscreen = false;
        listen("pause", () => {
            if (!restartAfterFullscreen) return;
            restartAfterFullscreen = false;
            resumeVideo(video);
        });
        listen("webkitendfullscreen", () => {
            resumeVideo(video);
            restartAfterFullscreen = true;
        });
    }
    listen("playing", () => dom.setVisible("preloader", false));
    listen("volumechange", () => dom.setVisible("unmute", video.muted));
    releaseMediaListeners = () => {
        listeners.forEach(([event, handler]) => video.removeEventListener(event, handler));
    };
}

function resumeVideo(video) {
    try {
        video.play()?.catch((error) => setError("info", error.message || "Press Unmute to continue playback."));
    } catch (error) {
        setError("info", error.message || "Unable to resume video.");
    }
}

function setVolume() {
    if (!stream) return;
    if (stream.isRemoteAudioMuted()) stream.unmuteRemoteAudio();
    stream.setVolume(currentVolume);
}
