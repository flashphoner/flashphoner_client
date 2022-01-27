var SESSION_STATUS = Flashphoner.constants.SESSION_STATUS;
var STREAM_STATUS = Flashphoner.constants.STREAM_STATUS;
var PRELOADER_URL = "../../dependencies/media/preloader.mp4";
var Browser = Flashphoner.Browser;
var localVideo;
var snapshotImg;
var canvas;
var snapshotImgSize;

//////////////////////////////////
/////////////// Init /////////////

function init_page() {
    //init api
    try {
        Flashphoner.init();
    } catch(e) {
        $("#notifyFlash").text("Your browser doesn't support WebRTC technology needed for this example");
        return;
    }

    //local and remote displays
    localVideo = document.getElementById("localVideo");
    snapshotImg = document.getElementById("snapshotImg");
    canvas = document.getElementById("canvas");
    
    //preview size
    snapshotImgSize = {
        w: snapshotImg.width,
        h: snapshotImg.height
    };

    $("#url").val(setURL() + "/" + createUUID(8));
    //set initial button callback
    onUnpublished();
}

function snapshot(stream) {
    let video = document.getElementById(stream.id());
    let canvasContext = canvas.getContext("2d");
    if (video === undefined) {
        console.log("Failed to get video item for stream " + stream.name);
    } else {
        let videoSize = {
            w: video.videoWidth,
            h: video.videoHeight
        };
        // Draw snapshot on hidden canvas in full video size
        canvas.width = videoSize.w;
        canvas.height = videoSize.h;
        canvasContext.drawImage(video, 0, 0, canvas.width, canvas.height);
        let data = canvas.toDataURL('image/png');
        if (data === undefined) {
            console.log("Failed to get image data from canvas");
        } else {
            // Downscale snapshot preview keeping video aspect ratio
            let previewSize;
            previewSize = downScaleToFitSize(videoSize.w, videoSize.h, snapshotImgSize.w, snapshotImgSize.h);
            console.log("previewSize: " + previewSize.w + "x" + previewSize.h);
            snapshotImg.style.width = previewSize.w + "px";
            snapshotImg.style.height = previewSize.h + "px";

            // Snapshot preview vertical align
            let margin = 0;
            if (snapshotImgSize.h - previewSize.h > 1) {
                margin = Math.floor((snapshotImgSize.h - previewSize.h) / 2);
            }
            snapshotImg.style.margin = margin + "px auto";
            
            // Set image data to snapshot page item. "Open image in new tab" or "Save image as" will open full size snapshot
            snapshotImg.setAttribute('src', data);
        }
    }
}


// Helper function to downscale picture to fit a snapshot preview size
function downScaleToFitSize(videoWidth, videoHeight, dstWidth, dstHeight) {
    let newWidth, newHeight;
    let videoRatio = videoWidth / videoHeight;
    let dstRatio = dstWidth / dstHeight;
    if (dstRatio > videoRatio) {
        newHeight = dstHeight;
        newWidth = Math.floor(videoRatio * dstHeight);
    } else {
        newWidth = dstWidth;
        newHeight = Math.floor(dstWidth / videoRatio);
    }
    return {
        w: newWidth,
        h: newHeight
    };
}



function onPublishing(stream) {
    $("#publishBtn").text("Stop").off('click').click(function(){
        $(this).prop('disabled', true);
        stream.stop();
    }).prop('disabled', false);

    $("#snapshotBtn").off('click').click(function(){
        snapshot(stream);
    }).prop('disabled', false);

}

function onUnpublished() {
    $("#publishBtn").text("Start").off('click').click(publishBtnClick).prop('disabled', false);
    $("#snapshotBtn").prop('disabled', true);
}

function publishBtnClick() {
    $(this).prop('disabled', true);
    start()
}

function start() {
    //check if we already have session
    if (Flashphoner.getSessions().length > 0) {
        startStreaming(Flashphoner.getSessions()[0]);
    } else {
        //create session
        let url = field('url');
        console.log("Create new session with url " + url);
        $('#url').prop('disabled', true);
        Flashphoner.createSession({urlServer: url}).on(SESSION_STATUS.ESTABLISHED, function(session){
            //session connected, start streaming
            startStreaming(session);
        }).on(SESSION_STATUS.DISCONNECTED, function(){
            setStatus(SESSION_STATUS.DISCONNECTED);
            $('#url').prop('disabled', false);
            onUnpublished();
        }).on(SESSION_STATUS.FAILED, function(){
            setStatus(SESSION_STATUS.FAILED);
            $('#url').prop('disabled', false);
            onUnpublished();
        });
    }
}

function startStreaming(session) {
    let streamName = field("url").split('/')[3];
    session.createStream({
        name: streamName,
        display: localVideo,
        cacheLocalResources: true,
        receiveVideo: false,
        receiveAudio: false
    }).on(STREAM_STATUS.PUBLISHING, function(publishStream){
        setStatus(STREAM_STATUS.PUBLISHING);
        onPublishing(publishStream);
    }).on(STREAM_STATUS.UNPUBLISHED, function(){
        setStatus(STREAM_STATUS.UNPUBLISHED);
        //enable start button
        onUnpublished();
    }).on(STREAM_STATUS.FAILED, function(stream){
        setStatus(STREAM_STATUS.FAILED, stream);
        //enable start button
        onUnpublished();
    }).publish();
}

//show connection or local stream status
function setStatus(status, stream) {
    let statusField = $("#status");
    let infoField = $("#info");
    statusField.text(status).removeClass();
    if (status == "PUBLISHING") {
        statusField.attr("class","text-success");
        infoField.text("");
    } else if (status == "DISCONNECTED" || status == "UNPUBLISHED") {
        statusField.attr("class","text-muted");
    } else if (status == "FAILED") {
        statusField.attr("class","text-danger");
        if (stream) {
            infoField.text(stream.getInfo()).attr("class","text-muted");
        }
    }
}
