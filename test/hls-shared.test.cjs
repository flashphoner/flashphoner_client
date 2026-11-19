const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const os = require('node:os');
const {spawnSync} = require('node:child_process');
const repository = path.resolve(__dirname, '..');

async function helpers({search = '', override, ports, protocol = 'http:'} = {}) {
    const nodes = new Map();
    function node(id) {
        if (!nodes.has(id)) {
            const classes = new Set();
            nodes.set(id, {value: '', textContent: '', hidden: true, disabled: false, dataset: {}, attributes: {},
                classList: {toggle(name, on) { on ? classes.add(name) : classes.delete(name); }, contains(name) { return classes.has(name); }},
                setAttribute(name, value) { this.attributes[name] = value; }, closest() { return this; }});
        }
        return nodes.get(id);
    }
    const timers = new Map();
    let clock = 1000;
    let nextTimer = 0;
    const context = vm.createContext({URL, URLSearchParams,
        window: {location: {protocol, hostname: 'panel.example', search, href: `http://panel.example/player.html${search}`},
            ...(override ? {getHLSUrl: override} : {})},
        ...(ports ? {SERVER_PORTS: ports} : {}),
        document: {getElementById: node, body: node('body'), querySelectorAll: () => [node('option')]},
        Date: {now: () => clock},
        setInterval(callback) { timers.set(++nextTimer, callback); return nextTimer; },
        clearInterval(id) { timers.delete(id); }});
    const modules = new Map();
    async function load(file) {
        if (!modules.has(file)) {
            const module = new vm.SourceTextModule(await fs.readFile(file, 'utf8'), {context, identifier: file});
            modules.set(file, module);
            await module.link((specifier, parent) => load(path.resolve(path.dirname(parent.identifier), specifier)));
        }
        return modules.get(file);
    }
    const module = await load(path.join(repository, 'examples/v2/dependencies/js/hls.js'));
    await module.evaluate();
    return {api: module.namespace, url: modules.get(path.join(repository, 'examples/v2/dependencies/js/server-url.js')).namespace,
        node, timers, tick(ms = 1000) { clock += ms; [...timers.values()].forEach((callback) => callback()); }};
}

test('HLS source preserves server/stream priority, Unicode, literal percent and auth characters', async () => {
    const {api, node} = await helpers();
    node('urlServer').value = 'https://wcs.example:8445/';
    node('playStream').value = 'поток 50%';
    node('key').value = 'auth key';
    node('token').value = 'a&b=+%';
    node('fullLink').value = 'https://other.example/custom.m3u8';
    const result = api.getHlsSource();
    assert.equal(result, 'https://wcs.example:8445/%D0%BF%D0%BE%D1%82%D0%BE%D0%BA%2050%25/%D0%BF%D0%BE%D1%82%D0%BE%D0%BA%2050%25.m3u8?auth%20key=a%26b%3D%2B%25');
    node('playStream').value = '';
    node('fullLink').value = 'https://cdn.example/a%25/b.m3u8?q=%25';
    assert.equal(api.getHlsSource(), node('fullLink').value);
    node('fullLink').value = 'javascript:alert(1)';
    assert.equal(api.getHlsSource(), '');
    assert.equal(node('fullLink').attributes['aria-invalid'], 'true');
    assert.equal(node('status').textContent, 'FAILED');
    node('fullLink').value = 'https://cdn.example/live.m3u8';
    assert.ok(api.getHlsSource());
    assert.equal(node('fullLink').attributes['aria-invalid'], 'false');
});

test('HLS query and permalink round-trip once; false stays false and code is never evaluated', async () => {
    const source = 'https://cdn.example/50%25.m3u8?token=a%26b';
    const {api, node} = await helpers({search: `?src=${encodeURIComponent(source)}&autoplay=false&llhls=false&version=videojs8`});
    const parameters = api.readHlsParameters();
    assert.equal(parameters.src, source);
    assert.equal(parameters.autoplay, false);
    assert.equal(parameters.llhls, false);
    api.initializeHlsPage(parameters);
    assert.equal(node('fullLink').value, source);
    api.showHlsPermalink(source, {llhls: false, version: 'videojs8'});
    const link = new URL(node('permalink').href);
    assert.equal(link.searchParams.get('src'), source);
    assert.equal(link.searchParams.get('llhls'), 'false');
    assert.equal(link.searchParams.has('autoplay'), false);
    assert.equal(node('permalink').hidden, false);
    api.setHlsState('LOADING');
    assert.equal(node('permalink').hidden, true);
    assert.equal(node('fullLink').disabled, true);
    assert.equal(node('applyBtn').textContent, 'Stop');
    api.setHlsState('FAILED', 'Network error');
    assert.equal(node('fullLink').disabled, false);
    assert.equal(node('info').textContent, 'Network error');
    assert.equal(node('applyBtn').textContent, 'Play');
    const bad = await helpers({search: '?autoplay=globalThis.codeExecuted=true&llhls=1'});
    assert.equal(bad.api.readHlsParameters().autoplay, false);
    assert.equal(bad.api.readHlsParameters().llhls, false);
});

