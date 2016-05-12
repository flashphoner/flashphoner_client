//Init WCS JavaScript API
var f = Flashphoner.getInstance();

// Save connection and callee info in cookies
function setCookies() {

    if (notEmpty($("#urlServer").val())) {
        f.setCookie("urlServer", $("#urlServer").val());
    }

    if (notEmpty($("#playStream").val())) {
        f.setCookie("playStream", $("#playStream").val());
    }
}

function getCookies() {
    if (notEmpty(f.getCookie("urlServer"))) {
        $("#urlServer").val(decodeURIComponent(f.getCookie("urlServer")));
    } else {
        $("#urlServer").val(getHLSUrl());
    }

    if (notEmpty(f.getCookie("playStream"))) {
        $("#playStream").val(decodeURIComponent(f.getCookie("playStream")));
    } else {
        $("#playStream").val("streamName");
    }
}

function initPage() {
    getCookies();

    var applyFn = function () {
        var streamName = $("#playStream").val();
        var $remoteVideo = $("#remoteVideo");
        $remoteVideo.attr("src", $("#urlServer").val() + "/" + streamName + "/" + streamName + ".m3u8");
        $remoteVideo.load();
    };
    $("#applyBtn").prop('disabled', false).click(applyFn);

    applyFn();

}