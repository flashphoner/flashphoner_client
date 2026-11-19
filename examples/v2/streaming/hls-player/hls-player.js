import * as dom from "../../dependencies/js/dom.js";
import {
    readHlsParameters, initializeHlsPage, getHlsSource, setHlsState,
    showHlsPermalink, createPlaybackStats, setNativeFullscreenHandlers
} from "../../dependencies/js/hls.js";

const VERSIONS = ["videojs7", "videojs8"];
const parameters = readHlsParameters();
const assets = new Map();
let version;
let autoplay = false;
let player;
let source = "";
let attempt = 0;
let stats;
let releaseFullscreen;
let liveTimer;
let selectedQuality = -1;
let playbackActive = false;

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initPage, {once: true});
} else {
    initPage();
}

function initPage() {
    try {
        ({autoplay} = initializeHlsPage({...parameters, autoplay: parameters.autoplay && VERSIONS.includes(parameters.version)}));
    } catch (error) {
        dom.setText("videojsError", error.message || "Unable to initialize the HLS server URL.");
        dom.setDisabled("videojsBtn", true);
        dom.setDisabled("videojsInput", true);
        return;
    }
    dom.byId("videojsBtn").onclick = () => loadPlayer(dom.value("videojsInput"));
    dom.byId("applyBtn").onclick = () => playbackActive ? stopPlayback() : startPlayback();
    dom.byId("backBtnMax").onclick = () => seekBackward();
    dom.byId("backBtn30").onclick = () => seekBackward(30);
    dom.byId("backBtn10").onclick = () => seekBackward(10);
    dom.byId("liveBtn").onclick = seekLive;
    window.addEventListener("pagehide", stopPlayback);
    if (parameters.version) {
        if (VERSIONS.includes(parameters.version)) {
            dom.setValue("videojsInput", parameters.version);
            dom.setVisible("videojsInputForm", false);
            loadPlayer(parameters.version);
        } else {
            dom.setText("videojsError", "Unknown VideoJS version. Choose videojs7 or videojs8.");
        }
    }
}

async function loadPlayer(requestedVersion) {
    if (!VERSIONS.includes(requestedVersion) || version) return;
    dom.setDisabled("videojsBtn", true);
    dom.setDisabled("videojsInput", true);
    dom.setText("videojsError", "");
    try {
        await loadAsset(`${requestedVersion}/video.js`, "script");
        await loadAsset(`${requestedVersion}/video-js.css`, "style");
        if (requestedVersion === "videojs7") {
            await loadAsset(`${requestedVersion}/videojs-contrib-quality-levels.js`, "script");
        }
        if (typeof window.videojs !== "function") throw new Error("VideoJS is unavailable.");
        version = requestedVersion;
        dom.setVisible("videojsInputForm", false);
        dom.setVisible("playerPage", true);
        setHlsState("IDLE");
        dom.setDisabled("applyBtn", false);
        createPlayer();
        if (autoplay) startPlayback();
    } catch (error) {
        version = undefined;
        disposePlayer();
        autoplay = false;
        const message = error.message || "Can't load VideoJS library.";
        setHlsState("FAILED", message);
        dom.setText("videojsError", message);
        dom.setDisabled("videojsBtn", false);
        dom.setDisabled("videojsInput", false);
        dom.setVisible("videojsInputForm", true);
    }
}

function loadAsset(url, type) {
    if (assets.has(url)) return assets.get(url);
    const promise = new Promise((resolve, reject) => {
        const element = document.createElement(type === "script" ? "script" : "link");
        if (type === "script") {
            element.src = url;
            element.async = true;
        } else {
            element.rel = "stylesheet";
            element.href = url;
        }
        element.addEventListener("load", resolve, {once: true});
        element.addEventListener("error", () => {
            element.remove();
            assets.delete(url);
            reject(new Error(`Can't load ${url}. Check that the VideoJS assets are installed.`));
        }, {once: true});
        document.head.appendChild(element);
    });
    assets.set(url, promise);
    return promise;
}

function createPlayer() {
    if (player) return player;
    const video = document.createElement("video");
    video.id = "remoteVideo";
    video.className = "video-js vjs-default-skin";
    video.controls = true;
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");
    dom.byId("videoContainer").replaceChildren(video);
    const current = window.videojs(video, {
        controls: true,
        playsinline: true,
        playbackRates: [0.1, 0.25, 0.5, 1, 1.5, 2],
        liveui: true,
        liveTracker: {trackingThreshold: 5, liveTolerance: 5},
        fill: true,
        muted: autoplay,
        html5: {vhs: {limitRenditionByPlayerDimensions: false}}
    });
    player = current;
    const actualVideo = current.el()?.querySelector("video") || video;
    releaseFullscreen = setNativeFullscreenHandlers(actualVideo, false);
    stats = createPlaybackStats(() => current.el()?.querySelector("video") || actualVideo);
    return current;
}

