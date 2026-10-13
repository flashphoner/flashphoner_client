import {createHelp} from "../../dependencies/js/tooltips.js";

const EMPTY_VALUE = "No data";
const NOT_APPLICABLE = "N/A";
const NUMBER_FORMAT = new Intl.NumberFormat("en-US", {maximumFractionDigits: 20});

// Paired names share a row, not a value: Publisher is outbound and Player is inbound.
const ROWS = {
    Video: [
        {key: "codec", label: "Codec", out: "codec", in: "codec"},
        {key: "codecRate", label: "Codec rate", unit: "Hz", out: "codecRate", in: "codecRate"},
        {key: "width", label: "Width", unit: "px", out: "width", in: "width"},
        {key: "height", label: "Height", unit: "px", out: "height", in: "height"},
        {key: "framesPerSecond", label: "Frame rate", unit: "fps", out: "framesPerSecond", in: "framesPerSecond"},
        {key: "bitrate", label: "Bitrate", unit: "bps", out: "bitrate", in: "bitrate"},
        {key: "bytes", label: "Bytes", unit: "B", out: "bytesSent", in: "bytesReceived"},
        {key: "packets", label: "Packets", out: "packetsSent", in: "packetsReceived"},
        {key: "bytesDiscarded", label: "Bytes discarded", unit: "B", out: "bytesDiscardedOnSend"},
        {key: "packetsDiscarded", label: "Packets discarded", out: "packetsDiscardedOnSend", in: "packetsDiscarded"},
        {key: "packetsLost", label: "Packets lost", in: "packetsLost"},
        {key: "nackCount", label: "NACK count", out: "nackCount", in: "nackCount"},
        {key: "pliCount", label: "PLI count", out: "pliCount", in: "pliCount"},
        {key: "firCount", label: "FIR count", out: "firCount", in: "firCount"},
        {key: "jitterBufferEmittedCount", label: "Jitter buffer emitted count", in: "jitterBufferEmittedCount"},
        {key: "qualityLimitationReason", label: "Quality limitation reason", out: "qualityLimitationReason"},
        {key: "qualityLimitationDurations", label: "Quality limitation duration", unit: "s", out: "qualityLimitationDurations"}
    ],
    Audio: [
        {key: "codec", label: "Codec", out: "codec", in: "codec"},
        {key: "codecRate", label: "Codec rate", unit: "Hz", out: "codecRate", in: "codecRate"},
        {key: "bitrate", label: "Bitrate", unit: "bps", out: "bitrate", in: "bitrate"},
        {key: "bytes", label: "Bytes", unit: "B", out: "bytesSent", in: "bytesReceived"},
        {key: "packets", label: "Packets", out: "packetsSent", in: "packetsReceived"},
        {key: "bytesDiscarded", label: "Bytes discarded", unit: "B", out: "bytesDiscardedOnSend"},
        {key: "packetsDiscarded", label: "Packets discarded", out: "packetsDiscardedOnSend", in: "packetsDiscarded"},
        {key: "packetsLost", label: "Packets lost", in: "packetsLost"},
        {key: "audioLevel", label: "Audio level", in: "audioLevel"},
        {key: "jitterBufferEmittedCount", label: "Jitter buffer emitted count", in: "jitterBufferEmittedCount"},
        {key: "nackCount", label: "NACK count", out: "nackCount", in: "nackCount"}
    ],
    Connection: [
        {key: "quality", label: "Quality", out: "quality", in: "quality"},
        {key: "availableBitrate", label: "Available bitrate", unit: "bps", out: "availableOutgoingBitrate", in: "availableIncomingBitrate", optional: true}
    ]
};

export class StreamStatistics {
    constructor(table) {
        this.groups = new Map();
        for (const [name, definitions] of Object.entries(ROWS)) {
            const body = table.querySelector(`[data-stat-group="${name}"]`);
            const records = definitions.map((definition) => ({...definition, values: {}, row: null, cells: {}}));
            this.groups.set(name, {body, records});
            for (const record of records) {
                if (!record.optional) {
                    this.render(name, record);
                }
            }
        }
    }

