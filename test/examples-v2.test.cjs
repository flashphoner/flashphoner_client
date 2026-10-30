const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "../examples/v2");
const shared = "dependencies/js/";
const manager = "streaming/media_devices_manager/media-device-manager.js";

function registeredBuildTasks() {
    const tasks = new Map();
    require("../Gruntfile.js")({
        file: {readJSON: () => require("../package.json")},
        initConfig() {},
        loadNpmTasks() {},
        registerTask(name, description, task) { tasks.set(name, task ?? description); }
    });
    return tasks;
}

test("example checks remain manual and are not registered in the build pipeline", () => {
    const tasks = registeredBuildTasks();
    assert.equal(tasks.has("test-examples"), false);
    for (const name of ["build", "release", "webrtc", "with-flash"]) {
        const steps = tasks.get(name);
        assert.equal(steps.includes("test-examples"), false, name);
    }
    assert.deepEqual(tasks.get("release"), ["clean:release", "build", "copy"]);
});

test("the manual npm runner enforces Node support and preserves exit codes", async () => {
    assert.equal(require("../package.json").scripts["test:examples"], "node test/run-examples.cjs");
    const source = await fs.readFile(path.join(__dirname, "run-examples.cjs"), "utf8");
    for (const [version, childResult, expectedExit] of [
        ["18.20.0", null, 1], ["20.19.4", {status: 0}, 0],
        ["22.0.0", {status: 1}, 1], ["20.19.4", {status: null, error: new Error("spawn failed")}, 1]
    ]) {
        let called = false;
        let exitCode;
        const messages = [];
        const stopped = {};
        try {
            vm.runInNewContext(source, {
                process: {versions: {node: version}, execPath: "/test/node", exit(code) { exitCode = code; throw stopped; }},
                console: {error(...args) { messages.push(args.join(" ")); }},
                require: Object.assign(() => ({spawnSync(cmd, args, options) {
                    called = true;
                    assert.equal(cmd, "/test/node");
                    assert.deepEqual([...args], ["--experimental-vm-modules", "--test",
                        "/test/examples-v2.test.cjs", "/test/streaming-shared.test.cjs",
                        "/test/streaming-two-way.test.cjs", "/test/streaming-playback.test.cjs",
                        "/test/streaming-publishing.test.cjs", "/test/streaming-assets.test.cjs"]);
                    assert.equal(options.stdio, "inherit");
                    return childResult;
                }}), {resolve: (filename) => "/test/" + path.basename(filename)})
            });
        } catch (error) {
            if (error !== stopped) throw error;
        }
        assert.equal(exitCode, expectedExit);
        assert.equal(called, version !== "18.20.0");
        if (!called) assert.match(messages[0], /require Node.js 20 or later/);
        if (childResult?.error) assert.match(messages[0], /Failed to start example tests/);
    }
});

function statisticsDOM() {
    function element() {
        return {
            dataset: {}, children: [], textContent: "", attributes: {},
            setAttribute(name, value) { this.attributes[name] = value; },
            append(...nodes) {
                for (const node of nodes) {
                    node.parentElement = this;
                    this.children.push(node);
                }
            },
            remove() {
                this.parentElement.children = this.parentElement.children.filter((child) => child !== this);
            }
        };
    }
    const bodies = Object.fromEntries(["Video", "Audio", "Connection"].map((name) => [name, element()]));
    return {
        document: {createElement: element},
        table: {querySelector: (selector) => bodies[selector.match(/"(\w+)"/)[1]]},
        rows: (name, metric) => bodies[name].children.filter((row) => row.dataset.metric === metric),
        cell(name, metric, direction) {
            return this.rows(name, metric)[0]?.children[direction === "out" ? 1 : 2];
        },
        details(name, metric) {
            return this.rows(name, metric)[0].children[0].children[0].children[1].children[1].textContent;
        }
    };
}

test("statistics merge matching and sent/received metrics without adding their values", async () => {
    const dom = statisticsDOM();
    const {StreamStatistics} = await loadModule("streaming/media_devices_manager/stream-statistics.js", dom);
    const statistics = new StreamStatistics(dom.table);
    statistics.update("outVideoStat", {bytesSent: 120, packetsSent: 12, codec: "H264"});
    statistics.update("inVideoStat", {bytesReceived: 80, packetsReceived: 8, codec: "VP8", packetsLost: 0, packetsDiscarded: 2});
    for (const metric of ["bytes", "packets", "codec"]) {
        assert.equal(dom.rows("Video", metric).length, 1);
    }
    assert.equal(dom.cell("Video", "bytes", "out").textContent, "120");
    assert.equal(dom.cell("Video", "bytes", "in").textContent, "80");
    assert.equal(dom.cell("Video", "bytes", "out").id, "bytesSent-outVideoStat");
    assert.equal(dom.cell("Video", "bytes", "in").id, "bytesReceived-inVideoStat");
    assert.equal(dom.cell("Video", "codec", "out").textContent, "H264");
    assert.equal(dom.cell("Video", "codec", "in").textContent, "VP8");
    assert.equal(dom.cell("Video", "packetsLost", "in").textContent, "0");
    assert.equal(dom.cell("Video", "packetsLost", "out").textContent, "N/A");
    assert.equal(dom.cell("Video", "packetsLost", "out").dataset.state, "not-applicable");
    assert.equal(dom.cell("Video", "codecRate", "out").textContent, "No data");
    assert.equal(dom.cell("Video", "codecRate", "out").dataset.state, "missing");
    assert.equal(dom.rows("Video", "bytes")[0].children[0].children[0].children[0].textContent, "Bytes");
    assert.equal(dom.rows("Video", "bytes")[0].children.length, 3);
    assert.match(dom.details("Video", "bytes"), /Publisher: Bytes sent/i);
    assert.match(dom.details("Video", "bytes"), /Player: Bytes received/i);
    assert.match(dom.details("Video", "bytes"), /Unit: bytes \(B\)/);
    assert.match(dom.details("Video", "packetsLost"), /Publisher: Not applicable to this side/);
    assert.equal(dom.cell("Video", "packetsDiscarded", "in").textContent, "2");
    statistics.clear("out");
    assert.equal(dom.cell("Video", "bytes", "out").textContent, "No data");
    assert.equal(dom.cell("Video", "bytes", "in").textContent, "80");
});

test("optional connection statistics hide absent directions and clear stale values independently", async () => {
    const dom = statisticsDOM();
    const {StreamStatistics} = await loadModule("streaming/media_devices_manager/stream-statistics.js", dom);
    const statistics = new StreamStatistics(dom.table);
    assert.equal(dom.rows("Connection", "availableBitrate").length, 0);
    statistics.update("outConnectionStat", {availableOutgoingBitrate: 0, availableIncomingBitrate: 99, unrelated: 5}, true);
    assert.equal(dom.cell("Connection", "availableBitrate", "out").textContent, "0");
    assert.equal(dom.cell("Connection", "availableBitrate", "in").textContent, "No data");
    assert.equal(dom.rows("Connection", "unrelated").length, 0);
    statistics.update("inConnectionStat", {availableIncomingBitrate: 80}, true);
    statistics.update("outConnectionStat", {}, true);
    assert.equal(dom.cell("Connection", "availableBitrate", "out").textContent, "No data");
    assert.equal(dom.cell("Connection", "availableBitrate", "in").textContent, "80");
    statistics.clear("out");
    assert.equal(dom.rows("Connection", "availableBitrate").length, 1);
    statistics.clear("in");
    assert.equal(dom.rows("Connection", "availableBitrate").length, 0);
    for (const value of [null, "", undefined, {}]) {
        statistics.update("outConnectionStat", {availableOutgoingBitrate: value}, true);
        assert.equal(dom.rows("Connection", "availableBitrate").length, 0);
    }
});

