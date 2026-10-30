import * as dom from "../../dependencies/js/dom.js";
import {getWebsocketUrl, readStreamAddress} from "../../dependencies/js/server-url.js";
import {createStreamName} from "../../dependencies/js/identifiers.js";
import {initializeSDK, setStatus, setError, setInvalid, bindResize, queryParam} from "../../dependencies/js/streaming.js";

const EXTENSION_ID = "nlbaajplpmleofphigmgaifhoikjmbkg";
const EXTENSION_URL = `https://chrome.google.com/webstore/detail/flashphoner-screen-sharin/${EXTENSION_ID}`;
const CAPTURE_FIELDS = ["fps", "width", "height", "woChromeExtension", "useMic", "audioInput"];
let api;
let browser;
let sessionStatus;
let streamStatus;
let session;
let publisher;
let preview;
let name;
let run = 0;
let connectionRun = 0;
let failed = false;
let stopping = false;
let disconnectRequested = false;
let extensionMissing = false;
let sharingAvailable = false;
let extensionPoll;

initializeSDK((sdk) => {
    api = sdk;
    browser = api.Browser;
    sessionStatus = api.constants.SESSION_STATUS;
    streamStatus = api.constants.STREAM_STATUS;
    dom.setValue("url", `${getWebsocketUrl()}/${createStreamName(8)}`);
    bindResize(dom.byId("localVideo"));
    bindResize(dom.byId("remoteVideo"));
    dom.byId("useMic").onchange = updateMicrophone;
    dom.byId("installExtensionButton").onclick = installExtension;
    if (!configureCapture()) return;
    disconnected(sessionStatus.DISCONNECTED);
    if (!isSafariDesktop()) populateMicrophones();
}, {screenSharingExtensionId: EXTENSION_ID});

function isSafariDesktop() {
    return browser.isSafari() && !browser.isAndroid() && !browser.isiOS();
}

function configureCapture() {
    if (browser.isAndroid() || browser.isiOS() || !(browser.isChrome() || browser.isFirefox() || browser.isSafari())) {
        dom.setText("notifyFatal", "Screen sharing works only in desktop Chrome, Firefox and Safari.");
        return false;
    }
    sharingAvailable = true;
    if (isSafariDesktop()) {
        dom.setVisible("mic", false);
        dom.setVisible("micInput", false);
    } else if (browser.isChrome()) {
        dom.setVisible("chromeExtension", true);
        dom.setChecked("woChromeExtension", Boolean(window.navigator?.mediaDevices?.getDisplayMedia));
        detectChromeExtension();
    } else if (browser.isFirefox() && !api.firefoxScreenSharingExtensionInstalled) {
        sharingAvailable = false;
        showExtension("Install the Firefox screen sharing extension to continue.");
        extensionPoll = window.setInterval(() => {
            if (api.firefoxScreenSharingExtensionInstalled) {
                window.clearInterval(extensionPoll);
                sharingAvailable = true;
                dom.setVisible("extension", false);
                if (session && !publisher) ready();
            }
        }, 500);
    }
    return true;
}

function detectChromeExtension() {
    const missing = () => {
        extensionMissing = true;
        const nativeCapture = Boolean(window.navigator?.mediaDevices?.getDisplayMedia);
        dom.setChecked("woChromeExtension", true);
        dom.setDisabled("woChromeExtension", true);
        sharingAvailable = nativeCapture;
        if (queryParam("askExtension") === "true" || !nativeCapture) {
            showExtension(nativeCapture ? "The extension is optional when using native screen capture." : "Install the Chrome screen sharing extension to continue.");
        }
        if (session && !publisher) ready();
    };
    try {
        if (!window.chrome?.runtime?.sendMessage) {
            missing();
            return;
        }
        window.chrome.runtime.sendMessage(EXTENSION_ID, {type: "isInstalled"}, (response) => {
            if (window.chrome.runtime.lastError || !response) missing();
            else {
                extensionMissing = false;
                sharingAvailable = true;
                dom.setVisible("extension", false);
                if (!publisher) unlockSettings();
                if (session && !publisher) ready();
            }
        });
    } catch (error) {
        missing();
    }
}

