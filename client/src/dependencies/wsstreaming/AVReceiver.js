function AVReceiver() {
    this.videoPlayer;
    this.audioPlayer;
    this.videoCanvasCtx;
    this.videoCanvas;
    this.videoStarted = false;
    this.incomingAudioBuffer = [];
    this.incomingVideoBuffer = [];
    this.audioSSRC = "";
    this.videoSSRC = "";
    this.lastVideoTimestamp = 0;
    this.lastAudioTimestamp = 0;
    this.tsVideoWaitingList = [];
    this.firstAudioTimestamp = 0;
    this.firstVideoTimestamp = 0;
    this.videoTimeDifference = 0;
    this.audioTimeDifference = 0;
    this.sync = false;
    this.bufferFilled = false;
    //in milliseconds
    this.audioBufferWaitFor = 1000;
}

var requestAnimFrame = (function(){
    return window.requestAnimationFrame ||
        window.webkitRequestAnimationFrame ||
        window.mozRequestAnimationFrame ||
        function( callback ){
            window.setTimeout(callback, 1000 / 60);
        };
})();

AVReceiver.prototype.initPlayers = function() {
    //init audio player
    try {
        window.AudioContext = window.AudioContext || window.webkitAudioContext;
        var audioContext = new AudioContext();
        this.audioPlayer = new AudioPlayer(audioContext, f.configuration.incomingAudioBufferLength);
    } catch(e) {
        alert('Failed to init audio player' + e);
    }

    //init video
    try {
        var canvas = document.getElementById('videoCanvas');
        var ctx = canvas.getContext('2d');
        ctx.fillStyle = '#444';
        ctx.fillText('Loading...', canvas.width / 2 - 30, canvas.height / 3);
        this.videoCanvasCtx = ctx;
        this.videoCanvas = canvas;
        this.videoPlayer = new jsmpeg(null, {canvas: canvas, ondecodeframe: this.videoDecodedCallback.bind(this)});
        this.videoPlayer.initSocketClient(null, f.configuration.videoWidth, f.configuration.videoHeight);
    } catch (e) {
        alert('Failed to init video player' + e);
    }
};

AVReceiver.prototype.videoDecodedCallback = function(that, picture) {
    var picTs = this.tsVideoWaitingList.shift();
    var tmpPic = this.videoCanvasCtx.createImageData(picture.width, picture.height);
    tmpPic.data.set(new Uint8Array(picture.data.buffer));
    var buffEntry = {};
    buffEntry.timestamp = picTs;
    buffEntry.data = tmpPic;
    this.incomingVideoBuffer.push(buffEntry);
};

AVReceiver.prototype.requestVideoFrameCallback = function (timestamp) {
    var audioPlayerTime = this.getAudioPlayerTime();
    //console.log("requestVideoFrameCallback, audio player time " + audioPlayerTime + " callback timestamp " + timestamp);
    //feeding one frame at a time if ready
    buffEntry = this.incomingVideoBuffer[0];
    if (buffEntry != undefined && this.toCommonTimeBase(false, buffEntry.timestamp) <= audioPlayerTime) {
        this.videoCanvasCtx.putImageData(this.incomingVideoBuffer.shift().data, 0, 0);
        //console.log("Play picture ts " + this.toCommonTimeBase(false, buffEntry.timestamp) + " audio ts " + audioPlayerTime + " buffer size " + this.incomingVideoBuffer.length);
    }
    if (this.videoStarted) {
        requestAnimFrame(this.requestVideoFrameCallback.bind(this), this.videoCanvas);
    }
};