test("unknown scalar statistics remain visible and nested statistics are ignored", async () => {
    const dom = statisticsDOM();
    const {StreamStatistics} = await loadModule("streaming/media_devices_manager/stream-statistics.js", dom);
    const statistics = new StreamStatistics(dom.table);
    statistics.update("outAudioStat", {newMetric: 0, nested: {}, absent: null});
    assert.equal(dom.cell("Audio", "newMetric", "in").textContent, "No data");
    assert.match(dom.details("Audio", "newMetric"), /Player: Not reported yet/);
    statistics.update("inAudioStat", {newMetric: 7});
    assert.equal(dom.rows("Audio", "newMetric").length, 1);
    assert.equal(dom.cell("Audio", "newMetric", "out").textContent, "0");
    assert.equal(dom.cell("Audio", "newMetric", "in").textContent, "7");
    assert.match(dom.details("Audio", "newMetric"), /Player: New metric/i);
    assert.equal(dom.rows("Audio", "nested").length, 0);
    assert.equal(dom.rows("Audio", "absent").length, 0);
    statistics.update("outAudioStat", {audioLevel: 0.1});
    statistics.update("inAudioStat", {audioLevel: 0.2});
    assert.equal(dom.rows("Audio", "audioLevel").length, 1);
    assert.equal(dom.cell("Audio", "audioLevel", "out").textContent, "0.1");
    assert.equal(dom.cell("Audio", "audioLevel", "in").textContent, "0.2");
    assert.equal(dom.cell("Audio", "audioLevel", "out").id, "audioLevel-outAudioStat");
    assert.equal(dom.cell("Audio", "audioLevel", "out").dataset.state, "value");
});

test("statistics keep zero, missing, inapplicable, and formatted numeric values distinct after reset", async () => {
    const dom = statisticsDOM();
    const {StreamStatistics} = await loadModule("streaming/media_devices_manager/stream-statistics.js", dom);
    const statistics = new StreamStatistics(dom.table);
    statistics.update("outVideoStat", {bytesSent: 1264500, codecRate: 90000, bitrate: 0});
    statistics.update("inAudioStat", {audioLevel: "0.000001"});
    assert.equal(dom.cell("Video", "bytes", "out").textContent, "1,264,500");
    assert.equal(dom.cell("Video", "codecRate", "out").textContent, "90,000");
    assert.equal(dom.cell("Video", "bitrate", "out").textContent, "0");
    assert.equal(dom.cell("Video", "bitrate", "out").dataset.state, "value");
    assert.equal(dom.cell("Audio", "audioLevel", "in").textContent, "0.000001");
    statistics.update("outVideoStat", {bitrate: "No data"});
    assert.equal(dom.cell("Video", "bitrate", "out").dataset.state, "missing");
    statistics.clear("out");
    assert.equal(dom.cell("Video", "bytes", "out").textContent, "No data");
    assert.equal(dom.cell("Video", "packetsLost", "out").textContent, "N/A");
    assert.equal(dom.cell("Audio", "audioLevel", "in").textContent, "0.000001");
});

