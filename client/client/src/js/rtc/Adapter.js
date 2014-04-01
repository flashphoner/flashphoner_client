var RTCPeerConnection = null;
var getUserMedia = null;
var attachMediaStream = null;
var reattachMediaStream = null;
var webrtcDetectedBrowser = null;
var isWebRTCAvailable = false;

if (navigator.mozGetUserMedia) {
    console.log("This appears to be Firefox");

    if(typeof(mozRTCPeerConnection) === undefined) {
        console.log("Please, update your browser to use WebRTC");
    } else {
        isWebRTCAvailable = true;

        webrtcDetectedBrowser = "firefox";

        RTCPeerConnection = mozRTCPeerConnection;

        RTCSessionDescription = mozRTCSessionDescription;

        RTCIceCandidate = mozRTCIceCandidate;

        getUserMedia = navigator.mozGetUserMedia.bind(navigator);

        attachMediaStream = function(element, stream) {
            element.mozSrcObject = stream;
            element.play();
        };

        reattachMediaStream = function(to, from) {
            to.mozSrcObject = from.mozSrcObject;
            to.play();
        };

        MediaStream.prototype.getVideoTracks = function() {
            return [];
        };

        MediaStream.prototype.getAudioTracks = function() {
            return [];
        };
    }
} else if (navigator.webkitGetUserMedia) {
    console.log("This appears to be Chrome");

    if (typeof(webkitRTCPeerConnection) === undefined) {
        console.log("Please, update your browser to use WebRTC");
    } else {
        isWebRTCAvailable = true;

        webrtcDetectedBrowser = "chrome";

        RTCPeerConnection = webkitRTCPeerConnection;

        getUserMedia = navigator.webkitGetUserMedia.bind(navigator);

        attachMediaStream = function(element, stream) {
            element.src = webkitURL.createObjectURL(stream);
            element.play();
        };

        reattachMediaStream = function(to, from) {
            to.src = from.src;
            element.play();
        };

        if (!webkitMediaStream.prototype.getVideoTracks) {
            webkitMediaStream.prototype.getVideoTracks = function() {
                return this.videoTracks;
            };
        }

        if (!webkitMediaStream.prototype.getAudioTracks) {
            webkitMediaStream.prototype.getAudioTracks = function() {
                return this.audioTracks;
            };
        }
    }
} else {
    console.log("Browser does not appear to be WebRTC-capable");
}