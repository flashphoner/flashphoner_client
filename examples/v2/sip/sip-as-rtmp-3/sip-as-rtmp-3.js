import {createStreamName} from "../../dependencies/js/identifiers.js";
import {parseWcsRestAddress, requestWcsRest} from "../../dependencies/js/rest-api.js";
import {getRestUrl, isLoopbackHost} from "../../dependencies/js/server-url.js";

const POLL_INTERVAL = 3000;
const CALL_STARTUP_GRACE = 15000;
const FINISHED_CALL = new Set(["FINISH", "FINISHED", "FAILED", "BUSY"]);
const STOPPED_AGENT = new Set(["FAILED", "STOPPED"]);
const READY_AGENT = new Set(["PROCESSED_REMOTE", "PROCESSED_LOCAL"]);
const embedded = window.WCS_WEB_URL !== undefined;
const element = (id) => document.getElementById(id);
const value = (id) => element(id).value.trim();
const checked = (id) => element(id).checked;

function resource() {
    return {data: null, busy: false, status: "IDLE", error: "", pollError: "", revision: 0};
}

const call = resource();
const push = resource();
const mixer = resource();
const injection = resource();
const pulls = [1, 2, 3].map((index) => ({...resource(), index, mixed: false}));
const dtmf = {busy: false, status: "", error: ""};
const resources = [call, push, mixer, injection, ...pulls];
const audio = {muted: false, music: false};
let embeddedOrigin;
let endpointError;
let lastCallId;
let pollScheduled = false;

function rtmpAddress(raw) {
    let address;
    try {
        address = new URL(raw);
    } catch {
        throw new Error("Enter an RTMP or RTMPS URL.");
    }
    if (!["rtmp:", "rtmps:"].includes(address.protocol) || !address.hostname || address.hash) {
        throw new Error("Enter an RTMP or RTMPS URL.");
    }
    return address;
}

async function request(path, payload, missingIsEmpty = false) {
    if (endpointError) {
        throw new Error(endpointError);
    }
    const address = embeddedOrigin ?? parseWcsRestAddress(value("restUrl"));
    return requestWcsRest(address, path, payload, {
        authorization: value("restAuthorization"),
        missingIsEmpty
    });
}

function renderText(id, text) {
    const target = element(id);
    if (target.textContent !== text) {
        target.textContent = text;
    }
}

function renderResource(state, statusId, errorId) {
    renderText(statusId, state.status);
    renderText(errorId, state.error || state.pollError);
}

function renderButton(id, state, start, stop, disabled = false) {
    const button = element(id);
    renderText(id, state.data ? stop : start);
    button.disabled = Boolean(endpointError || state.busy || disabled);
    button.formNoValidate = Boolean(state.data);
}

function render() {
    const calling = Boolean(call.data || call.busy);
    const pushing = Boolean(push.data || push.busy);
    const established = call.status === "ESTABLISHED" && !call.busy;
    element("restUrl").readOnly = embedded || resources.some((item) => item.busy || item.data);
    element("sipCredentials").disabled = calling;
    element("callee").readOnly = calling;
    element("rtmpStream").readOnly = pushing;
    element("rtmpUrl").readOnly = pushing;
    element("dtmf").disabled = !established || dtmf.busy;
    element("dtmfBtn").disabled = !established || dtmf.busy;
    element("mute").checked = audio.muted;
    element("music").checked = audio.music;
    element("mute").disabled = push.busy;
    element("music").disabled = push.busy;
    element("playback").hidden = !push.data;
    element("playbackUrl").value = push.data?.playback ?? "";
    element("mixerStream").readOnly = Boolean(mixer.data || mixer.busy);
    element("injectCallId").readOnly = Boolean(injection.data || injection.busy);
    element("injectStream").readOnly = Boolean(injection.data || injection.busy);

    renderButton("callBtn", call, "Call", "Hang up", !call.data && Boolean(push.data || push.busy));
    renderButton("pushBtn", push, "Start", "Stop", !push.data && !established);
    renderButton("mixerBtn", mixer, "Start mixer", "Stop mixer", pulls.some((source) => source.mixing));
    renderButton("injectBtn", injection, "Inject", "Stop injection");
    renderResource(call, "callStatus", "callError");
    renderResource(dtmf, "dtmfStatus", "dtmfError");
    renderResource(push, "pushStatus", "pushError");
    renderResource(mixer, "mixerStatus", "mixerError");
    renderResource(injection, "injectStatus", "injectError");
    for (const source of pulls) {
        const {index} = source;
        element(`pullUrl${index}`).readOnly = Boolean(source.data || source.busy);
        const mix = element(`mixSource${index}`);
        mix.disabled = !(mixer.data && source.data && READY_AGENT.has(source.status))
            || Boolean(mixer.busy || source.busy || source.mixing);
        mix.checked = source.mixed;
        renderButton(`pullBtn${index}`, source, "Pull", "Terminate", source.mixing);
        renderResource(source, `pullStatus${index}`, `pullError${index}`);
    }
}