test("Media Devices attaches captions to video frames and keeps statistics compact", async () => {
    const html = await fs.readFile(path.join(root, "streaming/media_devices_manager/media_device_manager.html"), "utf8");
    for (const [name, id] of [["Publisher", "publishStatus"], ["Player", "playStatus"]]) {
        assert.match(html, new RegExp('class="preview-frame">\\s*<h2 class="preview-caption">' + name
            + '</h2>\\s*<div class="fp-remoteVideo">'));
        assert.equal(html.split('id="' + id + '"').length - 1, 1);
    }
    assert.match(html, /<th scope="col">Publisher<\/th>/);
    assert.match(html, /<caption class="visually-hidden">Stream statistics: publisher and player<\/caption>/);
    assert.match(html, /<th scope="col">Player<\/th>/);
    assert.doesNotMatch(html, /<th scope="col">Unit<\/th>/);
    assert.match(html, /No data<\/span>: no measurement yet/);
    assert.match(html, /N\/A<\/span>: not applicable to this side/);
    const css = await fs.readFile(path.join(root, "dependencies/css/examples.css"), "utf8");
    assert.match(css, /\.preview-column\s*\{\s*min-width:\s*0;/);
});

test("help popovers support click, focus, pointer re-entry, outside click, and Escape", async () => {
    function eventNode() {
        return {handlers: {}, dataset: {}, attributes: {"aria-expanded": "false"},
            addEventListener(name, handler) { this.handlers[name] = handler; },
            setAttribute(name, value) { this.attributes[name] = value; },
            getAttribute(name) { return this.attributes[name]; }
        };
    }
    const triggers = [eventNode(), eventNode()];
    function attach(trigger) {
        const help = eventNode();
        help.querySelector = (selector) => selector === ".help-marker" ? trigger : null;
        trigger.parentElement = help;
        trigger.closest = (selector) => selector === ".help-marker" ? trigger : selector === ".help" ? help : null;
        return trigger;
    }
    triggers.forEach(attach);
    const root = {...eventNode(), querySelectorAll: () => triggers};
    const {bindTooltips} = await loadModule(shared + "tooltips.js");
    bindTooltips(root);
    const click = (trigger) => root.handlers.click({target: trigger, preventDefault() {}, stopPropagation() {}});
    click(triggers[0]);
    assert.equal(triggers[0].getAttribute("aria-expanded"), "true");
    click(triggers[1]);
    assert.equal(triggers[0].getAttribute("aria-expanded"), "false");
    assert.equal(triggers[1].getAttribute("aria-expanded"), "true");
    root.handlers.keydown({key: "Escape"});
    assert.equal(triggers[1].getAttribute("aria-expanded"), "false");
    assert.equal(triggers[1].parentElement.dataset.dismissed, "true");
    root.handlers.focusin({target: triggers[1]});
    assert.equal(triggers[1].parentElement.dataset.dismissed, undefined);
    root.handlers.click({target: {closest: () => null}});
    assert.equal(triggers[1].parentElement.dataset.dismissed, "true");
    root.handlers.pointerover({target: triggers[1]});
    assert.equal(triggers[1].parentElement.dataset.dismissed, undefined);
    click(triggers[1]);
    click(triggers[1]);
    assert.equal(triggers[1].getAttribute("aria-expanded"), "false");
    assert.equal(triggers[1].parentElement.dataset.dismissed, "true");
    const lateTrigger = attach(eventNode());
    triggers.push(lateTrigger);
    click(lateTrigger);
    assert.equal(lateTrigger.getAttribute("aria-expanded"), "true");
    root.handlers.scroll();
    assert.equal(lateTrigger.getAttribute("aria-expanded"), "false");
});

test("help creation exposes the popup by name rather than child position", async () => {
    const dom = statisticsDOM();
    const {createHelp} = await loadModule(shared + "tooltips.js", dom);
    const {help, popup} = createHelp("help-metric", "Metric", "Explanation");
    assert.equal(popup.parentElement, help);
    assert.equal(popup.id, "help-metric");
    assert.equal(popup.textContent, "Explanation");
    assert.equal(popup.attributes.role, "tooltip");
});

test("hidden charts retain bounded samples without growing the bitmap on HiDPI displays", async () => {
    let observe;
    let draws = 0;
    const context = new Proxy({}, {get: () => () => { draws += 1; }});
    const canvas = {width: 400, height: 300, clientWidth: 0, clientHeight: 0, getContext: () => context};
    const {BitrateChart} = await loadModule("streaming/media_devices_manager/bitrate-chart.js", {
        window: {devicePixelRatio: 2, ResizeObserver: true},
        ResizeObserver: class { constructor(callback) { observe = callback; } observe() {} }
    });
    const chart = new BitrateChart(canvas);
    for (let i = 0; i < 30; i += 1) {
        chart.update(i, i * 2);
    }
    assert.equal(draws, 0);
    assert.equal(canvas.width, 400);
    assert.equal(canvas.height, 300);
    assert.equal(chart.clientSamples.length, 10);
    assert.equal(chart.clientSamples.at(-1).value, 29);
    canvas.clientWidth = 400;
    canvas.clientHeight = 240;
    observe();
    assert.ok(draws > 0);
    assert.equal(canvas.width, 800);
    assert.equal(canvas.height, 480);
    chart.draw();
    assert.equal(canvas.width, 800);
    canvas.clientWidth = 0;
    canvas.clientHeight = 0;
    chart.clear();
    chart.update(99, 100);
    assert.equal(canvas.width, 800);
    assert.equal(canvas.height, 480);
});

test("bitrate series and legends use matching colors and equal solid strokes without markers", async () => {
    let dash = [];
    const strokes = [];
    const context = {
        setTransform() {}, clearRect() {}, fillText() {}, moveTo() {}, lineTo() {}, fill() {},
        beginPath() {},
        arc() { assert.fail("Bitrate series must not use markers"); },
        setLineDash(value) { dash = Array.from(value); },
        stroke() { strokes.push({color: this.strokeStyle, width: this.lineWidth, dash: [...dash]}); }
    };
    const canvas = {width: 400, height: 240, clientWidth: 400, clientHeight: 240, getContext: () => context};
    const {BitrateChart} = await loadModule("streaming/media_devices_manager/bitrate-chart.js", {
        window: {devicePixelRatio: 1, addEventListener() {}}
    });
    const chart = new BitrateChart(canvas);
    for (const values of [[300_000, 800_000], [800_000, 801_000], [800_000, 800_000]]) {
        strokes.length = 0;
        chart.update(...values);
        assert.equal(strokes.length, 9);
        for (const gridLine of strokes.slice(0, 5)) {
            assert.deepEqual(gridLine, {color: "#d0d0d0", width: 1, dash: []});
        }
        assert.deepEqual(strokes[5], {color: "#2563eb", width: 2, dash: []});
        assert.deepEqual(strokes[6], {color: "#ea580c", width: 2, dash: []});
        assert.deepEqual(strokes[7], {color: strokes[5].color, width: 3, dash: []});
        assert.deepEqual(strokes[8], {color: strokes[6].color, width: 3, dash: []});
    }
});

async function loadModule(relativePath, globals = {}, extraSource = "") {
    const context = vm.createContext({window: {}, ...globals});
    const modules = new Map();
    async function load(filename) {
        if (!modules.has(filename)) {
            const source = await fs.readFile(filename, "utf8");
            modules.set(filename, new vm.SourceTextModule(
                source + (filename === path.join(root, relativePath) ? extraSource : ""),
                {context, identifier: filename}
            ));
        }
        return modules.get(filename);
    }
    const module = await load(path.join(root, relativePath));
    await module.link((specifier, importer) => load(path.resolve(path.dirname(importer.identifier), specifier)));
    await module.evaluate();
    return module.namespace;
}

test("server URLs select all protocol defaults when configuration is absent", async () => {
    for (const [protocol, expected] of [
        ["http:", ["ws://wcs.example:8080", "http://wcs.example:8082", "http://wcs.example:8081", "http://wcs.example:9091"]],
        ["https:", ["wss://wcs.example:8443", "https://wcs.example:8445", "https://wcs.example:8444", "https://wcs.example:8888"]]
    ]) {
        const urls = await loadModule(shared + "server-url.js", {
            window: {location: {protocol, hostname: "wcs.example"}}
        });
        assert.deepEqual([urls.getWebsocketUrl(), urls.getHLSUrl(), urls.getRestUrl(), urls.getAdminUrl()], expected);
    }
});

test("embedded examples use the selected WCS endpoint independently of the panel address", async () => {
    for (const [protocol, endpoint] of [
        ["http:", "wss://wcs.example:9443"],
        ["http:", "ws://192.0.2.10:9080"],
        ["https:", "wss://192.0.2.11:8443/"]
    ]) {
        const window = {location: {protocol, hostname: "localhost"}, WCS_SERVER_URL: endpoint};
        const {getWebsocketUrl} = await loadModule(shared + "server-url.js", {URL, window});
        assert.equal(getWebsocketUrl(), endpoint.replace(/\/$/, ""));
        window.WCS_SERVER_URL = "wss://other-wcs.example:10443";
        assert.equal(getWebsocketUrl(), "wss://other-wcs.example:10443");
    }
});

test("explicit server arguments override the embedded WCS without changing other URL helpers", async () => {
    const ports = {wss: 9443};
    const urls = await loadModule(shared + "server-url.js", {URL,
        window: {location: {protocol: "https:", hostname: "panel.example"},
            WCS_SERVER_URL: "wss://wcs.example:8443"}, SERVER_PORTS: ports
    });
    assert.equal(urls.getWebsocketUrl("other.example"), "wss://other.example:9443");
    assert.equal(urls.getWebsocketUrl(undefined, 10443), "wss://panel.example:10443");
    assert.deepEqual([urls.getHLSUrl(), urls.getRestUrl(), urls.getAdminUrl()],
        ["https://panel.example:8445", "https://panel.example:8444", "https://panel.example:8888"]);
});

test("invalid embedded WCS endpoints fail instead of dialing the panel host", async () => {
    for (const endpoint of [null, 8080, {}, "", "localhost:8080", "https://wcs.example:8443",
        "wss://user:password@wcs.example:8443", "wss://wcs.example:8443/stream",
        "wss://wcs.example:8443?token=value", "wss://wcs.example:8443#fragment"]) {
        const {getWebsocketUrl} = await loadModule(shared + "server-url.js", {URL,
            window: {location: {protocol: "http:", hostname: "localhost"}, WCS_SERVER_URL: endpoint}
        });
        assert.throws(() => getWebsocketUrl(), undefined, String(endpoint));
    }
});

test("combined streaming addresses preserve decoded stream names", async () => {
    const {readStreamAddress} = await loadModule(shared + "server-url.js", {URL});
    for (const [value, server, name] of [
        ["ws://localhost:8080/s 3", "ws://localhost:8080", "s 3"],
        ["wss://wcs.example:8443/s%203", "wss://wcs.example:8443", "s 3"],
        ["wss://wcs.example:8443/поток", "wss://wcs.example:8443", "поток"],
        ["wss://wcs.example:8443/%D0%BF%D0%BE%D1%82%D0%BE%D0%BA", "wss://wcs.example:8443", "поток"],
        [" ws://[::1]:8080/test ", "ws://[::1]:8080", "test"],
        ["ws://localhost:8080/name%23%3F%26", "ws://localhost:8080", "name#?&"],
        ["ws://localhost:8080/100%25", "ws://localhost:8080", "100%"],
        ["ws://localhost:8080/s%2520", "ws://localhost:8080", "s%20"],
        ["ws://localhost:8080/s%252F", "ws://localhost:8080", "s%2F"]
    ]) {
        const result = readStreamAddress(value);
        assert.ok(result, value);
        assert.equal(result.server, server, value);
        assert.equal(result.name, name, value);
    }
});

test("combined streaming addresses reject invalid URLs, escaped paths and malformed escapes", async () => {
    const {readStreamAddress} = await loadModule(shared + "server-url.js", {URL});
    for (const value of [
        "", "localhost:8080/stream", "https://localhost:8080/stream",
        "ws://localhost:8080", "ws://localhost:8080/", "ws://localhost:8080/a/b",
        "ws://localhost:8080/a%2Fb", "ws://localhost:8080/a?x=1", "ws://localhost:8080/a#fragment",
        "ws://user:password@localhost:8080/a", "ws://localhost:bad/a",
        "ws://localhost:8080/100%", "ws://localhost:8080/%ZZ", "ws://localhost:8080/%D0"
    ]) {
        assert.equal(readStreamAddress(value), null, value);
    }
});

test("custom classic-script SERVER_PORTS binding is used without mutation", async () => {
    const source = await fs.readFile(path.join(root, shared + "server-url.js"), "utf8");
    for (const [protocol, expected] of [
        ["http:", ["ws://wcs.example:9080", "http://wcs.example:9082", "http://wcs.example:9081", "http://wcs.example:9191"]],
        ["https:", ["wss://wcs.example:9443", "https://wcs.example:9445", "https://wcs.example:9444", "https://wcs.example:9888"]]
    ]) {
        const context = vm.createContext({window: {location: {protocol, hostname: "wcs.example"}}});
        vm.runInContext(`const SERVER_PORTS = Object.freeze({
            http: 9081, https: 9444, ws: 9080, wss: 9443,
            hls: Object.freeze({http: 9082, https: 9445}),
            legacy: Object.freeze({http: 9191, https: 9888})
        });`, context);
        const module = new vm.SourceTextModule(source, {context});
        await module.link(() => {});
        await module.evaluate();
        const urls = module.namespace;
        assert.deepEqual([urls.getWebsocketUrl(), urls.getHLSUrl(), urls.getRestUrl(), urls.getAdminUrl()], expected);
        assert.equal(vm.runInContext("window.SERVER_PORTS", context), undefined);
        assert.equal(vm.runInContext("SERVER_PORTS.wss", context), 9443);
        assert.equal(vm.runInContext("SERVER_PORTS.hls.https", context), 9445);
    }
});

test("partial configuration falls back without adding missing properties", async () => {
    const ports = Object.freeze({ws: 9080});
    const {getWebsocketUrl} = await loadModule(shared + "server-url.js", {
        window: {location: {protocol: "https:", hostname: "wcs.example"}, SERVER_PORTS: ports},
        SERVER_PORTS: ports
    });
    assert.equal(getWebsocketUrl(), "wss://wcs.example:8443");
    assert.deepEqual(ports, {ws: 9080});
    assert.equal(getWebsocketUrl("other.example", 10443), "wss://other.example:10443");
    assert.equal(getWebsocketUrl("other.example", undefined, {wss: 9443}), "wss://other.example:9443");
});

test("shared URL helper also reads a window.SERVER_PORTS configuration", async () => {
    const window = {location: {protocol: "https:", hostname: "wcs.example"}, SERVER_PORTS: {wss: 9443}};
    // Browser global-object properties are also global bindings.
    const {getWebsocketUrl} = await loadModule(shared + "server-url.js", {...window, window});
    assert.equal(getWebsocketUrl(), "wss://wcs.example:9443");
});

test("partial nested ports receive defaults without sharing or mutating configuration", async () => {
    const {getPortsConfig} = await loadModule(shared + "server-url.js");
    const defaults = {
        http: 8081, https: 8444, legacy: {http: 9091, https: 8888},
        ws: 8080, wss: 8443, hls: {http: 8082, https: 8445}
    };
    for (const absent of [undefined, null, {}]) {
        assert.deepEqual(JSON.parse(JSON.stringify(getPortsConfig(absent))), defaults);
    }
    const ports = Object.freeze({
        ws: 9080, https: 9444,
        hls: Object.freeze({http: 9082}),
        legacy: Object.freeze({https: 9888})
    });
    const original = JSON.stringify(ports);
    const filled = getPortsConfig(ports);
    assert.deepEqual(JSON.parse(JSON.stringify(filled)), {
        http: 8081, https: 9444, legacy: {http: 9091, https: 9888},
        ws: 9080, wss: 8443, hls: {http: 9082, https: 8445}
    });
    filled.hls.http = 1;
    filled.legacy.https = 2;
    assert.equal(getPortsConfig(ports).hls.http, 9082);
    assert.equal(getPortsConfig(ports).legacy.https, 9888);
    assert.equal(JSON.stringify(ports), original);
    const firstDefaults = getPortsConfig();
    firstDefaults.hls.https = 3;
    firstDefaults.legacy.http = 4;
    assert.deepEqual(JSON.parse(JSON.stringify(getPortsConfig())), defaults);
});

test("HLS and admin URLs fill partial nested ports for each page protocol", async () => {
    const ports = Object.freeze({hls: Object.freeze({http: 9082}), legacy: Object.freeze({https: 9888})});
    for (const [protocol, expected] of [
        ["http:", ["http://wcs.example:9082", "http://wcs.example:9091"]],
        ["https:", ["https://wcs.example:8445", "https://wcs.example:9888"]]
    ]) {
        const urls = await loadModule(shared + "server-url.js", {
            window: {location: {protocol, hostname: "wcs.example"}}, SERVER_PORTS: ports
        });
        assert.deepEqual([urls.getHLSUrl(), urls.getAdminUrl()], expected);
    }
    assert.deepEqual(ports, {hls: {http: 9082}, legacy: {https: 9888}});
});

test("all URL helpers prefer explicit hostname, port, and configuration overrides", async () => {
    const ports = Object.freeze({
        http: 9081, https: 9444, ws: 9080, wss: 9443,
        hls: Object.freeze({http: 9082, https: 9445}),
        legacy: Object.freeze({http: 9191, https: 9888})
    });
    for (const pageProtocol of ["http:", "https:"]) {
        const urls = await loadModule(shared + "server-url.js", {
            window: {location: {protocol: pageProtocol, hostname: "wcs.example"}}, SERVER_PORTS: {}
        });
        for (const [name, group] of [["getWebsocketUrl", ports], ["getHLSUrl", ports.hls], ["getRestUrl", ports], ["getAdminUrl", ports.legacy]]) {
            const webProtocol = pageProtocol === "http:" ? "http" : "https";
            const protocol = name === "getWebsocketUrl" ? (pageProtocol === "http:" ? "ws" : "wss") : webProtocol;
            assert.equal(urls[name]("other.example", undefined, ports), `${protocol}://other.example:${group[protocol]}`);
            assert.equal(urls[name](undefined, 10443, ports), `${protocol}://wcs.example:10443`);
            assert.equal(urls[name]("other.example", 10443, ports), `${protocol}://other.example:10443`);
        }
    }
});

test("shared port configuration and URLs match the original example helpers", async () => {
    const source = await fs.readFile(path.join(root, "../demo/dependencies/js/utils.js"), "utf8");
    const portsSource = await fs.readFile(path.join(root, "dependencies/ports.js"), "utf8");
    const configured = vm.createContext({});
    vm.runInContext(portsSource, configured);
    const configuredPorts = JSON.parse(vm.runInContext("JSON.stringify(SERVER_PORTS)", configured));
    const {getPortsConfig} = await loadModule(shared + "server-url.js");
    assert.deepEqual(configuredPorts, JSON.parse(JSON.stringify(getPortsConfig())));
    for (const protocol of ["http:", "https:"]) {
        for (const ports of [undefined, {}, configuredPorts, {hls: {http: 9082}, legacy: {https: 9888}, ws: 9080}]) {
            const window = {location: {protocol, hostname: "wcs.example"}};
            const legacy = vm.createContext({window, console: {log() {}},
                ...(ports === undefined ? {} : {SERVER_PORTS: JSON.parse(JSON.stringify(ports))})});
            vm.runInContext(source, legacy);
            const urls = await loadModule(shared + "server-url.js", {window, SERVER_PORTS: ports});
            for (const name of ["getWebsocketUrl", "getHLSUrl", "getRestUrl", "getAdminUrl"]) {
                assert.equal(urls[name](), legacy[name](), `${protocol} ${name}`);
            }
            assert.deepEqual(JSON.parse(JSON.stringify(urls.getPortsConfig())),
                JSON.parse(JSON.stringify(legacy.getPortsConfig())));
        }
    }
});

function mediaElement(width, height, tagName = "VIDEO", frameWidth = 400, frameHeight = 300) {
    const frame = {clientWidth: frameWidth, clientHeight: frameHeight};
    const display = {parentElement: frame, style: {}};
    return {tagName, videoWidth: width, videoHeight: height, width, height, parentElement: display};
}

test("video fits landscape, portrait, and matching-ratio frames", async () => {
    const {resizeVideo} = await loadModule(shared + "media.js");
    for (const [width, height, expected] of [
        [1920, 1080, {width: "400px", height: "225px", margin: "37px auto"}],
        [1080, 1920, {width: "168px", height: "300px", margin: "0px auto"}],
        [640, 480, {width: "400px", height: "300px", margin: "0px auto"}]
    ]) {
        const video = mediaElement(width, height);
        resizeVideo(video);
        assert.deepEqual(video.parentElement.style, expected);
    }
});

test("canvas intrinsic dimensions and explicit dimensions are supported", async () => {
    const {resizeVideo} = await loadModule(shared + "media.js");
    const canvas = mediaElement(640, 480, "CANVAS");
    delete canvas.videoWidth;
    delete canvas.videoHeight;
    resizeVideo(canvas);
    assert.equal(canvas.parentElement.style.height, "300px");
    const video = mediaElement(0, 0);
    resizeVideo(video, 1920, 1080);
    assert.equal(video.parentElement.style.height, "225px");
});

test("detached media and zero-size media or frames do not produce invalid styles", async () => {
    const {resizeVideo} = await loadModule(shared + "media.js");
    assert.doesNotThrow(() => resizeVideo({parentElement: null}));
    assert.doesNotThrow(() => resizeVideo({parentElement: {parentElement: null}}));
    for (const video of [mediaElement(0, 480), mediaElement(640, 0), mediaElement(640, 480, "VIDEO", 0, 300),
        mediaElement(640, 480, "VIDEO", 400, 0)]) {
        resizeVideo(video);
        assert.deepEqual(video.parentElement.style, {});
    }
});

function observableVideo(width = 640, height = 480) {
    const video = mediaElement(width, height);
    video.handlers = new Map();
    video.addEventListener = (name, handler) => video.handlers.set(name, handler);
    video.removeEventListener = (name, handler) => {
        if (video.handlers.get(name) === handler) video.handlers.delete(name);
    };
    return video;
}

test("video observes its frame without treating layout changes as media resolution changes", async () => {
    const observers = [];
    class ResizeObserver {
        constructor(callback) { this.callback = callback; this.disconnects = 0; observers.push(this); }
        observe(frame) { this.frame = frame; }
        disconnect() { this.disconnects += 1; }
    }
    const {observeVideoSize} = await loadModule(shared + "media.js", {window: {ResizeObserver}});
    const video = observableVideo();
    const display = video.parentElement;
    const frame = display.parentElement;
    let mediaUpdates = 0;
    const stop = observeVideoSize(video, () => mediaUpdates += 1);
    assert.equal(observers[0].frame, frame);
    assert.equal(display.style.width, "400px");
    assert.equal(mediaUpdates, 1);
    Object.assign(frame, {clientWidth: 328, clientHeight: 246});
    observers[0].callback();
    assert.equal(display.style.width, "328px");
    assert.equal(display.style.height, "246px");
    assert.equal(mediaUpdates, 1);
    Object.assign(video, {videoWidth: 1280, videoHeight: 720});
    video.handlers.get("resize")();
    assert.equal(display.style.height, "184px");
    assert.equal(mediaUpdates, 2);
    const lateResize = video.handlers.get("resize");
    stop();
    stop();
    assert.equal(observers[0].disconnects, 1);
    assert.equal(video.handlers.size, 0);
    frame.clientWidth = 200;
    observers[0].callback();
    lateResize();
    assert.equal(display.style.width, "328px");
    assert.equal(mediaUpdates, 2);
});

test("video fits after metadata arrives and after a hidden frame becomes visible", async () => {
    let observer;
    class ResizeObserver {
        constructor(callback) { this.callback = callback; observer = this; }
        observe() {}
        disconnect() {}
    }
    const {observeVideoSize} = await loadModule(shared + "media.js", {window: {ResizeObserver}});
    const video = observableVideo(0, 0);
    const display = video.parentElement;
    const frame = display.parentElement;
    let updates = 0;
    const stop = observeVideoSize(video, () => updates += 1);
    assert.deepEqual(display.style, {});
    assert.equal(updates, 0);
    Object.assign(video, {videoWidth: 1920, videoHeight: 1080});
    video.handlers.get("loadedmetadata")();
    assert.equal(display.style.height, "225px");
    assert.equal(updates, 1);
    Object.assign(frame, {clientWidth: 0, clientHeight: 0});
    observer.callback();
    assert.equal(display.style.height, "225px");
    Object.assign(frame, {clientWidth: 320, clientHeight: 240});
    observer.callback();
    assert.equal(display.style.width, "320px");
    assert.equal(display.style.height, "180px");
    assert.equal(updates, 1);
    stop();
});

test("video resize fallback and detached media cleanup are safe", async () => {
    const handlers = new Map();
    const {observeVideoSize} = await loadModule(shared + "media.js", {window: {
        addEventListener(name, handler) { handlers.set(name, handler); },
        removeEventListener(name, handler) { if (handlers.get(name) === handler) handlers.delete(name); }
    }});
    assert.doesNotThrow(() => observeVideoSize({parentElement: null})());
    const video = observableVideo();
    const stop = observeVideoSize(video);
    video.parentElement.parentElement.clientWidth = 200;
    video.parentElement.parentElement.clientHeight = 150;
    handlers.get("resize")();
    assert.equal(video.parentElement.style.width, "200px");
    stop();
    assert.equal(handlers.size, 0);
    assert.equal(video.handlers.size, 0);
});

test("stream names retain the short hexadecimal format and crypto generation", async () => {
    let calls = 0;
    const {createStreamName} = await loadModule(shared + "identifiers.js", {
        window: {crypto: {getRandomValues(bytes) {
            calls += 1;
            bytes.forEach((_, index) => bytes[index] = index + 10);
            return bytes;
        }}}
    });
    assert.equal(createStreamName(), "abcd");
    assert.equal(createStreamName(8), "abcdef01");
    assert.equal(calls, 2);
});

function domElement() {
    return {
        textContent: "",
        value: "",
        checked: false,
        disabled: false,
        hidden: false,
        events: [],
        dispatchEvent(event) { this.events.push(event); },
        replaceChildren() { this.cleared = true; }
    };
}

test("shared DOM helpers preserve native state, literal text, and missing-element errors", async () => {
    const node = domElement();
    const dom = await loadModule(shared + "dom.js", {
        document: {getElementById: (id) => id === "field" ? node : null},
        Event
    });
    assert.equal(dom.byId("field"), node);
    dom.setText("field", "<b>literal</b>");
    assert.equal(node.textContent, "<b>literal</b>");
    dom.setText("field", null);
    assert.equal(node.textContent, "");
    dom.setValue("field", "30");
    assert.equal(dom.value("field"), "30");
    assert.equal(dom.numberValue("field"), 30);
    dom.setChecked("field", true);
    assert.equal(dom.checked("field"), true);
    dom.setDisabled("field", true);
    assert.equal(node.disabled, true);
    dom.setVisible("field", false);
    assert.equal(node.hidden, true);
    dom.setVisible("field", true);
    assert.equal(node.hidden, false);
    const handler = () => {};
    dom.setButton("field", "Play", handler);
    assert.equal(node.textContent, "Play");
    assert.equal(node.onclick, handler);
    assert.equal(node.disabled, false);
    dom.emitChange("field");
    assert.equal(node.events[0].type, "change");
    assert.equal(node.events[0].bubbles, true);
    dom.clearChildren("field");
    assert.equal(node.cleared, true);
    assert.throws(() => dom.byId("missing"), /Missing required element #missing/);
});

async function loadManager(elements) {
    return loadModule(manager, {
        window: {Flashphoner: {constants: {STREAM_EVENT_TYPE: {
            AUDIO_MUTED: "AUDIO_MUTED", AUDIO_UNMUTED: "AUDIO_UNMUTED",
            VIDEO_MUTED: "VIDEO_MUTED", VIDEO_UNMUTED: "VIDEO_UNMUTED"
        }}}},
        document: {readyState: "loading", addEventListener() {}, getElementById: (id) => elements[id]}
    }, "\nexport {updateMutedState, switchToScreen, setStatus, updateServerVersion};\nexport function setTestStream(stream) { publishStream = stream; }\n");
}

test("fatal SDK and device errors are displayed in the renamed alert", async () => {
    const html = await fs.readFile(path.join(root, "streaming/media_devices_manager/media_device_manager.html"), "utf8");
    assert.match(html, /<div id="notifyFatal"[^>]*role="alert"/);
    assert.doesNotMatch(html, /notifyFlash/);
    const source = await fs.readFile(path.join(root, manager), "utf8");
    assert.doesNotMatch(source, /notifyFlash/);

    for (const failure of ["missing SDK", "SDK initialization", "input devices"]) {
        const dom = statisticsDOM();
        const elements = Object.fromEntries([
            "publishBitrateChart", "playBitrateChart", "localVideo", "remoteVideo", "connectStatus", "notifyFatal"
        ].map((id) => [id, domElement()]));
        elements.streamStats = dom.table;
        elements.connectStatus.parentElement = {dataset: {}};
        const sdk = failure === "missing SDK" ? undefined : {
            Browser: {isAndroid: () => false, isiOS: () => false},
            init() { throw new Error("WebRTC unavailable"); },
            getMediaDevices() { return Promise.reject(new Error("Permission denied")); }
        };
        const module = await loadModule(manager, {
            window: {Flashphoner: sdk},
            document: {...dom.document, readyState: "loading", addEventListener() {}, getElementById: (id) => elements[id]},
            console: {error() {}}
        }, "\nexport {initPage, loadInputDevices};\n");
        if (failure === "input devices") {
            await module.loadInputDevices();
            assert.equal(elements.notifyFatal.textContent, "Failed to get media devices: Permission denied");
        } else {
            await module.initPage();
            assert.equal(elements.notifyFatal.textContent, failure === "missing SDK"
                ? "Flashphoner Web SDK is not available."
                : "Your browser doesn't support WebRTC technology needed for this example");
        }
    }
});

async function playbackFixture({chrome = true, outputFailure = false, processorFailure = false} = {}) {
    const elements = {};
    const pendingTimeouts = new Map();
    const intervals = new Map();
    const callbacks = new Map();
    const sessionCallbacks = new Map();
    const observers = [];
    const nodes = [];
    let timerId = 0;
    let streamOptions;
    let statsCallback;
    function element(id) {
        if (!elements[id]) {
            elements[id] = {...domElement(), id, options: [{value: "default"}],
                handlers: {}, parentElement: {dataset: {}}, classList: {toggle() {}},
                addEventListener(event, handler) { this.handlers[event] = handler; },
                removeEventListener(event, handler) { if (this.handlers[event] === handler) delete this.handlers[event]; },
                setAttribute(name, value) { this[name] = value; }, closest() { return this; },
                querySelectorAll() { return id === "playGroup" && elements.audioOutput ? [elements.audioOutput] : []; },
                getContext: () => new Proxy({}, {get: () => () => {}}),
                width: 400, height: 300, clientWidth: 0, clientHeight: 0};
            if (id === "playAudio") elements[id].checked = true;
            if (id === "audioOutput") elements[id].value = "default";
        }
        return elements[id];
    }
    const stream = {on(event, handler) { callbacks.set(event, handler); return this; },
        play() {}, publish() {}, setVolume() {}, setMicrophoneGain() {},
        id: () => "media", status: () => "PLAYING", getAudioState: () => null,
        getVideoState: () => null, getStats(callback) { statsCallback = callback; }};
    const session = {status: () => "ESTABLISHED", getServerVersion: () => "5.3.review", disconnect() {},
        on(event, handler) { sessionCallbacks.set(event, handler); return this; },
        createStream(options) { streamOptions = options; return stream; }};
    const audioContext = {destination: {}, createMediaStreamSource() { return audioNode(); },
        createScriptProcessor() { if (processorFailure) throw new Error("processor unavailable"); return audioNode(); }};
    function audioNode() {
        const node = {disconnects: 0, connect() {}, disconnect() { this.disconnects += 1; }};
        nodes.push(node);
        return node;
    }
    const fakeWindow = {
        Flashphoner: {constants: {SESSION_STATUS: {CONNECTED: "CONNECTED", ESTABLISHED: "ESTABLISHED", FAILED: "FAILED", DISCONNECTED: "DISCONNECTED"},
            STREAM_STATUS: {PLAYING: "PLAYING", PUBLISHING: "PUBLISHING", STOPPED: "STOPPED", FAILED: "FAILED", UNPUBLISHED: "UNPUBLISHED"},
            MEDIA_DEVICE_KIND: {OUTPUT: "OUTPUT"}, CONNECTION_QUALITY: {UPDATE: "UPDATE"}},
            createSession: () => session,
            Browser: {isChrome: () => chrome}, getSessions: () => [session], getMediaProviders: () => ["WebRTC"],
            getMediaDevices: async () => { if (outputFailure) throw new Error("output media devices not found"); return {audio: []}; }},
        addEventListener() {}, removeEventListener() {}, performance: {now: () => 1000},
        ResizeObserver: class {
            constructor(callback) { this.callback = callback; this.disconnects = 0; observers.push(this); }
            observe(target) { this.target = target; }
            disconnect() { this.disconnects += 1; }
        },
        setTimeout(callback) { pendingTimeouts.set(++timerId, callback); return timerId; },
        clearTimeout(id) { pendingTimeouts.delete(id); },
        setInterval(callback) { intervals.set(++timerId, callback); return timerId; },
        clearInterval(id) { intervals.delete(id); }
    };
    element("media").srcObject = {};
    Object.assign(element("media"), {tagName: "VIDEO", videoWidth: 640, videoHeight: 480,
        parentElement: {style: {}, parentElement: {clientWidth: 400, clientHeight: 300}}});
    const module = await loadModule(manager, {window: fakeWindow, Event, URL, ResizeObserver: fakeWindow.ResizeObserver,
        document: {readyState: "loading", addEventListener() {}, getElementById: (id) => id === "audioOutput" ? elements[id] : element(id),
            querySelectorAll: (selector) => selector.includes('id^="send"') ? [element("micGainControl"), element("sendAudio")] : []},
        console: {log() {}, warn() {}, error() {}}
    }, "\nexport {play, publish, onStopped, onUnpublished, onDisconnected, loadOutputDevices, muteInputs, bindControls, validateForm};\nexport function setupTest(context) { audioContext = context; localVideo = {}; remoteVideo = {}; statistics = {clear(){}}; }\nexport function setTestStream(stream) { publishStream = stream; }\n");
    element("audioOutput");
    module.setupTest(audioContext);
    return {module, elements, element, stream, session, sessionCallbacks, callbacks, fakeWindow, observers, nodes, pendingTimeouts, intervals,
        get streamOptions() { return streamOptions; }, get statsCallback() { return statsCallback; },
        start() { module.play(); callbacks.get("PLAYING")(stream); },
        publish() { module.publish(); callbacks.get("PUBLISHING")(stream); },
        startDetection() { const [id, callback] = pendingTimeouts.entries().next().value; pendingTimeouts.delete(id); callback(); }};
}

test("missing output devices fall back to default audio without removing required controls", async () => {
    for (const outputFailure of [true, false]) {
        const fixture = await playbackFixture({outputFailure});
        await fixture.module.loadOutputDevices();
        assert.equal(fixture.elements.audioOutputForm.hidden, true);
        assert.equal(fixture.module.validateForm("play"), true);
        fixture.module.play();
        assert.equal("outputId" in fixture.streamOptions.constraints.audio, false);
        fixture.elements.audioOutput.value = "speaker";
        fixture.module.play();
        assert.equal(fixture.streamOptions.constraints.audio.outputId, "speaker");
        delete fixture.elements.audioOutput;
        assert.doesNotThrow(() => fixture.module.play());
        assert.equal("outputId" in fixture.streamOptions.constraints.audio, false);
    }
});

test("invalid server URLs restore Connect controls without creating a session", async () => {
    const fixture = await playbackFixture();
    fixture.fakeWindow.Flashphoner.getSessions = () => [];
    let attempts = 0;
    fixture.fakeWindow.Flashphoner.createSession = () => { attempts += 1; return fixture.session; };
    fixture.module.onDisconnected();
    for (const url of ["", "   ", "abc", "ws://", "https://wcs.example:8443"]) {
        fixture.element("urlServer").value = url;
        assert.doesNotThrow(() => fixture.element("connectBtn").onclick());
        assert.equal(fixture.elements.urlServer.disabled, false);
        assert.equal(fixture.elements.connectBtn.disabled, false);
        assert.equal(fixture.elements.connectBtn.textContent, "Connect");
        assert.equal(fixture.elements.connectStatus.textContent, "FAILED");
        assert.match(fixture.elements.connectError.textContent, /^Can't connect to server:/);
        assert.equal(fixture.elements.connectError.hidden, false);
        assert.equal(fixture.elements.publishBtn.disabled, true);
        assert.equal(fixture.elements.playBtn.disabled, true);
    }
    assert.equal(attempts, 0);
});

test("synchronous SDK errors allow a successful retry and normal session events", async () => {
    const fixture = await playbackFixture();
    fixture.fakeWindow.Flashphoner.getSessions = () => [];
    fixture.module.onDisconnected();
    fixture.element("urlServer").value = "ws://127.0.0.1:8080";
    fixture.fakeWindow.Flashphoner.createSession = () => { throw new Error("SDK connection failed"); };
    fixture.element("connectBtn").onclick();
    assert.equal(fixture.elements.urlServer.disabled, false);
    assert.equal(fixture.elements.connectBtn.disabled, false);
    assert.equal(fixture.elements.connectStatus.textContent, "FAILED");
    assert.equal(fixture.elements.connectError.textContent, "Can't connect to server: SDK connection failed");
    let options;
    fixture.fakeWindow.Flashphoner.createSession = (value) => { options = value; return fixture.session; };
    fixture.elements.urlServer.value = "  wss://wcs.example:9443  ";
    fixture.element("timeout").value = "1000";
    fixture.elements.connectBtn.onclick();
    assert.equal(options.urlServer, "wss://wcs.example:9443");
    assert.equal(options.timeout, 1000);
    assert.equal(fixture.elements.connectError.textContent, "");
    assert.equal(fixture.elements.connectError.hidden, true);
    assert.equal(fixture.elements.connectBtn.disabled, true);
    fixture.fakeWindow.Flashphoner.getSessions = () => [fixture.session];
    fixture.sessionCallbacks.get("ESTABLISHED")(fixture.session);
    assert.equal(fixture.elements.connectStatus.textContent, "ESTABLISHED");
    assert.equal(fixture.elements.connectBtn.textContent, "Disconnect");
    assert.equal(fixture.elements.connectBtn.disabled, false);
    assert.equal(fixture.elements.serverVersion.textContent, "5.3.review");
    fixture.fakeWindow.Flashphoner.getSessions = () => [];
    fixture.sessionCallbacks.get("DISCONNECTED")();
    assert.equal(fixture.elements.urlServer.disabled, false);
    assert.equal(fixture.elements.connectBtn.textContent, "Connect");
    fixture.elements.connectBtn.onclick();
    fixture.sessionCallbacks.get("FAILED")();
    assert.equal(fixture.elements.connectBtn.disabled, false);
    assert.equal(fixture.elements.urlServer.disabled, false);
    assert.equal(fixture.elements.connectStatus.textContent, "FAILED");
});

test("connection status distinguishes CONNECTED, initial failure, and loss of an established session", async () => {
    const fixture = await playbackFixture();
    fixture.fakeWindow.Flashphoner.getSessions = () => [];
    fixture.module.onDisconnected();
    fixture.element("urlServer").value = "ws://127.0.0.1:8080";
    fixture.elements.connectBtn.onclick();
    fixture.session.status = () => "CONNECTED";
    fixture.sessionCallbacks.get("CONNECTED")(fixture.session);
    assert.equal(fixture.elements.connectStatus.textContent, "CONNECTED");
    assert.equal(fixture.elements.connectStatus.className, "text-success");
    fixture.sessionCallbacks.get("DISCONNECTED")();
    assert.equal(fixture.elements.connectError.textContent, "Can't connect to server.");
    assert.equal(fixture.elements.connectError.hidden, false);
    assert.equal(fixture.elements.urlServer.disabled, false);
    assert.equal(fixture.elements.connectBtn.disabled, false);
    fixture.elements.connectBtn.onclick();
    assert.equal(fixture.elements.connectError.hidden, true);
    fixture.session.status = () => "ESTABLISHED";
    fixture.fakeWindow.Flashphoner.getSessions = () => [fixture.session];
    fixture.sessionCallbacks.get("ESTABLISHED")(fixture.session);
    fixture.fakeWindow.Flashphoner.getSessions = () => [];
    fixture.sessionCallbacks.get("FAILED")();
    assert.equal(fixture.elements.connectError.textContent, "Connection to server lost.");
    fixture.elements.connectBtn.onclick();
    fixture.sessionCallbacks.get("ESTABLISHED")(fixture.session);
    fixture.sessionCallbacks.get("DISCONNECTED")();
    assert.equal(fixture.elements.connectError.hidden, true);
});

test("stream errors expose ICE reasons and local details without changing the session status", async () => {
    const fixture = await playbackFixture();
    fixture.element("connectStatus").textContent = "ESTABLISHED";
    fixture.publish();
    fixture.callbacks.get("FAILED")({getInfo: () => "Failed by ICE timeout", getErrorInfo: () => ""});
    assert.equal(fixture.elements.publishStatus.textContent, "FAILED");
    assert.equal(fixture.elements.publishError.textContent, "Failed by ICE timeout");
    assert.equal(fixture.elements.publishError.hidden, false);
    assert.equal(fixture.elements.connectStatus.textContent, "ESTABLISHED");
    fixture.publish();
    assert.equal(fixture.elements.publishError.hidden, true);
    fixture.start();
    fixture.callbacks.get("FAILED")({getInfo: () => "Local error", getErrorInfo: () => "Permission denied"});
    assert.equal(fixture.elements.playError.textContent, "Local error: Permission denied");
    assert.equal(fixture.elements.playError.hidden, false);
    assert.equal(fixture.elements.connectStatus.textContent, "ESTABLISHED");
    fixture.start();
    assert.equal(fixture.elements.playError.hidden, true);
    fixture.callbacks.get("FAILED")({getInfo: () => "  Stream not found  ", getErrorInfo: () => "Stream not found"});
    assert.equal(fixture.elements.playError.textContent, "Stream not found");
    fixture.module.onStopped();
    assert.equal(fixture.elements.playError.hidden, true);
    fixture.publish();
    fixture.callbacks.get("FAILED")({});
    assert.equal(fixture.elements.publishError.textContent, "Publishing failed.");
    fixture.module.onDisconnected();
    assert.equal(fixture.elements.publishError.hidden, true);
});

test("Connection controls stay compact and centered without preview separators", async () => {
    const html = await fs.readFile(path.join(root, "streaming/media_devices_manager/media_device_manager.html"), "utf8");
    const css = await fs.readFile(path.join(root, "dependencies/css/examples.css"), "utf8");
    assert.match(html, /class="connection-panel" aria-label="Connection"/);
    assert.doesNotMatch(html, /id="connectionHeading"/);
    assert.match(css.match(/\.connection-fields\s*\{[^}]+\}/)[0], /grid-template-columns: minmax\(0, 360px\)/);
    assert.match(css.match(/\.timeout-field\s*\{[^}]+\}/)[0], /justify-self: center/);
    assert.doesNotMatch(css, /\.preview-column\s*\+\s*\.preview-column/);
    assert.doesNotMatch(css.match(/\.connection-panel\s*\{[^}]+\}/)[0], /border-top/);
    for (const id of ["connectError", "publishError", "playError"]) {
        assert.match(html, new RegExp('id="' + id + '"[^>]+role="alert" hidden'));
    }
});

