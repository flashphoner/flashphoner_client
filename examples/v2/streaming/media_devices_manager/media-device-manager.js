import {BitrateChart} from "./bitrate-chart.js";
import {StreamStatistics} from "./stream-statistics.js";
import {bindTooltips} from "../../dependencies/js/tooltips.js";
import * as dom from "../../dependencies/js/dom.js";
import {createStreamName} from "../../dependencies/js/identifiers.js";
import {observeVideoSize} from "../../dependencies/js/media.js";
import {getWebsocketUrl} from "../../dependencies/js/server-url.js";

const FlashphonerApi = window.Flashphoner;
const constants = FlashphonerApi?.constants ?? {};
const {
    SESSION_STATUS = {},
    STREAM_STATUS = {},
    STREAM_EVENT,
    STREAM_EVENT_TYPE = {},
    CONNECTION_QUALITY = {},
    MEDIA_DEVICE_KIND = {},
    TRANSPORT_TYPE = {},
    CONTENT_HINT_TYPE = {},
    SERVER_INFO = {}
} = constants;

const Browser = FlashphonerApi?.Browser;
const CONNECTION_QUALITY_UPDATE_TIMEOUT_MS = 10_000;
const STAT_INTERVAL_MS = 1_000;
const PRELOADER_URL = "../../assets/preloader.mp4";
const EMPTY_STAT_VALUE = "No data";
const NUMERIC_FIELDS = new Set([
    "fps",
    "sendWidth",
    "sendHeight",
    "sendVideoMinBitrate",
    "sendVideoMaxBitrate",
    "receiveBitrate",
    "quality"
]);
const MUTABLE_WHILE_STREAMING = new Set([
    "audioOutput",
    "micGainControl",
    "sendWidth",
    "sendHeight",
    "fps",
    "sendVideoMinBitrate",
    "sendVideoMaxBitrate"
]);

let statistics;
let localVideo;
let remoteVideo;
let publishStream;
let previewStream;
let stopLocalVideoResize;
let stopRemoteVideoResize;
let constraints;
let publishStatsIntervalId;
let playStatsIntervalId;
let speechIntervalId;
let speechTimeoutId;
let speechAudioSource;
let speechAudioProcessor;
let audioContext;
let audioContextForTest;
let testStarted = false;
let switchCamEnabled = true;
let currentVolumeValue = 50;
let currentGainValue = 50;
let videoBytesSent = 0;
let audioBytesSent = 0;
let videoBytesReceived = 0;
let audioBytesReceived = 0;

const publishConnectionQuality = {};
const playConnectionQuality = {};
const speechDetector = {
    clipping: false,
    lastClip: 0,
    threshold: 0.010,
    latency: 750
};

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initPage, {once: true});
} else {
    initPage();
}

async function initPage() {
    dom.setVisible("publishBitrateChart", false);
    dom.setVisible("playBitrateChart", false);
    initializeStatistics();
    localVideo = dom.byId("localVideo");
    remoteVideo = dom.byId("remoteVideo");
    setStatus("connectStatus", SESSION_STATUS.DISCONNECTED ?? "DISCONNECTED");

    if (!FlashphonerApi || !Browser) {
        dom.setText("notifyFatal", "Flashphoner Web SDK is not available.");
        return;
    }

    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioContext = AudioContext ? new AudioContext() : null;
    } catch (error) {
        console.warn("Failed to create audio context", error);
    }

    try {
        FlashphonerApi.init({
            mediaProvidersReadyCallback() {
                if (FlashphonerApi.isUsingTemasys()) {
                    dom.setVisible("audioInputForm", false);
                    dom.setVisible("videoInputForm", false);
                }
            }
        });
    } catch (error) {
        dom.setText("notifyFatal", "Your browser doesn't support WebRTC technology needed for this example");
        console.error(error);
        return;
    }

    bindControls();
    populateEnumSelect("transportInput", TRANSPORT_TYPE);
    populateEnumSelect("transportOutput", TRANSPORT_TYPE);
    populateEnumSelect("contentHintInput", CONTENT_HINT_TYPE);

    dom.setValue("urlServer", getWebsocketUrl());
    const streamName = createStreamName();
    dom.setValue("publishStream", streamName);
    dom.setValue("playStream", streamName);
    onDisconnected();

    await loadInputDevices();
    await loadOutputDevices();

    if (Browser.isiOS() && Browser.isSafariWebRTC()) {
        document.addEventListener("visibilitychange", onVisibilityChanged);
    }
}