async function act(state, operation) {
    state.revision = (state.revision ?? 0) + 1;
    state.busy = true;
    state.error = "";
    state.pollError = "";
    render();
    try {
        await operation();
    } catch (error) {
        state.error = error.message;
    } finally {
        state.busy = false;
        render();
        schedulePoll();
    }
}

function submit(id, state, operation) {
    element(id).addEventListener("submit", (event) => {
        event.preventDefault();
        if (!state.busy && !event.submitter?.disabled) {
            act(state, operation);
        }
    });
}

function streamName(id) {
    const name = value(id);
    if (!name) {
        throw new Error("Enter a WCS stream name.");
    }
    return name;
}

function finishCall(status) {
    if (injection.data?.callId === call.data?.id) {
        injection.data = null;
        injection.status = "STOPPED";
    }
    call.data = null;
    call.status = status;
}

async function toggleCall() {
    if (call.data) {
        try {
            await request("/call/terminate", {callId: call.data.id});
        } catch (error) {
            if (error.status !== 404) {
                throw error;
            }
            if (Date.now() < call.data.findDeadline) {
                throw new Error("WCS could not find the starting call (HTTP 404). Retry Hang up once the call appears.");
            }
        }
        finishCall("FINISHED");
        return;
    }
    const id = createStreamName(16);
    const sipLogin = value("sipLogin");
    const sipDomain = value("sipDomain");
    const callee = value("callee");
    const appKey = value("appKey");
    if (!sipLogin || !sipDomain || !callee || !appKey) {
        throw new Error("Enter the SIP login, domain, callee and app key.");
    }
    const toStream = streamName("rtmpStream");
    await request("/call/startup", {
        callId: id,
        toStream,
        callee,
        sipLogin,
        sipAuthenticationName: value("sipAuthenticationName") || sipLogin,
        sipPassword: element("sipPassword").value,
        sipDomain,
        sipOutboundProxy: value("sipOutboundProxy") || sipDomain,
        sipPort: Number(value("sipPort")),
        appKey,
        sipRegisterRequired: checked("sipRegisterRequired"),
        hasAudio: checked("hasAudio"),
        hasVideo: checked("hasVideo")
    });
    if (!value("injectCallId") || value("injectCallId") === lastCallId) {
        element("injectCallId").value = id;
    }
    lastCallId = id;
    call.data = {id, toStream, findDeadline: Date.now() + CALL_STARTUP_GRACE};
    call.status = "PENDING";
    dtmf.status = "";
    dtmf.error = "";
}

async function sendDtmf() {
    const activeCall = call.data;
    await request("/call/send_dtmf", {callId: activeCall.id, dtmf: value("dtmf"), type: "RFC2833"});
    if (activeCall === call.data) {
        dtmf.status = "SENT";
    }
}

function playbackAddress(target, name) {
    const address = rtmpAddress(target);
    if (isLoopbackHost(address.hostname)) {
        address.hostname = (embeddedOrigin ?? parseWcsRestAddress(value("restUrl"))).hostname;
    }
    address.pathname = `${address.pathname.replace(/\/$/, "")}/${encodeURIComponent(name)}`;
    return address.href;
}

function finishPush(status) {
    push.data = null;
    push.status = status;
    audio.muted = false;
    audio.music = false;
}

