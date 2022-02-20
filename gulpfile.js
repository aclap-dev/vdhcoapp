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

const os=require('os');
const fs=require('fs-extra');
const path=require('path');
const { spawn } = require('child_process');

const gulp=require('gulp');
const vfs=require('vinyl-fs');
const execPkg = require('pkg').exec;
const clean = require('gulp-clean');
const gulpif = require('gulp-if');
const rename = require("gulp-rename");
const tar = require('gulp-tar');
const gzip = require('gulp-gzip');
const ejs = require('gulp-ejs');
const which = require('which');

const config = require('./config');
const manifest = require('./package.json');

const ARCH_BITS = {
	"64": 64,
	"x64": 64,
	"x86_64": 64,
	"amd64": 64,
	"32": 32,
	"ia32": 32,
	"i386": 32,
	"i686": 32
}

const PLATFORMS = {
	"linux": "linux",
	"win": "win",
	"win32": "win",
	"win64": "win",
	"mac": "mac",
	"darwin": "mac",
	"macos": "mac"
}

function PkgNames(platform,arch) {
	const PLATFORM_NAMES={ "mac": "macos", "win": "win", "linux": "linux" };
	var platformName = PLATFORM_NAMES[platform];
	const ARCHS={ "64": "x64", "32": "x86"}
	var archName = ARCHS[arch];
	var EXTENSIONS = { "win": ".exe" }
	var target = "node" + (config.node_version || config.node_major || 7) + "-" +
		platformName + "-" + archName;
	var binaryName = config.id + "-" + platform + 
		"-" + ARCH_BITS[arch] + (EXTENSIONS[platform] || "");
	return { target, binaryName };
}

function Pkg(platform,arch) {
	var { target, binaryName } = PkgNames(platform,arch);
	return execPkg(["index.js","--target",target,"--output","bin/"+binaryName]);
}

function ResolveString(str,dictionnary) {
	return str.replace(/\$\{(.*?)\}/g,(...args)=>{
		return dictionnary[args[1]] || "";
	})
}

function CopyExtra(platform,arch,extraPath="") {
	return Promise.all(
		(config.extra || []).map((extra)=>{
			var dest = ResolveString(extra.dest || extra.source,{platform,arch});
			var source = ResolveString(extra.source,{platform,arch});
			var sourceIsDir = source[source.length-1]=="/";
			var destName = null;
			if(sourceIsDir)
				source += "**/*";
			else {
				destName = path.basename(dest);
				dest = path.dirname(dest);
			}

			return new Promise((resolve, reject) => {
				vfs.src(source, { 
						resolveSymlinks: false,
						relativeSymlinks:true 
					})
					.pipe(gulpif(!!destName,rename((filePath)=>{
						filePath.extname = "";
						filePath.basename = destName;
					})))
					.pipe(vfs.dest("dist/"+platform+"/"+(arch||"")+extraPath+"/"+dest))
					.on("end",resolve);
			})
		})
	);
}

function CopyBinary(platform,arch,extraPath="") {
	var { binaryName } = PkgNames(platform,arch);
	return new Promise((resolve, reject) => {
		gulp.src("bin/"+binaryName)
		.pipe(gulp.dest("dist/"+platform+"/"+extraPath))
		.on("end",resolve);
	})
}

function CopyXbgOpen(platform,arch,extraPath="") {
	return new Promise((resolve, reject) => {
		gulp.src("node_modules/opn/xdg-open")
		.pipe(gulp.dest("dist/"+platform+"/"+extraPath))
		.on("end",resolve);
	});
}

function CreateLinuxFirefoxNativeManifest(arch,extraPath="") {
	var manifest = {
		name: config.id,
		description: config.description,
		path: "/opt/"+config.id+"/bin/"+config.id+"-linux-"+arch,
		type: "stdio",
		allowed_extensions: config.allowed_extensions.firefox
	}
	return new Promise((resolve, reject) => {
		fs.outputFile("dist/linux/"+arch+extraPath+"/usr/lib/mozilla/native-messaging-hosts/"+config.id+".json",
			JSON.stringify(manifest,null,4),"utf8",(err)=>{
				if(err)
					reject(err);
				else
					resolve();
			});
	});
}

function CreateLinuxChromeNativeManifest(arch,extraPath="") {
	var manifest = {
		name: config.id,
		description: config.description,
		path: "/opt/"+config.id+"/bin/"+config.id+"-linux-"+arch,
		type: "stdio",
		allowed_origins: config.allowed_extensions.chrome.concat(
			config.allowed_extensions.brave,
			config.allowed_extensions.vivaldi
		)
	}
	return Promise.all(
		["/etc/opt/chrome/native-messaging-hosts",
			"/etc/chromium/native-messaging-hosts"].map((rootPath)=>{
				return new Promise((resolve, reject) => {
					fs.outputFile("dist/linux/"+arch+extraPath+rootPath+"/"+config.id+".json",
						JSON.stringify(manifest,null,4),"utf8",(err)=>{
							if(err)
								reject(err);
							else
								resolve();
						});
				})
			})
		)
}

