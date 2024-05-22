const Browser = Flashphoner.Browser;
const STATS_INTERVAL = 1000;
let remoteVideo = null;
let hlsPlayer = null;
let playbackStats = null;

const loadPlayerPage = function() {
    loadPage("../hls-player/player-page.html", "playerPage", initPage );
}

const loadPage = function(page, containerId, onLoad) {
    fetch(page).then(function (response) {
        if (response.ok) {
            return response.text();
        }
        throw response;
    }).then(function (text) {
        let container = document.getElementById(containerId);
        container.innerHTML = text;
        onLoad();
    });
}

const initPage =  function() {
    setText("header", "HLS.JS Player Minimal");
    setValue("urlServer", getHLSUrl());
    setText("applyBtn", "Play");
    setHandler("applyBtn", "click", playBtnClick);
    remoteVideo = document.getElementById('remoteVideo');
    remoteVideo.style ="background-color: lightgrey;";
    if (Hls.isSupported()) {
        console.log("Using HLS.JS " + Hls.version);
        enableItem("applyBtn");
        showItem("llHlsMode");
        playbackStats = PlaybackStats(STATS_INTERVAL);
    } else {
        setText("notifyFlash", "Your browser doesn't support MSE technology required to play video");
        disableItem("applyBtn");
        toggleInputs(false);
    }
}


const playBtnClick = function() {
    if (validateForm()) {
        let llHlsEnabled = getCheckbox("llHlsEnabled");
        let streamName = getValue("playStream");
        streamName = encodeURIComponent(streamName);
        let videoSrc = getValue("urlServer") + '/' + streamName + '/' + streamName + '.m3u8';
        let key = getValue('key');
        let token = getValue("token");
        if (key.length > 0 && token.length > 0) {
            videoSrc += "?" + key + "=" + token;
        }
        hlsPlayer = new Hls(getHlsConfig(llHlsEnabled));
        hlsPlayer.on(Hls.Events.MANIFEST_PARSED, function() {
            console.log("Play with HLS.js");
            remoteVideo.play();
        });
        hlsPlayer.loadSource(videoSrc);
        hlsPlayer.attachMedia(remoteVideo);
        onStarted();            
    }
}


const getHlsConfig = function(llHlsEnabled) {
    let config = {
        lowLatencyMode: false,
        enableWorker: true,
        backBufferLength: 90,
        manifestLoadingTimeOut: 15000
    };
    console.log("Low Latency HLS: "+llHlsEnabled)
    if(llHlsEnabled) {
        // Here we configure HLS.JS for lower latency
        config = {
           lowLatencyMode: llHlsEnabled,
           enableWorker: true,
           backBufferLength: 90,
           liveBackBufferLength: 0,
           liveSyncDuration: 0.5,
           liveMaxLatencyDuration: 5,
           liveDurationInfinity: true,
           highBufferWatchdogPeriod: 1,
           manifestLoadingTimeOut: 15000
        };
    }
    return config;
}


const stopBtnClick = function() {
    if (hlsPlayer != null) {
        console.log("Stop HLS segments loading");
        hlsPlayer.stopLoad();
        hlsPlayer = null;
    }
    if (remoteVideo != null) {
        console.log("Stop HTML5 player");
        remoteVideo.pause();
        remoteVideo.currentTime = 0;
        remoteVideo.removeAttribute('src');
        remoteVideo.load();
    }
    onStopped();
}


const onStarted = function() {
    toggleInputs(false);
    enableItem("applyBtn");
    setText("applyBtn", "Stop");
    setHandler("applyBtn", "click", stopBtnClick, playBtnClick);
    playbackStats.start();
}


function onStopped() {
    toggleInputs(true);
    enableItem("applyBtn");
    setText("applyBtn", "Play");
    setHandler("applyBtn", "click", playBtnClick, stopBtnClick);
    playbackStats.stop();
}


const validateForm = function() {
    let valid = validateInput("urlServer");
    if (valid) {
        valid = validateInput("playStream");
    }
    return valid;
}

const validateInput = function(id) {
    let value = getValue(id);
    let valid = true;
    if (!value || !value.length) {
        highlightInput(id);
        valid = false;
    } else {
        removeHighlight(id);
    }
    return valid;
}

const highlightInput = function(input) {
    let item = document.getElementById(input);
    if (item) {
        let parent = closest(input,'.form-group');
        if (parent) {
            parent.classList.add("has-error");
        }
    }
}


const removeHighlight = function(input) {
    let item = document.getElementById(input);
    if (item) {
        let parent = closest(input,'.form-group');
        if (parent) {
            parent.classList.remove("has-error");
        }
    }
}

const toggleInputs = function(enable) {
    if (enable) {
        enableItem("urlServer");
        enableItem("playStream");
        enableItem("key");
        enableItem("token");
        enableItem("player");
        enableItem("llHlsEnabled");
    } else {
        disableItem("urlServer");
        disableItem("playStream");
        disableItem("key");
        disableItem("token");
        disableItem("player");
        disableItem("llHlsEnabled");
    }
}

const PlaybackStats = function(interval) {
    const playbackStats = {
        interval: interval || STATS_INTERVAL,
        timer: null,
        stats: null,
        start: function() {
            let video = remoteVideo;

            playbackStats.stop();
            stats = HTML5Stats(video);
            playbackStats.timer = setInterval(playbackStats.displayStats, playbackStats.interval);
            setText("videoWidth", "N/A");
            setText("videoHeight", "N/A");
            setText("videoRate", "N/A");
            setText("videoFps", "N/A");
            showItem("stats");
        },
        stop: function() {
            if (playbackStats.timer) {
                clearInterval(playbackStats.timer);
                playbackStats.timer = null;
            }
            playbackStats.stats = null;
            hideItem("stats");
        },
        displayStats: function() {
            if (stats.collect()) {
                let width = stats.getWidth();
                let height = stats.getHeight();
                let bitrate = stats.getBitrate();
                let fps = stats.getFps();

                setText("videoWidth", width);
                setText("videoHeight", height);

                if (bitrate !== undefined) {
                    setText("videoRate", Math.round(bitrate));
                }
                if (fps !== undefined) {
                    setText("videoFps", fps.toFixed(1));
                }
            }
        }
    };
    return playbackStats;
}