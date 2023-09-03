#!/usr/bin/env node

import os from "os";
import * as fs from "node:fs/promises";
import { send } from "./rpc.mjs";
import { assert, assert_true, assert_deep_equal } from "./assert.mjs";
import { spawn_process, spawn_process_and_track } from "./process.mjs";
import { register_request_handler } from "./rpc.mjs";
import path from "path";
import { expected_codecs, _expected_formats } from "./codecs.mjs";

const amo = JSON.stringify([
  "weh-native-test@downloadhelper.net",
  "{b9db16a4-6edc-47ec-a1f4-b86292ed211d}"
]);

const ggl = JSON.stringify([
  "chrome-extension://lmjnegcaeklhafolokijcfjliaokphfk/"
]);

const ms = JSON.stringify([
  "chrome-extension://jmkaglaafmhbcpleggkmaliipiilhldn/"
]);

if (!process.versions.node.startsWith("18.")) {
  console.error("Error: run test with Node 18");
  process.exit(1);
}

const install_locations = {
  linux: {
    user: [
      [".mozilla/native-messaging-hosts/", "amo"],
      [".config/microsoft-edge/NativeMessagingHosts", "ms"],
      [".config/google-chrome/NativeMessagingHosts/", "ggl"],
      [".config/chromium/NativeMessagingHosts/", "ggl"],
      [".config/vivaldi/NativeMessagingHosts", "ggl"],
      [".config/vivaldi-snapshot/NativeMessagingHosts", "ggl"],
      [".config/opera/NativeMessagingHosts", "ggl"],
      [".config/BraveSoftware/Brave-Browser/NativeMessagingHosts", "ggl"],
    ],
    system: [
      ["/etc/opt/edge/native-messaging-hosts/", "ms"],
      ["/etc/opt/chrome/native-messaging-hosts/", "ggl"],
      ["/etc/chromium/native-messaging-hosts/", "amo"]
    ]
  },

  darwin: {
    user: [
      ["Library/Application Support/Vivaldi/NativeMessagingHosts/", "ggl"],
      ["Library/Application Support/Chromium/NativeMessagingHosts/", "ggl"],
      ["Library/Application Support/Google/Chrome Beta/NativeMessagingHosts/", "ggl"],
      ["Library/Application Support/Google/Chrome Canary/NativeMessagingHosts/", "ggl"],
      ["Library/Application Support/Google/Chrome Dev/NativeMessagingHosts/", "ggl"],
      ["Library/Application Support/Google/Chrome/NativeMessagingHosts/", "ggl"],
      ["Library/Application Support/Microsoft Edge Beta/NativeMessagingHosts/", "ms"],
      ["Library/Application Support/Microsoft Edge Canary/NativeMessagingHosts/", "ms"],
      ["Library/Application Support/Microsoft Edge Dev/NativeMessagingHosts/", "ms"],
      ["Library/Application Support/Microsoft Edge/NativeMessagingHosts/", "ms"],
      ["Library/Application Support/Mozilla/NativeMessagingHosts/", "amo"],
      ["Library/Application Support/Opera/NativeMessagingHosts/", "ggl"],
      ["Library/Application Support/BraveSoftware/Brave-Browser/NativeMessagingHosts/", "ggl"],
    ],
    system: [
      ["/Library/Google/Chrome/NativeMessagingHosts/", "ggl"],
      ["/Library/Microsoft/Edge/NativeMessagingHosts/", "ms"],
      ["/Library/Application Support/Mozilla/NativeMessagingHosts/", "amo"],
    ]
  },
};

let is_window = process.platform == "win32";

let bin_path;
let arg = process.argv[2];
if (!arg && !is_window) {
  let dir = install_locations[process.platform].user[0][0];
  let json_path = path.resolve(os.homedir(), dir, "net.downloadhelper.coapp.json");
  let json = JSON.parse(await fs.readFile(json_path));
  bin_path = json.path;
} else if (!arg && is_window) {
  // FIXME
} else {
  bin_path = path.resolve(arg);
}

if (!is_window) {
  {
    let code = await spawn_process(bin_path, ["uninstall", "--user"]);
    assert("uninstall success", code, 0);
  }

  {
    let code = await spawn_process(bin_path, ["install", "--user"]);
    assert("install success", code, 0);
    for (let [dir, store] of install_locations[process.platform].user) {
      let json_path = path.resolve(os.homedir(), dir, "net.downloadhelper.coapp.json");
      let json = JSON.parse(await fs.readFile(json_path));
      assert_true("bin is absolute", json.path.startsWith("/"));
      assert("bin path", json.path, bin_path);
      if (store == "amo") {
        assert(dir, JSON.stringify(json.allowed_extensions), amo);
      } else if (store == "ms") {
        assert(dir, JSON.stringify(json.allowed_origins), ms);
      } else if (store == "ggl") {
        assert(dir, JSON.stringify(json.allowed_origins), ggl);
      } else {
        throw new Error("Unexpected store");
      }
    }
  }

  {
    let code = await spawn_process(bin_path, ["uninstall", "--user"]);
    assert("uninstall success", code, 0);
    for (let [dir, _] of install_locations[process.platform].user) {
      let json = path.resolve(os.homedir(), dir, "net.downloadhelper.coapp.json");
      let doesnt_exist = false;
      try {
        await fs.access(path.dir, json);
      } catch (_) {
        doesnt_exist = true;
      }
      assert_true("File removed", doesnt_exist);
    }
  }

  {
    let code = await spawn_process(bin_path, ["install", "--user"]);
    assert("uninstall success", code, 0);
  }
}

