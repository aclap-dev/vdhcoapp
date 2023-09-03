const os = require("os");
const fs = require("node:fs/promises");
const path = require("path");
const { spawn, spawnSync } = require('child_process');
const config = require('../../dist/config.json');

const STORES = ["mozilla", "google", "microsoft"];

async function FileExist(path) {
  try {
    await fs.stat(path);
    return true;
  } catch (_) {
    return false;
  }
}

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
  } else if (process.argv.indexOf("--flatpak") >= 0) {
    mode = "flatpak";
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

  if (mode == "flatpak") {
    let process = spawnSync("flatpak", ["-h"]);
    if (process.error) {
      console.error("flatpak returned an error", process.error);
      process.exit(1);
    }
  }
  return mode;
}

async function InstallBinariesInFlatpak(uninstall) {
  let dir = path.dirname(process.execPath);
  let binaries = ["ffmpeg", "ffprobe", "xdg-open", config.package.binary_name].map((name) => {
    return path.resolve(dir, name);
  });
  for (let store of STORES) {
    let paks = config.store[store].msg_manifest_paths.linux.flatpak;
    for (let pak of paks) {
      dir = path.resolve(os.homedir(), ".var/app", pak);
      if (await FileExist(dir)) {
        console.log(`Flatpak for ${pak} seems to exist. Installing.`);
        dir = path.resolve(dir, config.meta.id);
        let exist = await FileExist(dir);
        if (uninstall && exist) {
          await fs.rm(dir, {recursive: true});
        } else {
          await fs.mkdir(dir, {recursive: true});
          let dest = binaries.map((bin) => path.resolve(dir, path.basename(bin)));
          for (let i = 0; i < dest.length; i++) {
            await fs.copyFile(binaries[i], dest[i]);
          }
          let args = `run --command=${dest[3]} ${pak} install --user`;
          let process = spawnSync("flatpak", args.split(" "));
          if (process.status != 0) {
            console.error("flatpak returned an error:");
            console.error(process.stderr.toString());
            process.exit(1);
          }
          console.log(`CoApp registered for ${pak}`);
        }
      }
    }
  }
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
        await fs.unlink(op.path);
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
  } else if (platform == "linux" && mode == "flatpak") {
    InstallBinariesInFlatpak(uninstall);
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
