///////////////////////////////////
///////////// Utils ////////////
///////////////////////////////////

function notEmpty(obj) {
    if (obj != null && obj != 'undefined' && obj != '') {
        return true;
    }
    return false;
}

//Trace
function trace(str){
    console.log(str);
}

//Get field
function field(name){
    var field = document.getElementById(name).value;
    return field;
}

//Set WCS URL
function setURL() {
    var proto;
    var url;
    var port;
    if (window.location.protocol == "http:") {
        proto = "ws://"
        port = "8080"
    } else {
        proto = "wss://"
        port = "8443"
    }

    url = proto + window.location.hostname + ":" + port;
    return url;
}

function getHLSUrl() {
    var proto = "http://";
    var url;
    var port = 8082;

    url = proto + window.location.hostname + ":" + port;
    return url;
}

// Detect IE
function detectIE() {
    var ua = window.navigator.userAgent;
    var msie = ua.indexOf('MSIE ');
    if (msie > 0) {
        return true;
    }
    var trident = ua.indexOf('Trident/');
    if (trident > 0) {
        return true;
    }
    return false;
}

// Detect Flash
function detectFlash() {
    var hasFlash = false;
    try {
        var fo = new ActiveXObject('ShockwaveFlash.ShockwaveFlash');
        if (fo) {
            hasFlash = true;
        }
    } catch (e) {
        if (navigator.mimeTypes
            && navigator.mimeTypes['application/x-shockwave-flash'] != undefined
            && navigator.mimeTypes['application/x-shockwave-flash'].enabledPlugin) {
            hasFlash = true;
        }
    }
    if (!hasFlash) {
        $("#notifyFlash").text("Your browser doesn't support the Flash technology necessary for work of an example");
    }
}

$(function() {
    function reposition() {
        var modal = $(this),
            dialog = modal.find('.modal-dialog');
        modal.css('display', 'block');

        // Dividing by two centers the modal exactly, but dividing by three
        // or four works better for larger screens.
        dialog.css("margin-top", Math.max(0, ($(window).height() - dialog.height()) / 2));
    }
    // Reposition when a modal is shown
    $('.modal').on('show.bs.modal', reposition);
    // Reposition when the window is resized
    $(window).on('resize', function() {
        $('.modal:visible').each(reposition);
    });
});

function detectBrowser() {
    var browser;
    var isAndroid = navigator.userAgent.toLowerCase().indexOf("android") > -1;
    if (isAndroid)
        return "Android";
    var isiOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    if (isiOS)
        return "iOS";
    // Opera 8.0+
    var isOpera = (!!window.opr && !!opr.addons) || !!window.opera || navigator.userAgent.indexOf(' OPR/') >= 0;
    if (isOpera)
        return "Opera";
    // Firefox 1.0+
    var isFirefox = typeof InstallTrigger !== 'undefined';
    if (isFirefox)
        return "Firefox";
    // At least Safari 3+: "[object HTMLElementConstructor]"
    var isSafari = Object.prototype.toString.call(window.HTMLElement).indexOf('Constructor') > 0;
    if (isSafari)
        return "Safari";
    // Internet Explorer 6-11
    var isIE = /*@cc_on!@*/false || !!document.documentMode;
    if (isIE)
        return "IE";
    // Edge 20+
    var isEdge = !isIE && !!window.StyleMedia;
    if (isEdge)
        return "Edge";
    // Chrome 1+
    var isChrome = !!window.chrome && !!window.chrome.webstore;
    if (isChrome)
        return "Chrome";
    // Blink engine detection
    var isBlink = (isChrome || isOpera) && !!window.CSS;
    if (isBlink)
        return "Blink";

}