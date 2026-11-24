import {byId, setDisabled, setText, setValue, value} from "../../dependencies/js/dom.js";
import {getWebsocketUrl} from "../../dependencies/js/server-url.js";
import {getSipOptions, prepareAudio, setSipStatus, validateField, validateSipFields} from "../../dependencies/js/sip-call.js";
import {initializeSDK, setError} from "../../dependencies/js/streaming.js";

initializeSDK(api => {
    const {CALL_STATUS, SESSION_STATUS} = api.constants;
    const credentials = byId("sipFields");
    const credentialsButton = byId("sipCredentialsBtn");
    const callButton = byId("callBtn");
    let active;

    function toggleCredentials(show) {
        credentials.hidden = !show;
        credentialsButton.setAttribute("aria-expanded", String(show));
    }

    function render() {
        setDisabled("urlServer", !!active);
        setDisabled("callee", !!active);
        credentials.disabled = !!active;
        credentialsButton.disabled = !!active;
        callButton.disabled = !!active && (!active.call || active.closing);
        callButton.classList.toggle("button-primary", !active);
        setText("callBtn", active?.call ? "Hang up" : "Call");
    }

    function disconnect(attempt) {
        if (active !== attempt) return;
        active = undefined;
        render();
        if (attempt.session) {
            try {
                attempt.session.disconnect();
                setSipStatus("regStatus", "DISCONNECTED");
            } catch {
                setSipStatus("regStatus", "FAILED");
                setError("callError", "Unable to disconnect.");
            }
        }
    }

    function placeCall(attempt, session) {
        if (active !== attempt || attempt.call) return;
        setSipStatus("regStatus", "ESTABLISHED");
        try {
            const call = session.createCall({
                callee: value("callee").trim(),
                visibleName: "Click To Call",
                localVideoDisplay: byId("localDisplay"),
                remoteVideoDisplay: byId("remoteDisplay"),
                constraints: {audio: true, video: false},
                receiveAudio: true,
                receiveVideo: false,
                stripCodecs: "SILK"
            });
            attempt.call = call;
            const progress = status => {
                if (active === attempt) setSipStatus("callStatus", status);
            };
            const finish = status => {
                if (active !== attempt) return;
                setSipStatus("callStatus", status);
                disconnect(attempt);
            };
            call.on(CALL_STATUS.TRYING, () => progress("TRYING"))
                .on(CALL_STATUS.RING, () => progress("RING"))
                .on(CALL_STATUS.SESSION_PROGRESS, () => progress("SESSION_PROGRESS"))
                .on(CALL_STATUS.ESTABLISHED, () => progress("ESTABLISHED"))
                .on(CALL_STATUS.FINISH, () => finish("FINISH"))
                .on(CALL_STATUS.FAILED, () => finish("FAILED"))
                .on(CALL_STATUS.BUSY, () => finish("BUSY"));
            setSipStatus("callStatus", "CALLING");
            render();
            call.call();
        } catch {
            setSipStatus("callStatus", "FAILED");
            setError("callError", "Unable to start the call.");
            disconnect(attempt);
        }
    }

    async function start() {
        const validUrl = validateField("urlServer");
        const validCallee = validateField("callee");
        const validCredentials = validateSipFields();
        if (!validCredentials) toggleCredentials(true);
        if (!validUrl || !validCallee || !validCredentials) return;
        const options = {
            urlServer: value("urlServer").trim(),
            sipOptions: getSipOptions(true)
        };
        const attempt = {};
        active = attempt;
        setError("callError", "");
        setSipStatus("regStatus", "CONNECTING");
        setSipStatus("callStatus", "");
        render();
        try {
            const preparing = prepareAudio(api);
            if (preparing) await preparing;
            const session = api.createSession(options);
            attempt.session = session;
            const ended = status => {
                if (active !== attempt) return;
                setSipStatus("regStatus", status);
                if (attempt.call) setSipStatus("callStatus", "FINISH");
                active = undefined;
                render();
            };
            session.on(SESSION_STATUS.ESTABLISHED, connected => placeCall(attempt, connected))
                .on(SESSION_STATUS.FAILED, () => ended("FAILED"))
                .on(SESSION_STATUS.DISCONNECTED, () => ended("DISCONNECTED"))
                .on(SESSION_STATUS.INCOMING_CALL, call => call.hangup());
        } catch {
            setSipStatus("regStatus", "FAILED");
            setError("callError", "Unable to connect to WCS.");
            disconnect(attempt);
        }
    }

    setValue("urlServer", getWebsocketUrl());
    render();
    credentialsButton.onclick = () => toggleCredentials(credentials.hidden);
    callButton.onclick = () => {
        if (!active) {
            start();
        } else if (active.call && !active.closing) {
            active.closing = true;
            render();
            try {
                active.call.hangup();
            } catch {
                active.closing = false;
                render();
                setError("callError", "Unable to hang up the call.");
            }
        }
    };
});
