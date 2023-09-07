"use strict";

//Requires
import { promises as fs, createWriteStream } from "fs";
import { resolve, join } from "path";
import { promisify } from "util";
import https from "https";
import stream from "stream";
import zlib from "zlib";

const pipeline = promisify(stream.pipeline);

const BASE_URL = "https://mtgjson.com/api";

function get(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(response.statusCode);
        }
        resolve(response);
      })
      .on("error", reject);
  });
}

/**
 * Returns a promise of an MtG Json file
 * @param {String} type The name of the MTGJSON file to download, e.g. "AllPrintings", "Standard" etc
 * @param {String} dir The location to put the new json file (the filename is decided by the request)
 * @param {String} version The version of MTGJSON to use, e.g. "v5"
 * @param {Boolean} update Whether or not to update the file if it exists
 * @param {Number} updateFreq How often (in milliseconds) to update. Defaults to once daily.
 */
export default async function getMtgJson({ type, dir, version = "v5", update, updateFreq = 1000*60*60*24 }) {
  //Setup input and output URIs
  const outFileName = `${type}.json.gz`;
  const outPath = resolve(join(dir, outFileName));

  const openArgs = { encoding: "utf-8", flags: "r" };

  let contents;
  try {
    // Try to read an existing file
    contents = await fs.readFile(outPath, openArgs);
    if (update) {
      const fileStats = await fs.stat(outPath);
      const timeSinceModified = Date.now() - fileStats.mtime;
      //If it's been longer than the "update frequency" since the document was last modified, do the catch block of fetching from the URL again
      if (timeSinceModified > updateFreq) throw new Error("Send HTTP request anyway");
    }
  } catch {
    const url = `${BASE_URL}/${version}/${outFileName}`;
    const response = await get(url);
    //Rewrite the file if it exists and create it if it doesn't. May be a more efficient way to update file with appending?
    await pipeline(response, zlib.createGunzip(), createWriteStream(outPath));
    contents = await fs.readFile(outPath, openArgs);
  }
  return JSON.parse(contents);
}