function showExtension(message) {
    dom.setText("extensionInfo", message);
    dom.setVisible("extension", true);
    dom.setVisible("installExtensionButton", !browser.isChrome() || !inIframe());
    dom.setVisible("installFromMarket", browser.isChrome() && inIframe());
}

function inIframe() {
    try {
        return window.self !== window.top;
    } catch (error) {
        return true;
    }
}

function installExtension() {
    if (browser.isChrome()) {
        window.open(EXTENSION_URL, "_blank", "noopener,noreferrer");
    } else if (window.InstallTrigger?.install) {
        window.InstallTrigger.install({"Flashphoner Screen Sharing": {
            URL: "../../dependencies/screen-sharing/firefox-extension/flashphoner_screen_sharing-0.0.9-an+fx.xpi",
            IconURL: "../../dependencies/screen-sharing/firefox-extension/icon.png",
            Hash: "sha1:96699c6536de455cdc5c7705f5b24fae28931605",
            toString() { return this.URL; }
        }});
    } else {
        setError("info", "This Firefox version does not support extension installation through this page.");
    }
}

async function populateMicrophones() {
    try {
        const devices = await api.getMediaDevices(null, true);
        for (const device of devices.audio) {
            if ([...dom.byId("audioInput").options].some((option) => option.value === device.id)) continue;
            const option = document.createElement("option");
            option.value = device.id;
            option.textContent = device.label || device.id;
            dom.byId("audioInput").appendChild(option);
        }
    } catch (error) {
        setError("info", `Failed to list microphones: ${error.message}`);
    }
}

function updateMicrophone() {
    dom.setDisabled("audioInput", Boolean(publisher) || !dom.checked("useMic"));
}

function unlockSettings() {
    for (const id of CAPTURE_FIELDS) dom.setDisabled(id, id === "woChromeExtension" && extensionMissing);
    updateMicrophone();
}

function ready() {
    dom.setButton("connectBtn", "Disconnect", disconnect);
    dom.setButton("publishBtn", "Start sharing", start, !sharingAvailable);
    unlockSettings();
}

function disconnected(status) {
    const wasStreaming = Boolean(publisher);
    ++connectionRun;
    ++run;
    session = null;
    publisher = null;
    preview = null;
    dom.setDisabled("url", false);
    unlockSettings();
    dom.setButton("connectBtn", "Connect", connect);
    dom.setButton("publishBtn", "Start sharing", start, true);
    setStatus("status", status);
    if (disconnectRequested) setError("info", "");
    else if (wasStreaming) setError("info", "Connection closed. Screen sharing stopped.");
    else if (status === sessionStatus.FAILED) setError("info", "Failed to connect to the WebSocket server.");
    disconnectRequested = false;
}

function connect() {
    const address = readStreamAddress(dom.value("url"));
    if (!address) {
        setInvalid("url", true);
        setError("info", "Enter a URL such as wss://server:8443/stream.");
        dom.byId("url").focus();
        return;
    }
    name = address.name;
    disconnectRequested = false;
    setInvalid("url", false);
    setError("info", "");
    setStatus("status", "CONNECTING");
    dom.setDisabled("url", true);
    dom.setDisabled("connectBtn", true);
    const connection = ++connectionRun;
    try {
        session = api.createSession({urlServer: address.server})
            .on(sessionStatus.ESTABLISHED, (connected) => {
                if (connection !== connectionRun) return;
                session = connected;
                setStatus("status", sessionStatus.ESTABLISHED);
                ready();
            }).on(sessionStatus.DISCONNECTED, () => {
                if (connection === connectionRun) disconnected(sessionStatus.DISCONNECTED);
            }).on(sessionStatus.FAILED, () => {
                if (connection === connectionRun) disconnected(sessionStatus.FAILED);
            });
    } catch (error) {
        disconnected(sessionStatus.FAILED);
        setError("info", error.message);
    }
}

function disconnect() {
    disconnectRequested = true;
    dom.setDisabled("connectBtn", true);
    dom.setDisabled("publishBtn", true);
    try {
        session.disconnect();
    } catch (error) {
        disconnectRequested = false;
        setError("info", error.message);
        dom.setDisabled("connectBtn", false);
        dom.setDisabled("publishBtn", !publisher);
    }
}

