var SESSION_STATUS = Flashphoner.constants.SESSION_STATUS;
var STREAM_STATUS = Flashphoner.constants.STREAM_STATUS;
var localVideo;
var snapshotImg;


//////////////////////////////////
/////////////// Init /////////////

function init_page() {
    //init api
    try {
        Flashphoner.init({flashMediaProviderSwfLocation: '../../../../media-provider.swf'});
    } catch(e) {
        $("#notifyFlash").text("Your browser doesn't support Flash or WebRTC technology necessary for work of an example");
        return;
    }

    //local and remote displays
    localVideo = document.getElementById("localVideo");
    snapshotImg = document.getElementById("dynImg");

    $("#url").val(setURL() + "/" + createUUID(8));
    //set initial button callback
    onUnpublished();
}

function snapshot(name) {
    setSnapshotStatus();
    var session = Flashphoner.getSessions()[0];
    session.createStream({name: name}).on(STREAM_STATUS.SNAPSHOT_COMPLETE, function(stream){
        console.log("Snapshot complete");
        setSnapshotStatus(STREAM_STATUS.SNAPSHOT_COMPLETE);
        snapshotImg.src = "data:image/png;base64,"+stream.getInfo();
        //remove failed callback
        stream.on(STREAM_STATUS.FAILED, function(){});
        //release stream object
        stream.stop();
    }).on(STREAM_STATUS.FAILED, function(stream){
        setSnapshotStatus(STREAM_STATUS.FAILED);
        console.log("Snapshot failed, info: " + stream.getInfo());
    }).snapshot();
}

function onPublishing(stream) {
    $("#publishBtn").text("Stop").off('click').click(function(){
        $(this).prop('disabled', true);
        stream.stop();
    }).prop('disabled', false);

    $("#snapshotBtn").off('click').click(function(){
        $(this).prop('disabled', true);
        snapshot(stream.name());
    }).prop('disabled', false);

}

function onUnpublished() {
    $("#publishBtn").text("Start").off('click').click(function(){
        $(this).prop('disabled', true);
        start();
    }).prop('disabled', false);
    $("#snapshotBtn").prop('disabled', true);
}

function start() {
    //check if we already have session
    if (Flashphoner.getSessions().length > 0) {
        startStreaming(Flashphoner.getSessions()[0]);
    } else {
        //create session
        var url = field('url');
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
    var streamName = field("url").split('/')[3];
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
    }).on(STREAM_STATUS.FAILED, function(){
        setStatus(STREAM_STATUS.FAILED);
        //enable start button
        onUnpublished();
    }).publish();
}

//show connection or local stream status
function setStatus(status) {
    var statusField = $("#status");
    statusField.text(status).removeClass();
    if (status == "PUBLISHING") {
        statusField.attr("class","text-success");
    } else if (status == "DISCONNECTED" || status == "UNPUBLISHED") {
        statusField.attr("class","text-muted");
    } else if (status == "FAILED") {
        statusField.attr("class","text-danger");
    }
}

function setSnapshotStatus(status) {
    var statusField = $("#snapshotStatus");
    if (status == "SNAPSHOT_COMPLETE") {
        statusField.text("").removeClass();
        $("#snapshotBtn").prop('disabled', false);
    } else if (status == "FAILED") {
        statusField.text(status).removeClass().attr("class","text-danger");
        $("#snapshotBtn").prop('disabled', false);
    } else {
        statusField.text("processing...").removeClass();
    }
}