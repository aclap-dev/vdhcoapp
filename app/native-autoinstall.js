
const os = require("os");
const fs = require("fs-extra");
const path = require("path");
const { spawn } = require('child_process');

function DisplayMessage(body,title) {
	switch(os.platform()) {
		case "darwin":
			spawn("/usr/bin/osascript",["-e","display notification \""+
				body+"\" with title \""+(title||"")+"\""]);
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
			allowed_origins: config.allowed_extensions.chrome
		}
	}
}

function UnixParseModeConfig() {
	var mode;
	if(process.execPath.startsWith(process.env.HOME))
		mode = "user";
	else
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
	var { mode, config } = UnixParseModeConfig();
	var { chrome: chromeManifest, firefox: firefoxManifest } = GetManifests(config);
	var manifests;
	if(mode=="user") 
		manifests = [{
			file: process.env.HOME+"/Library/Application Support/Mozilla/NativeMessagingHosts/"+config.id+".json",			manifest: JSON.stringify(firefoxManifest,null,4),
		},{
			file: process.env.HOME+"/Library/Application Support/Google/Chrome/NativeMessagingHosts/"+config.id+".json",
			manifest: JSON.stringify(chromeManifest,null,4),
		},{
			file: process.env.HOME+"/Library/Application Support/Chromium/NativeMessagingHosts/"+config.id+".json",
			manifest: JSON.stringify(chromeManifest,null,4),
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
	var { mode, config } = UnixParseModeConfig();
	
	var manifests;
	if(mode=="user") 
		manifests = [
			process.env.HOME+"/Library/Application Support/Mozilla/NativeMessagingHosts/"+config.id+".json",			
			process.env.HOME+"/Library/Application Support/Google/Chrome/NativeMessagingHosts/"+config.id+".json",
			process.env.HOME+"/Library/Application Support/Chromium/NativeMessagingHosts/"+config.id+".json"
		];
	else
		manifests = [
			"/Library/Application Support/Mozilla/NativeMessagingHosts/"+config.id+".json",
			"/Library/Google/Chrome/NativeMessagingHosts/"+config.id+".json",
			"/Library/Application Support/Chromium/NativeMessagingHosts/"+config.id+".json"
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
	var { mode, config } = UnixParseModeConfig();
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
		}];
	else
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
	var { mode, config } = UnixParseModeConfig();
	
	var manifests;
	if(mode=="user") 
		manifests = [
			process.env.HOME+"/.mozilla/native-messaging-hosts/"+config.id+".json",
			process.env.HOME+"/.config/google-chrome/NativeMessagingHosts/"+config.id+".json",
			process.env.HOME+"/.config/chromium/NativeMessagingHosts/"+config.id+".json"
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
	
exports.install = () => {
	switch(os.platform()) {
		case "darwin":
			DarwinInstall();
			break;
		case "linux":
			LinuxInstall();
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
		default:
			DisplayMessage("Auto-install not supported for "+ os.platform() + " platform");
	}
	process.exit(0);
}