function captureConstraints() {
    let valid = true;
    const dimensions = {};
    for (const id of ["fps", "width", "height"]) {
        const value = Number(dom.value(id));
        const ok = Number.isInteger(value) && value > 0;
        setInvalid(id, !ok);
        valid = valid && ok;
        dimensions[id] = value;
    }
    if (!valid) {
        setError("info", "Frame rate, width and height must be positive whole numbers.");
        return null;
    }
    const constraints = {video: {type: "screen", width: dimensions.width, height: dimensions.height, frameRate: dimensions.fps}};
    if (dom.checked("woChromeExtension") || browser.isSafari()) constraints.video.withoutExtension = true;
    if (browser.isFirefox()) constraints.video.mediaSource = "screen";
    if (dom.checked("useMic") && !isSafariDesktop()) {
        const deviceId = dom.value("audioInput");
        constraints.audio = deviceId ? {deviceId: {exact: deviceId}} : true;
    }
    return constraints;
}

function start() {
    const constraints = captureConstraints();
    if (!constraints) return;
    failed = false;
    stopping = false;
    setError("info", "");
    for (const id of CAPTURE_FIELDS) dom.setDisabled(id, true);
    dom.setDisabled("publishBtn", true);
    dom.setDisabled("connectBtn", true);
    const attempt = ++run;
    try {
        const options = {name, display: dom.byId("localVideo"), constraints};
        if (isSafariDesktop()) options.disableConstraintsNormalization = true;
        publisher = session.createStream(options)
            .on(streamStatus.PUBLISHING, (stream) => {
                if (attempt !== run) return;
                publisher = stream;
                const video = document.getElementById(stream.id()) || dom.byId("localVideo").querySelector("video");
                const track = video?.srcObject?.getVideoTracks()[0];
                if (track) track.onended = () => {
                    if (attempt === run) stop();
                };
                setStatus("status", streamStatus.PUBLISHING);
                dom.setButton("publishBtn", "Stop sharing", stop);
                dom.setDisabled("connectBtn", false);
                playPreview(attempt);
            }).on(streamStatus.UNPUBLISHED, () => finished(attempt, streamStatus.UNPUBLISHED))
            .on(streamStatus.FAILED, (stream) => {
                if (attempt !== run || sessionTerminated()) return;
                fail(stream.getInfo());
                finished(attempt, streamStatus.FAILED);
            });
        publisher.publish();
    } catch (error) {
        fail(error.message);
        finished(attempt, streamStatus.FAILED);
    }
}

function playPreview(attempt) {
    try {
        preview = session.createStream({name, display: dom.byId("remoteVideo")})
            .on(streamStatus.PLAYING, () => {
                if (attempt === run) dom.setButton("publishBtn", "Stop sharing", stop);
            }).on(streamStatus.STOPPED, () => {
                if (attempt !== run) return;
                preview = null;
                stop();
            }).on(streamStatus.FAILED, (stream) => {
                if (attempt !== run || sessionTerminated()) return;
                preview = null;
                fail(stream.getInfo());
                stop();
            });
        preview.play();
    } catch (error) {
        fail(error.message);
        stop();
    }
}

function sessionTerminated() {
    return [sessionStatus.DISCONNECTED, sessionStatus.FAILED].includes(session?.status());
}

function stop() {
    if (stopping) return;
    stopping = true;
    dom.setDisabled("publishBtn", true);
    const player = preview;
    preview = null;
    try {
        player?.stop();
    } catch (error) {
        fail(error.message);
    }
    try {
        publisher?.stop();
    } catch (error) {
        fail(error.message);
        finished(run, streamStatus.FAILED);
    }
}

function finished(attempt, status) {
    if (attempt !== run) return;
    ++run;
    const player = preview;
    preview = null;
    publisher = null;
    try {
        player?.stop();
    } catch (error) {
        fail(error.message);
    }
    if (!failed) setStatus("status", status);
    if (session) ready();
}

function fail(message) {
    failed = true;
    setStatus("status", "FAILED");
    setError("info", message || "Screen sharing failed.");
}