async function loadInputDevices() {
    try {
        if (Browser.isAndroid() || Browser.isiOS()) {
            dom.setVisible("screenShareForm", false);
            if (Browser.isFirefox()) {
                const devices = await FlashphonerApi.getMediaDevices(null, true);
                setSwitchableControls(devices.video, "videoInput", "sendVideo");
                setSwitchableControls(devices.audio, "audioInput", "sendAudio");
            } else {
                const devices = await FlashphonerApi.getMobileDevices(null, MEDIA_DEVICE_KIND.INPUT);
                setSwitchableControls(devices.video, "videoInput", "sendVideo");
                setSwitchableControls(devices.audio, "audioInput", "sendAudio");
                switchCamEnabled = false;
            }
        } else {
            const devices = await FlashphonerApi.getMediaDevices(null, true);
            setSwitchableControls(devices.video, "videoInput", "sendVideo");
            setSwitchableControls(devices.audio, "audioInput", "sendAudio");
        }
    } catch (error) {
        dom.setText("notifyFatal", `Failed to get media devices: ${error.message}`);
    }
}

async function loadOutputDevices() {
    try {
        const devices = await FlashphonerApi.getMediaDevices(null, true, MEDIA_DEVICE_KIND.OUTPUT);
        if (devices.audio?.length) {
            addDevicesToSelect(devices.audio, "audioOutput");
        } else {
            dom.setValue("audioOutput", "");
        }
        dom.setVisible("audioOutputForm", Boolean(devices.audio?.length));
    } catch (error) {
        console.error(error);
        dom.setVisible("audioOutputForm", false);
        dom.setValue("audioOutput", "");
    }
}

function addDevicesToSelect(devices, selectId) {
    const select = dom.byId(selectId);
    for (const device of devices) {
        const alreadyAdded = [...select.options].some((option) => option.value === device.id);
        if (alreadyAdded) {
            continue;
        }

        const option = new Option(device.label || device.id, device.id);
        const isBackCamera = selectId === "videoInput" && option.text.toLowerCase().includes("back");
        if (isBackCamera && select.firstChild) {
            select.insertBefore(option, select.firstChild);
        } else {
            select.append(option);
        }
    }
}

function setSwitchableControls(devices, selectId, sendCheckboxId) {
    if (devices?.length) {
        addDevicesToSelect(devices, selectId);
        dom.setDisabled(sendCheckboxId, false);
        return;
    }
    dom.setChecked(sendCheckboxId, false);
    dom.setDisabled(sendCheckboxId, true);
}

function onConnected(session) {
    setError("connectError", "");
    updateServerVersion(session.getServerVersion(), true);
    dom.setButton("connectBtn", "Disconnect", () => {
        dom.setDisabled("connectBtn", true);
        session.disconnect();
    });
    onUnpublished();
    onStopped();
}

function onDisconnected() {
    setError("connectError", "");
    dom.setButton("connectBtn", "Connect", () => {
        dom.setDisabled("urlServer", true);
        dom.setDisabled("connectBtn", true);
        connect();
    });
    dom.setDisabled("urlServer", false);
    onUnpublished();
    onStopped();
    updateServerVersion("");
}

function connect() {
    const urlServer = dom.value("urlServer").trim();
    const timeout = dom.numberValue("timeout");
    setError("connectError", "");
    let established = false;
    console.log(`Create new session with url ${urlServer}`);

    try {
        const serverUrl = new URL(urlServer);
        if (serverUrl.protocol !== "ws:" && serverUrl.protocol !== "wss:") {
            throw new Error("Server URL must use ws:// or wss://.");
        }
        FlashphonerApi.createSession({urlServer, timeout})
            .on(SESSION_STATUS.CONNECTED, (session) => {
                setStatus("connectStatus", session.status());
            })
            .on(SESSION_STATUS.ESTABLISHED, (session) => {
                established = true;
                setStatus("connectStatus", session.status());
                onConnected(session);
            })
            .on(SERVER_INFO.SERVER_VERSION, (session) => {
                updateServerVersion(
                    session.getServerVersion(),
                    session.status() === SESSION_STATUS.ESTABLISHED
                );
            })
            .on(SESSION_STATUS.DISCONNECTED, () => {
                setStatus("connectStatus", SESSION_STATUS.DISCONNECTED);
                onDisconnected();
                if (!established) {
                    setError("connectError", "Can't connect to server.");
                }
            })
            .on(SESSION_STATUS.FAILED, () => {
                setStatus("connectStatus", SESSION_STATUS.FAILED);
                onDisconnected();
                setError("connectError", established ? "Connection to server lost." : "Can't connect to server.");
            });
    } catch (error) {
        console.error("Failed to create session", error);
        setStatus("connectStatus", SESSION_STATUS.FAILED);
        onDisconnected();
        setError("connectError", `Can't connect to server: ${error?.message ?? String(error)}`);
    }
}

function onPublishing(stream) {
    if (!publishStatsIntervalId) {
        publishStatsIntervalId = window.setInterval(loadPublishStats, STAT_INTERVAL_MS);
    }

    dom.setButton("publishBtn", "Stop", () => {
        dom.setDisabled("publishBtn", true);
        stream.stop();
    });

    if (switchCamEnabled) {
        dom.setButton("switchBtn", "Switch", async () => {
            try {
                selectDevice("videoInput", await stream.switchCam());
            } catch (error) {
                console.error("Failed to switch camera", error);
            }
        });
    }

    dom.setButton("switchMicBtn", "Switch", async () => {
        try {
            selectDevice("audioInput", await stream.switchMic());
        } catch (error) {
            console.error("Failed to switch microphone", error);
        }
    }, !dom.checked("sendAudio"));

    stream.setVolume(currentVolumeValue);
    dom.setButton("resolutionBtn", "Apply", () => updateResolution(stream));
    dom.setButton("fpsBtn", "Apply", () => updateFrameRate(stream));
    dom.setButton("bitrateBtn", "Apply", () => updateBitrate(stream));
}

