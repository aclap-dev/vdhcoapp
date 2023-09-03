const os = require("os");
const fs = require("fs");
const path = require("path");
const { spawn, spawnSync } = require('child_process');
const config = require('../../dist/config.json');

const STORES = ["mozilla", "google", "microsoft"];

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
  } else if (process.argv.indexOf("--flatpack") >= 0) {
    mode = "platform";
  } else if (process.argv.indexOf("--system") >= 0) {
    mode = "system";
  } else if (!process.execPath.startsWith(os.homedir())) {
    mode = "system";
  } else {
    mode = "user";
  }

  if (mode == "system") {
    if (!process.getuid() == 0) {
      console.error("Can't install system wide without root privilege. Re-run with sudo.");
      process.exit(1);
    }
  }

  if (mode == "flatpack") {
    let process = spawnSync("flatpack", ["-v"]);
    if (process.error) {
      console.error("flatpack returned an error", process.error);
      process.exit(1);
    }
  }
  return mode;
}

async function InstallBinariesInFlatpack(uninstall) {
  let dir = path.dirname(process.execPath);
  let binaries = ["ffmpeg", "ffprobe", config.package.binary_name].map((name) => {
    return path.resolve(dir, name);
  });
  for (let store of STORES) {
    let packs = config.store[store].msg_manifest_paths.flatpack;
    for (let pack of packs) {
      dir = path.resolve(os.homedir(), ".var/app", pack);
      if (fs.existsSync(dir)) {
        console.log(`Flatpack for ${pack} seems to exist. Installing.`);
        dir = path.resolve(dir, config.meta.id);
        if (uninstall && fs.existsSync(dir)) {
          fs.unlink(dir, {recursive: true});
        } else {
          let xxx = fs.mkdir(dir, {recursive: true});
          console.log("FIXME", xxx);
          for (let bin of binaries) {
            fs.copyFileSync(bin, dir);
          }
          let args = `run --command=${binaries[2]} ${pack} install --user`;
          let process = spawnSync("flatpack", args.split(" "));
          if (process.error) {
            console.error("flatpack returned an error", process.error);
            process.exit(1);
          }
        }
      }
    }
  }
}

function SetupFiles(platform, mode, uninstall) {
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
}

function install_uninstall(uninstall = false) {
  let mode = GetMode();
  let platform = os.platform();
  if (platform == "darwin") {
    SetupFiles("mac", mode, uninstall);
  } else if (platform == "linux" && mode == "flatpack") {
    InstallBinariesInFlatpack(uninstall);
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
