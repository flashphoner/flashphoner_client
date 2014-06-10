/**
 * Created by nazar on 10.04.14.
 */
//Load xml config

Config = function () {
    this.wcsIP = null;
    this.wsPort = "8080";
    this.videoWidth = 640;
    this.videoHeight = 480;

    $.ajax({
        type: "GET",
        url: "flashphoner.xml",
        dataType: "xml",
        success: this.parseFlashphonerXML,
        context: this
    });
};

Config.prototype = {

    parseFlashphonerXML: function(xml) {

        var wcsIP = $(xml).find("wcs_server");
        if (wcsIP.length > 0) {
            this.wcsIP = wcsIP[0].textContent;
        }

        var wsPort = $(xml).find("ws_port");
        if (wsPort.length > 0) {
            this.wsPort = wsPort[0].textContent;
        }

        var videoWidth = $(xml).find("video_width");
        if (videoWidth.length > 0) {
            this.videoWidth = videoWidth[0].textContent;
        }
        var videoHeight = $(xml).find("video_height");
        if (videoHeight.length > 0) {
            this.videoHeight = videoHeight[0].textContent;
        }
    }
};