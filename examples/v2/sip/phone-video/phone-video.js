import {byId, checked, numberValue, setChecked, setDisabled, setText, setValue, setVisible, value} from "../../dependencies/js/dom.js";
import {validateField} from "../../dependencies/js/sip-call.js";
import {setupPhone} from "../../dependencies/js/sip-phone.js";
import {bindResize, initializeSDK, setError} from "../../dependencies/js/streaming.js";

initializeSDK(api => {
    const {MEDIA_DEVICE_KIND} = api.constants;
    const localDisplay = byId("localDisplay");
    let activeCall;
    let statsTimer;
    let screenTrack;
    let cameraTracks = [];
    let sharing = false;
    let switchingScreen = false;

    bindResize(localDisplay);
    bindResize(byId("remoteDisplay"));
    const screenSupported = !api.Browser.isAndroid() && !api.Browser.isiOS()
        && !!navigator.mediaDevices?.getDisplayMedia;
    byId("screenSharingToggle").parentElement.hidden = !screenSupported;

    function loadDevices() {
        api.getMediaDevices(null, true, MEDIA_DEVICE_KIND.ALL).then(devices => {
            const selectIds = {camera: "cameraList", mic: "micList", speaker: "speakerList"};
            for (const group of Object.values(devices)) {
                for (const device of group) {
                    const id = selectIds[device.type];
                    if (!id || !device.id) continue;
                    const select = byId(id);
                    if (![...select.options].some(option => option.value === device.id)) {
                        select.add(new Option(device.label || device.id, device.id));
                    }
                }
            }
            setVisible("speakerForm", api.Browser.isChrome() && byId("speakerList").options.length > 1);
            updateControls();
        }).catch(() => setError("mediaError", "Unable to list media devices."));
    }

    function getCallOptions() {
        const mic = value("micList");
        const camera = value("cameraList");
        const video = {
            width: numberValue("sendWidth"),
            height: numberValue("sendHeight"),
            frameRate: numberValue("sendFramerate")
        };
        if (camera) video.deviceId = {exact: camera};
        const find = value("sdpStringFind");
        const replacement = value("sdpStringReplace");
        return {
            constraints: {audio: mic ? {deviceId: {exact: mic}} : {}, video},
            sdpHook: ({sdpString}) => find && find !== "0" && replacement && replacement !== "0"
                ? sdpString.replace(find, replacement) : sdpString
        };
    }

    function setOutput(call) {
        const speaker = value("speakerList");
        if (speaker) return call.setAudioOutputId(speaker);
    }

    function setStats(outbound = {}, empty = "—") {
        for (const type of ["audio", "video"]) {
            setText(`${type}Bytes`, outbound[type]?.bytesSent ?? empty);
            setText(`${type}Packets`, outbound[type]?.packetsSent ?? empty);
        }
    }

    function updateControls() {
        const cameraBlocked = sharing || switchingScreen;
        setDisabled("cameraList", cameraBlocked);
        setDisabled("switchCamBtn", !activeCall || cameraBlocked || byId("cameraList").options.length < 2);
        setDisabled("switchMicBtn", !activeCall || byId("micList").options.length < 2);
        setDisabled("muteVideoToggle", !activeCall);
        setDisabled("screenSharingToggle", !activeCall || switchingScreen);
    }

    function render(call) {
        if (activeCall !== call) {
            clearInterval(statsTimer);
            activeCall = call;
            if (call) {
                statsTimer = setInterval(() => {
                    call.getStats(stats => {
                        if (activeCall === call && stats?.outboundStream) setStats(stats.outboundStream, 0);
                    });
                }, 2000);
            }
        }
        updateControls();
    }

    function reset() {
        screenTrack?.removeEventListener("ended", restoreCamera);
        screenTrack = undefined;
        for (const track of cameraTracks) track.stop();
        cameraTracks = [];
        sharing = false;
        switchingScreen = false;
        setChecked("screenSharingToggle", false);
        setChecked("muteVideoToggle", false);
        setStats();
    }

    async function switchDevice(id, method, next) {
        const call = activeCall;
        if (!call) return;
        const deviceId = value(id) || byId(id).options[1]?.value;
        try {
            const selected = await call[method](next ? undefined : deviceId);
            if (activeCall === call && selected) setValue(id, selected);
        } catch {
            if (activeCall === call) setError("mediaError", "Unable to switch devices.");
        }
    }

    function restoreCamera() {
        if (!activeCall || !sharing) return;
        try {
            activeCall.switchToCam();
            screenTrack?.removeEventListener("ended", restoreCamera);
            screenTrack = undefined;
            cameraTracks = [];
            sharing = false;
            setChecked("screenSharingToggle", false);
        } catch {
            setChecked("screenSharingToggle", true);
            setError("mediaError", "Unable to restore the camera.");
        }
        updateControls();
    }

    async function startScreenSharing() {
        const call = activeCall;
        if (!call || switchingScreen || sharing) return;
        const tracks = localDisplay.querySelector("video")?.srcObject?.getTracks() ?? [];
        switchingScreen = true;
        updateControls();
        try {
            await call.switchToScreen("screen", true);
            if (activeCall !== call) return;
            sharing = true;
            // The SDK keeps the original camera stream while the screen is being shared.
            cameraTracks = tracks;
            screenTrack = localDisplay.querySelector("video")?.srcObject?.getVideoTracks()[0];
            screenTrack?.addEventListener("ended", restoreCamera, {once: true});
        } catch {
            if (activeCall !== call) return;
            setChecked("screenSharingToggle", false);
            setError("mediaError", "Unable to share the screen.");
        } finally {
            if (activeCall === call) {
                switchingScreen = false;
                updateControls();
            }
        }
    }

    byId("cameraList").onchange = () => switchDevice("cameraList", "switchCam", false);
    byId("micList").onchange = () => switchDevice("micList", "switchMic", false);
    byId("switchCamBtn").onclick = () => switchDevice("cameraList", "switchCam", true);
    byId("switchMicBtn").onclick = () => switchDevice("micList", "switchMic", true);
    byId("speakerList").onchange = async () => {
        try {
            if (activeCall) await activeCall.setAudioOutputId(value("speakerList"));
        } catch {
            setError("mediaError", "Unable to switch speakers.");
        }
    };
    byId("muteVideoToggle").onchange = () => {
        if (checked("muteVideoToggle")) activeCall?.muteVideo();
        else activeCall?.unmuteVideo();
    };
    byId("screenSharingToggle").onchange = () => {
        if (checked("screenSharingToggle")) return startScreenSharing();
        restoreCamera();
    };

    setupPhone(api, {
        options: getCallOptions,
        render,
        reset,
        setOutput,
        validate: () => ["sendWidth", "sendHeight", "sendFramerate"].map(validateField).every(Boolean)
    });
    loadDevices();
});