test("replaying disconnects the old frame observer and Stop ignores queued resizes", async () => {
    const fixture = await playbackFixture();
    const video = fixture.element("media");
    const frame = video.parentElement.parentElement;
    const frameObservers = () => fixture.observers.filter((observer) => observer.target === frame);
    fixture.start();
    assert.equal(frameObservers().length, 1);
    Object.assign(frame, {clientWidth: 328, clientHeight: 246});
    frameObservers()[0].callback();
    assert.equal(video.parentElement.style.width, "328px");
    assert.equal(fixture.elements.playResolution.textContent, "640x480");
    fixture.start();
    assert.equal(frameObservers().length, 2);
    assert.equal(frameObservers()[0].disconnects, 1);
    fixture.module.onStopped();
    fixture.module.onStopped();
    assert.equal(frameObservers()[1].disconnects, 1);
    assert.equal(video.handlers.resize, undefined);
    assert.equal(video.handlers.loadedmetadata, undefined);
    frame.clientWidth = 200;
    frameObservers().forEach((observer) => observer.callback());
    assert.equal(video.parentElement.style.width, "328px");
    assert.equal(fixture.elements.playResolution.textContent, "");
});

test("publishing refits the frame and unpublishing or disconnecting releases observers", async () => {
    const fixture = await playbackFixture();
    const video = fixture.element("media");
    const frame = video.parentElement.parentElement;
    const frameObservers = () => fixture.observers.filter((observer) => observer.target === frame);
    fixture.publish();
    Object.assign(frame, {clientWidth: 320, clientHeight: 240});
    frameObservers()[0].callback();
    assert.equal(video.parentElement.style.width, "320px");
    assert.equal(fixture.elements.publishResolution.textContent, "640x480");
    fixture.module.onUnpublished();
    assert.equal(frameObservers()[0].disconnects, 1);
    fixture.publish();
    fixture.module.onDisconnected();
    assert.equal(frameObservers()[1].disconnects, 1);
    assert.equal(video.handlers.resize, undefined);
    assert.equal(video.handlers.loadedmetadata, undefined);
});