async function togglePush() {
    if (push.data) {
        await request("/push/terminate", {mediaSessionId: push.data.id}, true);
        finishPush("STOPPED");
        return;
    }
    const target = value("rtmpUrl");
    rtmpAddress(target);
    const options = {};
    if (audio.muted) {
        options.action = "mute";
    } else if (audio.music) {
        options.action = "sound_on";
        options.soundFile = "sample.wav";
    }
    const result = await request("/push/startup", {streamName: call.data.toStream, rtmpUrl: target, options});
    if (!result?.mediaSessionId || !result.streamName) {
        throw new Error("WCS did not return the RTMP session details.");
    }
    const rtmpUrl = result.rtmpUrl || target;
    push.data = {
        id: result.mediaSessionId,
        streamName: result.streamName,
        rtmpUrl,
        playback: playbackAddress(rtmpUrl, result.streamName)
    };
    push.status = "PUBLISHING";
}

function changeAudio(option, enabled) {
    if (!push.data) {
        audio[option] = enabled;
        if (enabled) {
            audio[option === "muted" ? "music" : "muted"] = false;
        }
        render();
        return;
    }
    act(push, async () => {
        const payload = {mediaSessionId: push.data.id};
        let action;
        if (option === "muted") {
            action = enabled ? "mute" : "unmute";
        } else {
            action = enabled ? "sound_on" : "sound_off";
            if (enabled) {
                payload.soundFile = "sample.wav";
                payload.loop = false;
            }
        }
        await request(`/push/${action}`, payload);
        audio[option] = enabled;
    });
}

async function copyPlayback() {
    const field = element("playbackUrl");
    try {
        await navigator.clipboard.writeText(field.value);
        renderText("copyPlaybackBtn", "Copied");
        setTimeout(() => renderText("copyPlaybackBtn", "Copy"), 1500);
    } catch {
        field.focus();
        field.select();
    }
}

function finishPull(source, status) {
    source.data = null;
    source.status = status;
    source.mixed = false;
}

async function togglePull(source) {
    if (source.data) {
        await request("/pull/rtmp/terminate", {uri: source.data.uri}, true);
        finishPull(source, "STOPPED");
        return;
    }
    const uri = value(`pullUrl${source.index}`);
    rtmpAddress(uri);
    if (pulls.some((item) => item !== source && (item.data?.uri === uri
            || (item.busy && value(`pullUrl${item.index}`) === uri)))) {
        throw new Error("This source is already in use.");
    }
    await request("/pull/rtmp/pull", {uri});
    source.data = {uri, localStreamName: uri};
    source.status = "PENDING";
}

function finishMixer(status) {
    mixer.data = null;
    mixer.status = status;
    for (const source of pulls) {
        source.mixed = false;
    }
}

async function toggleMixer() {
    if (mixer.data) {
        await request("/mixer/terminate", mixer.data, true);
        finishMixer("STOPPED");
        return;
    }
    const localStreamName = streamName("mixerStream");
    const data = {uri: `mixer://${localStreamName}`, localStreamName};
    await request("/mixer/startup", data);
    mixer.data = data;
    mixer.status = "PENDING";
}

async function mixSource(source, enabled) {
    source.mixing = true;
    const mixerData = mixer.data;
    const sourceData = source.data;
    try {
        await act(source, async () => {
            await request(enabled ? "/mixer/add" : "/mixer/remove", {
                ...mixerData,
                remoteStreamName: sourceData.localStreamName
            });
            if (source.data === sourceData && mixer.data === mixerData) {
                source.mixed = enabled;
            }
        });
    } finally {
        source.mixing = false;
        render();
    }
}

async function toggleInjection() {
    if (injection.data) {
        await request("/call/inject_stream/terminate", {callId: injection.data.callId}, true);
        injection.data = null;
        injection.status = "STOPPED";
        return;
    }
    const data = {callId: value("injectCallId"), streamName: streamName("injectStream")};
    if (!data.callId) {
        throw new Error("Enter the SIP call ID.");
    }
    const ownCall = data.callId === call.data?.id ? call.data : null;
    await request("/call/inject_stream/startup", data);
    if (ownCall && ownCall !== call.data) {
        injection.status = "STOPPED";
        return;
    }
    injection.data = data;
    injection.status = "INJECTING";
}

