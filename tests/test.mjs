#!/usr/bin/env node

import * as fs from "node:fs/promises";
import { homedir } from 'os';
import { send } from "./rpc.mjs";
import { assert, assert_true, assert_deep_equal } from "./assert.mjs";
import { spawn_process } from "./process.mjs";
import { register_request_handler } from "./rpc.mjs";
import minimist from "minimist";
import path from "path";
import { expected_codecs, expected_formats } from "./codecs.mjs";

if (!process.versions.node.startsWith("18.")) {
  console.error("Error: run test with Node 18");
  process.exit(1);
}

const install_locations = {
  linux: {
    bin: "/usr/local/bin/net.downloadhelper.coapp",
    user: [
      "/.mozilla/native-messaging-hosts/",
      "/.config/google-chrome/NativeMessagingHosts/",
      "/.config/chromium/NativeMessagingHosts/",
      "/.config/microsoft-edge/NativeMessagingHosts",
      "/.config/vivaldi/NativeMessagingHosts",
      "/.config/vivaldi-snapshot/NativeMessagingHosts",
      "/.config/opera/NativeMessagingHosts",
      "/.config/BraveSoftware/Brave-Browser/NativeMessagingHosts",
      "/.config/opera/NativeMessagingHosts"
    ],
    system: [
      "/etc/opt/edge/native-messaging-hosts/",
      "/etc/opt/chrome/native-messaging-hosts/",
      "/etc/chromium/native-messaging-hosts/"
    ]
  },

  darwin: {
    bin: "/Applications/net.downloadhelper.coapp.app/Contents/MacOS/net.downloadhelper.coapp",
    user: [
      "/Library/Application Support/Vivaldi/NativeMessagingHosts/",
      "/Library/Application Support/Chromium/NativeMessagingHosts/",
      "/Library/Application Support/Google/Chrome Beta/NativeMessagingHosts/",
      "/Library/Application Support/Google/Chrome Canary/NativeMessagingHosts/",
      "/Library/Application Support/Google/Chrome Dev/NativeMessagingHosts/",
      "/Library/Application Support/Google/Chrome/NativeMessagingHosts/",
      "/Library/Application Support/Microsoft Edge Beta/NativeMessagingHosts/",
      "/Library/Application Support/Microsoft Edge Canary/NativeMessagingHosts/",
      "/Library/Application Support/Microsoft Edge Dev/NativeMessagingHosts/",
      "/Library/Application Support/Microsoft Edge/NativeMessagingHosts/",
      "/Library/Application Support/Mozilla/NativeMessagingHosts/",
      "/Library/Application Support/Opera/NativeMessagingHosts/",
      "/Library/Application Support/BraveSoftware/Brave-Browser/NativeMessagingHosts/",
    ],
    system: [
      "/Library/Google/Chrome/NativeMessagingHosts/",
      "/Library/Microsoft/Edge/NativeMessagingHosts/",
      "/Library/Application Support/Mozilla/NativeMessagingHosts/"
    ]
  },
};

let bin_path;
let arg = minimist(process.argv.slice(2))._[0];
if (!arg) {
  bin_path = install_locations[process.platform].bin;
} else {
  bin_path = path.resolve(arg);
}

let child = spawn_process(bin_path);

let exec = async (...args) => send(child.stdin, ...args);

{
  for (let dir of install_locations[process.platform].user) {
    let json_path = path.join(homedir(), dir, "net.downloadhelper.coapp.json");
    try {
      let json = await fs.readFile(json_path);
      let registered_path = JSON.parse(json).path;
      assert("registered path", registered_path, bin_path);
    } catch (e) {
      console.error(`Can't find manifest in ${dir}`);
    }
  }
}

{
  let url = "http://echo.jsontest.com/foo/bar";
  let options = {
    headers: [
      {name: "Accept", value: "application/json"}
    ]
  };
  let content = await exec("request", url, options);
  assert("request", JSON.parse(content.data).foo, "bar");
}

{
  let url = "https://picsum.photos/id/237/20";
  let bin = await exec("requestBinary", url);
  let hash = bin.data.data.reduce((a, b) => a + b, 0);
  assert("requestBinary", hash, 51268);
}

{
  let url = "https://picsum.photos/id/237/800";
  let id = await exec("downloads.download", {
    url: url,
    filename: "test.png",
    directory: "/tmp"
  });
  assert("downloads.download", id, 1);

  let bytes = await new Promise((ok) => {
    let check = async () => {
      let state = await exec("downloads.search", { id });
      if (state.length > 0 && state[0].state == "complete") {
        ok(state[0].bytesReceived);
      } else {
        setTimeout(check, 100);
      }
    };
    check();
  });

  let sestat = await fs.stat("/tmp/test.png");
  assert("downloads.search", sestat.size, bytes);
}

let old_coapp;

{
  let info = await exec("info");
  assert("info.id", info.id, "net.downloadhelper.coapp");
  if (info.version == "1.6.3") {
    old_coapp = true;
  } else if (info.version == "1.7.0") {
    old_coapp = false;
  } else {
    assert("info.version", false);
  }
}

{
  let env = await exec("env");
  assert("env", env["FOO"], "BAR");
}

{
  let r1 = await exec("ping", "foo");
  assert("ping", r1, "foo");
}

