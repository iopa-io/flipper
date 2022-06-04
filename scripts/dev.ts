
import Watchman from './watchman';
import * as path from 'path';
import * as fs from 'fs/promises'
import { ensureFile, copy } from 'fs-extra';
import {spawn} from 'promisify-child-process';
import glob from 'tiny-glob';

const root = process.cwd()
const buildPath = path.join(root, '.flipper-desktop', 'plugins', 'public')
const pluginsSrc = path.join(root, 'plugins')

interface FileChangeItem {
  size: number
  name: string
  exists: boolean
  new: boolean
  type: 'f' | 'd'
  mtime_ms: number
}

interface FileChange {
  root: string
  subscription: string
  files: FileChangeItem[]
}

async function dev() {
  await copyPlugins()
 // await startWatchPlugins()
  await spawn('yarn', ['flipper-server'], {
    cwd: path.join(root, '.flipper-desktop'), stdio: 'inherit'
  });
}

async function copyPlugins() {
  console.log(`⚙️  Copying plugins ${pluginsSrc}`);
  const files = await glob(`${pluginsSrc}/*`, { filesOnly: false})
  for (const file of files) {
     await copy(file, path.join(buildPath, file.substring(file.lastIndexOf('/') + 1)), { recursive: true, overwrite: true})
  }
}

async function startWatchPlugins() {
  // eslint-disable-next-line no-console
  
 
  console.log('🕵️‍  Watching for iopa plugin changes');
  let delayedCompilation: NodeJS.Timeout | undefined;
  const kCompilationDelayMillis = 500;
  const onPluginChangeDetected = (resp: FileChange) => {
    if (!delayedCompilation) {
      delayedCompilation = setTimeout(async () => {
        delayedCompilation = undefined;
        // eslint-disable-next-line no-console
        console.log(`🕵️‍  Detected iopa plugin change`);
        for (const file of resp.files) {
          if (file.exists) {
            console.log(`M ${file.name}`)
            await ensureFile(path.join(buildPath, file.name))
            await fs.copyFile(path.join(pluginsSrc, file.name), path.join(buildPath, file.name))
          } else {
            console.log(`D ${file.name}`)
            await fs.rm(path.join(buildPath, file.name), { force: true})
          }
        }
      }, kCompilationDelayMillis);
    }
  };
  try {
    await startWatchingPluginsUsingWatchman(onPluginChangeDetected);
  } catch (err) {
    console.error(
      'Failed to start watching plugin files using Watchman, continue without hot reloading',
      err,
    );
  }
}

async function startWatchingPluginsUsingWatchman(onChange: (resp: FileChange) => void) {
  const pluginFolders = [pluginsSrc]
  await Promise.all(
    pluginFolders.map(async (pluginFolder) => {
      const watchman = new Watchman(pluginFolder);
      await watchman.initialize();
      await watchman.startWatchFiles((resp: FileChange) => onChange(resp), {
        excludes: ['**/__tests__/**/*', '**/node_modules/**/*', '**/.*'],
      });

      process.on('SIGINT', function() {
        watchman.close()
    })
    }),
  );
}

dev()