test('Autoplay requires a source, hides the form and never starts a statistics timer', async () => {
    for (const source of ['', 'https://cdn.example/live.m3u8']) {
        const {api, node, timers} = await helpers();
        const {autoplay} = api.initializeHlsPage({autoplay: true, src: source});
        assert.equal(autoplay, Boolean(source));
        assert.equal(node('body').classList.contains('hls-autoplay'), Boolean(source));
        if (source) {
            api.createPlaybackStats({}).start();
            assert.equal(timers.size, 0);
            api.showHlsPermalink(source);
            assert.equal(node('permalink').hidden, true);
        }
    }
});

test('HLS uses the selected LLcast origin and configured standalone ports; explicit arguments win', async () => {
    const {api, url, node} = await helpers({override: () => 'https://selected.example:19445', ports: {hls: {http: 19082}}});
    api.initializeHlsPage({src: '', autoplay: false});
    assert.equal(node('urlServer').value, 'https://selected.example:19445');
    assert.equal(url.getHLSUrl('explicit.example'), 'http://explicit.example:19082');
    assert.equal(url.getHLSUrl(undefined, 1234), 'http://panel.example:1234');
    const plain = await helpers({protocol: 'https:', ports: {hls: {https: 19445}}});
    assert.equal(plain.url.getHLSUrl(), 'https://panel.example:19445');
    for (const invalid of ['javascript:alert(1)', 'https://wcs.example/path', 'https://user:pass@wcs.example', 'https://wcs.example?x=1']) {
        const bad = await helpers({override: () => invalid});
        assert.throws(() => bad.url.getHLSUrl(), /Invalid embedded HLS/);
    }
});

test('Playback statistics tolerate unavailable browser APIs and clean up on repeated Start/Stop', async () => {
    const {api, node, timers, tick} = await helpers();
    const video = {videoWidth: 640, videoHeight: 360};
    const stats = api.createPlaybackStats(() => video);
    stats.start();
    tick();
    assert.equal(node('videoWidth').textContent, 640);
    assert.equal(node('videoRate').textContent, 'N/A');
    assert.equal(node('videoFps').textContent, 'N/A');
    let frames = 0;
    video.getVideoPlaybackQuality = () => ({totalVideoFrames: frames, droppedVideoFrames: 0});
    video.webkitVideoDecodedByteCount = 0;
    stats.start();
    assert.equal(timers.size, 1);
    frames = 30;
    video.webkitVideoDecodedByteCount = 1000;
    tick();
    assert.equal(node('videoRate').textContent, '8000');
    assert.equal(node('videoFps').textContent, '30.0');
    stats.stop();
    assert.equal(timers.size, 0);
    assert.equal(node('stats').hidden, true);
});

test('iOS fullscreen handlers resume only the active video and are removable before Stop', async () => {
    const {api} = await helpers();
    const events = new Map();
    let plays = 0;
    const video = {addEventListener(name, fn) { events.set(name, fn); }, removeEventListener(name) { events.delete(name); },
        play() { plays++; return Promise.resolve(); }};
    const dispose = api.setNativeFullscreenHandlers(video, false);
    const late = events.get('webkitendfullscreen');
    late();
    assert.equal(plays, 1);
    dispose();
    late();
    assert.equal(plays, 1);
    assert.equal(events.size, 0);
});

test('Grunt packages the HLS libraries from a v2-only source tree', async (context) => {
    const stage = await fs.mkdtemp(path.join(os.tmpdir(), 'wcs5190-assets-'));
    context.after(() => fs.rm(stage, {recursive: true, force: true}));
    await fs.copyFile(path.join(repository, 'package.json'), path.join(stage, 'package.json'));
    await fs.cp(path.join(repository, 'examples/v2'), path.join(stage, 'examples/v2'), {recursive: true});
    const assets = ['hls-js-player/hls.min.js', 'hls-player/videojs7/video.js', 'hls-player/videojs7/video-js.css',
        'hls-player/videojs7/videojs-contrib-quality-levels.js', 'hls-player/videojs8/video.js', 'hls-player/videojs8/video-js.css'];
    assert.deepEqual(await fs.readdir(path.join(stage, 'examples')), ['v2']);
    const result = spawnSync(process.execPath, [require.resolve('grunt-cli/bin/grunt'), '--gruntfile', path.join(repository, 'Gruntfile.js'),
        '--base', stage, 'copy:main', '--no-color'], {cwd: repository, encoding: 'utf8', timeout: 30000});
    assert.equal(result.status, 0, result.stdout + result.stderr);
    const {name, version} = require('../package.json');
    const release = path.join(stage, 'release', `${name}-${version}`, 'examples');
    assert.deepEqual(await fs.readdir(release), ['v2']);
    for (const asset of assets) {
        assert.deepEqual(await fs.readFile(path.join(release, 'v2/streaming', asset)),
            await fs.readFile(path.join(stage, 'examples/v2/streaming', asset)));
    }
    for (const entry of ['hls-player/hls-player', 'hls-js-player/hls-js-player', 'hls-native/hls-native']) {
        const page = await fs.readFile(path.join(release, 'v2/streaming', `${entry}.html`), 'utf8');
        assert.doesNotMatch(page, /examples\/demo|\.\.\/hls-player/);
        const source = await fs.readFile(path.join(release, 'v2/streaming', `${entry}.js`), 'utf8');
        assert.doesNotMatch(source, /from\s*['"]\.\.\/(?:hls-player|hls-native|hls-js-player)/);
    }
});
