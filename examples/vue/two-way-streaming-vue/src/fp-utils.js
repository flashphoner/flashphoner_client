// eslint-disable-next-line
'use strict';
const STREAM_STATUS = require('@flashphoner/websdk').constants.STREAM_STATUS;

module.exports = {

  // Set default websocket URL
  setURL: function() {
    var proto;
    var url;
    var port;
    if (window.location.protocol === "http:") {
        proto = "ws://";
        port = "8080";
    } else {
        proto = "wss://";
        port = "8443";
    }

    url = proto + window.location.hostname + ":" + port;
    return url;
  },

  // Get URL parameter by name
  getUrlParam: function (name) {
    var url = window.location.href;
    // eslint-disable-next-line
    name = name.replace(/[\[\]]/g, "\\$&");
    var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
        results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, " "));
  },

  // Generate simple uuid
  createUUID: function (length) {
    var s = [];
    var hexDigits = "0123456789abcdef";
    for (var i = 0; i < 36; i++) {
        s[i] = hexDigits.substr(Math.floor(Math.random() * 0x10), 1);
    }
    s[14] = "4";
    s[19] = hexDigits.substr((s[19] & 0x3) | 0x8, 1);
    s[8] = s[13] = s[18] = s[23] = "-";

    var uuid = s.join("");

    return uuid.substring(0, length);
  },

  // Helper function to downscale picture size
  downScaleToFitSize: function (videoWidth, videoHeight, dstWidth, dstHeight) {
    var newWidth, newHeight;
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
  },

  /**
   * Resize video object to fit parent div.
   * Div structure: div WxH -> div wrapper (display) -> video
   * @param video HTML element from resize event target
   */
  resizeVideo: function (video, width, height) {
    if (!video.parentNode) {
        return;
    }
    if (video instanceof HTMLCanvasElement) {
        video.videoWidth = video.width;
        video.videoHeight = video.height;
    }
    var display = video.parentNode;
    var parentSize = {
        w: display.parentNode.clientWidth,
        h: display.parentNode.clientHeight
    };
    var newSize;
    if (width && height) {
        newSize = this.downScaleToFitSize(width, height, parentSize.w, parentSize.h);
    } else {
        newSize = this.downScaleToFitSize(video.videoWidth, video.videoHeight, parentSize.w, parentSize.h);
    }
    display.style.width = newSize.w + "px";
    display.style.height = newSize.h + "px";

    //vertical align
    var margin = 0;
    if (parentSize.h - newSize.h > 1) {
        margin = Math.floor((parentSize.h - newSize.h) / 2);
    }
    display.style.margin = margin + "px auto";
    console.log("Resize from " + video.videoWidth + "x" + video.videoHeight + " to " + display.offsetWidth + "x" + display.offsetHeight);
  },

  isPlaying: function (streamStatus) {
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
};
