function AVReceiver(videoPlayer, audioPlayer) {
    this.videoPlayer = videoPlayer;
    this.audioPlayer = audioPlayer;
    //todo use typed arrays instead
    this.incomingAudioBuffer = [];
    this.incomingVideoBuffer = [];
    this.audioSSRC = "";
    this.videoSSRC = "";
    this.lastVideoTimestamp = 0;
    this.lastAudioTimestamp = 0;
    this.firstAudioTimestamp = 0;
    this.videoTimeDifference = 0;
    this.audioTimeDifference = 0;
    this.sync = false;
    this.bufferFilled = false;
    //in milliseconds
    this.audioBufferWaitFor = 1000;
}

AVReceiver.prototype.onDataReceived = function(event) {
    var view = new DataView(event.data);
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
            this.lastVideoTimestamp = view.getUint32(stripBytes);
            stripBytes += 4;
        }
        var buffEntry = {};
        buffEntry.timestamp = this.lastVideoTimestamp;
        buffEntry.data = this.stripBytes(new Uint8Array(event.data), stripBytes);
        this.incomingVideoBuffer.push(buffEntry);
        //if we are in sync see if we have video picture to show
        if (this.sync && this.bufferFilled) {
            var audioPlayerTime = this.getAudioPlayerTime() + 50;
            var count = 0;
            while (true) {
                var buffEntry = this.incomingVideoBuffer[0];
                if (buffEntry != undefined && this.toCommonTimeBase(false, buffEntry.timestamp) <= audioPlayerTime) {
                    //console.log("Play video entry ts " + this.toCommonTimeBase(false, buffEntry.timestamp) + " audio player ts " + audioPlayerTime);
                    this.handleVideo(buffEntry.data);
                    this.incomingVideoBuffer.shift();
                    count++;
                } else {
                    console.log("break, video buffer length " + this.incomingVideoBuffer.length + " flushed packets " + count);
                    break;
                }
            }
            //this.handleVideo(this.incomingVideoBuffer.shift().data);
        }
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
        }
        if (!this.bufferFilled) {
            var buffEntry = {};
            buffEntry.timestamp = this.lastAudioTimestamp;
            buffEntry.data = this.stripBytes(new Uint8Array(event.data), stripBytes);
            this.incomingAudioBuffer.push(buffEntry);
            //one buff entry for audio is 20ms
            if (this.audioBufferWaitFor < this.incomingAudioBuffer.length * 20) {
                this.bufferFilled = true;
            }

        } else if (this.sync && this.incomingAudioBuffer.length > 0) {
            //just got sync, flush buffer
            console.log("Flush buffer, buffer size " + this.incomingAudioBuffer.length);
            while (this.incomingAudioBuffer.length != 0) {
                this.handleAudio(this.incomingAudioBuffer.shift().data);
            }
            this.handleAudio(this.stripBytes(new Uint8Array(event.data), stripBytes));
        } else if (this.sync) {
            this.handleAudio(this.stripBytes(new Uint8Array(event.data), stripBytes));
        } else {
            var buffEntry = {};
            buffEntry.timestamp = this.lastAudioTimestamp;
            buffEntry.data = this.stripBytes(new Uint8Array(event.data), stripBytes);
            this.incomingAudioBuffer.push(buffEntry);
        }
    } else if (view.getUint8(0) == 0x02) {
        //rtcp
        this.handleRtcp(this.stripBytes(new Uint8Array(event.data), 4))
    } else {
        console.log("Unknown binary data received, discarding");
        return;
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
    console.log("Ntp time: " + view.getUint32(12) + "," + view.getUint32(8));
    console.log("---------------------------------------------------");
    if (this.audioSSRC == view.getInt32(0)) {
        var ntpTimeMs = view.getUint32(8) * 1000 + this.ntpFractionToMilliseconds(view.getUint32(12));
        var tsTimeMs = this.tsToMilliseconds(view.getUint32(4), 8000);
        this.audioTimeDifference = ntpTimeMs - tsTimeMs;
    } else if (this.videoSSRC == view.getInt32(0)) {
        var ntpTimeMs = view.getUint32(8) * 1000 + this.ntpFractionToMilliseconds(view.getUint32(12));
        var tsTimeMs = this.tsToMilliseconds(view.getUint32(4), 90000);
        this.videoTimeDifference = ntpTimeMs - tsTimeMs;
    } else {
        console.log("Received rtcp with unknown ssrc!");
    }
    if (this.audioTimeDifference != 0 && this.videoTimeDifference != 0) {
        this.sync = true;
    }
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
    return this.audioPlayer.timePlaying + this.toCommonTimeBase(true, this.firstAudioTimestamp);
};


