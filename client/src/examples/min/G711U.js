/**
 * Created by nazar on 06.02.2015.
 */

var G711U = window.G711U = function () {

};

G711U.prototype.decode = function(data) {
    var payload = data;
    var ret = new Uint8Array(data.length*2);
    for (index = 0; index < payload.length; ++index) {
        var tmp = this.ulaw2linear(payload[index]);
        var index2 = index << 1;
        ret[index2] = (tmp & 0x00ff);
        ret[++index2] = (tmp & 0xff00) >>> 8;
    }
    return ret;
};

var SIGN_BIT = 0x80;
var BIAS = 0x84;
var SEG_SHIFT = 4;
var QUANT_MASK = 0xf;
var SEG_MASK = 0x70;

G711U.prototype.ulaw2linear = function(data) {
    var t;
    data = ~data;
    t = ((data & QUANT_MASK) << 3) + BIAS;
    t <<= (data & SEG_MASK) >> SEG_SHIFT;
    return((data & SIGN_BIT) != 0 ? (BIAS - t) : (t - BIAS));

};

G711U.prototype.getWavHeader = function() {
    return this.parseHex("524946466406000057415645666d74201000000001000100401f0000803e0000020010006461746140060000");
}

G711U.prototype.printWavHeader = function(str) {
    var view = new DataView(this.parseHex(str).buffer);
    var index = 0;
    console.log("RIFF " + view.getInt32(index));
    index += 4;
    console.log("Chunk size:" + view.getInt32(index, true));
    index += 4;
    console.log("Format:" + view.getInt32(index));
    index += 4;
    console.log("Subchunk id:" + view.getInt32(index));
    index += 4;
    console.log("Subchunk size:" + view.getInt32(index, true));
    index += 4;
    console.log("AudioFormat:" + view.getInt16(index, true));
    index += 2;
    console.log("NumChannels:" + view.getUint16(index, true));
    index += 2;
    console.log("Sample rate:" + view.getInt32(index, true));
    index += 4;
    console.log("Byte rate:" + view.getInt32(index, true));
}

G711U.prototype.parseHex = function (str) {
    var ret = [];
    for (var i = 0; i < str.length; i += 2) {
        ret.push(parseInt("0x"+str.substr(i, 2), 16));
    }
    return new Uint8Array(ret);
};


G711U.prototype.byteToHex = function(b) {
    var hexChar = ["0", "1", "2", "3", "4", "5", "6", "7","8", "9", "A", "B", "C", "D", "E", "F"];
    return hexChar[(b >> 4) & 0x0f] + hexChar[b & 0x0f];
};

G711U.prototype.printArrayAsHex = function(data) {
    var str = "";
    var table = "";
    for (var i = 0; i < data.byteLength; i++) {
        var char = this.byteToHex(data[i]);
        str += char;
        table += char;
        if (i%32 == 0) {
            table += "\n";
        }
    }
    console.log(str);
    console.log(table);
}