function onUnpublished() {
    setError("publishError", "");
    stopLocalVideoResize?.();
    stopLocalVideoResize = null;
    publishStream = null;
    dom.setButton("publishBtn", "Publish", publishButtonClick);
    dom.setButton("switchBtn", "Switch", null, true);
    dom.setButton("switchMicBtn", "Switch", null, true);
    unmuteInputs("send");
    dom.setText("publishResolution", "");
    dom.setDisabled("testBtn", false);

    const disabled = !hasEstablishedSession();
    dom.setDisabled("publishBtn", disabled);
    dom.setDisabled("publishStream", disabled);
    clearStatInfo("out");
    clearIntervalIfSet("publish");
    enablePublishToggles(false);
    dom.setDisabled("resolutionBtn", true);
    dom.setDisabled("fpsBtn", true);
    dom.setDisabled("bitrateBtn", true);
}

function publishButtonClick() {
    if (!validateForm("send")) {
        return;
    }
    muteInputs("send");
    dom.setDisabled("publishBtn", true);
    publish();
}

function publish() {
    setError("publishError", "");
    if (testStarted) {
        stopTest();
    }

    const session = FlashphonerApi.getSessions()[0];
    const mediaConnectionConstraints = dom.checked("cpuOveruseDetection") ? undefined : {
        mandatory: {googCpuOveruseDetection: false}
    };

    publishConnectionQuality.chart = createOrClearChart(
        "publishBitrateChart",
        publishConnectionQuality.chart
    );

    publishStream = session.createStream({
        name: dom.value("publishStream"),
        display: localVideo,
        constraints: getConstraints(),
        mediaConnectionConstraints,
        sdpHook: rewriteSdp,
        transport: dom.value("transportInput"),
        cvoExtension: dom.checked("cvo"),
        stripCodecs: dom.value("stripPublishCodecs"),
        videoContentHint: dom.value("contentHintInput")
    })
        .on(STREAM_STATUS.PUBLISHING, (stream) => {
            publishConnectionQuality.connectionQualityUpdateTimestamp = Date.now();
            dom.setDisabled("testBtn", true);
            const video = dom.byId(stream.id());
            stopLocalVideoResize?.();
            stopLocalVideoResize = observeVideoSize(video, updatePublishResolution);
            enablePublishToggles(true);
            dom.emitChange("muteVideoToggle");
            dom.emitChange("muteAudioToggle");
            publishStream.setMicrophoneGain(currentGainValue);
            setStatus("publishStatus", STREAM_STATUS.PUBLISHING);
            onPublishing(stream);
        })
        .on(STREAM_STATUS.UNPUBLISHED, () => {
            setStatus("publishStatus", STREAM_STATUS.UNPUBLISHED);
            onUnpublished();
        })
        .on(STREAM_STATUS.FAILED, (stream) => {
            onUnpublished();
            setStatus("publishStatus", STREAM_STATUS.FAILED);
            setError("publishError", streamFailureInfo(stream, "Publishing failed."));
        })
        .on(CONNECTION_QUALITY.UPDATE, (quality, clientFiltered, serverFiltered) => {
            updateChart(quality, clientFiltered, serverFiltered, publishConnectionQuality);
        });

    publishStream.publish();
}

function updateResolution(stream) {
    stream.updateVideoResolution({
        width: dom.numberValue("sendWidth"),
        height: dom.numberValue("sendHeight")
    }).then((updatedConstraints) => {
        console.log(`Publishing video constraints changed to ${JSON.stringify(updatedConstraints)}`);
    }).catch((error) => console.error("Failed to update video resolution", error));
}

function updateBitrate(stream) {
    stream.updateVideoSettings({maxBitrate: dom.numberValue("sendVideoMaxBitrate")})
        .then((encodings) => {
            console.log(`Publishing video encoder parameters changed to ${JSON.stringify(encodings)}`);
        })
        .catch((error) => console.error("Failed to update video bitrate", error));
}

function updateFrameRate(stream) {
    stream.updateVideoSettings({frameRate: dom.numberValue("fps")})
        .then((encodings) => {
            console.log(`Publishing video encoder parameters changed to ${JSON.stringify(encodings)}`);
        })
        .catch((error) => console.error("Failed to update video frame rate", error));
}

