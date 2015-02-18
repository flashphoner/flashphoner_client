function AudioPlayer(audioContext) {
    var me = this;
    this.initBuffers();
    this.nodeConnected = false;
    this.context = audioContext;
    //this.resampler = new Resampler(8000, 44100, 1, 4096, true);
    try {
        this.context.createScriptProcessor = this.context.createScriptProcessor || this.context.createJavaScriptNode;
        this.audioJSNode = this.context.createScriptProcessor(4096, 1, 1);
    } catch (e) {
        alert('JS Audio Node is not supported in this browser' + e);
    }
    this.audioJSNode.onaudioprocess = function(event) {
        var bufferSize = 4096;
        if (me.decodedBufferPos >= bufferSize) {
            var decoded = me.shiftDecodedData(bufferSize);
            var output = event.outputBuffer.getChannelData(0);
            for (var i = 0; i < output.length; i++) {
                output[i] = decoded[i];
                //white noise for testing purposes
                //output[i] = (Math.random() * 2 - 1);
            }

        }
    };
    this.codec = new G711U();
}

AudioPlayer.prototype.initBuffers = function() {
    this.decodedBufferSize = 4096*100;
    this.decodedBufferArray = new ArrayBuffer(this.decodedBufferSize);
    this.decodedBufferView = new Float32Array(this.decodedBufferArray);
    //fill array with 0
    for (var i = 0; i < this.decodedBufferView.length; i++) {
        this.decodedBufferView[i] = 0;
    }
    this.decodedBufferPos = 0;
    console.log("decodedBuffer initialized, position " + this.decodedBufferPos);

    this.incomingBufferArray = new ArrayBuffer(1600);
    this.incomingBufferView = new Uint8Array(this.incomingBufferArray);
    this.incomingBufferPos = 0;
    console.log("incomingBuffer initialized, position " + this.incomingBufferPos);
};

/**
 * Decodes audio payload into 16-bit linear PCM and wraps it in WAV header
 * @param payload G711U payload with 20ms ptime
 */
AudioPlayer.prototype.play = function(payload) {
    var me = this;
    var pcm16Data = this.codec.decode(payload);
    var i;
    for (i = 0; i < pcm16Data.byteLength; i++) {
        this.incomingBufferView[this.incomingBufferPos++] = pcm16Data[i];
    }
    if (this.incomingBufferPos == 1600) {
        //bufferred, wrap into wav
        var header = this.codec.getWavHeader();
        var retBuff = new Uint8Array(header.byteLength + this.incomingBufferView.byteLength);
        var pos = 0;
        for (i = 0; i < header.byteLength; i++, pos++) {
            retBuff[pos] = header[i];
        }
        for (i = 0; i < this.incomingBufferView.byteLength; i++, pos++) {
            retBuff[pos] = this.incomingBufferView[i];
        }
        this.incomingBufferPos = 0;

        //pass data to decoder
        this.context.decodeAudioData(retBuff.buffer, function (buffer) {
            me.pushDecodedData(buffer.getChannelData(0));
            if (!me.nodeConnected) {
                me.audioJSNode.connect(me.context.destination);
                me.nodeConnected = true;
            }
        }, function (error) {
            console.log("Got error from decoder! " + error)
        });

        /*
        ////////////////////////////////////////////////
        ///////////////convert to float and put into decoded buffer
        var floatView = new Float32Array(this.incomingBufferPos / 2);
        var bufferView = new DataView(this.incomingBufferArray);
        var bytePos = 0;
        for (var i = 0; i < this.incomingBufferPos / 2 ; i++, bytePos += 2) {
            floatView[i] = bufferView.getInt16(bytePos) / 32768.0;
        }
        //resample
        var resultLength = me.resampler.resampler(floatView);
        this.pushDecodedData(me.resampler.outputBuffer.subarray(0, resultLength));
        //this.test = true;
        this.incomingBufferPos = 0;
        if (!me.nodeConnected && me.decodedBufferPos > 4096*3) {
            me.audioJSNode.connect(me.audioFilter);
            me.audioFilter.connect(me.context.destination);
            me.nodeConnected = true;
        }*/
    }
};

AudioPlayer.prototype.stop = function () {
    this.audioJSNode.disconnect();
};

AudioPlayer.prototype.pushDecodedData = function(data) {
    //check if we have space
    //console.log("pushDecodedData decodedBufferPos:" + this.decodedBufferPos + " data length:"+data.length);
    if (this.decodedBufferSize - this.decodedBufferPos > data.length) {
        for (var i = 0; i < data.length; i++) {
            this.decodedBufferView[this.decodedBufferPos++] = data[i];
        }
    } else {
        console.log("Decoded audio buffer full!");
        //clear buffer
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
