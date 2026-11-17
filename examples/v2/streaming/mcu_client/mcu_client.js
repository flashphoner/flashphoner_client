import * as dom from "../../dependencies/js/dom.js";
import {getWebsocketUrl} from "../../dependencies/js/server-url.js";
import {initializeSDK, setStatus, setError, setInvalid, validateRequired, bindResize} from "../../dependencies/js/streaming.js";

initializeSDK((api) => {
    const {SESSION_STATUS, STREAM_STATUS} = api.constants;
    let session;
    let publisher;
    let conference;
    let run = 0;
    let active = false;
    let playing = false;

    dom.setValue("url", getWebsocketUrl());
    bindResize(dom.byId("localVideo"));
    bindResize(dom.byId("remoteVideo"));
    setStatus("status", SESSION_STATUS.DISCONNECTED);
    dom.byId("joinBtn").onclick = () => active ? finish(STREAM_STATUS.STOPPED) : join();
    dom.byId("volume").oninput = () => {
        if (!playing) return;
        try {
            conference.setVolume(Number(dom.value("volume")));
            setError("playbackError", "");
        } catch (error) { setError("playbackError", error.message); }
    };
    dom.byId("fullScreenBtn").onclick = async () => {
        if (!playing) return;
        try {
            await conference.fullScreen();
            setError("playbackError", "");
        } catch (error) { setError("playbackError", error.message); }
    };
    updateControls();

    function updateControls() {
        for (const id of ["url", "login", "room", "hasAudio"]) dom.setDisabled(id, active);
        dom.setDisabled("joinBtn", false);
        dom.setText("joinBtn", active ? "Leave" : "Join");
        dom.setDisabled("volume", !playing);
        dom.setDisabled("fullScreenBtn", !playing);
        dom.setVisible("preloader", active && !playing);
    }

    function join() {
        const valid = ["url", "login", "room"].map(validateRequired).every(Boolean);
        if (!valid) return;
        let server;
        try {
            const url = new URL(dom.value("url").trim());
            if (!["ws:", "wss:"].includes(url.protocol) || url.pathname !== "/" || url.search || url.hash || url.username || url.password) throw new Error();
            server = url.origin;
        } catch {
            setInvalid("url", true);
            setError("info", "Enter a WebSocket server URL such as wss://server:8443.");
            return;
        }
        const attempt = ++run;
        const login = dom.value("login").trim();
        const room = dom.value("room").trim();
        const constraints = {audio: dom.checked("hasAudio"), video: true};
        active = true;
        setError("info", "");
        setError("playbackError", "");
        setStatus("status", "CONNECTING");
        updateControls();
        try {
            session = api.createSession({urlServer: server})
                .on(SESSION_STATUS.ESTABLISHED, (connected) => {
                    if (attempt !== run) return;
                    session = connected;
                    publish(login, room, constraints, attempt);
                }).on(SESSION_STATUS.DISCONNECTED, () => {
                    if (attempt === run) finish(SESSION_STATUS.DISCONNECTED);
                }).on(SESSION_STATUS.FAILED, () => {
                    if (attempt === run) finish(SESSION_STATUS.FAILED, "Unable to connect to the server.");
                });
        } catch (error) { finish(SESSION_STATUS.FAILED, error.message); }
    }

    function publish(login, room, constraints, attempt) {
        try {
            publisher = session.createStream({
                name: `${login}#${room}`, display: dom.byId("localVideo"),
                receiveVideo: false, receiveAudio: false, constraints
            }).on(STREAM_STATUS.PUBLISHING, () => {
                if (attempt !== run) return;
                setStatus("status", STREAM_STATUS.PUBLISHING);
                playConference(login, room, constraints, attempt);
            }).on(STREAM_STATUS.UNPUBLISHED, () => {
                if (attempt === run) finish(STREAM_STATUS.STOPPED);
            }).on(STREAM_STATUS.FAILED, (stream) => {
                if (attempt === run && !sessionTerminated()) {
                    finish(STREAM_STATUS.FAILED, stream.getInfo() || "Unable to publish. This login may already be in use; try another login.");
                }
            });
            publisher.publish();
        } catch (error) { finish(STREAM_STATUS.FAILED, error.message); }
    }

    function playConference(login, room, constraints, attempt) {
        try {
            conference = session.createStream({
                name: `${room}-${login}${room}`, display: dom.byId("remoteVideo"), constraints
            }).on(STREAM_STATUS.PLAYING, () => {
                if (attempt !== run) return;
                playing = true;
                setStatus("status", STREAM_STATUS.PLAYING);
                try { conference.setVolume(Number(dom.value("volume"))); }
                catch (error) { setError("playbackError", error.message); }
                updateControls();
            }).on(STREAM_STATUS.STOPPED, () => {
                if (attempt === run) finish(STREAM_STATUS.STOPPED);
            }).on(STREAM_STATUS.FAILED, (stream) => {
                if (attempt === run && !sessionTerminated()) finish(STREAM_STATUS.FAILED, stream.getInfo());
            });
            conference.play();
        } catch (error) { finish(STREAM_STATUS.FAILED, error.message); }
    }

    function sessionTerminated() {
        return [SESSION_STATUS.DISCONNECTED, SESSION_STATUS.FAILED].includes(session?.status());
    }

    function finish(status, error = "") {
        ++run;
        const streams = [conference, publisher];
        const connection = session;
        conference = publisher = session = undefined;
        active = playing = false;
        for (const stream of streams) {
            if (!stream || [STREAM_STATUS.STOPPED, STREAM_STATUS.UNPUBLISHED, STREAM_STATUS.FAILED].includes(stream.status())) continue;
            try { stream.stop(); } catch (failure) { error ||= failure.message; }
        }
        if (connection && ![SESSION_STATUS.DISCONNECTED, SESSION_STATUS.FAILED].includes(connection.status())) {
            try { connection.disconnect(); } catch (failure) { error ||= failure.message; }
        }
        setStatus("status", status);
        setError("info", error);
        updateControls();
    }
});