function MakeDebFiles(platform,arch) {
	var archName = { 64: "amd64", 32: "i386" }[arch];
	var appPath = "/opt/"+config.id;
	var control = Object.assign({},config.deb,{
		package: config.id,
		version: manifest.version,
		architecture: archName,
		description: config.short_description || config.description,
		depends: "libsdl2-2.0-0 (>= 2.0.0)"
	});
	var controlLines = [];
	Object.keys(control).forEach((key)=>{
		controlLines.push(key+": "+control[key]);
	});
	controlLines.push("");
	var copyright = `Files: *
Copyright: 2018-2020 Michel Gutierrez
License: GPL-2.0	
`;
	return Promise.all([
		CopyBinary(platform,arch,arch+"/deb"+appPath+"/bin"),
		CopyXbgOpen(platform,arch,arch+"/deb"+appPath+"/bin"),
		CopyExtra(platform,arch,"/deb"+appPath),
		CreateLinuxFirefoxNativeManifest(arch,"/deb"),
		CreateLinuxChromeNativeManifest(arch,"/deb"),
		fs.outputFile("dist/linux/"+arch+"/deb"+appPath+"/config.json",
			MakeConfigJsonStr(),"utf8"),
		fs.outputFile("dist/linux/"+arch+"/deb/DEBIAN/control",
			controlLines.join("\n"),"utf8"),
		fs.outputFile("dist/linux/"+arch+"/deb/usr/share/doc/"+config.id+"/copyright",
			copyright,"utf8")
	]);
}

function MakeDeb(platform,arch,callback) {
	var archName = { 64: "amd64", 32: "i386" }[arch];
	var debName = config.id+"-"+manifest.version+"-1_"+archName+".deb";

	return Exec("/usr/bin/dpkg-deb",[
		"--build","dist/"+platform+"/"+arch+"/deb/"
	])
	.then((ret)=>{
		return fs.move("dist/linux/"+arch+"/deb.deb","builds/"+debName,{overwrite:true});
	})
	.then(()=>{
		callback();
	})
	.catch((e)=>{
		console.error("Error generaring deb file",e.message);
		throw e;
	});
}

function MakeTarGzFiles(platform,arch) {
	var appPath = "/"+config.id+"-"+manifest.version;
	return Promise.all([
			CopyBinary(platform,arch,arch+"/targz"+appPath+"/bin"),
			CopyXbgOpen(platform,arch,arch+"/targz"+appPath+"/bin"),
			CopyExtra(platform,arch,"/targz"+appPath),
			fs.outputFile("dist/linux/"+arch+"/targz"+appPath+"/config.json",
				MakeConfigJsonStr(),"utf8")
		]);
}

function MakeTarGz(platform,arch) {
	var archName = { 64: "amd64", 32: "i386" }[arch];
	var tarName = config.id+"-"+manifest.version+"-1_"+archName+".tar";
	return gulp.src("dist/"+platform+"/"+arch+"/targz/**/*")
		.pipe(tar(tarName))
		.pipe(gulpif(typeof process.env.NAME_EXT=="string",rename({
			suffix: process.env.NAME_EXT
		})))
		.pipe(gzip())
		.pipe(gulp.dest("builds"));
}

gulp.task("build-local",()=>{
	return Pkg(PLATFORMS[os.platform()],ARCH_BITS[os.arch()])
	.then(()=>{
		if(os.platform()=="linux")
			return fs.copy("node_modules/opn/xdg-open","bin/xdg-open");
	});
});

[{p:"linux",a:"64"},{p:"linux",a:"32"},
	{p:"win",a:"64"},{p:"win",a:"32"},
	{p:"mac",a:"64"}].forEach(({p:platform,a:arch})=>{
		gulp.task("build-"+platform+"-"+arch,()=>{
			return Pkg(platform,arch);
		});				
	});

[64,32].forEach((arch)=>{
	gulp.task("deb-files-linux-"+arch,(callback)=>{
		MakeDebFiles(
			"linux",
			arch)
		.then(()=>callback())		
	});
	gulp.task("deb-make-linux-"+arch,(callback)=>{
		return MakeDeb("linux",arch,callback);
	});
	gulp.task("deb-linux-"+arch,
		gulp.series("build-linux-"+arch,
		"deb-files-linux-"+arch,
		"deb-make-linux-"+arch)
	);
});

