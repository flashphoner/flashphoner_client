import * as dom from "../../dependencies/js/dom.js";
import {readHlsParameters, initializeHlsPage, getHlsSource, setHlsState, showHlsPermalink,
    createPlaybackStats, resetHlsVideo, setNativeFullscreenHandlers} from "../../dependencies/js/hls.js";

let video;
let playbackStats;
let autoplay = false;
let active = false;
let attempt = 0;
let releaseFullscreen;

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
        playbackStats = createPlaybackStats(video);
        dom.byId("applyBtn").onclick = () => active ? stopPlayback() : startPlayback();
        window.addEventListener("pagehide", () => stopPlayback());
        if (!video.canPlayType("application/vnd.apple.mpegurl") || !window.Flashphoner?.Browser?.isSafariWebRTC()) {
            setHlsState("FAILED", "Your browser does not support native HLS playback. Open this example in Safari.");
            dom.setDisabled("applyBtn", true);
            return;
        }
        setHlsState("IDLE");
        if (autoplay) startPlayback();
    } catch (error) {
        setHlsState("FAILED", error.message || "Unable to initialize native HLS playback.");
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
    const isCurrent = () => active && attempt === currentAttempt;
    video.muted = autoplay;
    active = true;
    setHlsState("LOADING");
    if (window.Flashphoner.Browser.isiOS()) {
        releaseFullscreen = setNativeFullscreenHandlers(video);
    }
    video.onloadedmetadata = () => {
        if (!isCurrent()) return;
        try {
            Promise.resolve(video.play()).catch((error) => {
                if (isCurrent() && error?.name !== "AbortError") {
                    failPlayback(error?.message || "Unable to start playback.");
                }
            });
        } catch (error) {
            if (isCurrent()) failPlayback(error.message || "Unable to start playback.");
        }
    };
    video.onplaying = () => {
        if (!isCurrent()) return;
        setHlsState("PLAYING");
        showHlsPermalink(source);
        if (!autoplay) playbackStats.start();
    };
    video.onerror = () => {
        if (isCurrent()) failPlayback(video.error?.message || "The browser could not load or play this HLS stream.");
    };
    video.onended = () => {
        if (isCurrent()) stopPlayback();
    };
    try {
        video.src = source;
        video.load();
    } catch (error) {
        if (isCurrent()) failPlayback(error.message || "Unable to load the HLS stream.");
    }
}

function releasePlayback() {
    active = false;
    attempt += 1;
    video.onloadedmetadata = null;
    video.onplaying = null;
    video.onerror = null;
    video.onended = null;
    releaseFullscreen?.();
    releaseFullscreen = undefined;
    playbackStats.stop();
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
