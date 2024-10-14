///////////////////////////////////
///////////// Utils ////////////
///////////////////////////////////

/**
 * Default server ports description
 *
 * @type {{legacy: {http: number, https: number}, wss: number, http: number, https: number, ws: number, hls: {http: number, https: number}}}
 */
const DEFAULT_PORTS = {
    http: 8081,
    https: 8444,
    legacy: {
        http: 9091,
        https: 8888
    },
    ws: 8080,
    wss: 8443,
    hls: {
        http: 8082,
        https: 8445
    }
}

/**
 * Check if object is not empty
 *
 * @param obj object to check
 * @returns {boolean} true if object is not empty
*/
function notEmpty(obj) {
    if (obj != null && obj != 'undefined' && obj != '') {
        return true;
    }
    return false;
}

/**
 * Print trace string to
 *
 * @param str string to print
 */
function trace(str) {
    console.log(str);
}

/**
 * Get HTML page field
 *
 * @param name field name
 * @returns {*} field
 */
function field(name) {
    var field = document.getElementById(name).value;
    return field;
}

/**
 * Set default value to port if it is not defined
 *
 * @param port
 * @param value
 * @returns {*}
 */
function setDefaultPort(port, value) {
    if (port === undefined) {
        return value;
    }
    return port;
}

/**
 * Get server ports configuration
 *
 * @returns {{legacy: {http: number, https: number}, wss: number, http: number, https: number, ws: number, hls: {http: number, https: number}}}
 */
function getPortsConfig() {
    let portsConfig = DEFAULT_PORTS;
    try {
        // Try to get ports from a separate config declaring the SERVER_PORTS constant
        portsConfig = SERVER_PORTS;
        // Fill the ports absent in config by default values
        portsConfig.http = setDefaultPort(portsConfig.http, DEFAULT_PORTS.http);
        portsConfig.https = setDefaultPort(portsConfig.https, DEFAULT_PORTS.https);
        portsConfig.legacy = setDefaultPort(portsConfig.legacy, DEFAULT_PORTS.legacy);
        portsConfig.legacy.http = setDefaultPort(portsConfig.legacy.http, DEFAULT_PORTS.legacy.http);
        portsConfig.legacy.https = setDefaultPort(portsConfig.legacy.https, DEFAULT_PORTS.legacy.https);
        portsConfig.ws = setDefaultPort(portsConfig.ws, DEFAULT_PORTS.ws);
        portsConfig.wss = setDefaultPort(portsConfig.wss, DEFAULT_PORTS.wss);
        portsConfig.hls = setDefaultPort(portsConfig.hls, DEFAULT_PORTS.hls);
        portsConfig.hls.http = setDefaultPort(portsConfig.hls.http, DEFAULT_PORTS.hls.http);
        portsConfig.hls.https = setDefaultPort(portsConfig.hls.https, DEFAULT_PORTS.hls.https);
        console.log("Use custom server ports");
    } catch(e) {
        console.log("Use default server ports");
    }
    return portsConfig;
}

/**
 * Get web interface standard port depending on connection type
 *
 * @returns {string}
 */
function getWebPort() {
    let portsConfig = getPortsConfig();
    let port;
    if (window.location.protocol == "http:") {
        port = portsConfig.http;
    } else {
        port = portsConfig.https;
    }
    return port;
}

/**
 * Get HTML protocol used depending on connection type
 *
 * @returns {string}
 */
function getWebProtocol() {
    let proto;
    if (window.location.protocol == "http:") {
        proto = "http://";
    } else {
        proto = "https://";
    }
    return proto;
}

/**
 * Get websocket standard port depending on connection type
 *
 * @returns {string}
 */
function getWsPort() {
    let portsConfig = getPortsConfig();
    let port;
    if (window.location.protocol == "http:") {
        port = portsConfig.ws;
    } else {
        port = portsConfig.wss;
    }
    return port;
}

/**
 * Get websocket protocol type depending on connection type
 *
 * @returns {string}
 */
function getWsProtocol() {
    let proto;
    if (window.location.protocol == "http:") {
        proto = "ws://";
    } else {
        proto = "wss://";
    }
    return proto;
}

/**
 * Get standard HLS port depending on connection type
 *
 * @returns {string}
 */
