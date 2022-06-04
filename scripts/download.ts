import degit from 'degit';
import { mkdirp, copy, rm } from 'fs-extra';
import * as path from 'path';
import glob from 'tiny-glob';
import {spawn} from 'promisify-child-process';

const root = process.cwd()
const buildPath = path.join(root, '.flipper-desktop')
const patchesPath = path.join(root, 'patches')
const pluginsSrc = path.join(root, 'plugins')

async function downloadFlipper() {
    await rm(buildPath,  {recursive: true, force: true })
    await mkdirp(buildPath)

    const emitter = degit('facebook/flipper/desktop#v0.147.0', {
        cache: false,
        force: true,
        verbose: true,
    });
    
    emitter.on('info', info => {
        console.log(info.message);
    });
    
   await emitter.clone(buildPath)
   await patchFiles()
   await linkPlugins()
   await yarnInstall(buildPath)

   console.log('done');

}


async function yarnInstall(dir: string) {
    console.log(`⚙️  Running yarn install in ${dir}`);
    await spawn('yarn', ['install', '--production=false'], {
      cwd: dir, stdio: 'inherit'
    });
  }
  
async function patchFiles() {
  console.log(`⚙️  Patching files ${buildPath}`);
  await rm(path.join(buildPath, "plugins", "public"),  {recursive: true, force: true })
  await copy(patchesPath, buildPath, { recursive: true, overwrite: true})
}

async function linkPlugins() {
  console.log(`⚙️  Copying plugins ${pluginsSrc}`);
  const files = await glob(`${pluginsSrc}/*`, { filesOnly: false})
  for (const file of files) {
     await copy(file, path.join(buildPath, 'plugins', 'public', file.substring(file.lastIndexOf('/') + 1)), { recursive: true, overwrite: true})
  }
}


downloadFlipper()