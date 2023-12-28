const Browser = Flashphoner.Browser;
const VIDEOJS_VERSION_TYPE = {
    VIDEOJS7: "videojs7",
    VIDEOJS8: "videojs8"
};
let player = null;
let videojsVersion = getUrlParam("version");

const loadPlayerPage = function() {
    if (videojsVersion) {
        hideItem("videojsInputForm");
        loadVideoJS("videojs" + videojsVersion);
    } else {
        let videojsInput = document.getElementById("videojsInput");
        for (videojsType in VIDEOJS_VERSION_TYPE) {
            let option = document.createElement("option");
            let videojsFolder = "";
            switch (videojsType) {
                case 'VIDEOJS7':
                    videojsFolder = VIDEOJS_VERSION_TYPE.VIDEOJS7;
                    break;
                case 'VIDEOJS8':
                    videojsFolder = VIDEOJS_VERSION_TYPE.VIDEOJS8;
                    break;
            }
            option.text = videojsFolder;
            option.value = videojsFolder;
            videojsInput.appendChild(option);
        }

        setHandler("videojsBtn", "click", onVideojsBtnClick);
    }
}

const onVideojsBtnClick = function () {
    loadVideoJS(getValue("videojsInput"));
}

const loadVideoJS = function (version) {
    if (version) {
        let playerPage = document.getElementById("playerPage");
        loadFile(version + "/video.js", "text/javascript").then( data  => {
            console.log("HLS library loaded successfully", data);
            loadFile(version + "/video-js.css", "stylesheet").then ( data => {
                console.log("HLS library stylesheet loaded successfully", data);
                hideItem("videojsInputForm");
                loadPage("player-page.html", "playerPage", initPage );
            }).catch( err => {
                playerPage.innerHTML = "Can't load VideoJS library stylesheet";
                playerPage.setAttribute("class", "text-danger");
                console.error(err);
            })
        }).catch( err => {
            setText("videojsError", "Can't load VideoJS library");
            console.error(err);
        });
    }
}

const loadFile = function(url, type) {
    return new Promise((resolve, reject) => {
        try {
            let tag = null;
            if (type === "text/javascript") {
                tag = document.createElement("script");
                tag.type = type;
                tag.async = true;
                tag.src = url;
            } else if (type === "stylesheet") {
                tag = document.createElement("link");
                tag.rel = type;
                tag.href = url;
            }

            if (tag) {
                tag.addEventListener("load", (ev) => {
                    resolve({status: true});
                });

                tag.addEventListener("error", (ev) => {
                    reject({
                        status: false,
                        message: `Failed to load the file ${url}`
                    });
                });

                document.head.appendChild(tag);
            } else {
                reject({
                    status: false,
                    message: `Undefined file type ${type}`
                });
            }
        } catch (error) {
            reject(error);
        }
    });
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
    setText("header", "HLS VideoJS Player Minimal");
    setValue("urlServer", getHLSUrl());
    enableItem("applyBtn");
    setText("applyBtn", "Play");
    setHandler("applyBtn", "click", playBtnClick);
    let remoteVideo = document.getElementById('remoteVideo');
    remoteVideo.className = "video-js vjs-default-skin";
    player = initVideoJsPlayer(remoteVideo);
}

const playBtnClick = function() {
    if (validateForm()) {
        let streamName = getValue('playStream');
        streamName = encodeURIComponent(streamName);
        let videoSrc = getValue("urlServer") + '/' + streamName + '/' + streamName + '.m3u8';
        let key = getValue('key');
        let token = getValue("token");
        if (key.length > 0 && token.length > 0) {
            videoSrc += "?" + key + "=" + token;
        }
        player.on('loadedmetadata', function() {
            console.log("Play with VideoJs");
            player.play();
        });
        player.on('error', function() {
            let error = player.error();
            // Stop on error
            stopBtnClick();
            if (error && error.code == error.MEDIA_ERR_DECODE) {
                // Restart playback in case of decode error
                playBtnClick();
            }
        });
        player.src({
            src: videoSrc,
            type: "application/vnd.apple.mpegurl"
        });
        onStarted();
    }
}


const stopBtnClick = function() {
    if (player != null) {
        console.log("Stop VideoJS player");
        //player.pause();
        player.dispose();
    }
    onStopped();
}


const onStarted = function() {
    disableItem("urlServer");
    disableItem("playStream");
    disableItem("key");
    disableItem("token");
    disableItem("player");
    enableItem("applyBtn");
    setText("applyBtn", "Stop");
    setHandler("applyBtn", "click", stopBtnClick, playBtnClick);
}


const onStopped = function() {
    enableItem("urlServer");
    enableItem("playStream");
    enableItem("key");
    enableItem("token");
    enableItem("player");
    enableItem("applyBtn");
    setText("applyBtn", "Play");
    setHandler("applyBtn", "click", playBtnClick, stopBtnClick);
    if(!document.getElementById('remoteVideo')) {
        createRemoteVideo(document.getElementById('videoContainer'));
    }
}


const createRemoteVideo = function(parent) {
    remoteVideo = document.createElement("video");
    remoteVideo.id = "remoteVideo";
    remoteVideo.width=852;
    remoteVideo.height=480;
    remoteVideo.controls="controls";
    remoteVideo.autoplay="autoplay";
    remoteVideo.type="application/vnd.apple.mpegurl";
    remoteVideo.className = "video-js vjs-default-skin";
    remoteVideo.setAttribute("playsinline","");
    remoteVideo.setAttribute("webkit-playsinline","");
    parent.appendChild(remoteVideo);
    player = initVideoJsPlayer(remoteVideo);
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

const initVideoJsPlayer = function(video) {
    let videoJsPlayer = videojs(video);
    console.log("Using VideoJs " + videojs.VERSION);
    if (Browser.isSafariWebRTC() && Browser.isiOS()) {
        // iOS hack when using standard controls to leave fullscreen mode
        let videoTag = getActualVideoTag();
        if(videoTag) {
            setWebkitFullscreenHandlers(videoTag);
        }
    }
    return videoJsPlayer;
}

const getActualVideoTag = function() {
    let videos = document.querySelectorAll("video");
    if (videos && videos.length > 0) {
        return videos[0];
    }
    return null;
}
