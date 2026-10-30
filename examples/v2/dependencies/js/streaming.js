import * as dom from "./dom.js";
import {observeVideoSize} from "./media.js";

export function initializeSDK(callback, options = {}) {
    const initialize = async () => {
        const api = window.Flashphoner;
        if (!api?.constants || !api?.init) {
            setError("notifyFatal", "Flashphoner Web SDK is not available.");
            return;
        }
        try {
            await api.init(options);
            await callback(api);
        } catch (error) {
            setError("notifyFatal", error?.message || "Unable to initialize the Web SDK.");
            console.error(error);
        }
    };
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initialize, {once: true});
    } else {
        return initialize();
    }
}

export function setStatus(id, status) {
    const node = dom.byId(id);
    node.textContent = status ?? "";
    const color = ["CONNECTED", "ESTABLISHED", "PUBLISHING", "PLAYING", "AVAILABLE"].includes(status)
        ? "text-success" : ["FAILED", "UNAVAILABLE"].includes(status) ? "text-danger" : "text-muted";
    node.className = `stream-status ${color}`;
    if (node.parentElement) {
        node.parentElement.dataset.empty = String(!node.textContent);
    }
}

export function setError(id, message) {
    const node = dom.byId(id);
    node.textContent = message?.message ?? message ?? "";
    node.hidden = !node.textContent;
}

export function setInvalid(id, invalid) {
    const field = dom.byId(id);
    field.setAttribute("aria-invalid", String(invalid));
    field.closest(".control-group, .field-row")?.classList.toggle("has-error", invalid);
}

export function validateRequired(id) {
    const field = dom.byId(id);
    const valid = field.value.trim().length > 0;
    setInvalid(id, !valid);
    return valid;
}

export function queryParam(name) {
    return new URLSearchParams(window.location.search).get(name);
}

export function bindResize(display) {
    const media = new Map();
    let active = true;
    const refresh = () => {
        if (!active) return;
        const current = new Set(display.querySelectorAll("video, canvas"));
        for (const [node, cleanup] of media) {
            if (!current.has(node)) {
                cleanup();
                media.delete(node);
            }
        }
        for (const node of current) {
            if (!media.has(node)) {
                media.set(node, observeVideoSize(node));
            }
        }
    };
    refresh();
    const observer = window.MutationObserver ? new window.MutationObserver(refresh) : null;
    observer?.observe(display, {childList: true, subtree: true});
    return () => {
        if (!active) return;
        active = false;
        observer?.disconnect();
        for (const cleanup of media.values()) {
            cleanup();
        }
        media.clear();
    };
}