AVReceiver.prototype.onDataReceived = function(event) {
    var view = new DataView(event.data);
    var buffEntry = {};
    //de-multiplexing
    var stripBytes = 4;
    if (view.getUint8(0) == 0x00) {
        //video
        if (view.getUint8(1) == 0x01) {
            //ssrc
            this.videoSSRC = view.getUint32(stripBytes);
            stripBytes += 4;
        }
        if (view.getUint8(2) == 0x01) {
            //timestamp
            var ts = view.getUint32(stripBytes);
            stripBytes += 4;
            if (this.firstVideoTimestamp == 0) {
                this.firstVideoTimestamp = ts;
            }
            if (this.lastVideoTimestamp != ts) {
                this.tsVideoWaitingList.push(ts);
            }
            this.lastVideoTimestamp = ts;
        }
        //send picture for decoding, decoded picture will arrive in videoDecodedCallback
        this.handleVideo(this.stripBytes(new Uint8Array(event.data), stripBytes));
    } else if (view.getUint8(0) == 0x01) {
        //audio
        if (view.getUint8(1) == 0x01) {
            //ssrc
            this.audioSSRC = view.getUint32(stripBytes);
            stripBytes += 4;
        }
        if (view.getUint8(2) == 0x01) {
            //timestamp
            this.lastAudioTimestamp = view.getUint32(stripBytes);
            stripBytes += 4;
        }
        if (this.firstAudioTimestamp == 0) {
            this.firstAudioTimestamp = this.lastAudioTimestamp;
            console.log("Audio ts first " + this.firstAudioTimestamp);
        }
        //console.log("Audio TS last " + this.lastAudioTimestamp);
        if (!this.bufferFilled) {
            buffEntry.timestamp = this.lastAudioTimestamp;
            buffEntry.data = this.stripBytes(new Uint8Array(event.data), stripBytes);
            this.incomingAudioBuffer.push(buffEntry);
            //one buff entry for audio is 20ms
            if (this.audioBufferWaitFor <= this.incomingAudioBuffer.length * 20) {
                this.bufferFilled = true;
            }
        } else if (this.sync && this.incomingAudioBuffer.length > 0) {
            //just got sync, flush buffer
            console.log("Flush buffer, buffer size " + this.incomingAudioBuffer.length);
            console.log("time before flush, player " + this.getAudioPlayerTime() + " now " + this.audioPlayer.now());
            while (this.incomingAudioBuffer.length != 0) {
                this.handleAudio(this.incomingAudioBuffer.shift().data);
            }
            this.handleAudio(this.stripBytes(new Uint8Array(event.data), stripBytes));
            console.log("time after flush, player " + this.getAudioPlayerTime() + " now " + this.audioPlayer.now());
            console.log("Common timebase ms audio " + this.toCommonTimeBase(true, this.firstAudioTimestamp) + " video " + this.toCommonTimeBase(false, this.lastVideoTimestamp));
            console.log("Common timebase difference " + (this.toCommonTimeBase(false, this.lastVideoTimestamp) - this.toCommonTimeBase(true, this.firstAudioTimestamp)));
            if (!this.videoStarted) {
                this.videoStarted = true;
                requestAnimFrame(this.requestVideoFrameCallback.bind(this), this.videoCanvas);
            }
        } else if (this.sync) {
            this.handleAudio(this.stripBytes(new Uint8Array(event.data), stripBytes));
        } else {
            buffEntry.timestamp = this.lastAudioTimestamp;
            buffEntry.data = this.stripBytes(new Uint8Array(event.data), stripBytes);
            this.incomingAudioBuffer.push(buffEntry);
        }
    } else if (view.getUint8(0) == 0x02) {
        //rtcp
        this.handleRtcp(this.stripBytes(new Uint8Array(event.data), 4))
    } else {
        console.log("Unknown binary data received, discarding");
    }

};

AVReceiver.prototype.handleVideo = function(data) {
    this.videoPlayer.receiveSocketMessage(data);
};

AVReceiver.prototype.handleAudio = function(data) {
    this.audioPlayer.ulaw8000(data);
};

AVReceiver.prototype.handleRtcp = function(data) {
    console.log("received rtcp");
    console.log("audio ssrc " + this.audioSSRC);
    console.log("video ssrc " + this.videoSSRC);
    var view = new DataView(data.buffer);
    console.log("RTCP SSRC " + view.getInt32(0));
    console.log("Timestamp " + view.getUint32(4));
    console.log("Time seconds " + view.getUint32(8));
    console.log("Time fraction of second " + view.getUint32(12));
    console.log("---------------------------------------------------");
    var ntpTimeMs;
    var tsTimeMs;
    if (this.audioSSRC == view.getInt32(0)) {
        ntpTimeMs = view.getUint32(8) * 1000 + this.ntpFractionToMilliseconds(view.getUint32(12));
        tsTimeMs = this.tsToMilliseconds(view.getUint32(4), 8000);
        this.audioTimeDifference = ntpTimeMs - tsTimeMs;
        console.log("Audio difference " + this.audioTimeDifference + " ntpTimeMS " + ntpTimeMs + " tsTimeMs " + tsTimeMs);
    } else if (this.videoSSRC == view.getInt32(0)) {
        ntpTimeMs = view.getUint32(8) * 1000 + this.ntpFractionToMilliseconds(view.getUint32(12));
        tsTimeMs = this.tsToMilliseconds(view.getUint32(4), 90000);
        this.videoTimeDifference = ntpTimeMs - tsTimeMs;
        console.log("Video difference " + this.videoTimeDifference + " ntpTimeMS " + ntpTimeMs + " tsTimeMs " + tsTimeMs);
    } else {
        console.log("Received rtcp with unknown ssrc!");
    }
    if (this.audioTimeDifference != 0 && this.videoTimeDifference != 0) {
        this.sync = true;
    }
};

AVReceiver.prototype.stop = function() {
    this.audioPlayer.stop();
    this.videoPlayer.stop();
    this.videoStarted = false;
};

AVReceiver.prototype.stripBytes = function(data, length) {
    var ret = new Uint8Array(data.byteLength - length);
    var offset = length;
    for (var i = 0; i < ret.byteLength; i++, offset++) {
        ret[i] = data[offset];
    }
    return ret;
};

AVReceiver.prototype.ntpFractionToMilliseconds = function(fraction) {
    return fraction * 1000 / 4294967296;
};

AVReceiver.prototype.tsToMilliseconds = function(ts, rate) {
    return ts/rate * 1000;
};

AVReceiver.prototype.toCommonTimeBase = function(isAudio, ts) {
    var rate = isAudio ? 8000 : 90000;
    var diff = isAudio ? this.audioTimeDifference : this.videoTimeDifference;
    return this.tsToMilliseconds(ts, rate) + diff;
};

AVReceiver.prototype.getAudioPlayerTime = function() {
    return this.audioPlayer.getCurrentPlayingTime() + this.toCommonTimeBase(true, this.firstAudioTimestamp);
};


