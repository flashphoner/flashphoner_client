import * as dom from "../../dependencies/js/dom.js";
import {readHlsParameters, initializeHlsPage, getHlsSource, setHlsState, showHlsPermalink,
    createPlaybackStats, resetHlsVideo} from "../../dependencies/js/hls.js";

let video;
let player;
let playbackStats;
let autoplay = false;
let active = false;
let attempt = 0;

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initPage, {once: true});
} else {
    initPage();
}

function initPage() {
    try {
        const parameters = readHlsParameters();
        ({autoplay} = initializeHlsPage(parameters));
        video = dom.byId("remoteVideo");
        video.muted = autoplay;
        dom.setChecked("llHlsEnabled", parameters.llhls);
        playbackStats = createPlaybackStats(video);
        dom.byId("applyBtn").onclick = () => active ? stopPlayback() : startPlayback();
        window.addEventListener("pagehide", () => stopPlayback());
        if (!window.Hls?.isSupported()) {
            setHlsState("FAILED", "Your browser does not support MSE technology required for HLS.js playback.");
            dom.setDisabled("applyBtn", true);
            return;
        }
        setHlsState("IDLE");
        if (autoplay) startPlayback();
    } catch (error) {
        setHlsState("FAILED", error.message || "Unable to initialize HLS.js playback.");
        dom.setDisabled("applyBtn", true);
    }
}

function startPlayback() {
    const source = getHlsSource();
    if (!source) {
        autoplay = false;
        return;
    }
    const currentAttempt = ++attempt;
    const lowLatency = dom.checked("llHlsEnabled");
    video.muted = autoplay;
    active = true;
    setHlsState("LOADING");
    clearQualityLevels();
    let created;
    const isCurrent = () => active && attempt === currentAttempt && player === created;
    try {
        created = new window.Hls(getHlsConfig(lowLatency));
        player = created;
        created.on(window.Hls.Events.MANIFEST_PARSED, () => {
            if (!isCurrent()) return;
            displayQualityLevels(created);
            try {
                Promise.resolve(video.play()).catch((error) => {
                    if (isCurrent() && error?.name !== "AbortError") {
                        failPlayback(error?.message || "Unable to start playback.");
                    }
                });
            } catch (error) {
                if (isCurrent()) failPlayback(error.message || "Unable to start playback.");
            }
        });
        created.on(window.Hls.Events.ERROR, (_event, data) => {
            if (isCurrent() && data?.fatal) {
                failPlayback(`HLS playback failed: ${data.details || data.type || "unable to load the stream"}.`);
            }
        });
        video.onplaying = () => {
            if (!isCurrent()) return;
            setHlsState("PLAYING");
            showHlsPermalink(source, {llhls: lowLatency});
            dom.setVisible("quality", !autoplay && created.levels.length > 0);
            if (!autoplay) playbackStats.start();
        };
        video.onerror = () => {
            if (isCurrent()) failPlayback(video.error?.message || "The browser could not play this HLS stream.");
        };
        video.onended = () => {
            if (isCurrent()) stopPlayback();
        };
        created.loadSource(source);
        created.attachMedia(video);
    } catch (error) {
        if (attempt === currentAttempt) failPlayback(error.message || "Unable to load the HLS stream.");
    }
}

function releasePlayback() {
    active = false;
    attempt += 1;
    video.onplaying = null;
    video.onerror = null;
    video.onended = null;
    playbackStats.stop();
    clearQualityLevels();
    const previous = player;
    player = undefined;
    if (previous) {
        try {
            previous.stopLoad();
        } finally {
            previous.destroy();
        }
    }
    resetHlsVideo(video);
}

function stopPlayback() {
    if (!video || !playbackStats) return;
    releasePlayback();
    autoplay = false;
    setHlsState("STOPPED");
}

function failPlayback(message) {
    releasePlayback();
    autoplay = false;
    setHlsState("FAILED", message);
}

function clearQualityLevels() {
    dom.clearChildren("qualityBtns");
    dom.setVisible("quality", false);
}

function displayQualityLevels(current) {
    clearQualityLevels();
    if (autoplay || !current.levels.length) return;
    const container = dom.byId("qualityBtns");
    const buttons = [];
    const addLevel = (label, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = index === -1 ? "button button-primary" : "button";
        button.textContent = label;
        button.setAttribute("aria-pressed", String(index === -1));
        button.onclick = () => {
            if (!active || player !== current) return;
            current.currentLevel = index;
            for (const item of buttons) {
                const selected = item === button;
                item.className = selected ? "button button-primary" : "button";
                item.setAttribute("aria-pressed", String(selected));
            }
        };
        buttons.push(button);
        container.appendChild(button);
    };
    current.levels.forEach((level, index) => {
        addLevel(level.height ? `${level.height}p` : `${Math.round(level.bitrate / 1000)} kbps`, index);
    });
    addLevel("Auto", -1);
}

function getHlsConfig(lowLatency) {
    const loadPolicy = (timeoutRetries, errorRetries) => ({default: {
        maxTimeToFirstByteMs: Infinity,
        maxLoadTimeMs: 20000,
        timeoutRetry: {maxNumRetry: timeoutRetries, retryDelayMs: 0, maxRetryDelayMs: 0},
        errorRetry: {maxNumRetry: errorRetries, retryDelayMs: 1000, maxRetryDelayMs: 8000}
    }});
    const config = {
        lowLatencyMode: lowLatency,
        enableWorker: true,
        manifestLoadPolicy: loadPolicy(2, 1),
        playlistLoadPolicy: loadPolicy(2, 2),
        fragLoadPolicy: loadPolicy(4, 6)
    };
    if (lowLatency) {
        Object.assign(config, {
            liveSyncDuration: 0.5,
            liveMaxLatencyDuration: 5,
            liveDurationInfinity: true,
            highBufferWatchdogPeriod: 1
        });
    }
    return config;
}
