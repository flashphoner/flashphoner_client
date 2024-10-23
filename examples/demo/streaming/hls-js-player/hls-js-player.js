const Browser = Flashphoner.Browser;
const STATS_INTERVAL = 1000;
const QUALITY_COLORS = {
    NONE: "",
    AVAILABLE: "black",
    SELECTED: "blue"
};
const QUALITY_AUTO = "Auto";
let remoteVideo = null;
let hlsPlayer = null;
let playSrc = getUrlParam("src");
let autoplay = eval(getUrlParam("autoplay")) || false;
let llHlsEnabled = eval(getUrlParam("llhls")) || false;
let playbackStats = null;
let qualityLevels = [];

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
    if (playSrc) {
        setValue("fullLink", decodeURIComponent(playSrc));
    } else if (autoplay) {
        console.warn("No HLS URL set, autoplay disabled");
        autoplay = false;
    }
    if (llHlsEnabled) {
        setCheckbox("llHlsEnabled", llHlsEnabled);
    }
    remoteVideo = document.getElementById('remoteVideo');
    if (Hls.isSupported()) {
        console.log("Using HLS.JS " + Hls.version);
        if (autoplay) {
            // There should not be any visible item on the page unless player
            hideAllToAutoplay();
            // The player should use all available page width
            setUpPlayerItem(true);
            // The player should be muted to automatically start playback
            initVideoPlayer(remoteVideo, true);
            playBtnClick();
        } else {
            setText("header", "HLS.JS Player Minimal");
            showItem("llHlsMode");
            displayCommonItems();
            setUpButtons();
            enablePlaybackStats();
            // The player should have a maximum fixed size
            setUpPlayerItem(false);
            // The player can be unmuted because user should click Play button
            initVideoPlayer(remoteVideo, false);
        }
    } else {
        setText("notifyFlash", "Your browser doesn't support MSE technology required to play video");
        disableItem("applyBtn");
        toggleInputs(false);
    }
}


const playBtnClick = function() {
    let videoSrc = getVideoSrc(getValue("fullLink"));
    if (videoSrc) {
        llHlsEnabled = getCheckbox("llHlsEnabled");
        hlsPlayer = new Hls(getHlsConfig(llHlsEnabled));
        hlsPlayer.on(Hls.Events.MANIFEST_PARSED, function() {
            console.log("Play with HLS.js");
            remoteVideo.play();
            initQualityLevels(hlsPlayer);
        });
        remoteVideo.onplaying = () => {
            console.log("playing event fired");
            displayPermalink(videoSrc);
            displayQualitySwitch();
        }
        hlsPlayer.loadSource(videoSrc);
        hlsPlayer.attachMedia(remoteVideo);
        onStarted();            
    }
}


