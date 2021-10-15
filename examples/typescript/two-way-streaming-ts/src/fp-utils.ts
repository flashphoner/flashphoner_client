// eslint-disable-next-line
'use strict';
import { constants } from '@flashphoner/websdk';
const STREAM_STATUS = constants.STREAM_STATUS;

// Set default websocket URL
export function setURL(): string {
    let proto: string;
    let url: string;
    let port: string;
    if (window.location.protocol === "http:") {
        proto = "ws://";
        port = "8080";
    } else {
        proto = "wss://";
        port = "8443";
    }

    url = proto + window.location.hostname + ":" + port;
    return url;
}

// Get URL parameter by name
export function getUrlParam(name: string): string | null {
    let url = window.location.href;
    // eslint-disable-next-line
    name = name.replace(/[\[\]]/g, "\\$&");
    let regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
        results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, " "));
}

// Generate simple uuid
export function createUUID(length: number): string {
    var s = [];
    var hexDigits = "0123456789abcdef";
    for (var i = 0; i < 36; i++) {
        s[i] = hexDigits.substr(Math.floor(Math.random() * 0x10), 1);
    }
    s[14] = "4";
    s[19] = hexDigits.substr((parseInt(s[19], 16) & 0x3) | 0x8, 1);
    s[8] = s[13] = s[18] = s[23] = "-";

    var uuid = s.join("");

    return uuid.substring(0, length);
}

// Helper function to downscale picture size
export function downScaleToFitSize(videoWidth: number, videoHeight: number, dstWidth: number, dstHeight: number): any {
    let newWidth: number, newHeight: number;
    var videoRatio = videoWidth / videoHeight;
    var dstRatio = dstWidth / dstHeight;
    if (dstRatio > videoRatio) {
        newHeight = dstHeight;
        newWidth = Math.floor(videoRatio * dstHeight);
    } else {
        newWidth = dstWidth;
        newHeight = Math.floor(dstWidth / videoRatio);
    }
    return {
        w: newWidth,
        h: newHeight
    };
}

/**
 * Resize video object to fit parent div.
 * Div structure: div WxH -> div wrapper (display) -> video
 * @param video HTML element from resize event target
 */
export function resizeVideo(video: any, width?: number, height?: number) {
    if (!video.parentNode) {
        return;
    }
    let videoWidth = video.width;
    let videoHeight = video.height;
    if (video instanceof HTMLVideoElement) {
        videoWidth = video.videoWidth;
        videoHeight = video.videoHeight;
    }
    var display = video.parentNode;
    var parentSize = {
        w: display.parentNode.clientWidth,
        h: display.parentNode.clientHeight
    };
    let newSize: any;
    if (width && height) {
        newSize = downScaleToFitSize(width, height, parentSize.w, parentSize.h);
    } else {
        newSize = downScaleToFitSize(videoWidth, videoHeight, parentSize.w, parentSize.h);
    }
    display.style.width = newSize.w + "px";
    display.style.height = newSize.h + "px";

    //vertical align
    let margin = 0;
    if (parentSize.h - newSize.h > 1) {
        margin = Math.floor((parentSize.h - newSize.h) / 2);
    }
    display.style.margin = margin + "px auto";
    console.log("Resize from " + videoWidth + "x" + videoHeight + " to " + display.offsetWidth + "x" + display.offsetHeight);
}

export function isPlaying(streamStatus: string): boolean {
    switch(streamStatus) {
      case STREAM_STATUS.PLAYING:
      case STREAM_STATUS.RESIZE:
      case STREAM_STATUS.SNAPSHOT_COMPLETE:
      case STREAM_STATUS.NOT_ENOUGH_BANDWIDTH:
        return true;
      default:
        return false;
    }
}
