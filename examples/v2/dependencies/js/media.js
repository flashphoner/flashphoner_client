/**
 * Fit a video or canvas into its container while preserving its aspect ratio.
 * Expected structure: frame -> display wrapper -> video/canvas.
 * Adapted from the legacy resizeVideo/downScaleToFitSize helpers.
 */
export function resizeVideo(video, width, height) {
    const display = video.parentElement;
    const frame = display?.parentElement;
    const isCanvas = video.tagName === "CANVAS";
    const sourceWidth = width ?? (isCanvas ? video.width : video.videoWidth);
    const sourceHeight = height ?? (isCanvas ? video.height : video.videoHeight);
    if (!display || !frame || !(sourceWidth > 0) || !(sourceHeight > 0) ||
        !(frame.clientWidth > 0) || !(frame.clientHeight > 0)) {
        return;
    }

    const videoRatio = sourceWidth / sourceHeight;
    const frameRatio = frame.clientWidth / frame.clientHeight;
    const fittedWidth = frameRatio > videoRatio ? Math.floor(videoRatio * frame.clientHeight) : frame.clientWidth;
    const fittedHeight = frameRatio > videoRatio ? frame.clientHeight : Math.floor(frame.clientWidth / videoRatio);
    display.style.width = `${fittedWidth}px`;
    display.style.height = `${fittedHeight}px`;
    display.style.margin = `${Math.max(0, Math.floor((frame.clientHeight - fittedHeight) / 2))}px auto`;
}

export function observeVideoSize(video, onMediaResize) {
    const frame = video.parentElement?.parentElement;
    if (!frame) {
        return () => {};
    }

    let active = true;
    const fit = () => {
        if (active) {
            resizeVideo(video);
        }
    };
    const mediaResize = () => {
        fit();
        if (active && video.videoWidth > 0 && video.videoHeight > 0) {
            onMediaResize?.(video);
        }
    };
    video.addEventListener("resize", mediaResize);
    video.addEventListener("loadedmetadata", mediaResize);

    let observer;
    if (window.ResizeObserver) {
        observer = new window.ResizeObserver(fit);
        observer.observe(frame);
    } else {
        window.addEventListener("resize", fit);
    }
    mediaResize();

    return () => {
        if (!active) {
            return;
        }
        active = false;
        observer?.disconnect();
        if (!observer) {
            window.removeEventListener("resize", fit);
        }
        video.removeEventListener("resize", mediaResize);
        video.removeEventListener("loadedmetadata", mediaResize);
    };
}
