function initPage() {
    $("#urlServer").val(getHLSUrl());
    var applyFn = function () {
        var streamName = $("#playStream").val();
        var $remoteVideo = $("#remoteVideo");
        streamName = btoa(streamName);
        $remoteVideo.attr("src", $("#urlServer").val() + "/" + streamName + "/" + streamName + ".m3u8");
        $remoteVideo.load();
    };
    $("#applyBtn").prop('disabled', false).click(applyFn);

}