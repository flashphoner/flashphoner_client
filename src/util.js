'use strict';

const isEmptyObject = function( obj ) {
    for ( var name in obj ) {
        return false;
    }
    return true;
};

/**
 * Copy values of object own properties to array.
 *
 * @param obj
 * @returns {Array}
 */
const copyObjectToArray = function(obj) {
    var ret = [];
    for (var prop in obj) {
        if(obj.hasOwnProperty(prop)) {
            ret.push(obj[prop]);
        }
    }
    return ret;
};

/**
 * Copy src properties to dst object.
 * Will overwrite dst prop with src prop in case of dst prop exist.
 */
const copyObjectPropsToAnotherObject = function(src, dst) {
    for (var prop in src) {
        if(src.hasOwnProperty(prop)) {
            dst[prop] = src[prop];
        }
    }
};

const processRtcStatsReport = function(browser, report) {
    var result = {};
    if (browser == "chrome") {
        /**
         * Report types: googComponent, googCandidatePair, googCertificate, googLibjingleSession, googTrack, ssrc
         */
        var gotResult = false;
        if (report.type && report.type == "googCandidatePair") {
            //check if this is active pair
            if (report.googActiveConnection == "true") {
                gotResult = true;
            }
        }

        if (report.type && report.type == "ssrc") {
            gotResult = true;
        }

        if (gotResult) {
            for (var k in report) {
                if (report.hasOwnProperty(k)) {
                    result[k] = report[k];
                }
            }
        }
        return result;
    } else if (browser == "firefox") {
        /**
         * RTCStatsReport http://mxr.mozilla.org/mozilla-central/source/dom/webidl/RTCStatsReport.webidl
         */

        if (report.type && (report.type == "outboundrtp" || report.type == "inboundrtp") && report.id.indexOf("rtcp") == -1) {
            result = {};
            for (var k in report) {
                if (report.hasOwnProperty(k)) {
                    result[k] = report[k];
                }
            }
        }

        return result;
    } else {
        return result
    }
};

const Browser = {
    isIE: function () {
        return /*@cc_on!@*/false || !!document.documentMode;
    },
    isFirefox: function () {
        return typeof InstallTrigger !== 'undefined';
    },
    isChrome: function () {
        return !!window.chrome && /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor) && !/OPR/.test(navigator.userAgent);
    },
    isEdge: function () {
        return !this.isIE() && !!window.StyleMedia;
    },
    isOpera: function () {
        return (!!window.opr && !!opr.addons) || !!window.opera || navigator.userAgent.indexOf(' OPR/') >= 0;
    },
    isiOS: function () {
        return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    },
    isSafari: function () {
        var userAgent = navigator.userAgent.toLowerCase();
        return /(safari|applewebkit)/i.test(userAgent) && !userAgent.includes("chrome") && !userAgent.includes("android");
    },
    isAndroid: function () {
        return navigator.userAgent.toLowerCase().indexOf("android") > -1;
    },
    isSafariWebRTC: function () {
        return navigator.mediaDevices && this.isSafari();
    },
    isSamsungBrowser: function() {
        return /SamsungBrowser/i.test(navigator.userAgent);
    },
    isAndroidFirefox: function () {
        return this.isAndroid() && /Firefox/i.test(navigator.userAgent);
    },
    isChromiumEdge: function () {
        return /Chrome/i.test(navigator.userAgent) && /Edg/i.test(navigator.userAgent);
    },
    version: function () {
        var version = navigator.userAgent.match(/version\/(\d+)/i);
        if (version) {
            return version[1];
        } else {
            if (this.isEdge()) {
                version = /\brv[ :]+(\d+)/g.exec(navigator.userAgent) || [];
            }
            if (this.isOpera()) {
                version = navigator.userAgent.match(/\b(OPR)\/(\d+)/) || [];
            }
            if (this.isChromiumEdge()) {
                version = navigator.userAgent.match(/\b(Edg)\/(\d+)/) || [];
            }
            if (this.isSamsungBrowser()) {
                version = navigator.userAgent.match(/\b(SamsungBrowser)\/(\d+)/) || [];
            }
            if (this.isChrome()) {
                version = navigator.userAgent.match(/\b(Chrome)\/(\d+)/) || [];
            }
            if (this.isFirefox()) {
                version = navigator.userAgent.match(/\b(Firefox)\/(\d+)/) || [];
            }
            return version[2] || 0;
        }
        return 0;
    }
};