    update(containerId, values, replaceOptional = false) {
        const [, direction, name] = /^(out|in)(Video|Audio|Connection)Stat$/.exec(containerId);
        const group = this.groups.get(name);
        if (replaceOptional) {
            for (const record of group.records.filter((record) => record.optional)) {
                record.values[direction] = hasValue(values[record[direction]]) ? values[record[direction]] : undefined;
                this.render(name, record);
            }
        }
        for (const [key, value] of Object.entries(values)) {
            if (!hasValue(value)) {
                continue;
            }
            let record = group.records.find((candidate) => candidate[direction] === key);
            // Connection metrics are directional; do not expose the SDK's unrelated fields.
            if (!record && name === "Connection") {
                continue;
            }
            if (!record) {
                record = group.records.find((candidate) => candidate.key === key && !candidate[direction]);
                if (record) {
                    record[direction] = key;
                } else {
                    record = {key, label: metricLabel(key), dynamic: true, [direction]: key, values: {}, row: null, cells: {}};
                    group.records.push(record);
                }
            }
            record.values[direction] = value;
            this.render(name, record);
        }
    }

    clear(direction) {
        for (const [name, group] of this.groups) {
            for (const record of group.records) {
                record.values[direction] = undefined;
                this.render(name, record);
            }
        }
    }

    render(name, record) {
        if (record.optional && !hasValue(record.values.out) && !hasValue(record.values.in)) {
            record.row?.remove();
            record.row = null;
            record.cells = {};
            return;
        }
        if (!record.row) {
            const row = document.createElement("tr");
            row.dataset.metric = record.key;
            const label = document.createElement("th");
            label.scope = "row";
            const labelContent = document.createElement("span");
            labelContent.className = "statistics-metric-label";
            const nameLabel = document.createElement("span");
            nameLabel.textContent = record.label;
            const {help, popup} = createHelp(`stat-help-${name}-${record.key}`, record.label, "");
            record.helpContent = popup;
            record.helpContent.dataset.floating = "true";
            labelContent.append(nameLabel, help);
            label.append(labelContent);
            row.append(label);
            for (const direction of ["out", "in"]) {
                const cell = document.createElement("td");
                row.append(cell);
                record.cells[direction] = cell;
            }
            this.groups.get(name).body.append(row);
            record.row = row;
        }
        record.helpContent.textContent = metricDetails(record);
        for (const direction of ["out", "in"]) {
            const metric = record[direction];
            if (metric) {
                const containerId = `${direction}${name}Stat`;
                record.cells[direction].id = metric === "bitrate" ? `${containerId}Bitrate` : `${metric}-${containerId}`;
            }
            const cell = record.cells[direction];
            const applicable = Boolean(metric || record.dynamic);
            const value = record.values[direction];
            const available = hasValue(value) && value !== EMPTY_VALUE;
            cell.dataset.state = !applicable ? "not-applicable" : available ? "value" : "missing";
            cell.className = !applicable ? "stat-not-applicable" : available ? "" : "stat-missing";
            cell.textContent = !applicable ? NOT_APPLICABLE : available ? formatValue(value) : EMPTY_VALUE;
            cell.title = !applicable ? "Not applicable to this side" : available ? "" : "No measurement received yet";
        }
    }
}

function hasValue(value) {
    return value !== undefined && value !== null && value !== "" && typeof value !== "object";
}

function metricLabel(key) {
    const label = key.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
    return label.replace(/^./, (letter) => letter.toUpperCase());
}

function formatValue(value) {
    return typeof value === "number" && Number.isFinite(value) ? NUMBER_FORMAT.format(value) : String(value);
}

function metricDetails(record) {
    const details = [["out", "Publisher"], ["in", "Player"]].map(([direction, side]) => {
        const metric = record[direction];
        const stream = direction === "out" ? "outgoing" : "incoming";
        const meaning = metric ? (metric === record.key ? `${record.label} for the ${stream} stream` : metricLabel(metric))
            : record.dynamic ? "Not reported yet" : "Not applicable to this side";
        return `${side}: ${meaning}.`;
    });
    if (record.unit) {
        const units = {B: "bytes (B)", bps: "bits per second (bps)", Hz: "hertz (Hz)",
            px: "pixels (px)", fps: "frames per second (fps)", s: "seconds (s)"};
        details.push(`Unit: ${units[record.unit] ?? record.unit}.`);
    }
    return details.join("\n");
}