function getHlsPort() {
    let portsConfig = getPortsConfig();
    let port;
    if (window.location.protocol == "http:") {
        port = portsConfig.hls.http;
    } else {
        port = portsConfig.hls.https;
    }
    return port;
}

/**
 * Set default WCS websocket URL (used in most examples)
 *
 * @returns {string}
 */
function setURL() {
    var proto = getWsProtocol();
    var port = getWsPort();
    var url = proto + window.location.hostname + ":" + port;
    return url;
}

/**
 * Get URL parameter
 *
 * @param name
 * @returns {string|null}
 */
function getUrlParam(name) {
    var url = window.location.href;
    name = name.replace(/[\[\]]/g, "\\$&");
    var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
        results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, " "));
}

/**
 * Get default HLS url
 *
 * @returns {string}
 */
function getHLSUrl() {
    var proto = getWebProtocol();
    var port = getHlsPort();
    var url = proto + window.location.hostname + ":" + port;
    return url;
}

/**
 * Get default admin URL (used in Embed Player)
 *
 * @returns {string}
 */
function getAdminUrl() {
    var portsConfig = getPortsConfig();
    var proto = getWebProtocol();
    var port;
    if (window.location.protocol == "http:") {
        port = portsConfig.legacy.http;
    } else {
        port = portsConfig.legacy.https;
    }
    var url = proto + window.location.hostname + ":" + port;
    return url;
}

/**
 * Get REST API URL
 *
 * @param hostName host name to override the default one
 * @param hostPort host port to override the default one
 * @returns {string}
 */
function getRestUrl(hostName, hostPort) {
    let proto = getWebProtocol();
    let port = getWebPort();
    if (!hostName) {
        hostName = window.location.hostname;
    }
    if (hostPort) {
        port = hostPort;
    }

    let url = proto + hostName + ":" + port;
    return url;
}

/**
 * Get Websocket URL
 *
 * @param hostName host name to override the default one
 * @param hostPort host port to override the default one
 * @returns {string}
 */
function getWebsocketUrl(hostName, hostPort) {
    let proto = getWsProtocol();
    let port = getWsPort();
    if (!hostName) {
        hostName = window.location.hostname;
    }
    if (hostPort) {
        port = hostPort;
    }

    let url = proto + hostName + ":" + port;
    return url;
}

/**
 * Detect IE (for compatibility only)
 *
 * @returns {boolean}
 */
function detectIE() {
    var ua = window.navigator.userAgent;
    var msie = ua.indexOf('MSIE ');
    if (msie > 0) {
        return true;
    }
    var trident = ua.indexOf('Trident/');
    if (trident > 0) {
        return true;
    }
    return false;
}

/**
 * Detect Flash (for compatibility only)
 *
 */
function detectFlash() {
    var hasFlash = false;
    try {
        var fo = new ActiveXObject('ShockwaveFlash.ShockwaveFlash');
        if (fo) {
            hasFlash = true;
        }
    } catch (e) {
        if (navigator.mimeTypes
            && navigator.mimeTypes['application/x-shockwave-flash'] != undefined
            && navigator.mimeTypes['application/x-shockwave-flash'].enabledPlugin) {
            hasFlash = true;
        }
    }
    if (!hasFlash) {
        $("#notifyFlash").text("Your browser doesn't support the Flash technology necessary for work of an example");
    }
}

/**
 * Generate simple uuid
 *
 * @param length UUID length
 * @returns {string}
 */
function createUUID(length) {
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
}

/**
 * Resize video object to fit parent div.
 * Div structure: div WxH -> div wrapper (display) -> video
 * @param video HTML element from resize event target
 */
function resizeVideo(video, width, height) {
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
        newSize = downScaleToFitSize(width, height, parentSize.w, parentSize.h);
    } else {
        newSize = downScaleToFitSize(video.videoWidth, video.videoHeight, parentSize.w, parentSize.h);
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
}

/**
 * Helper function to resize video tag
 *
 * @param videoWidth
 * @param videoHeight
 * @param dstWidth
 * @param dstHeight
 * @returns {{w: number, h: number}}
 */
function downScaleToFitSize(videoWidth, videoHeight, dstWidth, dstHeight) {
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
}

/**
 * Set Webkit fullscreen handler functions to video tag
 *
 * @param video
 */