function onPlaying(stream) {
    if (!playStatsIntervalId) {
        playStatsIntervalId = window.setInterval(loadPlayStats, STAT_INTERVAL_MS);
    }
    dom.setButton("playBtn", "Stop", () => {
        dom.setDisabled("playBtn", true);
        stream.stop();
    });
    dom.setDisabled("volumeControl", false);
    enablePlayToggles(true);
    if (stream.getAudioState()) {
        dom.setText("audioMuted", stream.getAudioState().muted);
    }
    if (stream.getVideoState()) {
        dom.setText("videoMuted", stream.getVideoState().muted);
    }
}

function onStopped() {
    setError("playError", "");
    stopRemoteVideoResize?.();
    stopRemoteVideoResize = null;
    previewStream = null;
    dom.setButton("playBtn", "Play", playButtonClick);
    unmuteInputs("play");
    dom.setText("playResolution", "");
    dom.setDisabled("volumeControl", false);

    const disabled = !hasEstablishedSession();
    dom.setDisabled("playBtn", disabled);
    dom.setDisabled("playStream", disabled);
    clearStatInfo("in");
    clearIntervalIfSet("play");
    stopSpeechDetection();
    enablePlayToggles(false);
}

function playButtonClick() {
    if (!validateForm("play")) {
        return;
    }
    muteInputs("play");
    dom.setDisabled("playBtn", true);
    play();
}

function play() {
    setError("playError", "");
    const session = FlashphonerApi.getSessions()[0];
    const streamConstraints = {
        audio: dom.checked("playAudio"),
        video: dom.checked("playVideo")
    };

    if (streamConstraints.audio) {
        const outputId = document.getElementById("audioOutput")?.value;
        streamConstraints.audio = outputId ? {outputId} : {};
        if (dom.checked("playStereoAudio")) {
            streamConstraints.audio.stereo = true;
        }
    }
    if (streamConstraints.video) {
        streamConstraints.video = {
            width: dom.checked("receiveDefaultSize") ? 0 : dom.numberValue("receiveWidth"),
            height: dom.checked("receiveDefaultSize") ? 0 : dom.numberValue("receiveHeight"),
            bitrate: dom.checked("receiveDefaultBitrate") ? 0 : dom.value("receiveBitrate"),
            quality: dom.checked("receiveDefaultQuality") ? 0 : dom.value("quality")
        };
    }

    playConnectionQuality.chart = createOrClearChart("playBitrateChart", playConnectionQuality.chart);
    let mutedStreamName = "";

    previewStream = session.createStream({
        name: dom.value("playStream"),
        display: remoteVideo,
        constraints: streamConstraints,
        transport: dom.value("transportOutput"),
        stripCodecs: dom.value("stripPlayCodecs")
    })
        .on(STREAM_STATUS.PLAYING, (stream) => {
            playConnectionQuality.connectionQualityUpdateTimestamp = Date.now();
            setStatus("playStatus", stream.status());
            onPlaying(stream);
            stopRemoteVideoResize?.();
            stopRemoteVideoResize = observeVideoSize(dom.byId(stream.id()), (video) => {
                dom.setText("playResolution", `${video.videoWidth}x${video.videoHeight}`);
            });
            scheduleSpeechDetection(stream);
        })
        .on(STREAM_STATUS.STOPPED, () => {
            setStatus("playStatus", STREAM_STATUS.STOPPED);
            onStopped();
        })
        .on(STREAM_STATUS.FAILED, (stream) => {
            onStopped();
            setStatus("playStatus", STREAM_STATUS.FAILED);
            setError("playError", streamFailureInfo(stream, "Playback failed."));
        })
        .on(CONNECTION_QUALITY.UPDATE, (quality, clientFiltered, serverFiltered) => {
            updateChart(quality, clientFiltered, serverFiltered, playConnectionQuality);
        })
        .on(STREAM_EVENT, (streamEvent) => {
            mutedStreamName = streamEvent.payload?.streamName ?? mutedStreamName;
            updateMutedState(streamEvent.type, mutedStreamName);
            console.log("Received stream event", streamEvent.type);
        });

    previewStream.play();
}

function updateMutedState(eventType, streamName) {
    const states = {
        [STREAM_EVENT_TYPE.AUDIO_MUTED]: {mutedElementId: "audioMuted", muted: true, streamElementId: "audioMutedStream"},
        [STREAM_EVENT_TYPE.AUDIO_UNMUTED]: {mutedElementId: "audioMuted", muted: false, streamElementId: "audioMutedStream"},
        [STREAM_EVENT_TYPE.VIDEO_MUTED]: {mutedElementId: "videoMuted", muted: true, streamElementId: "videoMutedStream"},
        [STREAM_EVENT_TYPE.VIDEO_UNMUTED]: {mutedElementId: "videoMuted", muted: false, streamElementId: "videoMutedStream"}
    };
    const state = states[eventType];
    if (state) {
        dom.setText(state.mutedElementId, state.muted);
        dom.setText(state.streamElementId, streamName);
    }
}

