'use strict';

const util = require('./util');
const LOG_PREFIX = "stats-collector";

// Collect and send WebRTC statistics periodically
const StreamStatsCollector = function(description, id, mediaConnection, wsConnection, logger) {
    let statCollector = {
        description: description,
        id: id,
        mediaConnection: mediaConnection,
        wsConnection: wsConnection,
        logger: getLogger(logger),
        headers: "",
        compression: "none",
        metricsBatch: null,
        timer: null,
        batchCount: 0,
        start: async function() {
            let error = "Can't collect WebRTC stats to send: ";
            if (!statCollector.description.types) {
                throw new Error(error + "no report types defined");
            }
            if (!statCollector.description.sampling) {
                throw new Error(error + "no sampling interval defined");
            }
            if (!statCollector.description.batchSize) {
                throw new Error(error + "no metrics batch size defined");
            }
            if (!statCollector.mediaConnection) {
                throw new Error(error + "no media connection available");
            }
            if (!statCollector.wsConnection) {
                throw new Error(error + "no websocket connection available");
            }

            await statCollector.updateHeaders();
            await statCollector.updateCompression();
            statCollector.sendHeaders();
            if (statCollector.description.collect === "on") {
                statCollector.collect(true);
            }
        },
        collect: function(enable) {
            if (enable) {
                statCollector.startTimer();
            } else {
                statCollector.stopTimer();
            }
        },
        stop: function() {
            statCollector.stopTimer();
            statCollector.headers = "";
        },
        update: async function(description) {
            if (!description) {
                if (statCollector.logger) {
                    statCollector.logger.error(LOG_PREFIX, "Can't update WebRTC metrics sending: no parameters passed");
                    return;
                }
            }
            if (description.types || description.compression) {
                statCollector.stop();
                if (description.types) {
                    statCollector.description.types = description.types;
                    await statCollector.updateHeaders();
                }
                if (description.compression) {
                    statCollector.description.compression = description.compression;
                    await statCollector.updateCompression();
                }
                statCollector.sendHeaders();
            } else {
                statCollector.collect(false);
            }
            if (description.batchSize) {
                statCollector.description.batchSize = description.batchSize;
            }
            if (description.sampling) {
                statCollector.description.sampling = description.sampling;
            }
            if (description.collect) {
                statCollector.description.collect = description.collect;
            }
            switch(statCollector.description.collect) {
                case "on":
                    statCollector.collect(true);
                    break;
                case "off":
                    statCollector.collect(false);
                    break;
            }
        },
        updateHeaders: async function() {
            let stats = await statCollector.mediaConnection.getWebRTCStats();
            Object.keys(statCollector.description.types).forEach((type) => {
                let typeDescriptor = statCollector.description.types[type];
                let metricsString = "";
                let contentFilters = null;
                if (typeDescriptor.metrics) {
                    metricsString = typeDescriptor.metrics;
                }
                if (typeDescriptor.contains) {
                    contentFilters = typeDescriptor.contains;
                }
                if (stats[type]) {
                    stats[type].forEach((report) => {
                        statCollector.logger.debug(LOG_PREFIX, type + " report: " + JSON.stringify(report));
                        if (contentFilters) {
                            let filtersMatched = true;
                            for (const filter in contentFilters) {
                                statCollector.logger.debug(LOG_PREFIX, type + " filter by " + filter + ": " + JSON.stringify(contentFilters[filter]));
                                let filterMatched = false;
                                if (report[filter]) {
                                    for (const value of contentFilters[filter]) {
                                        statCollector.logger.debug(LOG_PREFIX, filter + ": " + value + " <>  " + report[filter]);
                                        if (report[filter] === value) {
                                            filterMatched = true;
                                            break;
                                        }
                                    }
                                }
                                filtersMatched = filtersMatched && filterMatched;
                                if (!filterMatched) {
                                    break;
                                }
                            }
                            if (filtersMatched) {
                                statCollector.addHeaders(report, metricsString);
                            }
                        } else {
                            statCollector.addHeaders(report, metricsString);
                        }
                    });
                } else {
                    statCollector.logger.warn(LOG_PREFIX, "No report type found in RTC stats: '" + type + "'");
                }
            });
        },
        addHeaders: function(report, metricsString) {
            if (metricsString) {
                let metrics = metricsString.split(",");
                metrics.forEach((metric) => {
                    let metricFound = false;
                    for (const key of Object.keys(report)) {
                        if (metric === key) {
                            statCollector.headers = util.addFieldToCsvString(statCollector.headers, report.type + "." + report.id + "." + metric, ",");
                            metricFound = true;
                            break;
                        }
                    }
                    if (!metricFound) {
                        statCollector.logger.warn(LOG_PREFIX, "No metric found in RTC stats report '" + report.type + "': '" + metric + "'");
                    }
                });
            }
        },
        updateCompression: async function() {
            if (statCollector.description.compression) {
                if (statCollector.description.compression.indexOf("gzip") >= 0) {
                    await statCollector.checkForCompression("gzip");
                } else if (statCollector.description.compression.indexOf("deflate") >= 0) {
                    await statCollector.checkForCompression("deflate");
                }
            }
        },
        checkForCompression: async function(compression) {
            try {
                await util.compress(compression, "test", false);
                statCollector.compression = compression;
            } catch (e) {
                statCollector.logger.warn(LOG_PREFIX, "Can't compress metrics data using " + compression + ": " + e);
                statCollector.compression = "none";
            }
        },
        sendHeaders: function() {
            let data = {
                mediaSessionId: statCollector.id,
                compression: statCollector.compression,
                headers: statCollector.headers
            };
            statCollector.send("webRTCMetricsClientDescription", data);
        },
        send: function(message, data) {
            statCollector.logger.debug(LOG_PREFIX, data);
            if (statCollector.wsConnection.readyState === WebSocket.OPEN) {
                statCollector.wsConnection.send(JSON.stringify({
                    message: message,
                    data: [data]
                }));
            }
        },
        startTimer: function() {
            if (!statCollector.timer && statCollector.headers) {
                statCollector.batchCount = statCollector.description.batchSize;
                statCollector.timer = setInterval(statCollector.collectMetrics, statCollector.description.sampling);
            }
        },
        stopTimer: function() {
            if (statCollector.timer) {
                clearInterval(statCollector.timer);
                statCollector.timer = null;
                statCollector.metricsBatch = null;
            }
        },
        collectMetrics: async function() {
            if (statCollector.timer) {
                let stats = await statCollector.mediaConnection.getWebRTCStats();

                if (!statCollector.metricsBatch) {
                    statCollector.metricsBatch = [];
                }

                let metrics = [];
                statCollector.headers.split(",").forEach((header) => {
                    let components = header.split(".");
                    let descriptor = {
                        type: components[0],
                        id: components[1],
                        name: components[2]
                    }
                    let value = "undefined";

                    if (stats[descriptor.type]) {
                        for (const report of stats[descriptor.type]) {
                            if (report.id === descriptor.id) {
                                value = report[descriptor.name];
                                break;
                            }
                        }
                    }
                    metrics.push(value);
                });
                statCollector.metricsBatch.push(metrics);
                statCollector.batchCount--;
                if (statCollector.batchCount === 0) {
                    await statCollector.sendMetrics();
                }
            }
        },
        sendMetrics: async function() {
            let previous;
            let metricsToSend = [];
            let metricsData;

            for (let i = 0; i < statCollector.metricsBatch.length; i++) {
                let metricsString = "";
                for (let j = 0; j < statCollector.metricsBatch[i].length; j++) {
                    let valueString = valueToString(statCollector.metricsBatch[i][j]);
                    let previousString = "";
                    let separator = ";";
                    if (previous) {
                        previousString = valueToString(previous[j]);
                    }
                    if (valueString === previousString) {
                        valueString = "";
                    }
                    metricsString = util.addFieldToCsvString(metricsString, valueString, separator);
                }
                previous = statCollector.metricsBatch[i];
                metricsToSend.push(metricsString);
            }
            if (statCollector.compression !== "none") {
                try {
                    metricsData = await util.compress(statCollector.compression, JSON.stringify(metricsToSend), true);
                } catch(e) {
                    statCollector.logger.warn(LOG_PREFIX, "Can't send metrics data using" + statCollector.compression + ": " + e);
                    metricsData = null;
                }
            } else {
                metricsData = metricsToSend;
            }
            if (metricsData) {
                let data = {
                    mediaSessionId: statCollector.id,
                    metrics: metricsData
                };
                statCollector.send("webRTCMetricsBatch", data);
            }
            statCollector.metricsBatch = null;
            statCollector.batchCount = statCollector.description.batchSize;
        }
    }
    return statCollector;
}

// Helper function to stringify a value
const valueToString = function(value) {
    let valueString = "undefined";
    if (typeof value === "object") {
        valueString = JSON.stringify(value);
    } else {
        valueString = value.toString();
    }
    return valueString;
}

// Helper function to get logger object
const getLogger = function(logger) {
    if (logger) {
        if (logger.info !== undefined &&
            logger.warn !== undefined &&
            logger.error !== undefined &&
            logger.debug !== undefined) {
            return logger;
        }
    }
    return {
        info: function() {},
        warn: function() {},
        error: function() {},
        debug: function() {}
    };
}

module.exports = {
    StreamStatsCollector: StreamStatsCollector
}