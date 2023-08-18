/*
vdhcoapp: Video DownloadHelper Companion app

Copyright (C) 2017  downloadhelper.net

This file is part of vdhcoapp.

Vdhcoapp is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 2 of the License, or
(at your option) any later version.

Vdhcoapp is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with Vdhcoapp. If not, see <http://www.gnu.org/licenses/>
*/

const os = require("os");
const fs = require("fs-extra");
const path = require("path");
const { spawn, spawnSync } = require('child_process');

function DisplayMessage(body,title) {
	switch(os.platform()) {
		case "darwin":
			spawn("/usr/bin/osascript",["-e","display notification \""+
				body+"\" with title \""+(title||"")+"\""]);
			break;
		case "win32":
			spawnSync("msg",["*","/TIME:5",(title && title+": " || "") + body]);
			break;
		default:
			console.info((title && title+": " || "") + body);
	}
}

function GetManifests(config) {
	return {
		firefox: {
			name: config.id,
			description: config.description,
			path: process.execPath,
			type: "stdio",
			allowed_extensions: config.allowed_extensions.firefox
		},
		chrome: {
			name: config.id,
			description: config.description,
			path: process.execPath,
			type: "stdio",
			allowed_origins: config.allowed_extensions.chrome.concat(
				config.allowed_extensions.brave,
				config.allowed_extensions.vivaldi
			)
		},
		edge: {
			name: config.id,
			description: config.description,
			path: process.execPath,
			type: "stdio",
			allowed_origins: config.allowed_extensions.edge
		}
	}
}

function ParseModeConfig() {
	var homeVar = "HOME";
	if(os.platform()=="win32")
		homeVar = "USERPROFILE";
	var mode;
	if(process.execPath.startsWith(process.env[homeVar]))
		mode = "user";
	else
		mode = "system";
	if(process.argv.indexOf("--user")>=0)
		mode = "user";
	else if(process.argv.indexOf("--system")>=0)
		mode = "system";
	var config;
	try {
		config = JSON.parse(fs.readFileSync(path.resolve(path.dirname(process.execPath),"../config.json"),"utf8"));
	} catch(err) {
		DisplayMessage("Cannot read config file: "+err.message,"Error");
		process.exit(-1);
		return;
	}
	return { mode, config }
}

function DarwinInstall() {
	var { mode, config } = ParseModeConfig();
	var { chrome: chromeManifest, firefox: firefoxManifest, edge: edgeManifest } = GetManifests(config);
	var manifests;
	if(mode=="user") 
		manifests = [{
			file: process.env.HOME+"/Library/Application Support/Mozilla/NativeMessagingHosts/"+config.id+".json",			
			manifest: JSON.stringify(firefoxManifest,null,4),
		},{
			file: process.env.HOME+"/Library/Application Support/Google/Chrome/NativeMessagingHosts/"+config.id+".json",
			manifest: JSON.stringify(chromeManifest,null,4),
		},{
			file: process.env.HOME+"/Library/Application Support/Chromium/NativeMessagingHosts/"+config.id+".json",
			manifest: JSON.stringify(chromeManifest,null,4),
		},{
			file: process.env.HOME+"/Library/Application Support/Microsoft Edge/NativeMessagingHosts/"+config.id+".json",
			manifest: JSON.stringify(edgeManifest,null,4),
		}];
	else
		manifests = [{
			file: "/Library/Application Support/Mozilla/NativeMessagingHosts/"+config.id+".json",
			manifest: JSON.stringify(firefoxManifest,null,4),
		},{
			file: "/Library/Google/Chrome/NativeMessagingHosts/"+config.id+".json",
			manifest: JSON.stringify(chromeManifest,null,4),
		},{
			file: "/Library/Application Support/Chromium/NativeMessagingHosts/"+config.id+".json",
			manifest: JSON.stringify(chromeManifest,null,4),
		},{
			file: "/Library/Microsoft/Edge/NativeMessagingHosts/"+config.id+".json",
			manifest: JSON.stringify(edgeManifest,null,4),
		}];
	try {
		manifests.forEach((manif)=>{
			fs.outputFileSync(manif.file,manif.manifest,"utf8");
		});
	} catch(err) {
		DisplayMessage("Cannot write manifest file: "+err.message,config.name);
		process.exit(-1);
		return;
	}
	var text = config.name+" is ready to be used";
	DisplayMessage(text,config.name);
}