const SDP = {
    matchPrefix: function(sdp,prefix) {
        var parts = sdp.trim().split('\n').map(function(line) {
            return line.trim();
        });
        return parts.filter(function(line) {
            return line.indexOf(prefix) === 0;
        });
    },
    writeFmtp: function (sdp, param, codec) {
        var sdpArray = sdp.split("\n");
        var i;
        for (i = 0; i < sdpArray.length; i++) {
            if (sdpArray[i].search(codec) != -1 && sdpArray[i].indexOf("a=rtpmap") == 0) {
                sdpArray[i] += "\na=fmtp:" + sdpArray[i].match(/[0-9]+/)[0] + " " + param + "\r";
            }
        }
        //normalize sdp after modifications
        var result = "";
        for (i = 0; i < sdpArray.length; i++) {
            if (sdpArray[i] != "") {
                result += sdpArray[i] + "\n";
            }
        }
        return result;
    },
    setPublishingBitrate: function (sdp, minBitrate, maxBitrate) {
        if(sdp && (minBitrate || maxBitrate)) {
            let sdpArray = sdp.split("\n");
            let i;
            let rtpmap = -1, codec = "";
            let matches;
            let bitrateString = "";
            for (i = 0; i < sdpArray.length; i++) {
                if (sdpArray[i].startsWith("a=rtpmap")) {
                    matches = sdpArray[i].match("a=rtpmap:(.+) (.+)/.*");
                    if (matches && matches.length > 2) {
                        rtpmap = parseInt(matches[1], 10);
                        codec = matches[2];
                    }
                } else {
                    if (codec === "H264" || codec === "VP8") {
                        if (sdpArray[i].startsWith("a=fmtp:" + rtpmap)) {
                            bitrateString = this.getBitrateString(sdpArray[i], minBitrate, maxBitrate);
                            if (bitrateString) {
                                sdpArray[i] += ";" + bitrateString;
                            }
                        } else {
                            bitrateString = this.getBitrateString("", minBitrate, maxBitrate);
                            if (bitrateString) {
                                sdpArray[i] = "a=fmtp:" + rtpmap + " " + bitrateString + "\r\n" + sdpArray[i];
                            }
                        }
                        codec = "";
                        rtpmap = -1;
                    }
                }
            }
            let newSDP = "";
            for (i = 0; i < sdpArray.length; i++) {
                if (sdpArray[i] != "") {
                    newSDP += sdpArray[i] + "\n";
                }
            }
            return newSDP;
        }
        return sdp;
    },
    getBitrateString: function (string, minBitrate, maxBitrate) {
        let bitrateString = "";
        if (minBitrate && string.indexOf("x-google-min-bitrate") == -1) {
            bitrateString += "x-google-min-bitrate=" + minBitrate;
        }
        if (maxBitrate && string.indexOf("x-google-max-bitrate") == -1) {
            if (bitrateString) {
                bitrateString += ";";
            }
            bitrateString += "x-google-max-bitrate=" + maxBitrate;
        }
        return bitrateString;
    }
};

