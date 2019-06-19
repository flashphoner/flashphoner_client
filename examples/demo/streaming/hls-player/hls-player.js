function initPage() {
    $("#urlServer").val(getHLSUrl());
    var player = videojs('remoteVideo');
    var applyFn = function () {
        var streamName = $("#playStream").val();
        streamName = encodeURIComponent(streamName);
        var src = $("#urlServer").val() + "/" + streamName + "/" + streamName + ".m3u8";
        var key = $('#key').val();
        var token = $("#token").val();
        if (key.length > 0 && token.length > 0) {
            src += "?" + key + "=" + token;
        }
        player.src({
            src: src,
            type: "application/vnd.apple.mpegurl"
        });
        player.play();
    };
    $("#applyBtn").prop('disabled', false).click(applyFn);

}