const os = require("os");
const fs = require("node:fs/promises");
const path = require("path");
const { spawn } = require('child_process');
const config = require('config.json');

const STORES = Object.keys(config.store);

function DisplayMessage(body, title) {
  if (title) {
    console.info(`${title} :`, body);
  } else {
    console.info(body);
  }
  if (os.platform() == "darwin") {
    spawn("/usr/bin/osascript", ["-e", "display notification \"" + body + "\" with title \"" + (title || "") + "\""]);
  }
}

function BuildManifests() {
  let manifest = {
    name: config.meta.id,
    description: config.meta.description,
    path: process.execPath,
  };
  const stores = {};
  for (let store in config.store) {
    stores[store] = {
      ...config.store[store].manifest,
      ...manifest
    };
  }
  return stores;
}

function GetMode() {
  let mode;
  if (process.argv.indexOf("--user") >= 0) {
    mode = "user";
  } else if (process.argv.indexOf("--system") >= 0) {
    mode = "system";
  } else if (process.getuid() == 0) {
    mode = "system";
  } else {
    mode = "user";
  }

  if (mode == "system") {
    if (!process.getuid() == 0) {
      console.error("Can't install system wide without root privilege. Re-run with sudo or with --user.");
      process.exit(1);
    }
  }
  return mode;
}

async function SetupFiles(platform, mode, uninstall) {
  let manifests = BuildManifests();
  let ops = [];
  for (let store of STORES) {
    let directories = config.store[store].msg_manifest_paths[platform][mode];
    directories.forEach((dir) => {
      if (mode == "user") {
        dir = path.resolve(os.homedir(), dir.replace("~", "."));
      }
      ops.push({
        path: dir + "/" + config.meta.id + ".json",
        content: JSON.stringify(manifests[store], " ", 2)
      });
    });
  }

  for (let op of ops) {
    if (uninstall) {
      try {
        console.log(`Removing file ${op.path}`);
        await fs.rm(op.path, { force: true });
      } catch (err) {
        DisplayMessage("Cannot delete manifest file: " + err.message, op.path);
        process.exit(1);
      }
    } else {
      try {
        console.log(`Writing ${op.path}`);
        let dir = path.dirname(op.path);
        await fs.mkdir(dir, { recursive: true });
        const data = new Uint8Array(Buffer.from(op.content));
        await fs.writeFile(op.path, data);
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
}

function install_uninstall(uninstall = false) {
  let mode = GetMode();
  let platform = os.platform();
  if (platform == "darwin") {
    SetupFiles("mac", mode, uninstall);
  } else if (platform == "linux") {
    SetupFiles("linux", mode, uninstall);
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