const logger = function() {
    return {
        init: function (verbosity, enablePushLogs, customLogger, enableLogs) {
            switch (verbosity.toUpperCase()) {
                case "DEBUG":
                    this.verbosity = 3;
                    break;
                case "INFO":
                    this.verbosity = 2;
                    break;
                case "ERROR":
                    this.verbosity = 0;
                    break;
                case "WARN":
                    this.verbosity = 1;
                    break;
                case "TRACE":
                    this.verbosity = 4;
                    break;
                default :
                    this.verbosity = 2;
            };
            this.date = function() {
                return new Date().toTimeString().split(" ")[0];
            };
            this.enablePushLogs = enablePushLogs;
            var delayedLogs = [];
            this.customLogger = customLogger;
            this.enableLogs = enableLogs;
            this.pushLogs = function(log) {
                if (this.wsConnection && this.enablePushLogs) {
                    if (delayedLogs.length) {
                        for (var i = 0; i<delayedLogs.length; i++) {
                            this.wsConnection.send(JSON.stringify({
                                message: "pushLogs",
                                data: [{logs: delayedLogs[i]}]
                            }));
                        }
                    }
                    delayedLogs = [];
                    this.wsConnection.send(JSON.stringify({
                        message: "pushLogs",
                        data: [{logs: log}]
                    }));
                } else {
                    // Save logs to send it later
                    delayedLogs.push(log);
                }
            }
        },
        info: function (src, text) {
            if (!this.enableLogs){
                return;
            }
            var prefix = this.date() + " INFO " + src + " - ";
            this.pushLogs(prefix + JSON.stringify(text) + '\n');
            if (this.verbosity >= 2) {
                if (this.customLogger != null) {
                    this.customLogger.info(text);
                } else {
                    console.log(prefix,text);
                }
            }
        },
        debug: function (src, text) {
            if (!this.enableLogs){
                return;
            }
            var prefix = this.date() + " DEBUG " + src + " - ";
            this.pushLogs(prefix + JSON.stringify(text) + '\n');
            if (this.verbosity >= 3) {
                if (this.customLogger != null) {
                    this.customLogger.debug(text);
                } else {
                    console.log(prefix,text);
                }
            }
        },
        trace: function (src, text) {
            if (!this.enableLogs){
                return;
            }
            var prefix = this.date() + " TRACE " + src + " - ";
            this.pushLogs(prefix + JSON.stringify(text) + '\n');
            if (this.verbosity >= 4) {
                if (this.customLogger != null) {
                    this.customLogger.trace(text);
                } else {
                    console.log(prefix,text);
                }
            }
        },
        warn: function (src, text) {
            if (!this.enableLogs){
                return;
            }
            var prefix = this.date() + " WARN " + src + " - ";
            this.pushLogs(prefix + JSON.stringify(text) + '\n');
            if (this.verbosity >= 1) {
                if (this.customLogger != null) {
                    this.customLogger.warn(text);
                } else {
                    console.warn(prefix,text);
                }
            }
        },
        error: function (src, text) {
            if (!this.enableLogs){
                return;
            }
            var prefix = this.date() + " ERROR " + src + " - ";
            this.pushLogs(prefix + JSON.stringify(text) + '\n');
            if (this.verbosity >= 0) {
                if (this.customLogger != null) {
                    this.customLogger.error(text);
                } else {
                    console.error(prefix,text);
                }
            }
        },
        setEnableLogs: function(enableLogs) {
            this.enableLogs = enableLogs;
        },
        setCustomLogger: function(customLogger) {
            this.customLogger = customLogger;
        },
        setConnection: function(connection) {
            this.wsConnection = connection;

        },
        setPushLogs: function(pushLogs) {
            this.enablePushLogs = pushLogs;
        },
        setLevel: function(level) {
            switch (level.toUpperCase()) {
                case "DEBUG":
                    this.verbosity = 3;
                    break;
                case "INFO":
                    this.verbosity = 2;
                    break;
                case "ERROR":
                    this.verbosity = 0;
                    break;
                case "WARN":
                    this.verbosity = 1;
                    break;
                case "TRACE":
                    this.verbosity = 4;
                    break;
                default :
                    this.verbosity = 2;
            }
        }
    }
};