if (!old_coapp) {
  const codecs = await exec("codecs");
  assert_deep_equal("codecs", codecs, expected_codecs);
  const formats = await exec("formats");
  assert_deep_equal("formats", formats, expected_formats);
}

{
  try {
    await exec("fs.mkdirp", "/bin/foobar");
    assert_true("write exception", false);
  } catch (_) {
    assert_true("write exception", true);
  }
}

let tmp_dir = "/tmp/vdhcoapp-tests/tests/";
let tmp_options;
await fs.rm(tmp_dir, {recursive: true, force: true});
if (old_coapp) {
  tmp_options = {template: `${tmp_dir}/foo-XXXXXX.raw` };
} else {
  tmp_options = {prefix: 'foo-', postfix: '.raw', tmpdir: tmp_dir };
}

{
  await exec("fs.mkdirp", tmp_dir);
  let dir = await fs.stat(tmp_dir);
  assert_true("mkdirp", dir.isDirectory());
}

let file1_path;
{
  let bits = "70,79,79"; // FOO
  let file = await exec("tmp.file", tmp_options);
  file1_path = path.resolve(file.path);
  await exec("fs.write", file.fd, bits);
  await exec("fs.close", file.fd);
  let filename = path.basename(file.path);
  assert_true("tmp file prefix", filename.startsWith("foo-"));
  assert_true("tmp file postfix", filename.endsWith(".raw"));

  let content = await fs.readFile(file.path);
  assert("fs.write", content, "FOO");
  content = await exec("fs.readFile", file.path);
  assert("fs.readFile", content.data.join(), bits);
}

let file2_path;
{
  let file = await exec("tmp.file", tmp_options);
  if (old_coapp) {
    await exec("fs.write", file.fd, "66,65,82");
  } else {
    await exec("fs.write2", file.fd, "QkFS");
  }
  await exec("fs.close", file.fd);
  file2_path = path.resolve(tmp_dir, "newfile2");
  await exec("fs.rename", file.path, file2_path);

  let content = await fs.readFile(file2_path);
  assert("fs.write | fs.write2", content, "BAR");
}

{
  let files = await exec("listFiles", tmp_dir);
  assert("listFiles len", files.length, 2);
  assert("listFiles 1", files[0][1].path, file1_path);
  assert("listFiles 2", files[1][1].path, file2_path);
}

{
  let fd = await exec("fs.open", file1_path, "a");
  if (old_coapp) {
    await exec("fs.write", fd, "66,65,82");
  } else {
    await exec("fs.write2", fd, "QkFS");
  }
  await exec("fs.close", fd);
}

{
  let stat = await exec("fs.stat", file1_path);
  assert("fs.stat", stat.size, 6);
}

{
  await exec("fs.unlink", file2_path);
  let files = await exec("listFiles", tmp_dir);
  assert("listFiles len after unlink", files.length, 1);
}

{
  let tmp = await exec("tmp.tmpName");
  await exec("fs.copyFile", file1_path, tmp.filePath);
  let tmpstat = await exec("fs.stat", tmp.filePath);
  assert("fs.stat", tmpstat.size, 6);
}

{
  await fs.rm(process.env.HOME + "/vdh-tmp", {recursive: true, force: true});
  let uniq1 = await exec("makeUniqueFileName", "vdh-tmp", "foobar-42");
  await fs.mkdir(uniq1.directory, {recursive: true});
  await fs.writeFile(uniq1.filePath, "xx");
  let uniq2 = await exec("makeUniqueFileName", "vdh-tmp", "foobar-42");
  assert("makeUniqueFileName", uniq2.fileName, "foobar-43");
  let vdhtmp = await exec("path.homeJoin", "vdh-tmp", "foobar-42");
  let _ = await exec("fs.stat", vdhtmp);
  await fs.rm(process.env.HOME + "/vdh-tmp", {recursive: true, force: true});
}

{
  let parents = await exec("getParents", tmp_dir);
  assert("getParents", parents.join(""), "/tmp/vdhcoapp-tests/tmp/");
}

{
  let url = "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8";
  let json = await exec("probe", url, true);
  json = JSON.parse(json);
  let duration = json.format.duration;
  assert("duration", duration, 634.584);

  let tick_count = 0;
  let on_tick = (_, time) => {
    let progress = Math.ceil(100 * time / duration);
    progress = `  ${progress}%  `;
    if (process.stdout.isTTY) {
      process.stdout.clearLine(0);
      process.stdout.cursorTo(0);
      process.stdout.write(progress);
    } else {
      console.log(progress);
    }
    tick_count += 1;
  };

  register_request_handler("convertOutput", on_tick);

  let args = `-y -i ${url} -map m:variant_bitrate:246440 ${tmp_dir}/out.mp4`;

  let res = await exec("convert", args.split(" "), {
    progressTime: true
  });

  console.log(""); // clear on_tick missing CR

  assert("convert", res.exitCode, 0);

  let out_mp4 = await fs.stat(`${tmp_dir}/out.mp4`);

  assert_true("output size", (out_mp4.size > 24800000) && (out_mp4.size < 25000000));
  assert_true("ticked", tick_count > 10);
}

{
  await exec("open", "/tmp/test.png");
  assert_true("open", true);
}

exec("quit");

let exit_code = await child.exiting;

assert("quit", exit_code, 0);

process.exit(0);
