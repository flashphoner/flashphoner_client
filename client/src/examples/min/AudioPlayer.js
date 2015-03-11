function AudioPlayer(audioContext, internalBufferSize) {
    var me = this;
    this.initBuffers();
    this.nodeConnected = false;
    this.context = audioContext;
    this.resampler = new Resampler(8000, 44100, 1, 4096, true);
    this.timePlaying = 0;
    //size of data js node will request, 1024 samples
    this.internalBufferSize = parseInt(internalBufferSize) || 2048;
    try {
        this.context.createScriptProcessor = this.context.createScriptProcessor || this.context.createJavaScriptNode;
        this.audioJSNode = this.context.createScriptProcessor(this.internalBufferSize, 1, 1);
    } catch (e) {
        alert('JS Audio Node is not supported in this browser' + e);
    }
    this.audioJSNode.onaudioprocess = function(event) {
        var bufferSize = me.internalBufferSize;
        if (me.decodedBufferPos >= bufferSize) {
            var decoded = me.shiftDecodedData(bufferSize);
            var output = event.outputBuffer.getChannelData(0);
            for (var i = 0; i < output.length; i++) {
                output[i] = decoded[i];
                //white noise for testing purposes
                //output[i] = (Math.random() * 2 - 1);
            }
            me.timePlaying += me.internalBufferSize / 44100 * 1000;
        } else {
            console.log("Not enough data in audio buffer! Available " + me.decodedBufferPos);
        }
    };
    this.codec = new G711U();
    console.log("AudioPlayer ready, incoming buffer length " + this.internalBufferSize);
}

AudioPlayer.prototype.initBuffers = function() {
    //4 seconds buffer of ieee float32 samples in bytes
    this.decodedBufferSize = 705600;
    this.decodedBufferArray = new ArrayBuffer(this.decodedBufferSize);
    this.decodedBufferView = new Float32Array(this.decodedBufferArray);
    //fill array with 0
    for (var i = 0; i < this.decodedBufferView.length; i++) {
        this.decodedBufferView[i] = 0;
    }
    this.decodedBufferPos = 0;

    //not using at the moment
    this.incomingBufferArray = new ArrayBuffer(1);
    this.incomingBufferView = new Uint8Array(this.incomingBufferArray);
    this.incomingBufferPos = 0;
    console.log("Buffers ready");
};

/**
 * Play G711U payload
 * @param payload G711U payload with 20ms ptime
 */
AudioPlayer.prototype.ulaw8000 = function(payload) {
    var pcm16Data = this.codec.decode(payload);
    var retBuff = new Float32Array(pcm16Data.byteLength/2);
    var incomingDataView = new DataView(pcm16Data.buffer);
    for (var i = 0; i < retBuff.length; i++) {
        retBuff[i] = incomingDataView.getInt16(i*2, true) / 32768.0;
    }
    var resampledLength = this.resampler.resampler(retBuff);
    var resampledResult = this.resampler.outputBuffer.subarray(0, resampledLength);
    this.pushDecodedData(resampledResult);

    //buffer at least 1 sample
    if (!this.nodeConnected && this.decodedBufferPos > this.internalBufferSize) {
        this.audioJSNode.connect(this.context.destination);
        this.nodeConnected = true;
    }

};

AudioPlayer.prototype.play16PCM8000 = function(payload) {
    var retBuff = new Float32Array(payload.byteLength/2);
    var incomingDataView = new DataView(payload.buffer);
    for (var i = 0; i < retBuff.length; i++) {
        retBuff[i] = incomingDataView.getInt16(i*2, true) / 32768.0;
    }
    var resampledLength = this.resampler.resampler(retBuff);
    var resampledResult = this.resampler.outputBuffer.subarray(0, resampledLength);
    this.pushDecodedData(resampledResult);
    this.incomingBufferPos = 0;
    if (!this.nodeConnected && this.decodedBufferPos > this.internalBufferSize) {
        this.audioJSNode.connect(this.context.destination);
        this.nodeConnected = true;
    }

};

AudioPlayer.prototype.play32PCM8000 = function(payload) {
    //playing bypass
    var retBuff = new Float32Array(payload.byteLength/4);
    var incomingDataView = new DataView(payload.buffer);
    for (var i = 0; i < retBuff.length; i++) {
        retBuff[i] = incomingDataView.getFloat32(i*4, true);
    }
    var resampledLength = me.resampler.resampler(retBuff);
    var resampledResult = me.resampler.outputBuffer.subarray(0, resampledLength);
    this.pushDecodedData(resampledResult);
    if (!me.nodeConnected && this.decodedBufferPos > this.internalBufferSize) {
        me.audioJSNode.connect(me.context.destination);
        me.nodeConnected = true;
    }

};

AudioPlayer.prototype.play32PCM44100 = function(payload) {
    var retBuff = new Float32Array(payload.byteLength/4);
    var incomingDataView = new DataView(payload.buffer);
    for (var i = 0; i < retBuff.length; i++) {
        retBuff[i] = incomingDataView.getFloat32(i*4, true);
    }
    this.pushDecodedData(retBuff);
    if (!me.nodeConnected && this.decodedBufferPos > this.internalBufferSize) {
        me.audioJSNode.connect(me.context.destination);
        me.nodeConnected = true;
    }

};

AudioPlayer.prototype.stop = function () {
    this.audioJSNode.disconnect();
};

//data must be a Float32View
AudioPlayer.prototype.pushDecodedData = function(data) {
    //check if we have space
    //console.log("pushDecodedData decodedBufferPos:" + this.decodedBufferPos + " data length:"+data.length);
    if (this.decodedBufferSize / 4 - this.decodedBufferPos > data.length) {
        for (var i = 0; i < data.length; i++) {
            this.decodedBufferView[this.decodedBufferPos++] = data[i];
        }
    } else {
        console.log("Decoded audio buffer full!");
        //clear buffer
        //todo shift instead
        //shift playtime
        this.timePlaying += this.decodedBufferPos / 44100 * 1000;
        this.decodedBufferPos = 0;
    }
};

AudioPlayer.prototype.shiftDecodedData = function (length) {
    var ret = new Float32Array(length);
    //console.log("shiftDecodedData length:"+length + " decodedBufferPos:" + this.decodedBufferPos);
    var i;
    for (i = 0; i < length; i++) {
        ret[i] = this.decodedBufferView[i];
    }
    //move data
    var pos = this.decodedBufferPos;
    for (i = 0; i < pos - length; i++) {
        this.decodedBufferView[i] = this.decodedBufferView[i+length];
    }
    this.decodedBufferPos = pos - length;
    return ret;
};