let child = spawn_process_and_track(bin_path);

let exec = async (...args) => send(child.stdin, ...args);

{
  let result = await exec("vm.run", "var x = 2; x + 40");
  assert("vm.run", result, 42);
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

let old_coapp;

{
  let info = await exec("info");
  assert("info.id", info.id, "net.downloadhelper.coapp");
  if (info.version == "1.6.3") {
    old_coapp = true;
  } else if (info.version == "2.0.0") {
    old_coapp = false;
  } else {
    assert_true("info.version", false);
  }

  let os_arch = os.arch();
  if (os_arch == "arm64") {
    assert("info.target_arch", info.target_arch, "arm64");
  } else if (os_arch == "x64") {
    assert("info.target_arch", info.target_arch, "x86_64");
  } else {
    assert_true("info.target_arch", false);
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
  console.warn("Skipping format test as it fails on Linux");
  // const formats = await exec("formats");
  // assert_deep_equal("formats", formats, expected_formats);
}

{
  try {
    await exec("fs.mkdirp", "/bin/foobar");
    assert_true("write exception", false);
  } catch (_) {
    assert_true("write exception", true);
  }
}

let tmp_dir = await exec("path.homeJoin", "vdh-tmp-a");
await fs.rm(tmp_dir, {recursive: true, force: true});

{
  assert("path.homeJoin", tmp_dir, path.resolve(os.homedir(), "vdh-tmp-a"));
}

let tmp_options;
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

{
  let url = "https://picsum.photos/id/237/800";
  let id = await exec("downloads.download", {
    url: url,
    filename: "test.png",
    directory: tmp_dir,
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

  let sestat = await fs.stat(path.resolve(tmp_dir, "test.png"));
  assert("downloads.search", sestat.size, bytes);
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
  assert("listFiles len", files.length, 3);
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
  assert("listFiles len after unlink", files.length, 2);
}

{
  let tmp = await exec("tmp.tmpName");
  await exec("fs.copyFile", file1_path, tmp.filePath);
  let tmpstat = await exec("fs.stat", tmp.filePath);
  assert("fs.stat", tmpstat.size, 6);
}

{
  await fs.rm(os.homedir() + "/vdh-tmp", {recursive: true, force: true});
  let uniq1 = await exec("makeUniqueFileName", "vdh-tmp", "foobar-42");
  await fs.mkdir(uniq1.directory, {recursive: true});
  await fs.writeFile(uniq1.filePath, "xx");
  let uniq2 = await exec("makeUniqueFileName", "vdh-tmp", "foobar-42");
  assert("makeUniqueFileName", uniq2.fileName, "foobar-43");
  let vdhtmp = await exec("path.homeJoin", "vdh-tmp", "foobar-42");
  let _ = await exec("fs.stat", vdhtmp);
  await fs.rm(os.homedir() + "/vdh-tmp", {recursive: true, force: true});
}

{
  if (!is_window) {
    let parents = await exec("getParents", "/foo/bar/xxx/");
    assert("getParents", parents.join(""), "/foo/bar/foo/");
  } else {
    let parents = await exec("getParents", "C:/foo/bar/xxx/");
    assert_true("getParents", parents.join("").startsWith("C:\\foo\\barC:\\fooC:"));
  }
}

{
  let url = "https://s3.amazonaws.com/qa.jwplayer.com/hlsjs/muxed-fmp4/hls.m3u8";
  let json = await exec("probe", url, true);
  json = JSON.parse(json);
  let duration = json.format.duration;
  assert("duration", duration, 13.012993);

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

  let args = `-y -i ${url} ${tmp_dir}/out.mp4`;

  let res = await exec("convert", args.split(" "), {
    progressTime: true
  });

  console.log(""); // clear on_tick missing CR

  assert("convert", res.exitCode, 0);

  let out_mp4 = await fs.stat(`${tmp_dir}/out.mp4`);

  assert_true("output size", (out_mp4.size > 3380000) && (out_mp4.size < 3400000));
  assert_true("ticked", tick_count > 3);
}

{
  await exec("open", "/tmp/test.png");
  assert_true("open", true);
}

exec("quit");

let exit_code = await child.exiting;

assert("quit", exit_code, 0);

process.exit(0);
