#!/usr/bin/env node

import * as fs from "node:fs/promises";
import * as fss from "node:fs";
import { send } from "./rpc.mjs"
import { assert, assert_true } from "./assert.mjs"
import { spawn_process } from "./process.mjs"
import { register_request_handler } from "./rpc.mjs"

// See: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Native_manifests
let PATH_CHROME_OSX = "/Library/Google/Chrome/NativeMessagingHosts/net.downloadhelper.coapp.json";
let PATH_EDGE_OSX = "/Library/Microsoft/Edge/NativeMessagingHosts/net.downloadhelper.coapp.json";
let PATH_FIREFOX_OSX = "/Library/Application Support/Mozilla/NativeMessagingHosts/net.downloadhelper.coapp.json";
let BINARY_PATH_OSX = "/Applications/net.downloadhelper.coapp.app/Contents/MacOS/net.downloadhelper.coapp";

if (process.platform === "darwin") {
  let files = [PATH_CHROME_OSX, PATH_EDGE_OSX, PATH_FIREFOX_OSX];
  for (let file of files) {
    let content = await fs.readFile(file);
    let json = JSON.parse(content);
    assert("json.name", json.name, "net.downloadhelper.coapp");
    assert("json.description", json.description, "Video DownloadHelper companion app");
    assert("json.path", json.path, BINARY_PATH_OSX);
  }
}

let child = spawn_process(BINARY_PATH_OSX);
let exec = async (...args) => send(child.stdin, ...args);

// Tests:
// FIXME: test env & info

let _info = await exec("info");
let _env = await exec("env");

let r1 = await exec("ping", "foo");

assert("ping", r1, "foo");

let tmpdir = "/tmp/vdhcoapp-foo";

fs.rm(tmpdir, {recursive: true, force: true});
fs.rm(process.env.HOME + "/vdh-tmp", {recursive: true, force: true});

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

let bits = "70,79,79";
let file1 = await exec("tmp.file", {dir: tmpdir});
await exec("fs.write", file1.fd, bits);
await exec("fs.close", file1.fd);

let file2 = await exec("tmp.file", {dir: tmpdir});
await exec("fs.write2", file2.fd, "QkFS");
await exec("fs.close", file2.fd);
let file2_new_path = tmpdir + "/newfile2";
await exec("fs.rename", file2.path, file2_new_path);

let content1 = await fs.readFile(file1.path);
assert("fs.write", content1, "FOO");

let content1_bis = await exec("fs.readFile", file1.path);
assert("fs.readFile", content1_bis.data.join(), bits);

let content2 = await fs.readFile(file2_new_path);
assert("fs.write2", content2, "BAR");

let files = await exec("listFiles", tmpdir);
assert("listFiles len", files.length, 2);
assert("listFiles 1", files[1][1].path, file1.path);
assert("listFiles 2", files[0][1].path, file2_new_path);

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

let uniq1 = await exec("makeUniqueFileName", "vdh-tmp", "foobar-42");
fs.mkdir(uniq1.directory, {recursive: true});
await fs.writeFile(uniq1.filePath, "xx");
let uniq2 = await exec("makeUniqueFileName", "vdh-tmp", "foobar-42");
assert("makeUniqueFileName", uniq2.fileName, "foobar-43");

let vdhtmp = await exec("path.homeJoin", "vdh-tmp", "foobar-42");
let _ = await exec("fs.stat", vdhtmp);

let parents = await exec("getParents", "/tmp/vdhcoapp-foo");
assert("getParents", parents.join(""), "/tmp/");

// ------------------------

process.exit(0);

let url = "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8";

let json = await exec("resolve", url);

let total_ns = json.format.duration * 1000000;

let on_tick = (timer_id, ns) => {
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
