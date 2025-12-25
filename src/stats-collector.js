'use strict';

const util = require('./util');
const LOG_PREFIX = "stats-collector";
const CONNECTION_TYPE = {
    WEBSOCKET: "ws",
    HTTP: "http"
}
const MAX_SEND_ERRORS = 3;
const CONNECTION_STATUS = {
    INIT: 0,
    OK: 200,
    BAD_REQUEST: 400,
    INTERNAL_SERVER_ERROR: 500
};

// Collect and send WebRTC statistics periodically
const StreamStatsCollector = function(description, id, mediaConnection, wsConnection, logger, maxErrors) {
    let statCollector = {
        description: description,
        id: id,
        mediaConnection: mediaConnection,
        connection: Connection(wsConnection, maxErrors),
        logger: getLogger(logger),
        headers: "",
        compression: "none",
        metricsBatch: null,
        timer: null,
        batchCount: 0,
        timerBusy: false,
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

            statCollector.logger.debug(LOG_PREFIX, "RTCMetricsServerDescription: " + JSON.stringify(statCollector.description));
            if (statCollector.description.ingestPoint) {
                let authHeader = null;
                if (statCollector.description.authorization) {
                    authHeader = {
                        Authorization: statCollector.description.authorization
                    }
                }
                statCollector.connection.setUp(statCollector.description.ingestPoint, authHeader);
            }

            await statCollector.updateHeaders();
            await statCollector.updateCompression();
            await statCollector.sendHeaders();
            if (statCollector.description.collect === "on") {
                statCollector.collect(true);
            }
        },
        collect: function(enable) {
            if (enable && statCollector.connection.status === CONNECTION_STATUS.OK) {
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
                statCollector.logger.error(LOG_PREFIX + "-" + statCollector.id, "Can't update WebRTC metrics sending: no parameters passed");
                return;
            }
            statCollector.logger.debug(LOG_PREFIX, "New RTCMetricsServerDescription: " + JSON.stringify(description));
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
                await statCollector.sendHeaders();
                if (statCollector.connection.status !== CONNECTION_STATUS.OK) {
                    return;
                }
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
        updateHeaders: async function(stats = null) {
            let currentHeaders = "";
            let headersChanged = false;
            if (stats === null) {
                stats = await statCollector.mediaConnection.getWebRTCStats();
            }
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
                        statCollector.logger.debug(LOG_PREFIX + "-" + statCollector.id, type + " report: " + JSON.stringify(report));
                        if (contentFilters) {
                            let filtersMatched = true;
                            for (const filter in contentFilters) {
                                statCollector.logger.debug(LOG_PREFIX + "-" + statCollector.id, type + " filter by " + filter + ": " + JSON.stringify(contentFilters[filter]));
                                let filterMatched = false;
                                if (report[filter]) {
                                    for (const value of contentFilters[filter]) {
                                        statCollector.logger.debug(LOG_PREFIX + "-" + statCollector.id, filter + ": " + value + " <>  " + report[filter]);
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
                                currentHeaders = statCollector.addHeaders(currentHeaders, report, metricsString);
                            }
                        } else {
                            currentHeaders = statCollector.addHeaders(currentHeaders, report, metricsString);
                        }
                    });
                } else {
                    statCollector.logger.debug(LOG_PREFIX + "-" + statCollector.id, "No report type found in RTC stats: '" + type + "'");
                }
            });
            if (currentHeaders !== statCollector.headers) {
                headersChanged = true;
                let newMetrics = [];
                currentHeaders.split(",").forEach((header) => {
                    if (statCollector.headers.indexOf(header) === -1) {
                        newMetrics.push(header);
                    }
                });
                if (newMetrics.length) {
                    statCollector.logger.info(LOG_PREFIX + "-" + statCollector.id, "RTC metrics to be collected: " + newMetrics.toString());
                }
                statCollector.headers = currentHeaders;
            }
            return headersChanged;
        },
        addHeaders: function(currentHeaders, report, metricsString) {
            if (metricsString) {
                let metrics = metricsString.split(",");
                metrics.forEach((metric) => {
                    for (const key of Object.keys(report)) {
                        if (metric === key && report[key]) {
                            currentHeaders = util.addFieldToCsvString(currentHeaders, report.type + "." + report.id + "." + metric, ",");
                            break;
                        }
                    }
                });
            }
            return currentHeaders;
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
        updateHttpConnection: function(url, authorization) {
            if (url.startsWith(CONNECTION_TYPE.HTTP) && authorization) {
                statCollector.connection.http.setAuthorization(authorization);
            }
        },
        checkForCompression: async function(compression) {
            try {
                await util.compress(compression, "test", false);
                statCollector.compression = compression;
            } catch (e) {
                statCollector.logger.warn(LOG_PREFIX + "-" + statCollector.id, "Can't compress metrics data using " + compression + ": " + e);
                statCollector.compression = "none";
            }
        },
        sendHeaders: async function() {
            let data = {
                mediaSessionId: statCollector.id,
                compression: statCollector.compression,
                headers: statCollector.headers
            };
            await statCollector.send("webRTCMetricsClientDescription", data);
        },
        send: async function(message, data) {
            if (statCollector.connection.status === CONNECTION_STATUS.INIT || statCollector.connection.status === CONNECTION_STATUS.OK) {
                statCollector.logger.debug(LOG_PREFIX + "-" + statCollector.id, data);
                await statCollector.connection.send(message, data);
                if (statCollector.connection.status !== CONNECTION_STATUS.OK) {
                    statCollector.logger.error(LOG_PREFIX + "-" + statCollector.id, "Error " + statCollector.connection.status + " sending RTC metrics to the server, stop sending");
                    statCollector.stop();
                }
            }
        },
        startTimer: function() {
            if (!statCollector.timer) {
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
        isMetricValid: function(value) {
            return value != null && value !== "" && value !== "undefined" && value !== "null";
        },
        collectMetrics: async function() {
            if (statCollector.timer && !statCollector.timerBusy) {
                // Unfortunately there are no real atomics in JS unless SharedArrayBuffer is used
                // So we guard the timer callback with a dumb boolean
                statCollector.timerBusy = true;
                let stats = await statCollector.mediaConnection.getWebRTCStats();

                statCollector.startNewBatch();

                let metrics = [];
                let lostMetrics = [];
                if (statCollector.headers) {
                    statCollector.headers.split(",").forEach((header) => {
                        let components = header.split(".");
                        let descriptor = {
                            type: components[0],
                            id: components[1],
                            name: components[2]
                        }
                        let value = null;

                        if (stats[descriptor.type]) {
                            for (const report of stats[descriptor.type]) {
                                if (report.id === descriptor.id) {
                                    value = report[descriptor.name];
                                    break;
                                }
                            }
                        }
                        if (statCollector.isMetricValid(value)) {
                            metrics.push(value);
                        } else {
                            lostMetrics.push(descriptor);
                        }
                    });
                } else {
                    statCollector.logger.info(LOG_PREFIX + "-" + statCollector.id, "No RTC metrics to collect, trying to update metrics available list");
                }
                // Metrics list may change if some metrics are added or some metrics are lost #WCS-4627
                let headersUpdated = await statCollector.updateHeaders(stats);
                if (lostMetrics.length) {
                    statCollector.logger.info(LOG_PREFIX + "-" + statCollector.id, "Missing metrics: " + JSON.stringify(lostMetrics));
                    // Send metrics already collected and start a new batch with current metrics array to send them later #WCS-4627
                    await statCollector.sendMetrics();
                    statCollector.startNewBatch(metrics);
                } else if (metrics.length) {
                    statCollector.metricsBatch.push(metrics);
                    statCollector.batchCount--;
                    if (statCollector.batchCount === 0 || headersUpdated) {
                        await statCollector.sendMetrics();
                    }
                }
                // Check if metrics list changed and send a new headers if needed #WCS-4619
                if (headersUpdated) {
                    statCollector.logger.info(LOG_PREFIX + "-" + statCollector.id, "RTC metrics list has changed, sending a new metrics description");
                    await statCollector.sendHeaders();
                }
                statCollector.timerBusy = false;
            }
        },
        sendMetrics: async function() {
            let previous;
            let metricsToSend = [];
            let metricsData;

            for (let i = 0; statCollector.metricsBatch && i < statCollector.metricsBatch.length; i++) {
                let metricsString = "";
                for (let j = 0; j < statCollector.metricsBatch[i].length; j++) {
                    let valueString = valueToString(statCollector.metricsBatch[i][j]);
                    let previousString = "";
                    let delimiter = ";";
                    if (previous) {
                        previousString = valueToString(previous[j]);
                    }
                    if (valueString === previousString) {
                        valueString = "";
                    }
                    metricsString = util.addFieldToCsvString(metricsString, valueString, delimiter);
                    if (j > 0 && metricsString === "") {
                        metricsString = delimiter;
                    }
                }
                previous = statCollector.metricsBatch[i];
                metricsToSend.push(metricsString);
            }
            if (statCollector.compression !== "none") {
                try {
                    metricsData = await util.compress(statCollector.compression, JSON.stringify(metricsToSend), true);
                } catch(e) {
                    statCollector.logger.warn(LOG_PREFIX + "-" + statCollector.id, "Can't send metrics data using" + statCollector.compression + ": " + e);
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
                await statCollector.send("webRTCMetricsBatch", data);
            }
            statCollector.cleanBatch();
        },
        startNewBatch: function(metrics) {
            if (!statCollector.metricsBatch) {
                statCollector.metricsBatch = [];
                if (metrics) {
                    statCollector.metricsBatch.push(metrics);
                }
            }
        },
        cleanBatch: function() {
            if (statCollector.metricsBatch) {
                statCollector.metricsBatch = null;
                statCollector.batchCount = statCollector.description.batchSize;
            }
        }
    }
    return statCollector;
}

// Wrapper to send metrics via Websocket or HTTP POST
const Connection = function(existingConnection = null, maxErrors = MAX_SEND_ERRORS) {
    const connection = {
        type: "",
        websocket: null,
        http: null,
        maxErrors: maxErrors,
        errorsCount: 0,
        status: CONNECTION_STATUS.INIT,
        setUp: function(url, headers = null, existingConnection = null) {
            if (url.startsWith(CONNECTION_TYPE.WEBSOCKET)) {
                connection.type = CONNECTION_TYPE.WEBSOCKET;
                // ToDo: create a new Websocket connection
            } else if (url.startsWith(CONNECTION_TYPE.HTTP)) {
                connection.type = CONNECTION_TYPE.HTTP
                connection.http = HttpConnection(url, headers);
            } else if (existingConnection) {
                connection.type = CONNECTION_TYPE.WEBSOCKET;
                connection.websocket = WebsocketConnection(existingConnection);
            }
            connection.errorsCount = 0;
            connection.status = CONNECTION_STATUS.INIT;
        },
        send: async function(message, data) {
            let code = CONNECTION_STATUS.BAD_REQUEST;
            switch(connection.type) {
                case CONNECTION_TYPE.WEBSOCKET:
                    if (connection.websocket) {
                        code = connection.websocket.send(message, data);
                    }
                    break;
                case CONNECTION_TYPE.HTTP:
                    if (connection.http) {
                        code = await connection.http.send(message, data);
                    }
                    break;
            }
            connection.status = code;
            if (connection.status === CONNECTION_STATUS.OK) {
                connection.errorsCount = 0;
            }
            else {
                if (message === "webRTCMetricsBatch") {
                    connection.errorsCount++;
                    if (connection.errorsCount < connection.maxErrors) {
                        connection.status = CONNECTION_STATUS.OK;
                    }
                }
            }
        }
    };
    connection.setUp("", null, existingConnection);
    return connection;
}

// Websocket connection (using existing one)
const WebsocketConnection = function(wsConnection) {
    const connection = {
        websocket: wsConnection,
        send: function(message, data) {
            let code = CONNECTION_STATUS.BAD_REQUEST;
            if (connection.websocket) {
                if (connection.websocket.readyState === WebSocket.OPEN) {
                    connection.websocket.send(JSON.stringify({
                        message: message,
                        data: [data]
                    }));
                }
                code = CONNECTION_STATUS.OK;
            }
            return code;
        }
    }
    return connection;
}

// HTTP connection using Fetch API
const HttpConnection = function(url, headers) {
    const connection = {
        url: addSlash(url),
        headers: headers,
        setAuthorization(token) {
            this.headers.Authorization = token;
        },
        send: async function(message, data) {
            let code = CONNECTION_STATUS.BAD_REQUEST;
            if (connection.url) {
                try {
                    const httpHeaders = new Headers();
                    httpHeaders.append("Content-Type", "application/json");

                    if (connection.headers) {
                        for (const [header, value] of Object.entries(connection.headers)) {
                            httpHeaders.append(header, value);
                        }
                    }
                    let response = await fetch(connection.url + message,{
                        method: "POST",
                        headers: httpHeaders,
                        mode: "cors",
                        body: JSON.stringify(data)
                    });
                    code = response.status;
                } catch (e) {
                    code = CONNECTION_STATUS.INTERNAL_SERVER_ERROR;
                }
            }
            return code;
        }
    }
    return connection;
}

// Helper function to stringify a value
const valueToString = function(value) {
    let valueString = "undefined";
    if (value) {
        if (typeof value === "object") {
            valueString = JSON.stringify(value);
        } else {
            valueString = value.toString();
        }
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

// Helper function to add slash to endpoint
const addSlash = function(value) {
    let endpoint = value;
    if (endpoint && !endpoint.endsWith("/")) {
        endpoint = endpoint + "/";
    }
    return endpoint;
}

module.exports = {
    StreamStatsCollector: StreamStatsCollector
}
