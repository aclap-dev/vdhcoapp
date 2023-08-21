#!/usr/bin/env node

import * as fs from "node:fs/promises";
import { send } from "./rpc.mjs"
import { assert, assert_true } from "./assert.mjs"
import { spawn_process } from "./process.mjs"
import { register_request_handler } from "./rpc.mjs"

// See: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Native_manifests
const PATH_CHROME_OSX = "/Library/Google/Chrome/NativeMessagingHosts/net.downloadhelper.coapp.json";
const PATH_EDGE_OSX = "/Library/Microsoft/Edge/NativeMessagingHosts/net.downloadhelper.coapp.json";
const PATH_FIREFOX_OSX = "/Library/Application Support/Mozilla/NativeMessagingHosts/net.downloadhelper.coapp.json";
const BINARY_PATH_OSX = "/Applications/net.downloadhelper.coapp.app/Contents/MacOS/net.downloadhelper.coapp";

if (process.platform === "darwin") {
  const files = [PATH_CHROME_OSX, PATH_EDGE_OSX, PATH_FIREFOX_OSX];
  for (let file of files) {
    const content = await fs.readFile(file);
    const json = JSON.parse(content);
    assert("json.name", json.name, "net.downloadhelper.coapp");
    assert("json.description", json.description, "Video DownloadHelper companion app");
    assert("json.path", json.path, BINARY_PATH_OSX);
  }
}

const child = spawn_process(BINARY_PATH_OSX);
const exec = async (...args) => send(child.stdin, ...args);

// Tests:

const info = await exec("info");

const r1 = await exec("ping", "foo");

assert("ping", r1, "foo");

const env = await exec("env");

// FIXME: test env

const tmpdir = "/tmp/vdhcoapp-foo";

let error = null;
try {
  await exec("fs.mkdirp", "/foobar");
} catch (e) {
  error = e;
}
assert("error catching", error, "EROFS: read-only file system, mkdir '/foobar'");
await exec("fs.mkdirp", tmpdir);

let dir = await fs.stat(tmpdir);
assert_true("mkdirp", dir.isDirectory());

const file = await exec("tmp.file", {dir: tmpdir});
await exec("fs.write", file.fd, "70,79,79");
const content = await fs.readFile(file.path);
assert("fs.write", content, "FOO");

const url = "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8";

const json = await exec("resolve", url);

let total_ns = json.format.duration * 1000000;

const on_tick = (timer_id, ns) => {
  console.log("Timer:", timer_id, Math.floor(100 * ns / total_ns));
};

register_request_handler("consolidate_tick", on_tick);

try {
  await exec("consolidate", url, 3, 2, 42, "/tmp/js.mp4");
  console.log("consolidate success");
} catch (e) {
  console.error(e);
}

// let file = await fs.open("/tmp/vdhcoapp-foo/test.txt");
// console.log(file);

// request
// requestExtra
// requestBinary
// listFiles
// path.homeJoin
// getParents
// makeUniqueFileName
// tmp.file
// tmp.tmpName
// fs.write
// fs.close
// fs.open
// fs.stat
// fs.rename
// fs.inlink
// fs.copyFile
// fs.readFile
// convert
// probe
// play
// codecs
// formats
// open
// downloads.download
// downloads.search
// downloads.cancel

console.log("DONE");

process.exit(0);
