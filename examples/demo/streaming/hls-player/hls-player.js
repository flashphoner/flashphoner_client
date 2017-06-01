function initPage() {
    $("#urlServer").val(getHLSUrl());
    var player = videojs('remoteVideo');
    var applyFn = function () {
        var streamName = $("#playStream").val();
        streamName = encodeURIComponent(streamName);
        player.src({
            src: $("#urlServer").val() + "/" + streamName + "/" + streamName + ".m3u8",
            type: "application/vnd.apple.mpegurl"
        });
        player.play();
    };
    $("#applyBtn").prop('disabled', false).click(applyFn);

}