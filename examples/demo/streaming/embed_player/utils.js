/**
 * Set WCS URL
 * @return WCS URL to connect
 */
function setURL() {
    let proto;
    let url;
    let port;
    if (window.location.protocol == "http:") {
        proto = "ws://";
        port = "8080";
    } else {
        proto = "wss://";
        port = "8443";
    }

    url = proto + window.location.hostname + ":" + port;
    return url;
}


/**
 * Check if value is URI encoded
 * @param value a string to check for encoding
 * @return true if value is encoded
 */
function isEncoded(value) {
  value = value || '';
  let result;

  try {
     result = (value !== decodeURIComponent(value));
  } catch (e) {
     result = false;
  }

  return result;
}

/**
 * Get a parameter passed in URL by name
 * @param name parameter name
 * @return parameter value decoded if needed
 */
function getUrlParam(name) {
    let url = window.location.href;
    name = name.replace(/[\[\]]/g, "\\$&");
    // Fixed streams playback with '#' char in name (test#m1) #WCS-3655
    let regex = new RegExp("[?&]" + name + "(=([^&]*)|&|$)"),
        results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    let value = results[2];
    if (isEncoded(value)) {
        value = decodeURIComponent(value);
    }
    // Add workaround to play RTSP streams with '@' char in password #WCS-3655
    if (value.startsWith("rtsp://") || value.startsWith("rtmp://")) {
        return value.replace(/\@(?=.*\@)/g, '%40');
    }
    return value;
}

/**
 * Resize video object to fit parent div.
 * Div structure: div WxH -> div wrapper (display) -> video
 * @param video HTML element from resize event target
 * @param width optional width to scale
 * @param height optional height to scale
 */
function resizeVideo(video, width, height) {
    if (!video.parentNode) {
        return;
    }
    if (video instanceof HTMLCanvasElement) {
        video.videoWidth = video.width;
        video.videoHeight = video.height;
    }
    let display = video.parentNode;
    let parentSize = {
        w: display.parentNode.clientWidth,
        h: display.parentNode.clientHeight
    };
    let newSize;
    if (width && height) {
        newSize = downScaleToFitSize(width, height, parentSize.w, parentSize.h);
    } else {
        newSize = downScaleToFitSize(video.videoWidth, video.videoHeight, parentSize.w, parentSize.h);
    }
    display.style.width = newSize.w + "px";
    display.style.height = newSize.h + "px";

    //vertical align
    let margin = 0;
    if (parentSize.h - newSize.h > 1) {
        margin = Math.floor((parentSize.h - newSize.h) / 2);
    }
    display.style.margin = margin + "px auto";
    console.log("Resize from " + video.videoWidth + "x" + video.videoHeight + " to " + display.offsetWidth + "x" + display.offsetHeight);
}


/**
 * Helper function to resize video
 * @param videoWidth source video width
 * @param videoHeight source video height
 * @param dstWidth destination video width
 * @param dstHeight destination video height
 * @return new width and height
 */
function downScaleToFitSize(videoWidth, videoHeight, dstWidth, dstHeight) {
    let newWidth, newHeight;
    let videoRatio = videoWidth / videoHeight;
    let dstRatio = dstWidth / dstHeight;
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