function getConstraints() {
    constraints = {
        audio: dom.checked("sendAudio"),
        video: dom.checked("sendVideo")
    };

    if (constraints.audio) {
        constraints.audio = {deviceId: {exact: dom.value("audioInput")}};
        if (dom.checked("fec")) {
            constraints.audio.fec = true;
        }
        if (dom.checked("sendStereoAudio")) {
            constraints.audio.stereo = true;
        }
        if (dom.numberValue("sendAudioBitrate") > 0) {
            constraints.audio.bitrate = dom.numberValue("sendAudioBitrate");
        }
    }

    if (constraints.video) {
        constraints.video = {
            deviceId: {exact: dom.value("videoInput")},
            width: dom.numberValue("sendWidth"),
            height: dom.numberValue("sendHeight")
        };
        if (dom.numberValue("sendVideoMinBitrate") > 0) {
            constraints.video.minBitrate = dom.numberValue("sendVideoMinBitrate");
        }
        if (dom.numberValue("sendVideoMaxBitrate") > 0) {
            constraints.video.maxBitrate = dom.numberValue("sendVideoMaxBitrate");
        }
        if (dom.numberValue("fps") > 0) {
            constraints.video.frameRate = dom.numberValue("fps");
        }
    }
    return constraints;
}

function rewriteSdp(sdp) {
    const find = dom.value("sdpStringFind").replace("\\r\\n", "\r\n");
    const replacement = dom.value("sdpStringReplace").replace("\\r\\n", "\r\n");
    if (find !== "0" && replacement !== "0") {
        return sdp.sdpString.toString().replace(new RegExp(find, "g"), replacement);
    }
    return sdp.sdpString;
}

function bindControls() {
    bindTooltips();
    dom.byId("receiveDefaultSize").addEventListener("change", (event) => {
        dom.setDisabled("receiveWidth", event.currentTarget.checked);
        dom.setDisabled("receiveHeight", event.currentTarget.checked);
    });
    dom.byId("receiveDefaultBitrate").addEventListener("change", (event) => {
        dom.setDisabled("receiveBitrate", event.currentTarget.checked);
    });
    dom.byId("receiveDefaultQuality").addEventListener("change", (event) => {
        dom.setDisabled("quality", event.currentTarget.checked);
    });
    dom.byId("micGainControl").addEventListener("input", (event) => {
        currentGainValue = Number(event.currentTarget.value);
        publishStream?.setMicrophoneGain(currentGainValue);
    });
    dom.byId("volumeControl").addEventListener("input", (event) => {
        currentVolumeValue = Number(event.currentTarget.value);
        previewStream?.setVolume(currentVolumeValue);
    });
    dom.byId("audioOutput").addEventListener("change", (event) => {
        previewStream?.setAudioOutputId(event.currentTarget.value);
    });
    dom.byId("videoInput").addEventListener("change", (event) => {
        publishStream?.switchCam(event.currentTarget.value);
    });
    dom.byId("audioInput").addEventListener("change", (event) => {
        publishStream?.switchMic(event.currentTarget.value);
    });
    dom.byId("muteAudioToggle").addEventListener("change", (event) => {
        if (event.currentTarget.checked) {
            publishStream?.muteAudio();
        } else {
            publishStream?.unmuteAudio();
        }
    });
    dom.byId("muteVideoToggle").addEventListener("change", (event) => {
        if (event.currentTarget.checked) {
            publishStream?.muteVideo();
        } else {
            publishStream?.unmuteVideo();
        }
    });
    dom.byId("screenShareToggle").addEventListener("change", (event) => {
        if (event.currentTarget.checked) {
            switchToScreen();
        } else {
            switchToCamera();
        }
    });
    dom.byId("publishChartToggle").addEventListener("change", (event) => {
        dom.setVisible("publishBitrateChart", event.currentTarget.checked);
        publishConnectionQuality.chart?.draw();
    });
    dom.byId("playChartToggle").addEventListener("change", (event) => {
        dom.setVisible("playBitrateChart", event.currentTarget.checked);
        playConnectionQuality.chart?.draw();
    });
    dom.setButton("testBtn", "Test", runMediaTest);
}

function runMediaTest() {
    dom.setDisabled("testBtn", true);
    if (Browser.isSafariWebRTC()) {
        FlashphonerApi.playFirstVideo(localVideo, true, PRELOADER_URL)
            .then(() => FlashphonerApi.playFirstVideo(remoteVideo, false, PRELOADER_URL))
            .then(startTest)
            .catch((error) => {
                console.error("Failed to prepare Safari media playback", error);
                dom.setDisabled("testBtn", false);
            });
        return;
    }
    startTest();
}

function switchToScreen() {
    if (!publishStream) {
        return;
    }
    dom.setDisabled("switchBtn", true);
    dom.setDisabled("videoInput", true);
    publishStream.switchToScreen(undefined, true).catch(() => {
        dom.setChecked("screenShareToggle", false);
        dom.setDisabled("switchBtn", !switchCamEnabled);
        dom.setDisabled("videoInput", false);
    });
}

function switchToCamera() {
    if (!publishStream) {
        return;
    }
    publishStream.switchToCam();
    dom.setDisabled("switchBtn", !switchCamEnabled);
    dom.setDisabled("videoInput", false);
}

