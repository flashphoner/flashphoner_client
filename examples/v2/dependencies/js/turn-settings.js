import * as dom from "./dom.js";
import {setError, setInvalid, validateRequired} from "./streaming.js";

const requiredFields = ["urlTurnServer", "usernameTurnServer", "credentialTurnServer"];
const validationError = "Enter the TURN URL, username, and credential.";

export function createTurnSettings(errorId) {
    let locked = false;

    function updateControls() {
        const enabled = dom.checked("useTurn");
        dom.setDisabled("useTurn", locked);
        for (const id of requiredFields) {
            dom.setDisabled(id, locked || !enabled);
            if (!enabled) setInvalid(id, false);
        }
        dom.setDisabled("forceRelay", locked || !enabled);
    }

    dom.byId("useTurn").onchange = () => {
        updateControls();
        if (!dom.checked("useTurn") && dom.byId(errorId).textContent === validationError) {
            setError(errorId, "");
        }
    };
    updateControls();

    return {
        setLocked(value) {
            locked = value;
            updateControls();
        },
        read() {
            if (!dom.checked("useTurn")) return {mediaOptions: undefined, forceRelay: false};
            if (!requiredFields.map(validateRequired).every(Boolean)) {
                setError(errorId, validationError);
                return null;
            }

            const forceRelay = dom.checked("forceRelay");
            const mediaOptions = {
                iceServers: [{
                    url: dom.value("urlTurnServer").trim(),
                    username: dom.value("usernameTurnServer"),
                    credential: dom.value("credentialTurnServer")
                }]
            };
            if (forceRelay) mediaOptions.iceTransportPolicy = "relay";
            return {mediaOptions, forceRelay};
        }
    };
}
