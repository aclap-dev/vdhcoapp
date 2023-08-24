#!/usr/bin/env node

import * as fs from "node:fs/promises";
import { send } from "./rpc.mjs";
import { assert, assert_true } from "./assert.mjs";
import { spawn_process } from "./process.mjs";
import { register_request_handler } from "./rpc.mjs";
import minimist from "minimist";
import path from "path";

// FIXME: more complete test:
// See: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Native_manifests

let binary;

if (process.platform === "darwin") {
  let PATH_CHROME_OSX = "/Library/Google/Chrome/NativeMessagingHosts/net.downloadhelper.coapp.json";
  let PATH_EDGE_OSX = "/Library/Microsoft/Edge/NativeMessagingHosts/net.downloadhelper.coapp.json";
  let PATH_FIREFOX_OSX = "/Library/Application Support/Mozilla/NativeMessagingHosts/net.downloadhelper.coapp.json";
  let BINARY_PATH_OSX = "/Applications/net.downloadhelper.coapp.app/Contents/MacOS/net.downloadhelper.coapp";
  let files = [PATH_CHROME_OSX, PATH_EDGE_OSX, PATH_FIREFOX_OSX];
  for (let file of files) {
    let content = await fs.readFile(file);
    let json = JSON.parse(content);
    assert("json.name", json.name, "net.downloadhelper.coapp");
    assert("json.description", json.description, "Video DownloadHelper companion app");
    assert("json.path", json.path, BINARY_PATH_OSX);
  }
  binary = BINARY_PATH_OSX;
}

const argv = minimist(process.argv.slice(2));
const bin_path = argv._[0] ?? binary;

let child = spawn_process(bin_path);
let exec = async (...args) => send(child.stdin, ...args);

let info = await exec("info");

assert("info.id", info.id, "net.downloadhelper.coapp");
assert("info.version", info.version, "1.7.0");

let env = await exec("env");
assert("env", env["FOO"], "BAR");

let r1 = await exec("ping", "foo");

assert("ping", r1, "foo");

try {
  await exec("fs.mkdirp", "/bin/foobar");
  assert_true("write exception", false);
} catch (_) {
  assert_true("write exception", true);
}

await fs.rm("/tmp/vdhcoapp-tests", {recursive: true, force: true});
let tmpdir = "/tmp/vdhcoapp-tests/bar";
await exec("fs.mkdirp", tmpdir);
let dir = await fs.stat(tmpdir);
assert_true("mkdirp", dir.isDirectory());

let bits = "70,79,79";
let file1 = await exec("tmp.file", {prefix: 'foo-', postfix: '.txt', tmpdir });
await exec("fs.write", file1.fd, bits);
await exec("fs.close", file1.fd);
let filename = path.basename(file1.path);
assert_true("tmp file prefix", filename.startsWith("foo-"));
assert_true("tmp file postfix", filename.endsWith(".txt"));

let content1 = await fs.readFile(file1.path);
assert("fs.write", content1, "FOO");
let content1_bis = await exec("fs.readFile", file1.path);
assert("fs.readFile", content1_bis.data.join(), bits);

let file2 = await exec("tmp.file", { tmpdir });
await exec("fs.write2", file2.fd, "QkFS");
await exec("fs.close", file2.fd);
tmpdir = path.dirname(file2.path);
let file2_new_path = tmpdir + "/newfile2";
await exec("fs.rename", file2.path, file2_new_path);

let content2 = await fs.readFile(file2_new_path);
assert("fs.write2", content2, "BAR");

let files = await exec("listFiles", tmpdir);
assert("listFiles len", files.length, 2);
assert("listFiles 1", files[0][1].path, file1.path);
assert("listFiles 2", files[1][1].path, file2_new_path);

let fd1 = await exec("fs.open", file1.path, "a");
await exec("fs.write2", fd1, "QkFS");
await exec("fs.close", fd1);

let stat1 = await exec("fs.stat", file1.path);
assert("fs.stat", stat1.size, 6);

await exec("fs.unlink", file2_new_path);
files = await exec("listFiles", tmpdir);
assert("listFiles len after unlink", files.length, 1);

let tmp = await exec("tmp.tmpName");

await exec("fs.copyFile", file1.path, tmp.filePath);
let tmpstat = await exec("fs.stat", tmp.filePath);
assert("fs.stat", tmpstat.size, 6);

await fs.rm(process.env.HOME + "/vdh-tmp", {recursive: true, force: true});
let uniq1 = await exec("makeUniqueFileName", "vdh-tmp", "foobar-42");
await fs.mkdir(uniq1.directory, {recursive: true});
await fs.writeFile(uniq1.filePath, "xx");
let uniq2 = await exec("makeUniqueFileName", "vdh-tmp", "foobar-42");
assert("makeUniqueFileName", uniq2.fileName, "foobar-43");

let vdhtmp = await exec("path.homeJoin", "vdh-tmp", "foobar-42");
let _ = await exec("fs.stat", vdhtmp);

let parents = await exec("getParents", "/tmp/vdhcoapp-foo");
assert("getParents", parents.join(""), "/tmp/");

let url = "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8";

let json = await exec("probe", url, true);

json = JSON.parse(json);

let duration = json.format.duration;

assert("duration", duration, 634.584);

let tick_count = 0;
let on_tick = (_, time) => {
  console.log("Timer:", `${time} / ${duration}`);
  tick_count += 1;
};

register_request_handler("convertOutput", on_tick);

let args = `-y -i ${url} -map m:variant_bitrate:246440 /tmp/out.mp4`;

let res = await exec("convert", args.split(" "), {
  progressTime: true
});

assert("convert", res.exitCode, 0);

let out_mp4 = await fs.stat("/tmp/out.mp4");

assert_true("output size", out_mp4.size > 24800000);
assert_true("output size", out_mp4.size < 25000000);

assert_true("ticked", tick_count > 10);

process.exit(0);