function enablePublishToggles(enable) {
    for (const id of ["muteAudioToggle", "muteVideoToggle", "screenShareToggle", "publishChartToggle"]) {
        dom.setDisabled(id, !enable);
        if (!enable) {
            dom.setChecked(id, false);
        }
        dom.emitChange(id);
    }
}

function enablePlayToggles(enable) {
    dom.setDisabled("playChartToggle", !enable);
    if (!enable) {
        dom.setChecked("playChartToggle", false);
    }
    dom.emitChange("playChartToggle");
}

function muteInputs(prefix) {
    forEachGroupInput(prefix, (input) => {
        if (!MUTABLE_WHILE_STREAMING.has(input.id)) {
            input.disabled = true;
        }
    });
}

function unmuteInputs(prefix) {
    forEachGroupInput(prefix, (input) => {
        if (input.id === "sendAudio" && dom.byId("audioInput").options.length === 0) {
            return;
        }
        if (input.id === "sendVideo" && dom.byId("videoInput").options.length === 0) {
            return;
        }
        if (["receiveWidth", "receiveHeight"].includes(input.id)) {
            input.disabled = dom.checked("receiveDefaultSize");
        } else if (input.id === "receiveBitrate") {
            input.disabled = dom.checked("receiveDefaultBitrate");
        } else if (input.id === "quality") {
            input.disabled = dom.checked("receiveDefaultQuality");
        } else {
            input.disabled = false;
        }
    });
}

function forEachGroupInput(prefix, callback) {
    document.querySelectorAll(`[id^="${prefix}"][class*="group"] input`).forEach(callback);
}

function validateForm(prefix) {
    let valid = true;
    const videoToggle = dom.byId(`${prefix}Video`);
    const audioToggle = dom.byId(`${prefix}Audio`);
    if (!videoToggle.checked && !audioToggle.checked) {
        setInvalid(videoToggle, true);
        setInvalid(audioToggle, true);
        valid = false;
    } else {
        setInvalid(videoToggle, false);
        setInvalid(audioToggle, false);
    }

    const validateGroup = (groupId) => {
        dom.byId(groupId).querySelectorAll('input[type="text"], select').forEach((input) => {
            const emptyRequiredValue = !input.value && input.id !== "audioOutput" && !input.id.startsWith("strip");
            const invalidNumber = NUMERIC_FIELDS.has(input.id) && !(Number.parseInt(input.value, 10) >= 0);
            const invalid = emptyRequiredValue || invalidNumber;
            setInvalid(input, invalid);
            valid = valid && !invalid;
        });
    };

    if (prefix === "send") {
        if (dom.checked("sendAudio")) {
            validateGroup("sendAudioGroup");
        }
        if (dom.checked("sendVideo")) {
            validateGroup("sendVideoGroup");
        }
    } else {
        validateGroup("playGroup");
    }
    return valid;
}

function setInvalid(input, invalid) {
    input.setAttribute("aria-invalid", String(invalid));
    input.closest(".field-row")?.classList.toggle("has-error", invalid);
}

function setStatus(id, status) {
    const field = dom.byId(id);
    field.textContent = status ?? "";
    // WebKit can leave :has(:empty) styles stale after a text update.
    field.parentElement.dataset.empty = String(!field.textContent);
    field.className = "";
    if (["CONNECTED", "PLAYING", "ESTABLISHED", "PUBLISHING"].includes(status)) {
        field.className = "text-success";
    } else if (["DISCONNECTED", "UNPUBLISHED", "STOPPED"].includes(status)) {
        field.className = "text-muted";
    } else if (status === "FAILED") {
        field.className = "text-danger";
    }
}

function setError(id, message) {
    dom.setText(id, message);
    dom.setVisible(id, Boolean(message));
}

function streamFailureInfo(stream, fallback) {
    const details = [stream?.getInfo?.(), stream?.getErrorInfo?.()]
        .filter((detail) => typeof detail === "string" && detail.trim())
        .map((detail) => detail.trim());
    return [...new Set(details)].join(": ") || fallback;
}

function updateServerVersion(version, keepVisible = false) {
    const normalizedVersion = version === undefined || version === null ? "" : String(version).trim();
    dom.setText("serverVersion", normalizedVersion || EMPTY_STAT_VALUE);
    dom.byId("serverVersion").className = normalizedVersion ? "text-success" : "text-muted";
    dom.setVisible("wcsVersion", keepVisible || Boolean(normalizedVersion));
}

function onVisibilityChanged() {
    if (!Browser.isiOS() || !Browser.isSafariWebRTC() || document.hidden || !publishStream) {
        return;
    }
    publishStream.switchCam(dom.value("videoInput"))
        .then((id) => selectDevice("videoInput", id))
        .catch((error) => console.error("Failed to restore selected camera", error));
}

function selectDevice(selectId, deviceId) {
    const select = dom.byId(selectId);
    if ([...select.options].some((option) => option.value === deviceId)) {
        select.value = deviceId;
    }
}

