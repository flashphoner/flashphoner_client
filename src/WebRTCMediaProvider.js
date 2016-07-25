Flashphoner.MediaProvider.WebRTC = function(){
    var connections = {};
    var exports = {};

    var createConnection = function(options) {
        var id = options.id;
        var connectionConfig = options.connectionConfig || {"iceServers": []};
        var connection = new RTCPeerConnection(connectionConfig, {
            "optional": [
                {"DtlsSrtpKeyAgreement": true}
            ]
        });
        var remoteStream;
        var remoteElement = options.remoteElement;
        if (options.localStream) {
            connection.addStream(options.localStream);
        }
        connection.onaddstream = function(event) {
            remoteStream = event.stream;
            if (remoteElement) {
                remoteElement.srcObject = remoteStream;
                remoteElement.play();
            }
        };
        connection.onremovestream = function(event) {
            remoteStream = null;
            if (remoteElement) {
                remoteElement.pause();
            }
        };
        connection.onsignalingstatechange = function(event){
        };
        connection.oniceconnectionstatechange = function(event){
        };
        var state = function(){
            return connection.signalingState;
        };
        var close = function(){
            if (remoteElement) {
                remoteElement.pause();
            }
            connection.close();
            delete connections[id];
        };
        var createOffer = function() {
            return new Promise(function (resolve, reject) {
                var constraints = {offerToReceiveAudio: true, offerToReceiveVideo: true};
                //create offer and set local sdp
                return connection.createOffer(constraints).then(function (offer) {
                    connection.setLocalDescription(offer).then(function () {
                        resolve(offer.sdp);
                    });
                });
            });
        };
        var setRemoteSdp = function(sdp) {
            return new Promise(function (resolve, reject) {
                //todo check signalling state
                var sdpAnswer = new RTCSessionDescription({
                    type: 'answer',
                    sdp: sdp
                });
                connection.setRemoteDescription(sdpAnswer).then(function(){
                    resolve();
                }).catch(function(error){
                    reject(error);
                });
            });
        };

        var exports = {};
        exports.state = state;
        exports.createOffer = createOffer;
        exports.setRemoteSdp = setRemoteSdp;
        exports.close = close;
        connections[id] = exports;
        return exports;
    };

    var getAccessToAudioAndVideo = function() {
        return new Promise(function(resolve, reject) {
            var constraints = {
                audio: true,
                video: {
                    width: 640,
                    height: 480
                }
            };
            navigator.getUserMedia(constraints, resolve, reject);
        });
    };

    exports.createConnection = createConnection;
    exports.getAccessToAudioAndVideo = getAccessToAudioAndVideo;
    return exports;
}();