function DarwinUninstall() {
	var { mode, config } = ParseModeConfig();
	
	var manifests;
	if(mode=="user") 
		manifests = [
			process.env.HOME+"/Library/Application Support/Mozilla/NativeMessagingHosts/"+config.id+".json",			
			process.env.HOME+"/Library/Application Support/Google/Chrome/NativeMessagingHosts/"+config.id+".json",
			process.env.HOME+"/Library/Application Support/Chromium/NativeMessagingHosts/"+config.id+".json",
			process.env.HOME+"/Library/Application Support/Microsoft Edge/NativeMessagingHosts/"+config.id+".json"
		];
	else
		manifests = [
			"/Library/Application Support/Mozilla/NativeMessagingHosts/"+config.id+".json",
			"/Library/Google/Chrome/NativeMessagingHosts/"+config.id+".json",
			"/Library/Application Support/Chromium/NativeMessagingHosts/"+config.id+".json",
			"/Library/Application Support/Microsoft Edge/NativeMessagingHosts/"+config.id+".json"
		];
	try {
		manifests.forEach((file)=>{
			fs.removeSync(file);
		});
	} catch(err) {
		DisplayMessage("Cannot remove manifest file: "+err.message,config.name);
		process.exit(-1);
	}
	var text = config.name+" manifests have been removed";
	DisplayMessage(text,config.name);
}

function LinuxInstall() {
	var { mode, config } = ParseModeConfig();
	var { chrome: chromeManifest, firefox: firefoxManifest } = GetManifests(config);
	var manifests;
	if(mode=="user") 
		manifests = [{
			file: process.env.HOME+"/.mozilla/native-messaging-hosts/"+config.id+".json",			manifest: JSON.stringify(firefoxManifest,null,4),
		},{
			file: process.env.HOME+"/.config/google-chrome/NativeMessagingHosts/"+config.id+".json",
			manifest: JSON.stringify(chromeManifest,null,4),
		},{
			file: process.env.HOME+"/.config/chromium/NativeMessagingHosts/"+config.id+".json",
			manifest: JSON.stringify(chromeManifest,null,4),
		},{
			file: process.env.HOME+"/.config/BraveSoftware/Brave-Browser/NativeMessagingHosts/"+config.id+".json",
			manifest: JSON.stringify(chromeManifest,null,4),
		},{
			file: process.env.HOME+"/.config/vivaldi/NativeMessagingHosts/"+config.id+".json",
			manifest: JSON.stringify(chromeManifest,null,4),
		}];
	else {
		manifests = [{
			file: "/usr/lib/mozilla/native-messaging-hosts/"+config.id+".json",
			manifest: JSON.stringify(firefoxManifest,null,4),
		},{
			file: "/etc/opt/chrome/native-messaging-hosts/"+config.id+".json",
			manifest: JSON.stringify(chromeManifest,null,4),
		},{
			file: "/etc/chromium/native-messaging-hosts/"+config.id+".json",
			manifest: JSON.stringify(chromeManifest,null,4),
		}];
		if(os.arch()=="x64")
			try {
		 		fs.statSync("/usr/lib64");
				manifests.push({
					file: "/usr/lib64/mozilla/native-messaging-hosts/"+config.id+".json",
					manifest: JSON.stringify(firefoxManifest,null,4),
				});
			} catch(err) {}
	}
	try {
		manifests.forEach((manif)=>{
			fs.outputFileSync(manif.file,manif.manifest,"utf8");
		});
	} catch(err) {
		DisplayMessage("Cannot write manifest file: "+err.message,config.name);
		process.exit(-1);
		return;
	}
	var text = config.name+" is ready to be used";
	DisplayMessage(text,config.name);
}

function LinuxUninstall() {
	var { mode, config } = ParseModeConfig();
	
	var manifests;
	if(mode=="user") 
		manifests = [
			process.env.HOME+"/.mozilla/native-messaging-hosts/"+config.id+".json",
			process.env.HOME+"/.config/google-chrome/NativeMessagingHosts/"+config.id+".json",
			process.env.HOME+"/.config/chromium/NativeMessagingHosts/"+config.id+".json",
			process.env.HOME+"/.config/BraveSoftware/Brave-Browser/NativeMessagingHosts/"+config.id+".json",
			process.env.HOME+"/.config/vivaldi/NativeMessagingHosts/"+config.id+".json"
		];
	else
		manifests = [
			"/usr/lib/mozilla/native-messaging-hosts/"+config.id+".json",
			"/etc/opt/chrome/native-messaging-hosts/"+config.id+".json",
			"/etc/chromium/native-messaging-hosts/"+config.id+".json"
		];
	try {
		manifests.forEach((file)=>{
			fs.removeSync(file);
		});
	} catch(err) {
		DisplayMessage("Cannot remove manifest file: "+err.message,config.name);
		process.exit(-1);
	}
	var text = config.name+" manifests have been removed";
	DisplayMessage(text,config.name);
}

