import { readFileSync, writeFileSync } from "fs";

const targetVersion = process.env.npm_package_version;
if (!targetVersion) {
  throw new Error("Unable to find version in package.json");
}

let manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
manifest.version = targetVersion;
writeFileSync("manifest.json", JSON.stringify(manifest, null, 2) + "\n");

// Community convention: versions.json lists stable releases only, so
// prerelease versions (e.g. 1.2.3-beta.1) are neither added nor kept.
let versions = JSON.parse(readFileSync("versions.json", "utf8"));
for (const version of Object.keys(versions)) {
  if (version.includes("-")) {
    delete versions[version];
  }
}
if (!targetVersion.includes("-")) {
  versions[targetVersion] = manifest.minAppVersion;
}
writeFileSync("versions.json", JSON.stringify(versions, null, 2) + "\n");
