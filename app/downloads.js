const dl = require('download');
const path = require('path');
const fs = require('fs.extra');
const rpc = require('./weh-rpc');

let downloadFolder = path.join(process.env.HOME || process.env.HOMEDIR, "dwhelper");

let currentDownloadId = 0;

const downloads = {};
const NAME_PATTERN = new RegExp("/([^/]+?)(?:\\.([a-z0-9]{1,5}))?(?:\\?|#|$)", "i");

function download(options) {
  if (!options.url) {
    throw new Error("url not specified");
  }
  if (!options.filename) {
    let m = NAME_PATTERN.exec(options.url);
    if (m) {
      options.filename = m[1] + m[2];
    } else {
      options.filename = "file";
    }
  }
  let filename = path.join(options.directory || downloadFolder, options.filename);
  let dlOptions = {
    headers: {}
  };
  (options.headers || []).forEach((header) => {
    if (typeof header.value !== "undefined") {
      dlOptions.headers[header.name] = header.value;
    } else {
      dlOptions.headers[header.name] = Buffer.from(header.binaryValue);
    }
  });
  if (options.proxy && /^http/.test(options.proxy.type)) {
    dlOptions.proxy = options.proxy.type + "://";
    if (options.proxy.username) {
      dlOptions.proxy += encodeURIComponent(options.proxy.username) + "@";
    }
    dlOptions.proxy += options.proxy.host + ":" + options.proxy.port + "/";
  }
  let downloadId = ++currentDownloadId;
  let downloadItem = dl(options.url, dlOptions);
  downloads[downloadId] = {
    downloadItem,
    totalBytes: 0,
    bytesReceived: 0,
    url: options.url,
    filename,
    state: "in_progress",
    error: null
  };

  function RemoveEntry() {
    setTimeout(() => {
      delete downloads[downloadId];
    }, 60000);
  }

  function FailedDownload(err) {
    let downloadEntry = downloads[downloadId];
    if (downloadEntry) {
      downloadEntry.state = "interrupted";
      downloadEntry.error = err.message || "" + err;
      RemoveEntry();
    }
  }

  fs.mkdirp(path.dirname(filename), (err) => {
    if (err) {
      FailedDownload(err);
      return;
    }

    downloadItem.on('request', (request) => {
      let downloadEntry = downloads[downloadId];
      if (downloadEntry) {
        downloadEntry.request = request;
      }
    });
    downloadItem.on('response', (response) => {
      let downloadEntry = downloads[downloadId];
      let contentLength = response.headers['content-length'];
      if (downloadEntry && contentLength) {
        downloadEntry.totalBytes = parseInt(contentLength);
        response.on("data", (data) => {
          downloadEntry.bytesReceived += data.length;
        });
      }
    });
    downloadItem.pipe(fs.createWriteStream(filename))
      .on('finish', () => {
        let downloadEntry = downloads[downloadId];
        if (downloadEntry) {
          downloadEntry.state = "complete";
          RemoveEntry();
        }
      })
      .on('error', FailedDownload);
  });

  return downloadId;
}

function search(query) {
  let downloadEntry = downloads[query.id];
  if (downloadEntry) {
    return [{
      totalBytes: downloadEntry.totalBytes,
      bytesReceived: downloadEntry.bytesReceived,
      url: downloadEntry.url,
      filename: downloadEntry.filename,
      state: downloadEntry.state,
      error: downloadEntry.error
    }];
  } else {
    return [];
  }
}

function cancel(downloadId) {
  let downloadEntry = downloads[downloadId];
  if (downloadEntry && downloadEntry.state == "in_progress") {
    downloadEntry.state = "interrupted";
    downloadEntry.error = "Aborted";
    setTimeout(() => {
      delete downloads[downloadId];
    }, 60000);
  }
}

rpc.listen({
  "downloads.download": download,
  "downloads.search": search,
  "downloads.cancel": cancel
});