function updatePublishResolution(video) {
    const {videoWidth, videoHeight} = video;
    if (dom.numberValue("sendWidth") !== videoWidth || dom.numberValue("sendHeight") !== videoHeight) {
        console.warn(`Camera does not support requested resolution; actual resolution is ${videoWidth}x${videoHeight}`);
    }
    dom.setText("publishResolution", `${videoWidth}x${videoHeight}`);
}

function stopSpeechDetection() {
    if (speechTimeoutId != null) {
        window.clearTimeout(speechTimeoutId);
        speechTimeoutId = null;
    }
    if (speechIntervalId != null) {
        window.clearInterval(speechIntervalId);
        speechIntervalId = null;
    }
    if (speechAudioProcessor) {
        speechAudioProcessor.onaudioprocess = null;
        speechAudioProcessor.disconnect();
        speechAudioProcessor = null;
    }
    speechAudioSource?.disconnect();
    speechAudioSource = null;
    setTalking(false);
}

function scheduleSpeechDetection(stream) {
    stopSpeechDetection();
    if (!dom.checked("playAudio") || FlashphonerApi.getMediaProviders()[0] !== "WebRTC") {
        return;
    }
    const timeoutId = window.setTimeout(() => {
        if (speechTimeoutId !== timeoutId) {
            return;
        }
        speechTimeoutId = null;
        if (previewStream !== stream || stream.status() !== STREAM_STATUS.PLAYING) {
            return;
        }
        try {
            if (Browser.isChrome()) {
                detectSpeechFromStats(stream);
            } else {
                detectSpeechFromAudio(stream);
            }
        } catch (error) {
            stopSpeechDetection();
            console.warn("Failed to start speech detection", error);
        }
    }, 3_000);
    speechTimeoutId = timeoutId;
}

function detectSpeechFromAudio(stream, level = 0.10, latency = 750) {
    if (!audioContext) {
        return;
    }
    const mediaStream = document.getElementById(stream.id())?.srcObject;
    if (!mediaStream) {
        return;
    }
    speechAudioSource = audioContext.createMediaStreamSource(mediaStream);
    speechAudioProcessor = audioContext.createScriptProcessor(512);
    const processor = speechAudioProcessor;
    processor.clipping = false;
    processor.lastClip = 0;
    processor.threshold = level;
    processor.latency = latency;
    processor.onaudioprocess = handleAudio;
    processor.isSpeech = function isSpeech() {
        if (this.clipping && this.lastClip + this.latency < window.performance.now()) {
            this.clipping = false;
        }
        return this.clipping;
    };
    speechAudioSource.connect(processor);
    processor.connect(audioContext.destination);
    speechIntervalId = window.setInterval(() => setTalking(processor.isSpeech()), 500);
}

function handleAudio(event) {
    const samples = event.inputBuffer.getChannelData(0);
    for (const sample of samples) {
        if (Math.abs(sample) >= this.threshold) {
            this.clipping = true;
            this.lastClip = window.performance.now();
            break;
        }
    }
}

function detectSpeechFromStats(stream, level = 0.010, latency = 750) {
    Object.assign(speechDetector, {threshold: level, latency, clipping: false, lastClip: 0});
    speechIntervalId = window.setInterval(() => {
        stream.getStats((stats) => {
            if (previewStream !== stream) {
                return;
            }
            const audioStats = stats?.inboundStream?.audio;
            if (!audioStats) {
                return;
            }
            if (audioStats.audioLevel >= speechDetector.threshold) {
                speechDetector.clipping = true;
                speechDetector.lastClip = window.performance.now();
            }
            if (speechDetector.lastClip + speechDetector.latency < window.performance.now()) {
                speechDetector.clipping = false;
            }
            setTalking(speechDetector.clipping);
        });
    }, 500);
}

function setTalking(active) {
    dom.byId("talking").classList.toggle("is-active", active);
}

function createOrClearChart(canvasId, chart) {
    if (chart) {
        chart.clear();
        return chart;
    }
    return new BitrateChart(dom.byId(canvasId));
}

function updateChart(quality, clientFiltered, serverFiltered, qualityState) {
    qualityState.connectionQualityUpdateTimestamp = Date.now();
    qualityState.chart.update(clientFiltered, serverFiltered);
    qualityState.quality = quality;
}

function loadPublishStats() {
    if (!publishStream) {
        return;
    }
    publishStream.getStats((stats) => {
        const video = stats?.outboundStream?.video;
        const audio = stats?.outboundStream?.audio;
        if (video) {
            showStat(video, "outVideoStat");
            updateBitrateMetric("outVideoStat", (video.bytesSent - videoBytesSent) * 8);
            videoBytesSent = video.bytesSent;
            if (Date.now() - CONNECTION_QUALITY_UPDATE_TIMEOUT_MS > publishConnectionQuality.connectionQualityUpdateTimestamp) {
                publishConnectionQuality.quality = CONNECTION_QUALITY.UNKNOWN;
            }
        }
        if (audio) {
            showStat(audio, "outAudioStat");
            updateBitrateMetric("outAudioStat", (audio.bytesSent - audioBytesSent) * 8);
            audioBytesSent = audio.bytesSent;
        }
        showConnectionStat(stats?.otherStats ?? {}, "outConnectionStat");
        if (publishConnectionQuality.quality !== undefined) {
            showStat({quality: publishConnectionQuality.quality}, "outConnectionStat");
        }
    });
}

