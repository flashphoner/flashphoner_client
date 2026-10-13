const SERVER_COLOR = "#2563eb";
const CLIENT_COLOR = "#ea580c";
const GRID_COLOR = "#d0d0d0";
const LABEL_COLOR = "#444444";

/**
 * Dependency-free chart for the last few server/client bitrate samples.
 */
export class BitrateChart {
    constructor(canvas, maxSamples = 10) {
        this.canvas = canvas;
        this.context = canvas.getContext("2d");
        this.maxSamples = maxSamples;
        this.serverSamples = [];
        this.clientSamples = [];
        if ("ResizeObserver" in window) {
            this.resizeObserver = new ResizeObserver(() => this.draw());
            this.resizeObserver.observe(canvas);
        } else {
            window.addEventListener("resize", () => this.draw());
        }
        this.clear();
    }

    clear() {
        const now = Date.now();
        this.serverSamples = [{time: now, value: 0}];
        this.clientSamples = [{time: now, value: 0}];
        this.draw();
    }

    update(clientBitrate, serverBitrate) {
        const now = Date.now();
        this.serverSamples.push({time: now, value: finiteNumber(serverBitrate)});
        this.clientSamples.push({time: now, value: finiteNumber(clientBitrate)});
        this.serverSamples = this.serverSamples.slice(-this.maxSamples);
        this.clientSamples = this.clientSamples.slice(-this.maxSamples);
        this.draw();
    }

    draw() {
        const cssWidth = this.canvas.clientWidth;
        const cssHeight = this.canvas.clientHeight;
        if (!cssWidth || !cssHeight) {
            return;
        }
        const scale = window.devicePixelRatio || 1;
        const width = Math.round(cssWidth * scale);
        const height = Math.round(cssHeight * scale);

        if (this.canvas.width !== width || this.canvas.height !== height) {
            this.canvas.width = width;
            this.canvas.height = height;
        }

        const context = this.context;
        context.setTransform(scale, 0, 0, scale, 0, 0);
        context.clearRect(0, 0, cssWidth, cssHeight);

        const bounds = {left: 52, right: 12, top: 28, bottom: 30};
        const plotWidth = Math.max(1, cssWidth - bounds.left - bounds.right);
        const plotHeight = Math.max(1, cssHeight - bounds.top - bounds.bottom);
        const values = [...this.serverSamples, ...this.clientSamples].map((sample) => sample.value);
        const maxValue = Math.max(1, ...values);

        context.font = "12px system-ui, sans-serif";
        context.lineWidth = 1;
        context.setLineDash([]);
        context.strokeStyle = GRID_COLOR;
        context.fillStyle = LABEL_COLOR;

        for (let row = 0; row <= 4; row += 1) {
            const y = bounds.top + (plotHeight * row / 4);
            const value = Math.round(maxValue * (1 - row / 4));
            context.beginPath();
            context.moveTo(bounds.left, y);
            context.lineTo(bounds.left + plotWidth, y);
            context.stroke();
            context.fillText(compactNumber(value), 4, y + 4);
        }

        drawLine(context, this.serverSamples, SERVER_COLOR, bounds, plotWidth, plotHeight, maxValue);
        drawLine(context, this.clientSamples, CLIENT_COLOR, bounds, plotWidth, plotHeight, maxValue);
        drawLegend(context, "Server", SERVER_COLOR, bounds.left, 14);
        drawLegend(context, "Client", CLIENT_COLOR, bounds.left + 90, 14);
    }
}

function drawLine(context, samples, color, bounds, width, height, maxValue) {
    if (samples.length === 0) {
        return;
    }

    context.beginPath();
    context.strokeStyle = color;
    context.lineWidth = 2;
    samples.forEach((sample, index) => {
        const x = bounds.left + width * index / Math.max(1, samples.length - 1);
        const y = bounds.top + height * (1 - sample.value / maxValue);
        if (index === 0) {
            context.moveTo(x, y);
        } else {
            context.lineTo(x, y);
        }
    });
    context.stroke();
}

function drawLegend(context, label, color, x, y) {
    context.strokeStyle = color;
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(x, y - 4);
    context.lineTo(x + 20, y - 4);
    context.stroke();
    context.fillStyle = LABEL_COLOR;
    context.fillText(label, x + 26, y);
}

function finiteNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, number) : 0;
}

function compactNumber(value) {
    if (value >= 1_000_000) {
        return `${(value / 1_000_000).toFixed(1)}m`;
    }
    if (value >= 1_000) {
        return `${(value / 1_000).toFixed(1)}k`;
    }
    return String(value);
}
