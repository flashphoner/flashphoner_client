if (Number.parseInt(process.versions.node, 10) < 20) {
    console.error(`Example tests require Node.js 20 or later; detected ${process.versions.node}.`);
    process.exit(1);
}

const {spawnSync} = require("child_process");
const result = spawnSync(process.execPath, [
    "--experimental-vm-modules",
    "--test",
    require.resolve("./examples-v2.test.cjs"),
    require.resolve("./streaming-shared.test.cjs"),
    require.resolve("./streaming-two-way.test.cjs"),
    require.resolve("./streaming-playback.test.cjs"),
    require.resolve("./streaming-publishing.test.cjs"),
    require.resolve("./streaming-assets.test.cjs")
], {stdio: "inherit"});

if (result.error) {
    console.error("Failed to start example tests:", result.error.message);
}
process.exit(result.status === null ? 1 : result.status);