const getHlsConfig = function(llHlsEnabled) {
    // Timings for manifest download
    let manifestLoadPolicy = {
        default: {
            maxTimeToFirstByteMs: Infinity,
            maxLoadTimeMs: 20000,
            timeoutRetry: {
                maxNumRetry: 2,
                retryDelayMs: 0,
                maxRetryDelayMs: 0,
            },
            errorRetry: {
                maxNumRetry: 1,
                retryDelayMs: 1000,
                maxRetryDelayMs: 8000,
            },
        }
    };
    // Timings for playlist download
    let playlistLoadPolicy = {
        default: {
            maxTimeToFirstByteMs: Infinity,
            maxLoadTimeMs: 20000,
            timeoutRetry: {
                maxNumRetry: 2,
                retryDelayMs: 0,
                maxRetryDelayMs: 0,
            },
            errorRetry: {
                maxNumRetry: 2,
                retryDelayMs: 1000,
                maxRetryDelayMs: 8000,
            },
        }
    };
    // Timings for segment download
    let fragLoadPolicy = {
        default: {
            maxTimeToFirstByteMs: Infinity,
            maxLoadTimeMs: 20000,
            timeoutRetry: {
                maxNumRetry: 4,
                retryDelayMs: 0,
                maxRetryDelayMs: 0,
            },
            errorRetry: {
                maxNumRetry: 6,
                retryDelayMs: 1000,
                maxRetryDelayMs: 8000,
            },
        }
    };
    let config = {
        lowLatencyMode: false,
        enableWorker: true,
        manifestLoadPolicy: manifestLoadPolicy,
        playlistLoadPolicy: playlistLoadPolicy,
        fragLoadPolicy: fragLoadPolicy
    };
    console.log("Low Latency HLS: " + llHlsEnabled)
    if(llHlsEnabled) {
        // Here we configure HLS.JS for lower latency
        config = {
            lowLatencyMode: llHlsEnabled,
            enableWorker: true,
            liveSyncDuration: 0.5,
            liveMaxLatencyDuration: 5,
            liveDurationInfinity: true,
            highBufferWatchdogPeriod: 1,
            manifestLoadPolicy: manifestLoadPolicy,
            playlistLoadPolicy: playlistLoadPolicy,
            fragLoadPolicy: fragLoadPolicy
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
    if (!autoplay) {
        toggleInputs(false);
        enableItem("applyBtn");
        hideItem("permalink");
        setText("applyBtn", "Stop");
        setHandler("applyBtn", "click", stopBtnClick, playBtnClick);
        startPlaybackStats();
    }
}


function onStopped() {
    if (!autoplay) {
        toggleInputs(true);
        enableItem("applyBtn");
        setText("applyBtn", "Play");
        setHandler("applyBtn", "click", playBtnClick, stopBtnClick);
        stopPlaybackStats();
        hideItem("quality");
        disposeQualityLevels();
    }
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

const initVideoPlayer = function(video, muted) {
    if (video) {
        video.style.backgroundColor = "black";
        video.muted = muted;
    }
}

const setUpButtons = function() {
    setHandler("applyBtn", "click", playBtnClick);
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

const getVideoSrc = function(src) {
    let videoSrc = src;
    if (validateForm()) {
        let streamName = getValue('playStream');
        streamName = encodeURIComponent(streamName);
        videoSrc = getValue("urlServer") + '/' + streamName + '/' + streamName + '.m3u8';
        let key = getValue('key');
        let token = getValue("token");
        if (key.length > 0 && token.length > 0) {
            videoSrc += "?" + key + "=" + token;
        }
    }
    setValue("fullLink", videoSrc);
    return videoSrc;
}

const displayPermalink = function(src) {
    if (!autoplay) {
        const permalinkId = "permalink";
        let videoSrc = encodeURIComponent(src);
        let linkObject = document.getElementById(permalinkId);
        let href = window.location.href.split("?")[0] + "?llhls=" + llHlsEnabled + "&src=" + videoSrc;
        linkObject.href = href;
        showItem(permalinkId);
    }
}

const displayQualitySwitch = function() {
    if (!autoplay && qualityLevels.length) {
        showItem("quality")
    }
}

const hideAllToAutoplay = function() {
    hideItem("header");
    hideItem("notifyFlash");
    hideItem("fieldset");
    hideItem("stats");
}

const displayCommonItems = function() {
    setValue("urlServer", getHLSUrl());
    hideItem("permalink");
    enableItem("applyBtn");
    setText("applyBtn", "Play");
}

const setUpPlayerItem = function(fillPage) {
    let videoContainer = document.getElementById('videoContainer');
    let playerPage = document.getElementById('playerPage');

    if (fillPage) {
        playerPage.classList.remove("container");
        videoContainer.style.marginTop = "0px";
        videoContainer.style.width = "100vw";
        videoContainer.style.height = "100vh";
        videoContainer.style.maxWidth = "available";
        videoContainer.style.maxHeight = "available";
    } else {
        videoContainer.style.maxWidth = "852px";
        videoContainer.style.maxHeight = "480px";
    }
}

const enablePlaybackStats = function() {
    if (!autoplay && !playbackStats) {
        playbackStats = PlaybackStats(STATS_INTERVAL);
    }
}

const startPlaybackStats = function() {
    if (!autoplay && playbackStats) {
        playbackStats.start();
    }
}

const stopPlaybackStats = function() {
    if (!autoplay && playbackStats) {
        playbackStats.stop();
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

const initQualityLevels = function(player) {
    if (player) {
        let qualityDiv = document.getElementById("qualityBtns");
        let qualityLevel;
        for (let i = 0; i < player.levels.length; i++) {
            qualityLevel = QualityLevel(player, player.levels[i].height, i, qualityDiv);
            qualityLevels.push(qualityLevel);
        }
        if (qualityLevels.length) {
            qualityLevel = QualityLevel(player, QUALITY_AUTO, -1, qualityDiv);
            qualityLevels.push(qualityLevel);
        }
    }
}

const disposeQualityLevels = function() {
    qualityLevels.forEach(level => {
        if (level.button) {
            level.button.remove();
        }
    });
    qualityLevels = [];
}

const qualityBtnClick = function(button, player, index) {
    if (player) {
        player.currentLevel = index;
    }
    button.style.color = QUALITY_COLORS.SELECTED;
    qualityLevels.forEach(item => {
        if (item.button.id !== button.id) {
            item.button.style.color = QUALITY_COLORS.AVAILABLE
        }
    });
}

const QualityLevel = function(object, levelId, index, btnParent) {
    const btnId = "qualityBtn";
    let button = document.createElement("button");
    if (levelId === QUALITY_AUTO && index === -1) {
        button.id = btnId + QUALITY_AUTO;
        button.innerHTML = QUALITY_AUTO
    } else {
        button.id = btnId + index;
        button.innerHTML = levelId;
    }
    button.type = "button";
    button.className = "btn btn-default";
    button.style.color = QUALITY_COLORS.AVAILABLE;
    button.onclick = (event) => {
        qualityBtnClick(button, object, index);
    };
    btnParent.appendChild(button);
    const qualityLevel = {
        level: levelId,
        index: index,
        button: button
    };
    return qualityLevel;
}