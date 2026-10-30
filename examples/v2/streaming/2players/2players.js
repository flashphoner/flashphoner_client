import * as dom from "../../dependencies/js/dom.js";
import {getWebsocketUrl} from "../../dependencies/js/server-url.js";
import {initializeSDK, setStatus, setError, validateRequired, bindResize} from "../../dependencies/js/streaming.js";

const api = window.Flashphoner;
const {SESSION_STATUS = {}, STREAM_STATUS = {}} = api?.constants ?? {};
const players = [{}, {}];
let session;
let disconnecting = false;

initializeSDK(() => {
    players.forEach((_, index) => bindResize(dom.byId(`player${index + 1}`)));
    dom.setValue("url", getWebsocketUrl());
    setStatus("connectStatus", SESSION_STATUS.DISCONNECTED);
    onDisconnected();
}, {
    receiverLocation: "../../dependencies/websocket-player/WSReceiver2.js",
    decoderLocation: "../../dependencies/websocket-player/video-worker2.js"
});

function connect() {
    if (!validateRequired("url")) return;
    setError("connectError", "");
    dom.setDisabled("url", true);
    dom.setDisabled("connectBtn", true);
    setStatus("connectStatus", "CONNECTING");
    try {
        const created = api.createSession({urlServer: dom.value("url")});
        let established = false;
        session = created;
        if (SESSION_STATUS.CONNECTED) {
            created.on(SESSION_STATUS.CONNECTED, () => {
                if (session === created) setStatus("connectStatus", SESSION_STATUS.CONNECTED);
            });
        }
        created.on(SESSION_STATUS.ESTABLISHED, (connected) => {
            if (session !== created) return;
            established = true;
            setStatus("connectStatus", connected.status());
            dom.setButton("connectBtn", "Disconnect", disconnect);
            players.forEach((player, index) => onStopped(index));
        }).on(SESSION_STATUS.DISCONNECTED, () => {
            if (session !== created) return;
            if (!disconnecting) setError("connectError", established ? "Connection to server lost." : "Connection closed before it was established.");
            setStatus("connectStatus", SESSION_STATUS.DISCONNECTED);
            onDisconnected();
        }).on(SESSION_STATUS.FAILED, (failed) => {
            if (session !== created) return;
            setStatus("connectStatus", SESSION_STATUS.FAILED);
            if (!disconnecting) setError("connectError", failed?.getInfo?.() || "Connection failed.");
            onDisconnected();
        });
    } catch (error) {
        setStatus("connectStatus", SESSION_STATUS.FAILED);
        setError("connectError", error.message || "Unable to connect.");
        onDisconnected();
    }
}

function disconnect() {
    disconnecting = true;
    dom.setDisabled("connectBtn", true);
    players.forEach((player, index) => {
        dom.setDisabled(`playBtn${index + 1}`, true);
        dom.setDisabled(`streamName${index + 1}`, true);
    });
    try {
        session.disconnect();
    } catch (error) {
        disconnecting = false;
        setError("connectError", error.message || "Unable to disconnect.");
        dom.setDisabled("connectBtn", false);
        players.forEach((player, index) => {
            dom.setDisabled(`playBtn${index + 1}`, Boolean(player.stream && player.stream.status() !== STREAM_STATUS.PLAYING));
            dom.setDisabled(`streamName${index + 1}`, Boolean(player.stream));
        });
    }
}

function onDisconnected() {
    session = undefined;
    disconnecting = false;
    dom.setButton("connectBtn", "Connect", connect);
    dom.setDisabled("url", false);
    players.forEach((player, index) => {
        if (player.stream) setStatus(`status${index + 1}`, STREAM_STATUS.STOPPED);
        onStopped(index);
    });
}

function onStopped(index) {
    const player = players[index];
    player.stream = undefined;
    const disabled = disconnecting || !session || session.status() !== SESSION_STATUS.ESTABLISHED;
    dom.setButton(`playBtn${index + 1}`, "Play", () => playStream(index), disabled);
    dom.setDisabled(`streamName${index + 1}`, disabled);
}

function playStream(index) {
    if (!session || disconnecting || session.status() !== SESSION_STATUS.ESTABLISHED) return;
    const number = index + 1;
    if (!validateRequired(`streamName${number}`)) return;
    const player = players[index];
    const connected = session;
    setError(`error${number}`, "");
    dom.setDisabled(`streamName${number}`, true);
    dom.setDisabled(`playBtn${number}`, true);
    try {
        if (api.getMediaProviders()[0] === "WSPlayer") api.playFirstSound();
        const display = dom.byId(`player${number}`);
        const created = connected.createStream({name: dom.value(`streamName${number}`), display});
        player.stream = created;
        const isCurrent = () => session === connected && player.stream === created;
        created.on(STREAM_STATUS.PLAYING, (playing) => {
            if (!isCurrent()) return;
            setStatus(`status${number}`, playing.status());
            dom.setButton(`playBtn${number}`, "Stop", () => stopStream(index), disconnecting);
        }).on(STREAM_STATUS.STOPPED, () => {
            if (!isCurrent()) return;
            setStatus(`status${number}`, STREAM_STATUS.STOPPED);
            onStopped(index);
        }).on(STREAM_STATUS.FAILED, (failed) => {
            if (!isCurrent()) return;
            if ([SESSION_STATUS.DISCONNECTED, SESSION_STATUS.FAILED].includes(connected.status())) return;
            setStatus(`status${number}`, STREAM_STATUS.FAILED);
            setError(`error${number}`, failed?.getInfo?.() || "Playback failed.");
            onStopped(index);
        }).play();
    } catch (error) {
        setStatus(`status${number}`, STREAM_STATUS.FAILED);
        setError(`error${number}`, error.message || "Unable to start playback.");
        onStopped(index);
    }
}

function stopStream(index) {
    const player = players[index];
    dom.setDisabled(`playBtn${index + 1}`, true);
    try {
        player.stream.stop();
    } catch (error) {
        setError(`error${index + 1}`, error.message || "Unable to stop playback.");
        dom.setDisabled(`playBtn${index + 1}`, false);
    }
}