test("microphone gain remains editable and updates a publishing stream", async () => {
    const fixture = await playbackFixture();
    const gains = [];
    fixture.module.setTestStream({setMicrophoneGain(gain) { gains.push(gain); }});
    fixture.module.bindControls();
    fixture.module.muteInputs("send");
    assert.equal(fixture.elements.micGainControl.disabled, false);
    assert.equal(fixture.elements.sendAudio.disabled, true);
    fixture.elements.micGainControl.handlers.input({currentTarget: {value: "70"}});
    assert.deepEqual(gains, [70]);
});

test("Stop cancels delayed speech detection and replay does not accumulate intervals", async () => {
    const fixture = await playbackFixture();
    fixture.start();
    assert.equal(fixture.pendingTimeouts.size, 1);
    fixture.module.onStopped();
    assert.equal(fixture.pendingTimeouts.size, 0);
    assert.equal(fixture.intervals.size, 0);
    fixture.start();
    fixture.startDetection();
    assert.equal(fixture.intervals.size, 2);
    fixture.start();
    assert.equal(fixture.intervals.size, 1);
    fixture.startDetection();
    assert.equal(fixture.intervals.size, 2);
    fixture.module.onStopped();
    fixture.module.onStopped();
    assert.equal(fixture.intervals.size, 0);
    assert.equal(fixture.pendingTimeouts.size, 0);
});

