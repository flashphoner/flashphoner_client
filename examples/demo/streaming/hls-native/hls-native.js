const Browser = Flashphoner.Browser;
const STATS_INTERVAL = 1000;
let remoteVideo = null;
let playSrc = getUrlParam("src");
let autoplay = eval(getUrlParam("autoplay")) || false;
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

const initPage = function() {
    if (playSrc) {
        setValue("fullLink", decodeURIComponent(playSrc));
    } else if (autoplay) {
        console.warn("No HLS URL set, autoplay disabled");
        autoplay = false;
    }
    remoteVideo = document.getElementById('remoteVideo');
    if (remoteVideo.canPlayType('application/vnd.apple.mpegurl') && Browser.isSafariWebRTC()) {
        console.log("Using Native HLS player");
        if (autoplay) {
            // There should not be any visible item on the page unless player
            hideAllToAutoplay();
            // The player should use all available page width
            setUpPlayerItem(true);
            // The player should be muted to automatically start playback
            initVideoPlayer(remoteVideo, true);
            playBtnClick();
        } else {
            setText("header", "HLS Native Player Minimal");
            displayCommonItems();
            setUpButtons();
            enablePlaybackStats();
            // The player should have a maximum fixed size
            setUpPlayerItem(false);
            // The player can be unmuted because user should click Play button
            initVideoPlayer(remoteVideo, false);
        }
    } else {
        setText("notifyFlash", "Your browser doesn't support native HLS playback");
        disableItem("applyBtn");
        toggleInputs(false);
    }
}

const playBtnClick = function() {
    let videoSrc = getVideoSrc(getValue("fullLink"));
    if (videoSrc) {
        remoteVideo.onloadedmetadata = () => {
            console.log("Play native HLS");
            remoteVideo.play();
            onStarted();
        };
        remoteVideo.onplaying = () => {
            console.log("playing event fired");
            displayPermalink(videoSrc);
        };
        remoteVideo.src = videoSrc;
    }
}


const stopBtnClick = function() {
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


const onStopped = function() {
    if (!autoplay) {
        toggleInputs(true);
        enableItem("applyBtn");
        setText("applyBtn", "Play");
        setHandler("applyBtn", "click", playBtnClick, stopBtnClick);
        stopPlaybackStats();
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
        if (Browser.isiOS()) {
            // iOS hack when using standard controls to leave fullscreen mode
            setWebkitFullscreenHandlers(video);
        }
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
    } else {
        disableItem("urlServer");
        disableItem("playStream");
        disableItem("key");
        disableItem("token");
        disableItem("player");
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
        let href = window.location.href.split("?")[0] + "?src=" + videoSrc;
        linkObject.href = href;
        showItem(permalinkId);
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