import {getHLSUrl} from "./server-url.js";

const fieldIds = ["urlServer", "playStream", "key", "token", "fullLink"];
const element = (id) => document.getElementById(id);

export function readHlsParameters() {
    const parameters = new URLSearchParams(window.location.search);
    return {
        src: parameters.get("src") || "",
        autoplay: parameters.get("autoplay") === "true",
        version: parameters.get("version"),
        llhls: parameters.get("llhls") === "true"
    };
}

export function initializeHlsPage(parameters) {
    element("urlServer").value = getHLSUrl();
    element("fullLink").value = parameters.src || "";
    const autoplay = Boolean(parameters.autoplay && parameters.src);
    document.body.classList.toggle("hls-autoplay", autoplay);
    setHlsState("IDLE");
    return {autoplay};
}

function setInvalid(id, invalid) {
    const field = element(id);
    field.setAttribute("aria-invalid", String(invalid));
    field.closest(".control-group, .field-row")?.classList.toggle("has-error", invalid);
}

function httpAddress(value) {
    try {
        const address = new URL(value);
        return ["http:", "https:"].includes(address.protocol) ? address : null;
    } catch {
        return null;
    }
}

export function getHlsSource() {
    fieldIds.forEach((id) => setInvalid(id, false));
    const server = element("urlServer").value.trim();
    const stream = element("playStream").value;
    let source = element("fullLink").value.trim();
    if (server && stream.trim()) {
        const address = httpAddress(server);
        if (!address || address.search || address.hash) {
            setInvalid("urlServer", true);
            setHlsState("FAILED", "Enter a valid HTTP or HTTPS WCS URL.");
            return "";
        }
        const name = encodeURIComponent(stream);
        source = `${server.replace(/\/+$/, "")}/${name}/${name}.m3u8`;
        const key = element("key").value;
        const token = element("token").value;
        if (key && token) source += `?${encodeURIComponent(key)}=${encodeURIComponent(token)}`;
    }
    if (!httpAddress(source)) {
        setInvalid("fullLink", true);
        setHlsState("FAILED", "Enter a WCS URL and stream name, or a full HTTP or HTTPS HLS URL.");
        return "";
    }
    element("fullLink").value = source;
    return source;
}

export function setHlsState(state, message = "") {
    if (state === "FAILED" || state === "STOPPED") document.body.classList.toggle("hls-autoplay", false);
    const active = state === "LOADING" || state === "PLAYING";
    element("status").textContent = state;
    element("status").dataset.state = state;
    element("info").textContent = message;
    element("info").hidden = !message;
    element("applyBtn").textContent = active ? "Stop" : "Play";
    for (const id of fieldIds) element(id).disabled = active;
    document.querySelectorAll("[data-hls-option]").forEach((control) => { control.disabled = active; });
    if (state === "LOADING") element("permalink").hidden = true;
}

export function showHlsPermalink(source, parameters = {}) {
    if (document.body.classList.contains("hls-autoplay")) return;
    const link = new URL(window.location.href);
    link.search = new URLSearchParams({...parameters, src: source}).toString();
    link.hash = "";
    element("permalink").href = link.href;
    element("permalink").hidden = false;
}

export function createPlaybackStats(videoOrGetter) {
    let timer = null;
    let previous = null;
    const video = () => typeof videoOrGetter === "function" ? videoOrGetter() : videoOrGetter;
    function sample() {
        const current = video();
        if (!current) return;
        const quality = typeof current.getVideoPlaybackQuality === "function" ? current.getVideoPlaybackQuality() : null;
        const frames = quality ? quality.totalVideoFrames - quality.droppedVideoFrames : undefined;
        return {time: Date.now(), frames, bytes: current.webkitVideoDecodedByteCount};
    }
    function display() {
        const current = video();
        if (!current) return;
        const next = sample();
        const seconds = previous ? (next.time - previous.time) / 1000 : 0;
        element("videoWidth").textContent = current.videoWidth || "No data";
        element("videoHeight").textContent = current.videoHeight || "No data";
        const rate = (key) => seconds > 0 && Number.isFinite(next[key]) && Number.isFinite(previous[key])
            && next[key] >= previous[key] ? (next[key] - previous[key]) / seconds : null;
        const bitrate = rate("bytes");
        const fps = rate("frames");
        element("videoRate").textContent = bitrate === null ? "N/A" : String(Math.round(bitrate * 8));
        element("videoFps").textContent = fps === null ? "N/A" : fps.toFixed(1);
        previous = next;
    }
    const stop = () => {
        if (timer !== null) clearInterval(timer);
        timer = null;
        previous = null;
        element("stats").hidden = true;
    };
    return {
        start() {
            stop();
            if (document.body.classList.contains("hls-autoplay")) return;
            previous = sample();
            ["videoWidth", "videoHeight", "videoRate", "videoFps"].forEach((id) => { element(id).textContent = "No data"; });
            element("stats").hidden = false;
            timer = setInterval(display, 1000);
        },
        stop
    };
}

export function resetHlsVideo(video) {
    if (!video) return;
    video.pause();
    video.removeAttribute("src");
    video.load();
}

export function setNativeFullscreenHandlers(video, startFullscreen = true) {
    let resume = false;
    let exited = false;
    let disposed = false;
    const play = () => {
        if (!disposed) video.play()?.catch(() => {});
    };
    const pause = () => {
        if (resume) {
            resume = false;
            play();
        }
    };
    const end = () => {
        exited = true;
        resume = true;
        play();
    };
    const playing = () => {
        if (startFullscreen && !exited && video.webkitSupportsFullscreen && video.webkitEnterFullscreen) {
            try { video.webkitEnterFullscreen(); } catch { /* Inline playback remains available. */ }
        }
    };
    video.addEventListener("pause", pause);
    video.addEventListener("webkitendfullscreen", end);
    video.addEventListener("playing", playing);
    return () => {
        disposed = true;
        video.removeEventListener("pause", pause);
        video.removeEventListener("webkitendfullscreen", end);
        video.removeEventListener("playing", playing);
    };
}
