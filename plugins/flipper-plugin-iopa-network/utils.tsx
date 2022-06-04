/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @format
 */

import {IContextIopa, IContextReplySerialized, IContextIopaSerialized} from './types';
import {Base64} from 'js-base64';
import { Typography, Badge, Tag } from 'antd';
import * as React from 'react'

export function decodeBody(
  data: IContextIopaSerialized | IContextReplySerialized
): string | undefined | Uint8Array {
  if (!data['iopa.Body']) {
    return undefined;
  }

  try {
    // If this is not a gzipped request, assume we are interested in a proper utf-8 string.
    //  - If the raw binary data in is needed, in base64 form, use data directly
    //  - either directly use data (for example)

    if (Array.isArray(data['iopa.Body'])) {
      const bytes = Base64.toUint8Array(data['iopa.Body'][0])
      if (bytes && bytes.length > 0) { 
        return bytes
      } else {
        return undefined
      }
    } else {
      return data['iopa.Body']
    }
  } catch (e) {
    console.warn(
      `Flipper failed to decode request/response body (size: ${data['iopa.Body'].length}): ${e}`,
    );
    return undefined;
  }
}

export function convertRequestToCurlCommand(
  request: IContextIopa,
): string {
  let command: string = `curl -v -X ${request.get('iopa.Method')}`;
  command += ` ${escapedString(request.get('iopa.OriginalUrl'))}`;
  // Add headers
  request.get('iopa.Headers').forEach((value: string, key: string) => {
    const headerStr = `${key}: ${value}`;
    command += ` -H ${escapedString(headerStr)}`;
  });
  if (typeof request.get('iopa.Body') === 'string') {
    command += ` -d ${escapedString(request.get('iopa.Body') as string)}`;
  }
  return command;
}

export function bodyAsString(body: undefined | string | Uint8Array): string {
  if (body == undefined) {
    return '(empty)';
  }
  if (body instanceof Uint8Array) {
    return '(binary data)';
  }
  return body;
}

export function bodyAsBinary(
  body: undefined | string | Uint8Array,
): Uint8Array | undefined {
  if (body instanceof Uint8Array) {
    return body;
  }
  return undefined;
}

function escapeCharacter(x: string) {
  const code = x.charCodeAt(0);
  return code < 16 ? '\\u0' + code.toString(16) : '\\u' + code.toString(16);
}

const needsEscapingRegex = /[\u0000-\u001f\u007f-\u009f!]/g;

// Escape util function, inspired by Google DevTools. Works only for POSIX
// based systems.
function escapedString(str: string) {
  if (needsEscapingRegex.test(str) || str.includes("'")) {
    return (
      "$'" +
      str
        .replace(/\\/g, '\\\\')
        .replace(/\'/g, "\\'")
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(needsEscapingRegex, escapeCharacter) +
      "'"
    );
  }

  // Simply use singly quoted string.
  return "'" + str + "'";
}

export function formatDuration(duration: number | undefined) {
  if (typeof duration === 'number') return duration + 'ms';
  return '';
}

export function formatBytes(count: number | undefined): string {
  if (typeof count !== 'number') {
    return '';
  }
  if (count === 0) {
    return '(empty)';
  }
  if (count > 1024 * 1024) {
    return (count / (1024.0 * 1024)).toFixed(1) + 'MB';
  }
  if (count > 1024) {
    return (count / 1024.0).toFixed(1) + 'kB';
  }
  return count + 'B';
}

export function formatMethod(method:string) {
  return <Badge count={method} style={{ backgroundColor: '#888' }} />
}

export function formatStatus(status: number | undefined) {
  return status ? <Typography.Text type={status < 400 ? 'success' : 'danger'}>{'' + status}</Typography.Text> : '';
}

export function contextsToText(contexts: IContextIopa[]): string {
  const context = contexts[0];
  if (!context || !context.get('iopa.OriginalUrl')) {
    return '<empty request>';
  }

  let url = context.get('iopa.Url')

  let copyText = `# HTTP request for ${url.hostname} (ID: ${context['iopa.Id']})
  ## Request
  HTTP ${context.get('iopa.Method')} ${url.toString()}
  ${Array.from(context.get('iopa.Headers').entries())
    .map(
      ([key, value]): string =>
        `${key}: ${String(value)}`,
    )
    .join('\n')}`;

  // TODO: we want decoding only for non-binary data! See D23403095
  if (context['iopa.Body']) {
    copyText += `\n\n${context['iopa.Body']}`;
  }
  if (context.get('response.StatusCode')) {
    copyText += `

  ## Response
  HTTP ${context.get('response.StatusCode')} ${context.response.get('iopa.StatusText')}
  ${
    Array.from(context.response.get('iopa.Headers').entries() || [])
      .map(
        ([key, value]): string =>
          `${key}: ${String(value)}`,
      )
      .join('\n') ?? ''
  }`;
  }

  if (context.response.get('iopa.Body')) {
    copyText += `\n\n${context.response.get('iopa.Body')}`;
  }
  return copyText;
}


function unescapePathComponent(path) {
  return path.replace(/~1/g, '/').replace(/~0/g, '~');
}

//3x faster than cached /^\d+$/.test(str)
function isInteger(str) {
  var i = 0;
  var len = str.length;
  var charCode;
  while (i < len) {
      charCode = str.charCodeAt(i);
      if (charCode >= 48 && charCode <= 57) {
          i++;
          continue;
      }
      return false;
  }
  return true;
}

export function addValueByPointer(document: any, path: string, value: any) {
  const keys = path.split('/');
  let obj = document;
  let t = 1; //skip empty element - http://jsperf.com/to-shift-or-not-to-shift
  let len = keys.length;
  let key: string | number; 
  let childkey: string | number
  while (true) {
    childkey = keys[t+1]
    key = keys[t];

    if (key && key.indexOf('~') != -1) {
      key = unescapePathComponent(key);
    }
    if (childkey) {
      if (childkey.indexOf('~') != -1) {
        childkey = unescapePathComponent(childkey);
      }
      if (childkey === '-' || isInteger(childkey)) {
        obj[key] = [...obj[key] || [], ...Array.apply(null, Array(childkey)).map(function () {})]
      } else  {
        obj[key] = obj[key] || {}  
      }
   
      t++;

      if (childkey === '-') {
        childkey = obj[key].length;
      }
      else {
        if(isInteger(childkey)) {
          childkey = ~~childkey;
        }
      }

      if (t+1 >= len) {
        if(isInteger(childkey)) {
          obj[key][childkey as number] = value
        } else { // array props
          obj[key][childkey] = value
        }
        return
      }
      
      obj = obj[key];
    } else {
      return;
    }
  }
}

