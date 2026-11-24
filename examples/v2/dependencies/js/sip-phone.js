import {byId, checked, setChecked, setDisabled, setText, setValue, setVisible, value} from "./dom.js";
import {getWebsocketUrl} from "./server-url.js";
import {setError} from "./streaming.js";
import {getSipOptions, prepareAudio, setSipStatus, validateField, validateSipFields} from "./sip-call.js";

export function setupPhone(api, media) {
    const {CALL_STATUS, SESSION_STATUS} = api.constants;
    const tokenButton = document.getElementById("connectTokenBtn");
    const connectionButton = byId("connectBtn");
    const localDisplay = byId("localDisplay");
    const remoteDisplay = byId("remoteDisplay");
    let connection;
    let activeCall;

    setValue("urlServer", getWebsocketUrl());
    setDisabled("connectBtn", false);
    if (tokenButton) setDisabled("connectTokenBtn", false);

    function renderConnection() {
        const connected = connection?.session && !connection.closing;
        const label = connected ? "Disconnect" : "Connect";
        connectionButton.textContent = label;
        connectionButton.disabled = !!connection && !connected;
        byId("sipFields").disabled = !!connection;
        setDisabled("urlServer", !!connection);
        if (tokenButton) {
            tokenButton.textContent = connected ? label : "Connect with token";
            tokenButton.disabled = connectionButton.disabled;
            setDisabled("authToken", !!connection);
        }
        renderCall();
    }

    function renderCall() {
        const incoming = !!activeCall?.incoming;
        const ringing = incoming && !activeCall.answered && !activeCall.closing;
        const usable = activeCall?.established && !activeCall.closing && !connection?.closing;
        const canDial = !activeCall && connection?.ready && !connection.closing;
        setVisible("callBtn", !incoming);
        setText("callBtn", activeCall ? "Hang up" : "Call");
        byId("callBtn").classList.toggle("button-primary", !activeCall);
        setDisabled("callBtn", activeCall ? activeCall.closing || !!connection?.closing : !canDial);
        setDisabled("callee", !canDial);
        setVisible("incomingCallAlert", ringing);
        setVisible("answerBtn", ringing);
        setDisabled("answerBtn", !ringing || !!connection?.closing);
        setVisible("hangupBtn", incoming);
        setDisabled("hangupBtn", !incoming || activeCall.closing || !!connection?.closing);
        setText("holdBtn", activeCall?.held ? "Unhold" : "Hold");
        setDisabled("holdBtn", !usable || activeCall.holdPending);
        setDisabled("muteAudioToggle", !usable);
        media?.render(usable ? activeCall.call : null);
    }

    function clearCall() {
        activeCall = undefined;
        setChecked("muteAudioToggle", false);
        media?.reset();
        renderCall();
    }

    function finishConnection(attempt, status, error) {
        if (connection !== attempt) return;
        connection = undefined;
        clearCall();
        setSipStatus("callStatus", "");
        setError("callError", "");
        setSipStatus("regStatus", status);
        setError("connectionError", error);
        renderConnection();
    }

    async function connect(withToken = false) {
        if (connection) {
            if (!connection.session || connection.closing) return;
            const attempt = connection;
            attempt.closing = true;
            renderConnection();
            try {
                activeCall?.call.hangup();
            } catch {
                // Disconnect still releases the call if it has already ended.
            }
            try {
                attempt.session.disconnect();
            } catch {
                finishConnection(attempt, "FAILED", "Unable to disconnect.");
            }
            return;
        }
        const urlValid = validateField("urlServer");
        const credentialsValid = withToken ? validateField("authToken") : validateSipFields();
        if (!urlValid || !credentialsValid) return;

        const options = {urlServer: value("urlServer").trim()};
        const registerRequired = checked("sipRegisterRequired");
        if (tokenButton) options.keepAlive = true;
        if (withToken) options.authToken = value("authToken").trim();
        else options.sipOptions = getSipOptions(registerRequired);

        const attempt = {ready: false};
        connection = attempt;
        renderConnection();
        setError("connectionError", "");
        setSipStatus("regStatus", "CONNECTING");
        try {
            const preparing = prepareAudio(api);
            if (preparing) await preparing;
            const session = api.createSession(options);
            session.on(SESSION_STATUS.ESTABLISHED, (establishedSession, details) => {
                if (connection !== attempt || attempt.closing) return;
                attempt.session = establishedSession;
                attempt.ready = !registerRequired;
                if (tokenButton && details?.authToken) setValue("authToken", details.authToken);
                setSipStatus("regStatus", "ESTABLISHED");
                renderConnection();
            }).on(SESSION_STATUS.REGISTERED, registeredSession => {
                if (connection !== attempt || attempt.closing) return;
                attempt.session = registeredSession;
                attempt.ready = true;
                setSipStatus("regStatus", "REGISTERED");
                renderConnection();
            }).on(SESSION_STATUS.UNREGISTERED, () => {
                if (connection !== attempt || attempt.closing) return;
                attempt.ready = !registerRequired;
                setSipStatus("regStatus", "UNREGISTERED");
                renderConnection();
            }).on(SESSION_STATUS.FAILED, () => finishConnection(attempt, "FAILED"))
                .on(SESSION_STATUS.DISCONNECTED, () => finishConnection(attempt, "DISCONNECTED"))
                .on(SESSION_STATUS.INCOMING_CALL, call => {
                    if (connection !== attempt) return;
                    if (attempt.closing || activeCall) {
                        call.hangup();
                        return;
                    }
                    bindCall(call, true);
                    setText("incomingCallAlert", `Incoming call from ${call.visibleName() || call.caller()}`);
                    setSipStatus("callStatus", "RING");
                    renderCall();
                });
        } catch {
            finishConnection(attempt, "FAILED", "Unable to connect to WCS.");
        }
    }

    function callOptions() {
        return {
            localVideoDisplay: localDisplay,
            remoteVideoDisplay: remoteDisplay,
            receiveAudio: true,
            receiveVideo: !!media,
            constraints: {audio: true, video: false},
            stripCodecs: "SILK",
            ...media?.options()
        };
    }

    function bindCall(call, incoming) {
        const state = {call, incoming};
        activeCall = state;
        setError("callError", "");
        const update = (status, held) => {
            if (activeCall !== state) return;
            state.established = held !== undefined || state.established;
            if (held !== undefined) {
                state.held = held;
                state.holdPending = false;
            }
            setSipStatus("callStatus", status);
            renderCall();
        };
        const finish = status => {
            if (activeCall !== state) return;
            setSipStatus("callStatus", status);
            clearCall();
        };
        call.on(CALL_STATUS.TRYING, () => update("TRYING"))
            .on(CALL_STATUS.RING, () => update("RING"))
            .on(CALL_STATUS.SESSION_PROGRESS, () => update("SESSION_PROGRESS"))
            .on(CALL_STATUS.ESTABLISHED, () => update("ESTABLISHED", false))
            .on(CALL_STATUS.HOLD, () => update("HOLD", true))
            .on(CALL_STATUS.FINISH, () => finish("FINISH"))
            .on(CALL_STATUS.FAILED, () => finish("FAILED"))
            .on(CALL_STATUS.BUSY, () => finish("BUSY"));
    }

    function dial() {
        if (activeCall) {
            hangup();
            return;
        }
        if (!connection?.ready || connection.closing || !validateField("callee") || media?.validate() === false) return;
        setError("callError", "");
        try {
            const call = connection.session.createCall({
                callee: value("callee").trim(),
                visibleName: value("sipLogin").trim(),
                ...callOptions()
            });
            bindCall(call, false);
            media?.setOutput(call);
            setSipStatus("callStatus", "CALLING");
            renderCall();
            call.call();
        } catch {
            clearCall();
            setSipStatus("callStatus", "FAILED");
            setError("callError", "Unable to start the call.");
        }
    }

    function answer() {
        const state = activeCall;
        if (!state?.incoming || state.answered || state.closing || media?.validate() === false) return;
        state.answered = true;
        setSipStatus("callStatus", "ANSWERING");
        renderCall();
        try {
            media?.setOutput(state.call);
            state.call.answer(callOptions());
        } catch {
            state.answered = false;
            setSipStatus("callStatus", "RING");
            setError("callError", "Unable to answer the call.");
            renderCall();
        }
    }

    function hangup() {
        const state = activeCall;
        if (!state || state.closing) return;
        state.closing = true;
        renderCall();
        try {
            state.call.hangup();
        } catch {
            state.closing = false;
            renderCall();
            setError("callError", "Unable to hang up the call.");
        }
    }

    function toggleHold() {
        const state = activeCall;
        if (!state?.established || state.closing || state.holdPending) return;
        state.holdPending = true;
        renderCall();
        try {
            if (state.held) state.call.unhold();
            else state.call.hold();
        } catch {
            state.holdPending = false;
            renderCall();
            setError("callError", "Unable to change hold state.");
        }
    }

    connectionButton.onclick = () => connect();
    if (tokenButton) tokenButton.onclick = () => connect(true);
    byId("callBtn").onclick = dial;
    byId("answerBtn").onclick = answer;
    byId("hangupBtn").onclick = hangup;
    byId("holdBtn").onclick = toggleHold;
    byId("muteAudioToggle").onchange = () => {
        if (!activeCall?.established || activeCall.closing) return;
        if (checked("muteAudioToggle")) activeCall.call.muteAudio();
        else activeCall.call.unmuteAudio();
    };
}