gulp.task("deb-local",gulp.series("deb-linux-"+ARCH_BITS[os.arch()]));
	
[64,32].forEach((arch)=>{
	gulp.task("targz-files-linux-"+arch,(callback)=>{
		MakeTarGzFiles(
			"linux",
			arch)
		.then(()=>callback())		
	});
	gulp.task("targz-make-linux-"+arch,(callback)=>{
		return MakeTarGz("linux",arch)
	});
	gulp.task("targz-linux-"+arch,gulp.series(
			"build-linux-"+arch,
			"targz-files-linux-"+arch,
			"targz-make-linux-"+arch));
});

gulp.task("targz-local",gulp.series("targz-linux-"+ARCH_BITS[os.arch()]));

function CreateIssWinManifests() {
	var promises = [];
	["64","32"].forEach((arch)=>{
		var { 
			firefox: firefoxManifest, 
			chrome: chromeManifest, 
			edge: edgeManifest
		} = GetWinManifests(arch,true);
		promises.push(fs.outputFile(
			"dist/win/iss/firefox."+arch+"."+config.id+".json",
			JSON.stringify(firefoxManifest,null,4),"utf8"));
		promises.push(fs.outputFile(
			"dist/win/iss/chrome."+arch+"."+config.id+".json",
			JSON.stringify(chromeManifest,null,4),"utf8"));
		promises.push(fs.outputFile(
			"dist/win/iss/edge."+arch+"."+config.id+".json",
			JSON.stringify(edgeManifest,null,4),"utf8"));
	});
	return Promise.all(promises);
}

function MakeIssFiles() {
	var appPath = "";
	return Promise.all([
		CopyBinary("win","64","iss"+appPath+"/bin"),
		CopyBinary("win","32","iss"+appPath+"/bin"),
		CopyExtra("win",null,"/iss"+appPath),
		CreateIssWinManifests(),
		new Promise((resolve, reject) => {
			var basedir = path.relative("dist/win/iss",".");
			gulp.src("assets/app.iss.ejs")
				.pipe(ejs({ config, manifest, basedir,
					//distdir: path.join(basedir,"dist","win","iss")
				}))
				.on("error",(error)=>{
					console.error("Error",error);
				})
				.pipe(rename((filePath)=>{
					if(filePath.extname==".ejs") // should be done by gulp-ejs ?
						filePath.extname="";
				}))
				.pipe(gulp.dest("dist/win/iss"))
				.on("end",()=>{
					resolve();				
				})
		}),
		fs.outputFile("dist/win/iss"+appPath+"/config.json",
			MakeConfigJsonStr(),"utf8")
		]);
}

function MakeIss() {
	return new Promise((resolve, reject) => {
		var issProcess = spawn(wineBinary, [issBinary,"dist/win/iss/app.iss"], {
			env: {
				WINEDEBUG: "-all"
			}
		});
		issProcess.stdout.on("data",(data)=>{
			//console.info(data.toString("utf8"));
			process.stdout.write(data);
		});
		issProcess.stderr.on("data",(data)=>{
			process.stderr.write(data);
			//console.info("ERR:",data.toString("utf8"));
		});
		issProcess.on("exit",()=>{
			resolve();				
		});
	})
}

var wineBinary = null;

gulp.task("check-wine",(callback)=>{
	return new Promise((resolve, reject) => {
		if(PLATFORMS[os.platform()]=="win")
			return resolve();
		which('wine',(err,path)=>{
			if(err)
				return reject(err);
			wineBinary = path;
			resolve();
		});
	})
});

var issBinary = null;

gulp.task("check-iss",(callback)=>{

	function CheckBinary(path) {
		return new Promise((resolve,reject)=>{
			fs.stat(path,(err,stats)=>{
				if(err)
					return reject(err);
				resolve();
			});
		});
	}

	if(issBinary)
		return CheckBinary(issBinary);

	var binaryCandidates;
	if(PLATFORMS[os.platform()]=="linux")
		binaryCandidates = [
			process.env.HOME+"/.wine/drive_c/Program\ Files\ \(x86\)/Inno\ Setup\ 6/ISCC.exe",
			process.env.HOME+"/.wine/drive_c/Program\ Files/Inno\ Setup\ 6/ISCC.exe",
			process.env.HOME+"/.wine/drive_c/Program\ Files\ \(x86\)/Inno\ Setup\ 5/ISCC.exe",
			process.env.HOME+"/.wine/drive_c/Program\ Files/Inno\ Setup\ 5/ISCC.exe"
		];
	else
		binaryCandidates = [
			"c:\\Program Files\\Inno Setup 6\\ISCC.exe",
			"c:\\Program Files\\Inno Setup 5\\ISCC.exe"
		];

	function CheckNextPath() {
		var path = binaryCandidates.shift();
		if(!path)
			return Promise.reject(new Error("Inno Setup not found"));
		else 
			return new Promise((resolve,reject)=>{
				CheckBinary(path)
					.then(()=>{
						issBinary = path;
						resolve();
					})
					.catch((err)=>{
						CheckNextPath()
							.then(resolve)
							.catch(reject);
					});
			});
	}

	return CheckNextPath();
});