async function find(path, payload) {
    const results = await request(path, payload, true);
    if (results !== null && !Array.isArray(results)) {
        throw new Error("WCS returned an invalid status response.");
    }
    return results ?? [];
}

async function poll(state, query, update) {
    const {data, busy, revision} = state;
    if (!data || busy) {
        return;
    }
    try {
        const result = await query(data);
        if (state.data === data && state.revision === revision) {
            state.pollError = "";
            update(result);
        }
    } catch (error) {
        if (state.data === data && state.revision === revision) {
            state.pollError = `Status unavailable. ${error.message}`;
        }
    }
}

function updateCall(results) {
    const current = results.find((item) => item.callId === call.data.id);
    if (!current && Date.now() < call.data.findDeadline) {
        return;
    }
    call.data.findDeadline = 0;
    const status = current?.status || "FINISHED";
    if (FINISHED_CALL.has(status)) {
        finishCall(status === "FINISH" ? "FINISHED" : status);
    } else {
        call.status = status;
    }
}

function updatePush(results) {
    const current = results.find((item) => item.mediaSessionId === push.data.id);
    if (!current) {
        finishPush("STOPPED");
    } else {
        audio.muted = current.muted ?? audio.muted;
        audio.music = current.soundEnabled ?? audio.music;
    }
}

function updatePull(source, results) {
    const current = results.find((item) => item.uri === source.data.uri);
    if (!current || STOPPED_AGENT.has(current.status)) {
        const fallback = READY_AGENT.has(source.status) ? "STOPPED" : "FAILED";
        finishPull(source, current?.status || fallback);
    } else {
        source.status = current.status;
        source.data.localStreamName = current.localStreamName || source.data.uri;
    }
}

function updateMixer(results) {
    const current = results.find((item) => item.localStreamName === mixer.data.localStreamName);
    if (!current || STOPPED_AGENT.has(current.status)) {
        finishMixer(current?.status || "STOPPED");
    } else {
        mixer.status = current.status;
    }
}

function schedulePoll() {
    if (!pollScheduled && [call, push, mixer, ...pulls].some((state) => state.data)) {
        pollScheduled = true;
        setTimeout(pollResources, POLL_INTERVAL);
    }
}

async function pollResources() {
    let pulled;
    await Promise.all([
        poll(call, ({id}) => find("/call/find", {callId: id}), updateCall),
        poll(push, ({streamName, rtmpUrl}) => find("/push/find", {streamName, rtmpUrl}), updatePush),
        poll(mixer, () => find("/mixer/find_all"), updateMixer),
        ...pulls.map((source) => poll(source, () => {
            pulled ??= find("/pull/rtmp/find_all");
            return pulled;
        }, (results) => updatePull(source, results)))
    ]);
    pollScheduled = false;
    render();
    schedulePoll();
}

if (embedded) {
    try {
        embeddedOrigin = parseWcsRestAddress(window.WCS_WEB_URL, true);
    } catch {
        endpointError = "The selected WCS REST API origin is invalid.";
        renderText("endpointError", endpointError);
    }
}
element("restUrl").value = embedded ? (embeddedOrigin ? `${embeddedOrigin.origin}/rest-api` : "") : `${getRestUrl()}/rest-api`;
submit("callForm", call, toggleCall);
submit("dtmfForm", dtmf, sendDtmf);
submit("pushForm", push, togglePush);
submit("mixerForm", mixer, toggleMixer);
submit("injectForm", injection, toggleInjection);
element("mute").addEventListener("change", (event) => changeAudio("muted", event.target.checked));
element("music").addEventListener("change", (event) => changeAudio("music", event.target.checked));
element("copyPlaybackBtn").addEventListener("click", copyPlayback);
for (const source of pulls) {
    submit(`pullForm${source.index}`, source, () => togglePull(source));
    element(`mixSource${source.index}`).addEventListener("change", (event) => mixSource(source, event.target.checked));
}
render();