function startPlayback(retrySource, decodeRetries = 0) {
    const videoSource = typeof retrySource === "string" ? retrySource : getHlsSource();
    if (!version || !videoSource) {
        if (!videoSource) autoplay = false;
        return;
    }
    disposePlayer();
    source = videoSource;
    const currentAttempt = ++attempt;
    playbackActive = true;
    selectedQuality = -1;
    setHlsState("LOADING");
    try {
        const current = createPlayer();
        const isCurrent = () => player === current && attempt === currentAttempt;
        current.on("loadedmetadata", () => {
            if (isCurrent()) resumePlayback(current, currentAttempt);
        });
        current.on("playing", () => {
            if (!isCurrent()) return;
            setHlsState("PLAYING");
            if (!autoplay) {
                showHlsPermalink(source, {version});
                stats.start();
                displayQuality(current);
                dom.setVisible("playbackControls", true);
                updateSeekControls(current);
            }
            startLiveTimer(current, currentAttempt);
        });
        current.on("timeupdate", () => {
            if (isCurrent() && !autoplay) updateSeekControls(current);
        });
        current.on("error", () => {
            if (!isCurrent()) return;
            const error = current.error();
            if (error?.code === 3 && decodeRetries < 1) {
                startPlayback(source, decodeRetries + 1);
            } else {
                failPlayback(error?.message || "HLS playback failed.");
            }
        });
        current.on("ended", () => {
            if (isCurrent()) stopPlayback();
        });
        const levels = current.qualityLevels?.();
        levels?.on("addqualitylevel", () => { if (isCurrent() && !autoplay) displayQuality(current); });
        levels?.on("removequalitylevel", () => { if (isCurrent() && !autoplay) displayQuality(current); });
        current.src({src: videoSource, type: "application/vnd.apple.mpegurl"});
        resumePlayback(current, currentAttempt);
    } catch (error) {
        failPlayback(error.message || "Unable to initialize VideoJS.");
    }
}

function resumePlayback(current, currentAttempt) {
    try {
        const pending = current.play();
        pending?.catch((error) => {
            if (player === current && attempt === currentAttempt && error.name !== "AbortError") {
                failPlayback(error.message || "Playback was blocked. Use the video controls to retry.");
            }
        });
    } catch (error) {
        if (player === current && attempt === currentAttempt) failPlayback(error.message || "Unable to start playback.");
    }
}

function stopPlayback() {
    disposePlayer();
    autoplay = false;
    setHlsState("STOPPED");
}

function failPlayback(message) {
    disposePlayer();
    autoplay = false;
    setHlsState("FAILED", message);
}

function disposePlayer() {
    attempt += 1;
    playbackActive = false;
    clearInterval(liveTimer);
    liveTimer = undefined;
    stats?.stop();
    stats = undefined;
    if (typeof releaseFullscreen === "function") releaseFullscreen();
    releaseFullscreen = undefined;
    const disposed = player;
    player = undefined;
    disposed?.dispose();
    dom.setVisible("playbackControls", false);
    dom.setVisible("quality", false);
    dom.clearChildren("qualityBtns");
    dom.setVisible("backward", false);
}

function startLiveTimer(current, currentAttempt) {
    if (liveTimer || !current.liveTracker || current.liveTracker.isLive()) return;
    liveTimer = setInterval(() => {
        if (player !== current || attempt !== currentAttempt || current.liveTracker.atLiveEdge()) {
            clearInterval(liveTimer);
            liveTimer = undefined;
        } else if (!current.liveTracker.isLive() && current.liveTracker.liveWindow() > 5) {
            current.liveTracker.seekToLiveEdge();
        }
    }, 1000);
}

function displayQuality(current) {
    const levels = current.qualityLevels?.();
    dom.clearChildren("qualityBtns");
    dom.setVisible("quality", Boolean(levels?.length));
    if (!levels?.length) return;
    if (selectedQuality >= levels.length) selectedQuality = -1;
    const addButton = (label, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "button";
        button.textContent = label;
        button.setAttribute("aria-pressed", String(selectedQuality === index));
        button.onclick = () => {
            if (player !== current) return;
            selectedQuality = index;
            for (let i = 0; i < levels.length; i++) levels[i].enabled = index === -1 || i === index;
            displayQuality(current);
        };
        dom.byId("qualityBtns").appendChild(button);
    };
    for (let i = 0; i < levels.length; i++) {
        addButton(levels[i].height ? `${levels[i].height}p` : `${Math.round(levels[i].bitrate / 1000)} kbps`, i);
    }
    addButton("Auto", -1);
}

function seekableWindow(current) {
    const ranges = current.seekable();
    if (!ranges?.length) return null;
    return {start: ranges.start(0), end: ranges.end(ranges.length - 1)};
}

function updateSeekControls(current) {
    const canSeek = Boolean(seekableWindow(current));
    dom.setVisible("backward", canSeek);
    ["backBtnMax", "backBtn30", "backBtn10"].forEach((id) => dom.setDisabled(id, !canSeek));
    dom.setDisabled("liveBtn", !canSeek || !current.liveTracker);
}

function seekBackward(seconds) {
    if (!player) return;
    const range = seekableWindow(player);
    if (!range) return;
    const target = seconds === undefined ? range.start : player.currentTime() - seconds;
    player.currentTime(Math.min(range.end, Math.max(range.start, target)));
}

function seekLive() {
    player?.liveTracker?.seekToLiveEdge();
}