gulp.task("iss-files-win",(callback)=>{
	MakeIssFiles()
	.then(()=>callback())		
});

gulp.task("iss-make-win",(callback)=>{
	MakeIss()
	.then(()=>callback())		
});

var osslsigncodePath = null;

function ExecSign(args) {
	return new Promise((resolve, reject) => {
		var osslsigncodeProcess = spawn(osslsigncodePath, args);
		osslsigncodeProcess.stderr.on("data",(data)=>{
			process.stderr.write(data);
		});
		osslsigncodeProcess.stdout.on("data",(data)=>{
			//process.stderr.write(data);
		});
		osslsigncodeProcess.on("exit",(exitCode)=>{
			resolve(exitCode);
		});			
	})
}

function SignFile(file) {
	if(!config.win.certificate)
		return Promise.resolve();
	return new Promise((resolve, reject) => {
		fs.readFile(config.win.certificate,"utf8",(err,data)=>{
			if(err)
				return reject(err);
			var certificate = JSON.parse(data);
			resolve({
				certificateFile: path.resolve(path.dirname(config.win.certificate),certificate.certificateFile),
				certificatePass: certificate.certificatePass
			})
		})
	})
	.then(({certificateFile,certificatePass})=>{
		return new Promise((resolve, reject) => {
			ExecSign(["sign","-pkcs12",certificateFile,
					"-pass",certificatePass,"-n",config.name,"-i",
					config.win.certificateUrl || manifest.homepage,
					"-h","sha1","-in",file,"-out",file+".sha1.exe"])
				.then(()=>{
					return ExecSign(["sign","-pkcs12",certificateFile,
						"-pass",certificatePass,"-n",config.name,"-i",
						config.win.certificateUrl || manifest.homepage,
						"-nest","-h","sha2","-in",file+".sha1.exe","-out",file]);
				})
				.then(()=>{
					fs.remove(file+".sha1.exe",()=>{
						resolve();					
					});
				})
				.catch(reject);
		})
	})
	.catch((err)=>{
		console.error("Error signing",file,":",err);
		throw err;
	})

}

function SignFiles(dir,filter) {
	return new Promise((resolve, reject) => {
		var promises = [];
		fs.readdir(dir,(err,files)=>{
			if(err)
				return reject(err);
			files.forEach((file)=>{
				promises.push(SignFile(path.join(dir,file)));
			});
			Promise.all(promises)
				.then(resolve)
				.catch(reject)
		})
	})
}

gulp.task("sign-iss-files",(callback)=>{
	if(!config.win.certificate)
		return callback();
	new Promise((resolve, reject) => {
		which("osslsigncode",(err,path)=>{
			if(err)
				return reject(err);
			osslsigncodePath = path;
			resolve();
		});
	})
	.then(()=>{
		var promises = [];
		["64","32"].forEach((arch)=>{
			promises.push(SignFile("dist/win/iss/bin/"+config.id+"-win-"+arch+".exe"));
			promises.push(SignFiles("dist/win/iss/converter/build/win/"+arch),/\.(exe|dll)$/);
		})
		return Promise.all(promises);
	})
	.then(()=>{
		callback();
	})
});

gulp.task("sign-iss-installer",(callback)=>{
	if(!config.win.certificate)
		return callback();
	new Promise((resolve, reject) => {
		which("osslsigncode",(err,path)=>{
			if(err)
				return reject(err);
			osslsigncodePath = path;
			resolve();
		});
	})
	.then(()=>{
		return SignFile("builds/"+manifest.productName+"Setup-"+manifest.version+".exe");
	})
	.then(()=>{
		callback();
	})
});


gulp.task("iss-win",gulp.series(
		"check-wine",
		"check-iss",
		"build-win-64",
		"build-win-32",
		"iss-files-win",
		"sign-iss-files",
		"iss-make-win",
		"sign-iss-installer"));

function CreateMacInfoPlist(extraPath="") {
	return new Promise((resolve, reject) => {
		gulp.src("assets/Info.plist.ejs")
			.pipe(ejs({
				config,
				manifest,
				binaryName: PkgNames("mac",64).binaryName
			}))
			.on("error",(err)=>{
				reject(err);
			})
			.pipe(rename((filePath)=>{
				if(filePath.extname==".ejs") // should be done by gulp-ejs ?
					filePath.extname="";
			}))
			.pipe(gulp.dest("dist/mac/"+extraPath))
			.on("end",()=>resolve());
	})
}

