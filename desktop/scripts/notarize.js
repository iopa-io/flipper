/* eslint-disable header/header */
/**
 * Copyright (c) Synchronous Health, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @format
 */
const { notarize } = require('electron-notarize')

exports.default = async function notarizing(context) {

  const { electronPlatformName, appOutDir } = context
  if (electronPlatformName !== 'darwin') {
    return
  }

  const appBundleId = context.packager.appInfo.macBundleIdentifier;
  const appName = context.packager.appInfo.productFilename
  const appPath = `${appOutDir}/${appName}.app`;

  console.log(`notarizing ${appBundleId}`)
  try {
    await notarize({
      appBundleId,
      appPath,
      appleApiKey: process.env.AC_API_KEY,
      appleApiIssuer: process.env.AC_API_ISSUER
    })
  } catch (ex) {
    console.error(ex)
    throw ex
  }
  
  console.log(`successfully notarized ${appBundleId}`)
}