test("stopped speech callbacks do not request a missing stream or change the indicator", async () => {
    const fixture = await playbackFixture();
    fixture.start();
    const callback = [...fixture.pendingTimeouts.values()][0];
    fixture.module.onStopped();
    callback();
    assert.equal(fixture.intervals.size, 0);
    fixture.start();
    callback();
    assert.equal(fixture.pendingTimeouts.size, 1);
    fixture.startDetection();
    [...fixture.intervals.values()].at(-1)();
    fixture.module.onStopped();
    assert.doesNotThrow(() => fixture.statsCallback({inboundStream: {audio: {audioLevel: 1}}}));
    assert.equal(fixture.intervals.size, 0);
    fixture.element("playAudio").checked = false;
    fixture.start();
    assert.equal(fixture.pendingTimeouts.size, 0);
});

test("partial speech setup failure disconnects the source and leaves no speech interval", async () => {
    const fixture = await playbackFixture({chrome: false, processorFailure: true});
    fixture.start();
    fixture.startDetection();
    assert.equal(fixture.nodes.length, 1);
    assert.equal(fixture.nodes[0].disconnects, 1);
    assert.equal(fixture.intervals.size, 1);
    fixture.module.onStopped();
    assert.equal(fixture.intervals.size, 0);
});

test("speech audio nodes are disconnected once on Stop and missing media is ignored", async () => {
    const fixture = await playbackFixture({chrome: false});
    fixture.start();
    fixture.startDetection();
    assert.equal(fixture.nodes.length, 2);
    assert.equal(typeof fixture.nodes[1].onaudioprocess, "function");
    fixture.module.onStopped();
    assert.equal(fixture.nodes[0].disconnects, 1);
    assert.equal(fixture.nodes[1].disconnects, 1);
    assert.equal(fixture.nodes[1].onaudioprocess, null);
    fixture.module.onStopped();
    assert.equal(fixture.nodes[0].disconnects, 1);
    fixture.element("media").srcObject = null;
    fixture.start();
    fixture.startDetection();
    assert.equal(fixture.nodes.length, 2);
    fixture.module.onStopped();
    assert.equal(fixture.intervals.size, 0);
});