function MakeMacFiles(type) {
	var appPath;
	switch(type) {
		case "dmg":
			appPath = "dmg/"+config.id+".app";
			break;
		case "pkg":
			appPath = "pkg/content/"+config.id+".app";
			break;
	}
	var contentPath = appPath+"/Contents/";

	var promises = [
		CopyBinary("mac","64",contentPath+"MacOS/bin"),
		CopyExtra("mac",null,"/"+contentPath+"MacOS"),
		CreateMacInfoPlist(contentPath),
		fs.copy("assets/"+config.mac.iconIcns,"dist/mac/"+contentPath+"Resources/"+config.mac.iconIcns),
		fs.outputFile("dist/mac/"+contentPath+"PkgInfo","APPL????","utf8"),
		fs.outputFile("dist/mac/"+contentPath+"MacOS/config.json",
			MakeConfigJsonStr(),"utf8")
	];
	switch(type) {
		case "dmg":
			promises.push(fs.copy("assets/"+config.mac.dmgBackground,"dist/mac/"+contentPath+"Resources/"+config.mac.dmgBackground));
			promises.push(new Promise((resolve, reject) => {
				which("ln",(err,path)=>{
					if(err)
						return reject(err);
					else
						resolve(path);
				})
			})
			.then((lnPath)=>{
				return new Promise((resolve, reject) => {
					var lnProcess = spawn(lnPath,["-s","-f","/Applications","dist/mac/dmg/Application"]);
					lnProcess.stderr.on("data",(data)=>{
						process.stderr.write(data);
					});
					lnProcess.on("exit",(exitCode)=>{
						if(exitCode)
							return reject(new Error("ln Applications returns "+exitCode));
						resolve();
					})
				})
			}));
			break;
		case "pkg": 
			promises.push(new Promise((resolve, reject) => {
				gulp.src("assets/setup-mac-pkg.sh.ejs")
					.pipe(ejs({ config, manifest }))
					.pipe(rename((filePath)=>{
						filePath.extname="";
						filePath.basename="postinstall";
					}))
					.pipe(gulp.dest("dist/mac/pkg/scripts"))
					.on("end",()=>{
						resolve();
					})
			}));
			break;
	}
	return Promise.all(promises)
		.then(()=>{
			if(config.mac.signApp)
				return MacSign("dist/mac/"+appPath);
		});
}

function MakeDmgFiles() {
	return MakeMacFiles("dmg");
}	

function MakeConfigJsonStr() {
	return JSON.stringify({
		id: config.id,
		name: config.name,
		description: config.description,
		allowed_extensions: config.allowed_extensions
	},null,4);
}

gulp.task("dmg-files-mac",(callback)=>{
	MakeDmgFiles()
	.then(()=>callback())		
});

function Exec(command,args) {
	return new Promise((resolve,reject)=>{
		which(command,(err,path)=>{
			if(err) return reject(err);
			resolve(path);
		})
	})
	.then((path)=>{
		return new Promise((resolve,reject)=>{
			var stdout = [];
			var stderr = [];
			console.info(command,args.join(" "));
			var cmdProcess = spawn(path, args);
			cmdProcess.stderr.on("data",(data)=>{
				stderr.push(data);
			});
			cmdProcess.stdout.on("data",(data)=>{
				stdout.push(data);
			});
			cmdProcess.on("exit",(exitCode)=>{
				var stderrStr = Buffer.concat(stderr).toString("utf8");
				if(exitCode)
					console.info("Error:",stderrStr);
				resolve({ exitCode,
					stdout: Buffer.concat(stdout).toString("utf8"),
					stderr: stderrStr
				});
			});
		})
	})	
}

gulp.task("dmg-make-mac",(callback)=>{
	fs.remove("builds/"+config.id+"-"+manifest.version+".dmg")
		.then(()=> {
			return OnDemandRequire("appdmg");
		})
		.then((appdmg)=>{
			var ee = appdmg({
				target: "builds/"+config.id+"-"+manifest.version+".dmg",
				basepath: "dist/mac/dmg",
				specification: {
					"title": config.name,
					"icon": config.id+".app/Contents/Resources/"+config.mac.iconIcns,
					"background": config.id+".app/Contents/Resources/"+config.mac.dmgBackground,
					"contents": [
						{ "x": 400, "y": 220, "type": "link", "path": "/Applications" },
						{ "x": 140, "y": 220, "type": "file", "path": config.id+".app" }
					]
				}
			});
			ee.on("finish",()=>{
				callback();
			});
			ee.on("error",(err)=>{
				throw err;
			})
		});
});