function setWebkitFullscreenHandlers(video, startFullScreen = true) {
    if (video) {
        let needRestart = false;
        let wasFullscreen = false;
        // iOS hack when using standard controls to leave fullscreen mode
        video.addEventListener("pause", function () {
            if (needRestart) {
                console.log("Video paused after fullscreen, continue...");
                wasFullscreen = true;
                video.play();
                needRestart = false;
            }
        });
        video.addEventListener("webkitendfullscreen", function () {
            wasFullscreen = true;
            video.play();
            needRestart = true;
        });
        if (startFullScreen) {
            // Start playback in fullscreen if webkit-playsinline is set
            video.addEventListener("playing", function () {
                // Do not enter fullscreen again if we just left it #WCS-3860
                if (canWebkitFullScreen(video) && !wasFullscreen) {
                    // We should catch if fullscreen mode is not available
                    try {
                        video.webkitEnterFullscreen();
                    } catch (e) {
                        console.log("Fullscreen is not allowed: " + e);
                    }
                }
                wasFullscreen = false;
            });
        }
    } else {
        console.log("No video tag is passed, skip webkit fullscreen handlers setup");
    }
}

/**
 * Check if fullscreen mode is available in Webkit
 *
 * @param video
 * @returns {boolean}
 */
function canWebkitFullScreen(video) {
    let canFullscreen = false;
    if (video) {
        canFullscreen = video.webkitSupportsFullscreen && !video.webkitDisplayingFullscreen;
    }
    return canFullscreen;
}

/**
 * Helper function to set item text
 *
 * @param id
 * @param text
 */
const setText = function (id, text) {
    let item = document.getElementById(id);
    if (item) {
        item.innerHTML = text;
    }
}

/**
 * Helper function to set an item value
 *
 * @param id
 * @param value
 */
const setValue = function (id, value) {
    let item = document.getElementById(id);
    if (item) {
        item.value = value;
    }
}

/**
 * Helper function to get an item value
 *
 * @param id
 * @returns value
 */
const getValue = function (id) {
    let item = document.getElementById(id);
    if (item) {
        return item.value;
    }
    return null;
}

/**
 * Helper function to set/unset a checkbox
 *
 * @param id
 * @param value
 */
const setCheckbox = function (id, value) {
    let item = document.getElementById(id);
    if (item) {
        item.checked = value;
    }
}

/**
 * Helper function to get a checkbox state
 *
 * @param id
 * @returns value
 */
const getCheckbox = function (id) {
    let item = document.getElementById(id);
    if (item) {
        return item.checked;
    }
    return null;
}


/**
 * Helper function to display an item
 *
 * @param id
 */
const showItem = function(id) {
    let item = document.getElementById(id);
    if (item) {
        item.style.display = "block";
    }
}

/**
 * Helper function to hide an item
 *
 * @param id
 */
const hideItem = function(id) {
    let item = document.getElementById(id);
    if (item) {
        item.style.display = "none";
    }
}

/**
 * Helper function to disable an item
 *
 * @param id
 */
const disableItem = function(id) {
    let item = document.getElementById(id);
    if (item) {
        item.disabled = true;
    }
}

/**
 * Helper function to enable an item
 *
 * @param id
 */
const enableItem = function(id) {
    let item = document.getElementById(id);
    if (item) {
        item.disabled = false;
    }
}

/**
 * Set an event handler
 *
 * @param id
 * @param event
 * @param handler
 * @param previous
 */
const setHandler = function (id, event, handler, previous = null) {
    let item = document.getElementById(id);
    if (item) {
        if (previous) {
            item.removeEventListener(event, previous)
        }
        item.addEventListener(event, handler);
    }
}

/**
 * Find a closest item
 *
 * @param id
 * @param selector
 * @returns {null}
 */
const closest = function (id, selector) {
    let currentElement = document.getElementById(id);
    let returnElement = null;

    while (currentElement && currentElement.parentNode && !returnElement) {
        currentElement = currentElement.parentNode;
        returnElement = currentElement.querySelector(selector);
    }

    return returnElement;
}

/**
 * Display object properties fro debugging purposes
 *
 * @param object
 */
const showProps = function (object) {
    console.log("-------------------------------object begin");
    for (const property in object) {
        console.log(`${property}: ${object[property]}`);
    }
    console.log("-------------------------------object end");

}