test("status rows explicitly follow text updates without WebKit :has(:empty) invalidation", async () => {
    const elements = Object.fromEntries(["connectStatus", "publishStatus", "playStatus"].map((id) => {
        const node = domElement();
        node.parentElement = {dataset: {empty: "true"}};
        return [id, node];
    }));
    const {setStatus} = await loadManager(elements);
    for (const [id, active, stopped] of [["connectStatus", "ESTABLISHED", "DISCONNECTED"],
        ["publishStatus", "PUBLISHING", "UNPUBLISHED"], ["playStatus", "PLAYING", "STOPPED"]]) {
        const field = elements[id];
        for (const [status, color] of [[active, "text-success"], [stopped, "text-muted"], ["FAILED", "text-danger"]]) {
            setStatus(id, status);
            assert.equal(field.textContent, status);
            assert.equal(field.parentElement.dataset.empty, "false");
            assert.equal(field.className, color);
        }
        setStatus(id, undefined);
        assert.equal(field.textContent, "");
        assert.equal(field.parentElement.dataset.empty, "true");
        assert.equal(field.className, "");
        setStatus(id, active);
        assert.equal(field.parentElement.dataset.empty, "false");
    }
    const css = await fs.readFile(path.join(root, "dependencies/css/examples.css"), "utf8");
    assert.doesNotMatch(css, /:has\([^)]*Status:empty\)/);
});