function MacSign(component) {
	if(!config.mac.sign) {
		console.warn("No signature specified, skipping "+component+" signing");
		return Promise.resolve();
	}
	return Exec("codesign",[
		"--deep","--force","--verbose","--ignore-resources",
		"--sign",config.mac.sign,
		component
	]);
}

gulp.task("dmg-sign-mac",(callback)=>{
	if(!config.mac.sign)
		return callback();
	MacSign("builds/"+config.id+"-"+manifest.version+".dmg")
	.then((ret)=>{
		callback();
	})
	.catch((err)=>{
		console.error("Error",err)
		throw err;
	});
});

gulp.task("dmg-checksign-mac",(callback)=>{
	Exec("codesign",[
			"--verify","-vvvv",
			"builds/"+config.id+"-"+manifest.version+".dmg"
		])
		.then((ret)=>{
			console.info(ret.stderr);
			callback();
		})
		.catch((err)=>{
			console.error("Error",err)
			throw err;
		});
});

gulp.task("dmg-mac",gulp.series(
		"build-mac-64",
		"dmg-files-mac",
		"dmg-make-mac",
		"dmg-sign-mac"));

function MakePkgFiles() {
	return MakeMacFiles("pkg");
}	

gulp.task("pkg-files-mac",(callback)=>{
	MakePkgFiles()
	.then(()=>callback())		
});

gulp.task("pkg-make-mac",(callback)=>{
	var version = Math.floor(Date.now()/1000);
	new Promise((resolve, reject) => {
		gulp.src("assets/{pkg-distribution.xml,pkg-component.plist}.ejs")
			.pipe(ejs({ config, manifest, version }))
			.pipe(rename((filePath)=>{
				if(filePath.extname==".ejs") // should be done by gulp-ejs ?
					filePath.extname="";
			}))
			.pipe(gulp.dest("dist/mac/pkg"))
			.on("end",()=>resolve());		
	}).then(()=>{
		return Exec("pkgbuild",[
			"--root","dist/mac/pkg/content",
			"--install-location","/Applications",
			"--scripts","dist/mac/pkg/scripts/",
			"--identifier",config.id,
			"--component-plist","dist/mac/pkg/pkg-component.plist",
			"--version",version,
			"dist/mac/pkg/app.pkg"
		])
	}).then(()=>{
		var args = [
			"--distribution","dist/mac/pkg/pkg-distribution.xml",
			"--package-path","dist/mac/pkg",
			"builds/"+config.id+"-"+manifest.version+".pkg"
		];
		if(config.mac.sign)
			args.push("--sign",config.mac.sign);
		return 	Exec("productbuild",args)
	}).then(()=>{
		callback();		
	})
});	

gulp.task("pkg-checksign-mac",(callback)=>{
	Exec("pkgutil",[
			"--check-signature",
			"builds/"+config.id+"-"+manifest.version+".pkg"
		])
		.then((ret)=>{
			console.info(ret.stdout);
			callback();
		})
		.catch((err)=>{
			console.error("Error",err)
			throw err;
		});
});

gulp.task("pkg-mac",gulp.series(
		"build-mac-64",
		"pkg-files-mac",
		"pkg-make-mac"));

gulp.task("default", gulp.series("build-local"));

gulp.task('clean', () => {
	return gulp.src(["dist/*","builds/*","bin/*"],{read: false})
		.pipe(clean());
});

gulp.task('setup-local-mac',(callback) => {
	// not implemented but must be defined otherwise gulp 4 complains
	callback();
});

