'use strict';

module.exports = {
    /**
     * Copy values of object own properties to array.
     *
     * @param obj
     * @returns {Array}
     */
    copyObjectToArray: function(obj) {
        var ret = [];
        for (var prop in obj) {
            if(obj.hasOwnProperty(prop)) {
                ret.push(obj[prop]);
            }
        }
        return ret;
    },
    /**
     * Copy src properties to dst object.
     * Will overwrite dst prop with src prop in case of dst prop exist.
     */
    copyObjectPropsToAnotherObject: function(src, dst) {
        for (var prop in src) {
            if(src.hasOwnProperty(prop)) {
                dst[prop] = src[prop];
            }
        }
    },
    browser: function() {
        var browser;
        var isAndroid = navigator.userAgent.toLowerCase().indexOf("android") > -1;
        if (isAndroid)
            browser = "Android";
        var isiOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        if (isiOS)
            browser = "iOS";
        // Opera 8.0+
        var isOpera = (!!window.opr && !!opr.addons) || !!window.opera || navigator.userAgent.indexOf(' OPR/') >= 0;
        if (isOpera)
            browser = "Opera";
        // Firefox 1.0+
        var isFirefox = typeof InstallTrigger !== 'undefined';
        if (isFirefox)
            browser = "Firefox";
        // At least Safari 3+: "[object HTMLElementConstructor]"
        var isSafari = Object.prototype.toString.call(window.HTMLElement).indexOf('Constructor') > 0;
        if (isSafari)
            browser = "Safari";
        // Internet Explorer 6-11
        var isIE = /*@cc_on!@*/false || !!document.documentMode;
        if (isIE)
            browser = "IE";
        // Edge 20+
        var isEdge = !isIE && !!window.StyleMedia;
        if (isEdge)
            browser = "Edge";
        // Chrome 1+
        var isChrome = !!window.chrome && !!window.chrome.webstore;
        if (isChrome)
            browser = "Chrome";
        return browser;
    },
    processGoogRtcStatsReport: function(report) {
        /**
         * Report types: googComponent, googCandidatePair, googCertificate, googLibjingleSession, googTrack, ssrc
         */
        var gotResult = false;
        var result = null;
        if (report.type && report.type == "googCandidatePair") {
            //check if this is active pair
            if (report.stat("googActiveConnection") == "true") {
                gotResult = true;
            }
        }

        if (report.type && report.type == "ssrc") {
            gotResult = true;
        }

        if (gotResult) {
            //prepare object
            result = {};
            result.timestamp = report.timestamp;
            result.id = report.id;
            result.type = report.type;
            if (report.names) {
                var names = report.names();
                for (var i = 0; i < names.length; ++i) {
                    var attrName = names[i];
                    result[attrName] = report.stat(attrName);
                }
            }
        }
        return result;
    }
};