/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import fs from 'fs-extra';
import path from 'path';

const RECURSE = true;

type PackageInfo = {
  licenseName: string;
  author: string;
  licenseFile: string|null;
};

const handledPackage: Record<string, boolean> = {};
const packageDB: Record<string, PackageInfo> = {};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getAttributionForAuthor(a: string | any) {
  if (typeof a === 'string' || a instanceof String) {
    return a.toString();
  }
  return a.name + ((a.email || a.homepage || a.url) ? ` <${a.email || a.homepage || a.url}>` : '');
}

async function processPackageJson(packageName: string|null, pathToPackageJson: string, nodeModulesDir: string) {
  const isRoot = packageName === null;
  try {
    if (packageName) {
      if (handledPackage[packageName]) return; // already processed
      handledPackage[packageName] = true;
    }
    const packageJson = await fs.readJSON(pathToPackageJson);
    if (!isRoot) {
      let license = packageJson.license;
      if (!license) {
        // try licenses
        if (packageJson.licenses) {
          license = packageJson.licenses[0].type;
        }
        if (!license) {
          license = 'UNKNOWN';
        }
      }
      const files = await fs.readdir(path.dirname(pathToPackageJson));
      let licenseFile:string|null = null;
      for (const file of files) {
        if (file.match(/^LICENSE/i)) {
          const licensePath = path.join(path.dirname(pathToPackageJson), file);
          licenseFile = await fs.readFile(licensePath, 'utf8');
        }
      }
      let author: string = '';
      if (packageJson.author) {
        author = getAttributionForAuthor(packageJson.author);
      } else if (packageJson.authors) {
        author = packageJson.authors.map(getAttributionForAuthor).join(', ');
      } else if (packageJson.contributors) {
        author = packageJson.contributors.map(getAttributionForAuthor).join(', ');
      } else if (packageJson.maintainers) {
        author = packageJson.maintainers.map(getAttributionForAuthor).join(', ');
      } else if (packageJson.homepage) {
        author = packageJson.homepage;
      }
      packageDB[packageName] = {
        licenseName: license,
        author: author,
        licenseFile: licenseFile,
      };
    }
    if (!isRoot && !RECURSE) return;
    for (const key in packageJson.dependencies) {
      const packageJsonPath = path.join(nodeModulesDir, key, 'package.json');
      await processPackageJson(key, packageJsonPath, nodeModulesDir);
    }
    if (isRoot) {
      for (const key in packageJson.devDependencies) {
        const packageJsonPath = path.join(nodeModulesDir, key, 'package.json');
        await processPackageJson(key, packageJsonPath, nodeModulesDir);
      }
    }
  } catch (e) {
    console.log(`Error processing ${pathToPackageJson}: ${e}`);
  }
}


const licenseStats: Record<string, number> = {};

function printPackageInfo(pathToAttributionMD: string) {
  let attributionMD: string = '';
  attributionMD += '# Open Source Software Attribution\n\n';
  attributionMD += 'This project has the following open source dependencies:\n\n';

  const sortedKeys = Object.keys(packageDB).sort();
  console.log(`${sortedKeys.length} packages`);
  for (const key of sortedKeys) {
    const info = packageDB[key];
    const license = info.licenseName || 'UNKNOWN';
    if (license === 'UNKNOWN') {
      console.log(`Unknown license for ${key}`);
      if (info.licenseFile) {
        console.log(`Custom license found.\n\n${info.licenseFile}\n\n`);
      }
    }
    if (!licenseStats[license]) {
      licenseStats[license] = 0;
    }
    licenseStats[license]++;
    attributionMD += `## ${key}\n`;
    if (info.licenseFile) {
      attributionMD += `${info.licenseFile}\n\n`;
    } else {
      console.log(`No license file found for ${key}, using license name and authors`);
      if (!info.author) {
        console.log(`No author found for ${key}`);
      }
      attributionMD += `${info.author || ''} - ${info.licenseName}\n\n`;
    }
  }
  for (const license in licenseStats) {
    console.log(`${license}: ${licenseStats[license]}`);
  }
  if (!pathToAttributionMD) {
    console.log('No output file specified, exiting');
    return;
  }
  fs.writeFileSync(pathToAttributionMD, attributionMD);
}


if (!process.argv[2]) {
  console.log('Usage: tsx genAttribution.ts <path-to-package-json> [optional-path-to-attribution-md]');
  process.exit(1);
}
const pathToPackageJson = process.argv[2];
const pathToAttributionMD = process.argv[3];
await processPackageJson(null, pathToPackageJson, path.join(path.dirname(pathToPackageJson), 'node_modules'));
printPackageInfo(pathToAttributionMD);