gulp.task('setup-local-linux',(callback) => {
	var arch = ARCH_BITS[os.arch()];
	var firefoxManifest = {
		name: config.id,
		description: config.description,
		path: __dirname+"/bin/"+config.id+"-linux-"+arch,
		type: "stdio",
		allowed_extensions: config.allowed_extensions.firefox
	}
	var chromeManifest = {
		name: config.id,
		description: config.description,
		path: __dirname+"/bin/"+config.id+"-linux-"+arch,
		type: "stdio",
		allowed_origins: config.allowed_extensions.chrome
	}
	var braveManifest = {
		name: config.id,
		description: config.description,
		path: __dirname+"/bin/"+config.id+"-linux-"+arch,
		type: "stdio",
		allowed_origins: config.allowed_extensions.brave
	}
	var vivaldiManifest = {
		name: config.id,
		description: config.description,
		path: __dirname+"/bin/"+config.id+"-linux-"+arch,
		type: "stdio",
		allowed_origins: config.allowed_extensions.vivaldi
	}
	Promise.all([
			fs.outputFile(
				process.env.HOME+"/.mozilla/native-messaging-hosts/"+config.id+".json",
				JSON.stringify(firefoxManifest,null,4),"utf8"),
			fs.outputFile(
				process.env.HOME+"/.config/google-chrome/NativeMessagingHosts/"+config.id+".json",
				JSON.stringify(chromeManifest,null,4),"utf8"),
			fs.outputFile(
				process.env.HOME+"/.config/chromium/NativeMessagingHosts/"+config.id+".json",
				JSON.stringify(chromeManifest,null,4),"utf8"),
			fs.outputFile(
				process.env.HOME+"/.config/BraveSoftware/Brave-Browser/NativeMessagingHosts/"+config.id+".json",
				JSON.stringify(braveManifest,null,4),"utf8"),
			fs.outputFile(
				process.env.HOME+"/.config/vivaldi/NativeMessagingHosts/"+config.id+".json",
				JSON.stringify(vivaldiManifest,null,4),"utf8"),
			fs.outputFile(
				process.env.HOME+"/.config/microsoft-edge/NativeMessagingHosts/"+config.id+".json",
				JSON.stringify(vivaldiManifest,null,4),"utf8"),
		])
		.then(()=>{
			return fs.copy("node_modules/opn/xdg-open","bin/xdg-open");
		})
		.then(()=>{
			callback();
		});

});

gulp.task('unsetup-local-linux',(callback) => {
	Promise.all([
		fs.remove(process.env.HOME+"/.mozilla/native-messaging-hosts/"+config.id+".json"),
		fs.remove(process.env.HOME+"/.config/google-chrome/NativeMessagingHosts/"+config.id+".json"),
		fs.remove(process.env.HOME+"/.config/chromium/NativeMessagingHosts/"+config.id+".json"),
		fs.remove(process.env.HOME+"/.config/BraveSoftware/Brave-Browser/NativeMessagingHosts/"+config.id+".json"),
		fs.remove(process.env.HOME+"/.config/vivaldi/NativeMessagingHosts/"+config.id+".json"),
		fs.remove(process.env.HOME+"/.config/microsoft-edge/NativeMessagingHosts/"+config.id+".json")
	])
	.then(()=>{
		callback();
	})
});

gulp.task('unsetup-local-mac',(callback) => {
	Promise.all([
		fs.remove(process.env.HOME+"/Library/Application Support/Mozilla/NativeMessagingHosts/"+config.id+".json"),
		fs.remove(process.env.HOME+"/Library/Application Support/Google/Chrome/NativeMessagingHosts/"+config.id+".json"),
		fs.remove(process.env.HOME+"/Library/Application Support/Chromium/NativeMessagingHosts/"+config.id+".json"),
		fs.remove(process.env.HOME+"/Library/Application Support/Microsoft Edge/NativeMessagingHosts/"+config.id+".json"),
		fs.remove(process.env.HOME+"/Library/Application Support/BraveSoftware/Brave-Browser/NativeMessagingHosts/"+config.id+".json"),
	])
	.then(()=>{
		callback();
	})
});

function GetWinManifests(arch,relativePath=false) {
	return {
		firefox: {
			name: config.id,
			description: config.description,
			path: (relativePath ? "" : __dirname+"/")+"bin/"+config.id+"-win-"+arch+".exe",
			type: "stdio",
			allowed_extensions: config.allowed_extensions.firefox
		},
		chrome: {
			name: config.id,
			description: config.description,
			path: (relativePath ? "" : __dirname+"/")+"bin/"+config.id+"-win-"+arch+".exe",
			type: "stdio",
			allowed_origins: config.allowed_extensions.chrome.concat(
				config.allowed_extensions.edge,
				config.allowed_extensions.brave,
				config.allowed_extensions.vivaldi
			)
		},
		edge: {
			name: config.id,
			description: config.description,
			path: (relativePath ? "" : __dirname+"/")+"bin/"+config.id+"-win-"+arch+".exe",
			type: "stdio",
			allowed_origins: config.allowed_extensions.edge 
		}
	}
}

function OnDemandRequire(packageName) {
	return new Promise((resolve, reject) => {
		try {
			var package = require(packageName)
			resolve(package);
		} catch(e) {
			new Promise((resolve,reject)=>{
				which("npm",(err,path)=>{
					if(err)
						reject(err);
					else
						resolve(path);
				})
			})
			.then((npmPath)=>{
				return new Promise((resolve,reject)=>{
					var version = manifest.wehOptionalDevDependencies && 
						manifest.wehOptionalDevDependencies[packageName] || null;
					var pkgVersion = packageName + (version && "@"+version || "");
					console.info("Installing",pkgVersion);
					var npmProcess = spawn(npmPath,["install","--no-save",pkgVersion]);
					npmProcess.stdout.on("data",(data)=>{
						process.stdout.write(data)
					});
					npmProcess.on("exit",()=>{
						try {
							var package = require(packageName);
							resolve(package);
						} catch(e) {
							reject(e);
						}
					})
				})
			})
			.then((package)=>{
				resolve(package)
			})
			.catch((e)=>{
				reject(e);
			})
		}
	})
}

