import os from "os";
import path from "path";
import { spawn, exec } from "child_process";
import config from "./config.js";

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

let fs;
if (process.versions.node.startsWith("10")) {
  fs = await require('fs').promises;
} else {
  fs = await require('node:fs/promises');
}

const STORES = Object.keys(config.store);

function exec_p(cmd) {
  return new Promise((ok, ko) => {
    exec(cmd, (error) => {
      if (error) {
        ko(error);
      } else {
        ok();
      }
    });
  });
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
  function expand_tilde(p) {
    if (p.startsWith("~")) {
      return path.resolve(os.homedir(), p.replace("~", "."));
    } else {
      return p;
    }
  }

  let manifests = BuildManifests();
  let ops = [];
  for (let store of STORES) {
    let directories = config.store[store].msg_manifest_paths[platform][mode];
    for (let dir of directories) {
      if (typeof dir != "string") {
        let {path, only_if_dir_exists} = dir;
        dir = path;
        try {
          await fs.stat(expand_tilde(only_if_dir_exists));
        } catch (_) {
          // Parents doesn't exist. Skip this file.
          continue;
        }
      }
      dir = expand_tilde(dir);
      ops.push({
        path: dir + "/" + config.meta.id + ".json",
        content: JSON.stringify(manifests[store], " ", 2)
      });
    }
  }

  for (let op of ops) {
    if (uninstall) {
      try {
        await fs.unlink(op.path);
        console.log(`Removing file ${op.path}`);
      } catch (_) {
        // Nothing to unlink
      }
    } else {
      try {
        console.log(`Writing ${op.path}`);
        let dir = path.dirname(op.path);
        try {
          await fs.mkdir(dir, { recursive: true });
        } catch (_) {
          // With node 10, this fails if directory exists.
        }
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

async function PrepareFlatpak() {
  let install_dir = path.dirname(process.execPath);
  try {
    await exec_p("flatpak --version");
  } catch (_) {
    return;
  }
  console.log("Flatpak is installed. Making the coapp available from browser sandboxes:");
  for (let id of config.flatpak.ids) {
    try {
      await exec_p(`flatpak override --user --filesystem=${install_dir}:ro ${id}`);
      console.log(`Linked coapp within ${id}.`);
    } catch (_) { /* flatpak not installed */ }
  }
}

async function install_uninstall(uninstall = false) {
  if (process.env.VDHCOAPP_INSTALL_ON_BUILDTIME != "1") {
    // VDHCOAPP_INSTALL_ON_BUILDTIME=1 vdhcoapp install
    return await install_uninstall_on_runtime(uninstall);
  }
  let platform = os.platform();
  if (platform == "darwin") {
    let mode = GetMode();
    SetupFiles("mac", mode, uninstall);
  } else if (platform == "linux") {
    let mode = GetMode();
    if (mode == "user") {
      await PrepareFlatpak();
    }
    SetupFiles("linux", mode, uninstall);
  } else {
    DisplayMessage("Installation from command line not supported on " + os.platform());
  }
}

export const install = async () => {
  console.log("Installing…");
  await install_uninstall();
};

export const uninstall = async () => {
  console.log("Uninstalling…");
  await install_uninstall(true);
};

async function fs_exists(path) {
  try {
    await fs.access(path, fs.constants.F_OK);
    return true;
  }
  catch (e) {
    if (e.errno == -2) {
      return false;
    }
    throw e;
  }
}

async function install_uninstall_on_runtime(uninstall) {
  const glob = (await import('glob')).default;
  const srcMainJsPath = await fs.realpath(process.argv[1]);
  const srcConfigDirPath = path.join(path.dirname(srcMainJsPath), "../config", os.platform());
  if (!await fs_exists(srcConfigDirPath)) {
    console.error(`error: not found config dir: ${srcConfigDirPath}`);
    process.exit(1);
  }
  const pattern = "**/*.json";
  const options = {
    cwd: srcConfigDirPath,
    nodir: true, // Do not match directories, only files
    follow: true, // Follow symlinked directories when expanding ** patterns
    dot: true, // match hidden paths
    //realpath: true, // call fs.realpath on all of the results
  };
  const homedir = os.homedir();
  for (const configPath of glob.sync(pattern, options)) {
    const dstConfigPath = path.join(homedir, configPath);
    const dstConfigDirPath = path.join(homedir, path.dirname(configPath), "..");
    if (!await fs_exists(dstConfigDirPath)) {
      console.log(`missing ${dstConfigDirPath}`);
      continue;
    }
    const srcConfigPath = await fs.realpath(path.join(srcConfigDirPath, configPath));
    if (uninstall) {
      if (await fs_exists(dstConfigPath)) {
        console.log(`deleting ${dstConfigPath}`);
        await fs.unlink(dstConfigPath);
      }
      continue;
    }
    if (!await fs_exists(dstConfigPath)) {
      console.log(`creating ${dstConfigPath}`);
      await fs.mkdir(path.dirname(dstConfigPath), { recursive: true });
      await fs.symlink(srcConfigPath, dstConfigPath);
      continue;
    }
    // check if file is up to date
    const oldLinkTarget = await fs.realpath(dstConfigPath);
    if (oldLinkTarget == srcConfigPath) {
      // file is up to date
      console.log(`keeping ${dstConfigPath}`);
      continue;
    }
    // found different file. delete the old file
    console.log(`replacing ${dstConfigPath}`);
    await fs.unlink(dstConfigPath);
    await fs.symlink(srcConfigPath, dstConfigPath);
  }
}