test("server version preserves full values and hides after disconnect", async () => {
    const elements = {serverVersion: domElement(), wcsVersion: domElement()};
    const {updateServerVersion} = await loadManager(elements);
    const version = "5.3.493-94e68c8d6505669f4adc804117256e0343df0aad";
    updateServerVersion(version);
    assert.equal(elements.serverVersion.textContent, version);
    assert.equal(elements.wcsVersion.hidden, false);
    updateServerVersion(undefined, true);
    assert.equal(elements.serverVersion.textContent, "No data");
    assert.equal(elements.wcsVersion.hidden, false);
    updateServerVersion("");
    assert.equal(elements.wcsVersion.hidden, true);
});

test("all mute events update the correct media state and stream name", async () => {
    const elements = Object.fromEntries(["audioMuted", "audioMutedStream", "videoMuted", "videoMutedStream"]
        .map((id) => [id, domElement()]));
    const {updateMutedState} = await loadManager(elements);
    for (const [event, prefix, muted] of [
        ["AUDIO_MUTED", "audio", true], ["AUDIO_UNMUTED", "audio", false],
        ["VIDEO_MUTED", "video", true], ["VIDEO_UNMUTED", "video", false]
    ]) {
        updateMutedState(event, event);
        assert.equal(elements[prefix + "Muted"].textContent, muted);
        assert.equal(elements[prefix + "MutedStream"].textContent, event);
    }
    updateMutedState("UNKNOWN", "ignored");
    assert.equal(elements.audioMutedStream.textContent, "AUDIO_UNMUTED");
    assert.equal(elements.videoMutedStream.textContent, "VIDEO_UNMUTED");
});

test("screen sharing uses the native SDK path and restores controls on cancellation", async () => {
    const elements = Object.fromEntries(["switchBtn", "videoInput", "screenShareToggle"]
        .map((id) => [id, domElement()]));
    const module = await loadManager(elements);
    assert.doesNotThrow(() => module.switchToScreen());
    let args;
    module.setTestStream({switchToScreen(...values) {
        args = values;
        return Promise.resolve();
    }});
    module.switchToScreen();
    assert.deepEqual(args, [undefined, true]);
    assert.equal(elements.switchBtn.disabled, true);
    assert.equal(elements.videoInput.disabled, true);
    elements.screenShareToggle.checked = true;
    module.setTestStream({switchToScreen() { return Promise.reject(new Error("cancelled")); }});
    module.switchToScreen();
    await Promise.resolve();
    assert.equal(elements.screenShareToggle.checked, false);
    assert.equal(elements.switchBtn.disabled, false);
    assert.equal(elements.videoInput.disabled, false);
});

test("Media Devices loads shared configuration and removes only the v2 Android banner", async () => {
    const html = await fs.readFile(path.join(root, "streaming/media_devices_manager/media_device_manager.html"), "utf8");
    assert.ok(html.indexOf('src="../../dependencies/ports.js"') < html.indexOf('src="media-device-manager.js"'));
    assert.doesNotMatch(html, /google_play|play\.google\.com|example-footer/);
    assert.doesNotMatch(html, /\.\.\/demo\//);
    await assert.rejects(fs.access(path.join(root, "assets/google_play.jpg")), {code: "ENOENT"});
    const legacyHtml = await fs.readFile(path.join(root, "../demo/streaming/media_devices_manager/media_device_manager.html"), "utf8");
    assert.match(legacyHtml, /google_play\.jpg/);
    await fs.access(path.join(root, "../demo/dependencies/img/google_play.jpg"));
    const source = await fs.readFile(path.join(root, manager), "utf8");
    assert.doesNotMatch(source, /screenSharingExtensionId|SCREEN_SHARING_EXTENSION_ID/);
    // loadManager evaluates the real import graph, including every relocated module.
    await loadManager({});
});
