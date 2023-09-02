const os = require("os");
const fs = require("fs-extra");
const path = require("path");
const { spawn } = require('child_process');
const config = require('../../dist/config.json');

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
      ...config.store[store],
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
  } else if (!process.execPath.startsWith(os.homedir())) {
    mode = "system";
  } else {
    mode = "user";
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
        dir = path.resolve(os.homedir(), dir.replace("~", "."));
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
