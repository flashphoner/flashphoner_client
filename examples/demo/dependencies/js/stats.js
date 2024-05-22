/**
 * HTML5 video playback statistics
 */

/**
 * HTML5 statistics item
 *
 * @returns {object}
 * @constructor
 */
const HTML5StatsItem = function() {
    const statsItem = {
        value: 0,
        lastData: 0,
        timestamp: 0,
        init: function(value, data) {
            statsItem.setValue(value);
            statsItem.setLastData(data);
        },
        setValue: function(value) {
            statsItem.value = value;
        },
        getValue: function() {
            return statsItem.value;
        },
        setLastData: function(data, timestamp) {
            statsItem.lastData = data;
            statsItem.setTimestamp(timestamp);
        },
        getLastData: function() {
            return statsItem.lastData;
        },
        setTimestamp: function(timestamp) {
            statsItem.timestamp = timestamp || Date.now();
        },
        getTimestamp: function() {
            return statsItem.timestamp;
        },
        elapsedSecs: function(timestamp) {
            let now = timestamp || Date.now();
            return (now - statsItem.timestamp) / 1000;
        }
    };
    return statsItem;
}

const HTML5Stats = function(video) {
    const stats = {
        video: video || null,
        width: 0,
        height: 0,
        bitrate: HTML5StatsItem(),
        fps: HTML5StatsItem(),
        init: function(video) {
            stats.video = video;
            stats.width = 0;
            stats.height = 0;
            stats.bitrate.init(0);
            stats.fps.init(0);
        },
        collect: function() {
            if (stats.video) {
                let now = Date.now();
                let quality = video.getVideoPlaybackQuality();

                if (quality) {
                    let played = quality.totalVideoFrames - quality.droppedVideoFrames;
                    if (played !== stats.fps.getLastData()) {
                        stats.fps.setValue((played - stats.fps.getLastData()) / stats.fps.elapsedSecs(now));
                        stats.fps.setLastData(played, now);
                    }
                } else {
                    stats.fps.setValue(undefined);
                }

                if (stats.video.webkitVideoDecodedByteCount !== undefined) {
                    let decoded = stats.video.webkitVideoDecodedByteCount;
                    stats.bitrate.setValue(Math.round((decoded - stats.bitrate.getLastData()) * 8 / stats.bitrate.elapsedSecs(now)));
                    stats.bitrate.setLastData(decoded, now);
                } else {
                    stats.bitrate.setValue(undefined);
                }

                stats.width = stats.video.videoWidth;
                stats.height = stats.video.videoHeight;

                return true;
            }
            return false;
        },
        getWidth: function() {
            return stats.width;
        },
        getHeight: function() {
            return stats.height;
        },
        getFps: function() {
            return stats.fps.getValue();
        },
        getBitrate: function() {
            return stats.bitrate.getValue();
        }
    };
    return stats;
}