const stripCodecs = function(sdp, codecs) {
    if (!codecs.length) return sdp;

    var sdpArray = sdp.split("\n");
    var codecsArray = codecs.split(",");

    //search and delete codecs line
    var pt = [];
    var i;
    for (var p = 0; p < codecsArray.length; p++) {
        console.log("Searching for codec " + codecsArray[p]);
        for (i = 0; i < sdpArray.length; i++) {
            if (sdpArray[i].search(new RegExp(codecsArray[p],'i')) != -1 && sdpArray[i].indexOf("a=rtpmap") == 0) {
                console.log(codecsArray[p] + " detected");
                pt.push(sdpArray[i].match(/[0-9]+/)[0]);
                sdpArray[i] = "";
            }
        }
    }
    if (pt.length) {
        //searching for fmtp
        for (p = 0; p < pt.length; p++) {
            for (i = 0; i < sdpArray.length; i++) {
                if (sdpArray[i].search("a=fmtp:" + pt[p]) != -1 || sdpArray[i].search("a=rtcp-fb:" + pt[p]) != -1) {
                    sdpArray[i] = "";
                }
            }
        }

        //delete entries from m= line
        for (i = 0; i < sdpArray.length; i++) {
            if (sdpArray[i].search("m=audio") != -1 || sdpArray[i].search("m=video") != -1) {
                var mLineSplitted = sdpArray[i].split(" ");
                var newMLine = "";
                for (var m = 0; m < mLineSplitted.length; m++) {
                    if (pt.indexOf(mLineSplitted[m].trim()) == -1 || m <= 2) {
                        newMLine += mLineSplitted[m];
                        if (m < mLineSplitted.length - 1) {
                            newMLine = newMLine + " ";
                        }
                    }
                }
                sdpArray[i] = newMLine;
            }
        }
    }

    //normalize sdp after modifications
    var result = "";
    for (i = 0; i < sdpArray.length; i++) {
        if (sdpArray[i] != "") {
            result += sdpArray[i] + "\n";
        }
    }
    return result;
};

const getCurrentCodecAndSampleRate = function(sdp, mediaType) {
    var rows = sdp.split("\n");
    var codecPt;
    var ret = {};
    for (var i = 0; i < rows.length ; i++) {
        if (codecPt && rows[i].indexOf("a=rtpmap:" + codecPt) != -1) {
            ret.name = rows[i].split(" ")[1].split("/")[0];
            ret.sampleRate = rows[i].split(" ")[1].split("/")[1];
            return ret;
        }
        //WCS-2136. WebRTC statistics doesn't work for VP8
        if (rows[i].indexOf("m=" + mediaType) != -1) {
            codecPt = rows[i].split(" ")[3].trim();
        }
    }
    // A workaround for empty sdp passed #WCS-3583
    ret.name = "undefined";
    ret.sampleRate = "undefined";
    return ret;
};

const isPromise = function(object) {
    if (object !== null &&
        typeof object === 'object' &&
        typeof object.then === 'function' &&
        typeof object.catch === 'function') {
        return true;
    }
    
    return false;
};

const setPublishingBitrate = function(sdp, mediaConnection, minBitrate, maxBitrate) {
    if (minBitrate || maxBitrate) {
        if (sdp && Browser.isChrome() || Browser.isSafariWebRTC()) {
            // Set publishing bitrate constraints via remote SDP
            sdp = SDP.setPublishingBitrate(sdp, minBitrate, maxBitrate);
        } else if (mediaConnection) {
            // Set publishing bitrate via sender encodings if SDP feature is not supported
            mediaConnection.setPublishingBitrate(minBitrate, maxBitrate);
        }
    }
    return sdp;
};

module.exports = {
    isEmptyObject,
    copyObjectToArray,
    copyObjectPropsToAnotherObject,
    processRtcStatsReport,
    Browser,
    SDP,
    logger,
    stripCodecs,
    getCurrentCodecAndSampleRate,
    isPromise,
    setPublishingBitrate
};