gulp.task('setup-local-win',(callback) => {
	var arch = ARCH_BITS[os.arch()];
	var { 
		firefox: firefoxManifest, 
		chrome: chromeManifest,
		edge: edgeManifest
	} = GetWinManifests(arch,false);
	var manifests = [
		path.join("dist","win",""+arch,"local","firefox."+config.id+".json"),
		path.join("dist","win",""+arch,"local","chrome."+config.id+".json"),
		path.join("dist","win",""+arch,"local","edge."+config.id+".json"),
	];
	var regedit = null;
	function WriteRegistryKeys() {
		function WriteRegistry(regPath,keyName,value) {
			return new Promise((resolve, reject) => {
				regedit.createKey(regPath+"\\"+keyName,(err)=>{
					if(err)
						return reject(err);
					var values = {};
					values[regPath+"\\"+keyName] = {
						"default": {
							value,
							type: "REG_DEFAULT"
						}
					};
					regedit.putValue(values,(err)=>{
						if(err)
							return reject(err);
						resolve();
					})
				})
			})
		}
		return Promise.all([
			WriteRegistry("HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts",
				config.id,
				path.resolve(manifests[1])
			),
			WriteRegistry("HKCU\\Software\\Chromium\\NativeMessagingHosts",
				config.id,
				path.resolve(manifests[1])
			),
			WriteRegistry("HKCU\\Software\\Mozilla\\NativeMessagingHosts",
				config.id,
				path.resolve(manifests[0])
			),
			WriteRegistry("HKCU\\Software\\Microsoft\\Edge\\NativeMessagingHosts",
				config.id,
				path.resolve(manifests[2])
			)
		])
	}
	OnDemandRequire("regedit")
		.then((_regedit)=>{
			regedit = _regedit;
			return Promise.all([
				fs.outputFile(
					manifests[0],
					JSON.stringify(firefoxManifest,null,4),"utf8"),
				fs.outputFile(
					manifests[1],
					JSON.stringify(chromeManifest,null,4),"utf8"),
				fs.outputFile(
					manifests[2],
					JSON.stringify(edgeManifest,null,4),"utf8")
			])		
		})
		.then(()=>{
			return WriteRegistryKeys()
		})
		.then(()=>{
			callback()
		})
		.catch((err)=>{
			throw err;
		})
});

gulp.task('unsetup-local-win',(callback) => {
	var regedit = null;
	function DeleteKey(regPath,keyName) {
		return new Promise((resolve, reject) => {
			regedit.deleteKey(regPath+"\\"+keyName,(err)=>{
				resolve();
			})
		})
	}
	OnDemandRequire("regedit")
		.then((_regedit)=>{
			regedit = _regedit;
			return Promise.all([
				DeleteKey("HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts",
					config.id),
				DeleteKey("HKCU\\Software\\Chromium\\NativeMessagingHosts",
					config.id),
				DeleteKey("HKCU\\Software\\Mozilla\\NativeMessagingHosts",
					config.id),
				DeleteKey("HKCU\\Software\\Microsoft\\Edge\\NativeMessagingHosts",
					config.id)
			])
		})
		.then(()=>{
			callback()
		})
		.catch((err)=>{
			throw err;
		})
});	

gulp.task('setup-local',gulp.series(
		"build-"+PLATFORMS[os.platform()]+"-"+ARCH_BITS[os.arch()],
		"setup-local-"+PLATFORMS[os.platform()]));

gulp.task('unsetup-local',gulp.series(
		"unsetup-local-"+PLATFORMS[os.platform()]));

gulp.task('build-source-tarball',() => {
	const entries = [
		"index.js",
		"./app/**/*",
		"./assets/**/*",
		"./BUILD.md",
		"./config.json",
		"./converter/*.sh",
		"./converter/src/**/*",
		"./gulpfile.js",
		"./LICENSE.txt",
		"./package.json",
		"./README.md"
	];
	const baseName = config.id+"-"+manifest.version
	return vfs.src(entries, { 
			base: ".", 
			resolveSymlinks: false, 
			relativeSymlinks: true 
		})
		.pipe(tar(baseName+"-src.tar", { prefix: baseName } ))
		.pipe(gzip())
		.pipe(vfs.dest("builds"));

});
