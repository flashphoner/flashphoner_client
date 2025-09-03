const SESSION_STATUS = Flashphoner.constants.SESSION_STATUS;
const STREAM_STATUS = Flashphoner.constants.STREAM_STATUS;
let currentSession;
let localVideo;
let remoteVideo;

const init_page = function() {
    //init api
    try {
        Flashphoner.init();
    } catch(e) {
        setText("notifyFlash", "Your browser doesn't support WebRTC technology needed for this example");
        return;
    }

    //local and remote displays
    localVideo = document.getElementById("localVideo");
    remoteVideo = document.getElementById("remoteVideo");

    setValue("url", setURL() + "/" + createUUID(8));
    //set initial button callback
    onStopped();
}

const onStarted = function(publishStream, previewStream) {
    setHandler("publishBtn", "click", () => {stopBtnClick(previewStream);}, publishBtnClick);
    setText("publishBtn", "Stop");
    enableItem("publishBtn");
    setUpZoom(publishStream);
}

const onStopped = function() {
    if (!currentSession) {
        enableItem("url");
    }
    disableItem("zoom");
    enableItem("publishBtn");
    setHandler("publishBtn", "click", publishBtnClick, stopBtnClick);
    setText("publishBtn", "Start");
}

const publishBtnClick = function() {
    disableItem("publishBtn");
    start();
}

const stopBtnClick = function(previewStream) {
    disableItem("publishBtn");
    disableItem("zoom");
    if (previewStream) {
        previewStream.stop();
    }
}

const start = function() {
    //check if we already have session
    if (currentSession) {
        startStreaming(currentSession);
    } else {
        //create session
        let url = getValue("url");
        console.log("Create new session with url " + url);
        Flashphoner.createSession({urlServer: url}).on(SESSION_STATUS.ESTABLISHED, function(session){
            //session connected, start streaming
            currentSession = session;
            startStreaming(session);
        }).on(SESSION_STATUS.DISCONNECTED, function(){
            setStatus(SESSION_STATUS.DISCONNECTED);
            currentSession = null;
            onStopped();
        }).on(SESSION_STATUS.FAILED, function(){
            setStatus(SESSION_STATUS.FAILED);
            currentSession = null;
            onStopped();
        });
    }
}

const startStreaming = function(session) {
    let streamName = getValue("url").split('/')[3];
    disableItem("url");

    session.createStream({
        name: streamName,
        display: localVideo,
        constraints: {
            video: {
                zoom: true
            },
            audio: true
        }
    }).on(STREAM_STATUS.PUBLISHING, function(publishStream){
        setStatus(STREAM_STATUS.PUBLISHING);
        //play preview
        session.createStream({
            name: streamName,
            display: remoteVideo
        }).on(STREAM_STATUS.PLAYING, function(previewStream){
            //enable stop button
            onStarted(publishStream, previewStream);
        }).on(STREAM_STATUS.STOPPED, function(){
            publishStream.stop();
        }).on(STREAM_STATUS.FAILED, function(stream){
            //preview failed, stop publishStream
            if (publishStream.status() === STREAM_STATUS.PUBLISHING) {
                setStatus(STREAM_STATUS.FAILED, stream);
                publishStream.stop();
            }
        }).play();
    }).on(STREAM_STATUS.UNPUBLISHED, function(){
        setStatus(STREAM_STATUS.UNPUBLISHED);
        //enable start button
        onStopped();
    }).on(STREAM_STATUS.FAILED, function(stream){
        setStatus(STREAM_STATUS.FAILED, stream);
        //enable start button
        onStopped();
    }).publish();
}

const setUpZoom = function(publishStream) {
    // Check if zoom capabilities available
    if (publishStream) {
        let zoom = document.getElementById("zoom");
        let zoomCapabilities = publishStream.getZoomCapabilities();

        if (zoomCapabilities) {
            // Set up zoom control
            setText("info", "Zoom can be used with the camera");
            setAttribute("info", "class", "text-muted");
            zoom.min = zoomCapabilities.min;
            zoom.max = zoomCapabilities.max;
            zoom.step = zoomCapabilities.step;
            zoom.value = zoomCapabilities.value;
            zoom.oninput = async function(event) {
                await publishStream.setZoom(event.target.value);
                console.log("Zoom value: " + publishStream.getZoom());
            };
            enableItem("zoom");
        } else {
            setText("info", "Zoom can't be used with the camera");
            setAttribute("info", "class", "text-danger");
        }
    }
}

// Display connection or local stream status
const setStatus = function(status, stream) {
    setText("status", status);
    setAttribute("status", "class", "")
    if (status === "PUBLISHING") {
        setAttribute("status","class", "text-success");
        setAttribute("info","class", "text-muted");
        setText("info", "");
    } else if (status === "DISCONNECTED" || status === "UNPUBLISHED") {
        setAttribute("info","class", "text-muted");
        setAttribute("status","class", "text-muted");
        setText("info", "");
    } else if (status === "FAILED") {
        setAttribute("status","class", "text-danger");
        if (stream) {
            setText("info", stream.getInfo());
            setAttribute("info","class", "text-muted");
        }
    }
}
