import {byId, value} from "./dom.js";
import {setInvalid, setStatus} from "./streaming.js";

export const sipFields = {
    login: "sipLogin",
    authenticationName: "sipAuthenticationName",
    password: "sipPassword",
    domain: "sipDomain",
    outboundProxy: "sipOutboundProxy",
    port: "sipPort"
};

export function validateSipFields() {
    return Object.values(sipFields).map(validateField).every(Boolean);
}

export function validateField(id) {
    const field = byId(id);
    const valid = field.checkValidity() && !!field.value.trim();
    setInvalid(id, !valid);
    return valid;
}

export function getSipOptions(registerRequired) {
    const options = {registerRequired};
    for (const [name, id] of Object.entries(sipFields)) {
        options[name] = name === "password" ? value(id) : value(id).trim();
    }
    return options;
}

export function prepareAudio(api) {
    if (api.Browser.isSafariWebRTC() && api.getMediaProviders()[0] === "WebRTC") {
        const preloader = "../../assets/preloader.mp4";
        return api.playFirstVideo(byId("localDisplay"), true, preloader)
            .then(() => api.playFirstVideo(byId("remoteDisplay"), false, preloader));
    }
}

export function setSipStatus(id, status) {
    setStatus(id, status);
    const field = byId(id);
    field.classList.toggle("text-success", status === "REGISTERED" || status === "ESTABLISHED");
    field.classList.toggle("text-danger", status === "FAILED" || status === "BUSY");
}