function loadPlayStats() {
    if (!previewStream) {
        return;
    }
    previewStream.getStats((stats) => {
        const video = stats?.inboundStream?.video;
        const audio = stats?.inboundStream?.audio;
        if (video) {
            showStat(video, "inVideoStat");
            updateBitrateMetric("inVideoStat", (video.bytesReceived - videoBytesReceived) * 8);
            videoBytesReceived = video.bytesReceived;
            if (Date.now() - CONNECTION_QUALITY_UPDATE_TIMEOUT_MS > playConnectionQuality.connectionQualityUpdateTimestamp) {
                playConnectionQuality.quality = CONNECTION_QUALITY.UNKNOWN;
            }
        }
        if (audio) {
            if (audio.audioLevel) {
                audio.audioLevel = audio.audioLevel.toFixed(6);
            }
            showStat(audio, "inAudioStat");
            updateBitrateMetric("inAudioStat", (audio.bytesReceived - audioBytesReceived) * 8);
            audioBytesReceived = audio.bytesReceived;
        }
        showConnectionStat(stats?.otherStats ?? {}, "inConnectionStat");
        if (playConnectionQuality.quality !== undefined) {
            showStat({quality: playConnectionQuality.quality}, "inConnectionStat");
        }
    });
}

function showConnectionStat(stat, containerId) {
    statistics.update(containerId, stat, true);
}

function showStat(stat, containerId) {
    statistics.update(containerId, stat);
}

function updateBitrateMetric(containerId, bitrate) {
    statistics.update(containerId, {bitrate: Number.isFinite(bitrate) ? bitrate : EMPTY_STAT_VALUE});
}

function initializeStatistics() {
    statistics = new StreamStatistics(dom.byId("streamStats"));
}

function startTest() {
    FlashphonerApi.getMediaAccess(getConstraints(), localVideo).then(() => {
        dom.setButton("testBtn", "Release", () => {
            dom.setDisabled("testBtn", true);
            stopTest();
        });
        startMicrophoneMeter();
        testStarted = true;
    }).catch((error) => {
        console.error("Failed to get media access", error);
        dom.setDisabled("testBtn", false);
        testStarted = false;
    });
}

function startMicrophoneMeter() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (FlashphonerApi.getMediaProviders()[0] !== "WebRTC" || !AudioContext) {
        return;
    }

    const video = [...localVideo.children].find((child) => child.id.includes("-LOCAL_CACHED_VIDEO"));
    if (!video?.srcObject) {
        return;
    }
    audioContextForTest = new AudioContext();
    const microphone = audioContextForTest.createMediaStreamSource(video.srcObject);
    const processor = audioContextForTest.createScriptProcessor(1024, 1, 1);
    microphone.connect(processor);
    processor.connect(audioContextForTest.destination);
    processor.onaudioprocess = (event) => {
        const samples = event.inputBuffer.getChannelData(0);
        const sum = samples.reduce((total, sample) => total + sample * sample, 0);
        dom.setText("micLevel", Math.floor(Math.sqrt(sum / samples.length) * 100));
    };
}

function stopTest() {
    releaseTestResources();
    if (FlashphonerApi.releaseLocalMedia(localVideo)) {
        dom.setButton("testBtn", "Test", runMediaTest);
    } else {
        dom.setDisabled("testBtn", false);
    }
}

function releaseTestResources() {
    testStarted = false;
    if (audioContextForTest) {
        audioContextForTest.close();
        audioContextForTest = null;
    }
}

function clearStatInfo(prefix) {
    if (prefix === "in") {
        audioBytesReceived = 0;
        videoBytesReceived = 0;
    } else {
        audioBytesSent = 0;
        videoBytesSent = 0;
    }
    statistics.clear(prefix);
}

function clearIntervalIfSet(type) {
    if (type === "publish" && publishStatsIntervalId) {
        window.clearInterval(publishStatsIntervalId);
        publishStatsIntervalId = null;
    }
    if (type === "play" && playStatsIntervalId) {
        window.clearInterval(playStatsIntervalId);
        playStatsIntervalId = null;
    }
}

function populateEnumSelect(selectId, enumValues) {
    const select = dom.byId(selectId);
    Object.entries(enumValues).forEach(([name, enumValue]) => {
        select.append(new Option(enumValue ?? name, enumValue ?? name));
    });
}

function hasEstablishedSession() {
    const session = FlashphonerApi.getSessions()[0];
    return Boolean(session && session.status() === SESSION_STATUS.ESTABLISHED);
}
