const os = require("os");
const fs = require("fs-extra");
const path = require("path");
const { spawn, spawnSync } = require('child_process');
const config = require('../../dist/config.json');

function DisplayMessage(body, title) {
  if (title) {
    console.info(`${title} :`, body);
  } else {
    console.info(body);
  }
  let platform = os.platform();
  if (platform == "darwin") {
    spawn("/usr/bin/osascript", ["-e", "display notification \"" + body + "\" with title \"" + (title || "") + "\""]);
  } else if (platform == "win32") {
    spawnSync("msg", ["*", "/TIME:5", (title && title + ": " || "") + body]);
  }
}

function WriteRegistry(regRoot, path, key, value) {
  let fullKey = regRoot + path + "\\" + key;
  let args = ["ADD", fullKey, "/f", "/t", "REG_SZ", "/d", value];
  let ret = spawnSync("reg", args);
  if (ret.status !== 0) {
    DisplayMessage("Failed writing registry key " + fullKey);
    process.exit(1);
  }
}

function DeleteRegistry(regRoot, path, key) {
  let fullKey = regRoot + path + "\\" + key;
  let args = ["DELETE", fullKey, "/f"];
  spawnSync("reg", args);
}

function BuildManifests() {
  let manifest = {
    name: config.meta.id,
    description: config.meta.description,
    type: "stdio",
    path: process.execPath,
  };
  return {
    mozilla: {
      allowed_extensions: config.store.mozilla.extension_ids,
      ...manifest
    },
    google: {
      allowed_origins: config.store.google.extension_ids,
      ...manifest,
    },
    microsoft: {
      allowed_origins: config.store.microsoft.extension_ids,
      ...manifest
    }
  };
}

function GetMode() {
  let homeVar = "HOME";
  if (os.platform() == "win32") {
    homeVar = "USERPROFILE";
  }
  let mode;
  if (process.execPath.startsWith(process.env[homeVar])) {
    mode = "user";
  } else {
    mode = "system";
  }
  if (process.argv.indexOf("--user") >= 0) {
    mode = "user";
  } else if (process.argv.indexOf("--system") >= 0) {
    mode = "system";
  }
  return mode;
}

function SetupFiles(platform, mode, uninstall) {
  let manifests = BuildManifests();
  let ops = [];
  ["mozilla", "google", "microsoft"].forEach((store) => {
    let directories = config.store[store].msg_manifest_paths[platform][mode];
    directories.forEach((dir) => {
      if (mode == "user") {
        dir = path.resolve(process.env.HOME, dir.replace("~", "."));
      }
      ops.push({
        path: dir + "/" + config.meta.id + ".json",
        content: JSON.stringify(manifests[store], " ", 2)
      });
    });
  });

  for (let op of ops) {
    if (uninstall) {
      try {
        console.log(`Removing file ${op.path}`);
        fs.removeSync(op.path);
      } catch (err) {
        DisplayMessage("Cannot delete manifest file: " + err.message, op.path);
        process.exit(1);
      }
    } else {
      try {
        console.log(`Writing ${op.path}`);
        fs.outputFileSync(op.path, op.content, "utf8");
      } catch (err) {
        DisplayMessage("Cannot write manifest file: " + err.message, op.path);
        process.exit(1);
      }
    }
  }
  let text = "";
  if (uninstall) {
    text = config.meta.name + " has successfully unregistered itself.";
  } else {
    text = config.meta.name + " is ready to be used";
  }
  DisplayMessage(text, config.meta.name);
  process.exit(0);
}

function SetupReg(mode, uninstall) {
  let manifests = BuildManifests();
  if (mode == "system") {
    // check if elevated
    let processRet = spawnSync("net", ["session"]);
    if (processRet.exitCode != 0) {
      DisplayMessage("To setup " + config.name + " system-wide, you must execute the program as Administrator", config.name);
      return process.exit(1);
    }
  }
  let manifestsDir = path.resolve(path.dirname(process.execPath), "../manifests");
  try {
    fs.mkdirSync(manifestsDir, {recursive: true});
  } catch (e) {
    DisplayMessage("Error creating directory", manifestsDir, ":", e.message);
    process.exit(1);
  }

  let regRoot = "HKLM";
  if (mode == "user") {
    regRoot = "HKCU";
  }
  ["mozilla", "google", "microsoft"].forEach((store) => {
    let regs = [...config.store[store].msg_manifest_paths.regs];

    if (!uninstall) {
      let path = path.join(manifestsDir, "firefox." + config.meta.id + ".json");
      let content = manifests[store];
      fs.outputFileSync(path, JSON.stringify(content, null, 4), "utf8");
    }

    for (let reg of regs) {
      if (!uninstall) {
        WriteRegistry(regRoot, reg, config.meta.id, path);
      } else {
        DeleteRegistry(regRoot, reg, config.meta.id);
      }
    }
  });
  let text = config.name + " is ready to be used";
  DisplayMessage(text);
}

function install_uninstall(uninstall = false) {
  let mode = GetMode();
  let platform = os.platform();
  if (platform == "darwin") {
    SetupFiles("mac", mode, uninstall);
  } else if (platform == "linux") {
    SetupFiles("linux", mode, uninstall);
  } else if (platform == "win32") {
    SetupReg(mode, uninstall);
  } else {
    DisplayMessage("Unsupported platform: " + os.platform());
  }
}

exports.install = () => {
  console.log("Installing…");
  install_uninstall();
};

exports.uninstall = () => {
  console.log("Uninstalling…");
  install_uninstall(true);
};