function WriteRegistry(regRoot,path,key,value) {
	var fullKey = regRoot+path+"\\"+key;
	var args = ["ADD",fullKey,"/f","/t","REG_SZ","/d",value];
	var ret = spawnSync("reg",args);
	if(ret.status!==0) {
		DisplayMessage("Failed writing registry key "+fullKey);
		process.exit(-1);
	}
}

function WindowsInstall() {
	var { mode, config } = ParseModeConfig();
	if(mode=="system") {
		// check if elevated
		var processRet = spawnSync("net",["session"]);
		if(processRet.exitCode!=0) {
			DisplayMessage("To setup "+config.name+" system-wide, you must execute the program as Administrator",
				config.name);
			return process.exit(-1);
		}
	}
	var manifestsDir = path.resolve(path.dirname(process.execPath),"../manifests");
	try {
		fs.mkdirpSync(manifestsDir);
	} catch(e) {
		DisplayMessage("Error creating directory",manifestsDir,":",e.message);
		process.exit(-1);
	}
	var { firefox: firefoxManifest, chrome: chromeManifest, edge: edgeManifest} = GetManifests(config);
	var firefoxManifestFile = path.resolve(path.join(manifestsDir,"firefox."+config.id+".json"));
	fs.outputFileSync(firefoxManifestFile,JSON.stringify(firefoxManifest,null,4),"utf8");
	var chromeManifestFile = path.resolve(path.join(manifestsDir,"chrome."+config.id+".json"));
	fs.outputFileSync(chromeManifestFile,JSON.stringify(chromeManifest,null,4),"utf8");
	var edgeManifestFile = path.resolve(path.join(manifestsDir,"edge."+config.id+".json"));
	fs.outputFileSync(edgeManifestFile,JSON.stringify(edgeManifest,null,4),"utf8");

	var regRoot = "HKLM";
	if(mode=="user")
		regRoot = "HKCU";
	WriteRegistry(regRoot,"\\Software\\Google\\Chrome\\NativeMessagingHosts",config.id,chromeManifestFile);
	WriteRegistry(regRoot,"\\Software\\Chromium\\NativeMessagingHosts",config.id,chromeManifestFile);
	WriteRegistry(regRoot,"\\Software\\Mozilla\\NativeMessagingHosts",config.id,firefoxManifestFile);
	WriteRegistry(regRoot,"\\Software\\ComodoGroup\\NativeMessagingHosts",config.id,firefoxManifestFile);
	WriteRegistry(regRoot,"\\Software\\Microsoft\\Edge\\NativeMessagingHosts",config.id,edgeManifestFile);
	var text = config.name+" is ready to be used";
	DisplayMessage(text);
}

function DeleteRegistry(regRoot,path,key) {
	var fullKey = regRoot+path+"\\"+key;
	var args = ["DELETE",fullKey,"/f"];
	spawnSync("reg",args);
}

function WindowsUninstall() {
	var { mode, config } = ParseModeConfig();
	if(mode=="system") {
		// check if elevated
		var processRet = spawnSync("net",["session"]);
		if(processRet.exitCode!=0) {
			DisplayMessage("To setup "+config.name+" system-wide, you must execute the program as Administrator",
				config.name);
			return process.exit(-1);
		}
	}
	var regRoot = "HKLM";
	if(mode=="user")
		regRoot = "HKCU";
	DeleteRegistry(regRoot,"\\Software\\Google\\Chrome\\NativeMessagingHosts",config.id);
	DeleteRegistry(regRoot,"\\Software\\Chromium\\NativeMessagingHosts",config.id);
	DeleteRegistry(regRoot,"\\Software\\Mozilla\\NativeMessagingHosts",config.id);
	DeleteRegistry(regRoot,"\\Software\\Microsoft\\Edge\\NativeMessagingHosts",config.id);
	var text = config.name+" manifests have been removed";
	DisplayMessage(text);
}

exports.install = () => {
	switch(os.platform()) {
		case "darwin":
			DarwinInstall();
			break;
			case "linux":
			LinuxInstall();
			break;
		case "win32":
			WindowsInstall();
			break;
		default:
			DisplayMessage("Auto-install not supported for "+ os.platform() + " platform");
	}
	process.exit(0);
}

exports.uninstall = () => {
	switch(os.platform()) {
		case "darwin":
			DarwinUninstall();
			break;
		case "linux":
			LinuxUninstall();
			break;
		case "win32":
			WindowsUninstall();
			break;
		default:
			DisplayMessage("Auto-install not supported for "+ os.platform() + " platform");
	}
	process.exit(0);
}
