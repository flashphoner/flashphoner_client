const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const {spawnSync} = require("node:child_process");
const test = require("node:test");
const vm = require("node:vm");

const repository = path.resolve(__dirname, "..");

test("Grunt packages every Streaming runtime asset when only examples/v2 is present", async (context) => {
    const stage = await fs.mkdtemp(path.join(os.tmpdir(), "wcs5155-v2-assets-"));
    context.after(() => fs.rm(stage, {recursive: true, force: true}));
    await fs.copyFile(path.join(repository, "package.json"), path.join(stage, "package.json"));
    await fs.cp(path.join(repository, "examples/v2"), path.join(stage, "examples/v2"), {recursive: true});

    const result = spawnSync(process.execPath, [
        require.resolve("grunt-cli/bin/grunt"),
        "--gruntfile", path.join(repository, "Gruntfile.js"),
        "--base", stage, "copy:main", "--no-color"
    ], {cwd: repository, encoding: "utf8", timeout: 30000});
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stdout + result.stderr);

    const {name, version} = require("../package.json");
    const release = path.join(stage, "release", `${name}-${version}`, "examples");
    const standalone = path.join(release, "v2");
    await assert.rejects(fs.access(path.join(release, "demo")), {code: "ENOENT"});

    const assets = new Map();
    for (const entry of ["player/player", "2players/2players", "screen-sharing/screen-sharing"]) {
        const script = path.join(standalone, "streaming", `${entry}.js`);
        const source = await fs.readFile(script, "utf8");
        const references = source.matchAll(/(?:receiverLocation|decoderLocation|IconURL|URL):\s*["']([^"']+)["']/g);
        for (const [, relative] of references) {
            const filename = path.resolve(path.dirname(script), relative);
            const packagedPath = path.relative(standalone, filename);
            assert.equal(packagedPath.startsWith(".."), false, `${entry}: ${relative} leaves v2`);
            const bytes = await fs.readFile(filename);
            assert.ok(bytes.length > 0, `${entry}: ${relative} is empty`);
            assets.set(filename, bytes);
        }
    }
    assert.equal(assets.size, 4, "both workers, the Firefox extension and its icon must be shipped");

    for (const [filename, bytes] of assets) {
        if (filename.endsWith(".js")) {
            const worker = vm.createContext({console, postMessage() {}});
            worker.self = worker;
            new vm.Script(bytes.toString("utf8"), {filename}).runInContext(worker, {timeout: 1000});
            assert.equal(typeof worker.onmessage, "function", `${filename} must initialize by itself`);
        } else if (filename.endsWith(".xpi")) {
            assert.equal(bytes.subarray(0, 2).toString(), "PK", "the extension must be a ZIP archive");
        } else if (filename.endsWith(".png")) {
            assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
        }
    }
});
