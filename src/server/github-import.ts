import {parseLesson} from './validation.js';

const maxBytes = 256 * 1024;

export function githubRawUrl(value: unknown): string {
  if (typeof value !== 'string' || value.length > 4096) {
    throw new Error('Enter a public GitHub JSON file link.');
  }
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error('Enter a valid HTTPS GitHub file link.');
  }
  if (url.protocol !== 'https:' || url.port || url.username || url.password) {
    throw new Error('Use an HTTPS GitHub file link without credentials or a custom port.');
  }
  const parts = url.pathname.split('/').slice(1);
  if (url.hostname === 'github.com' && parts.length >= 5 && parts[2] === 'blob') {
    parts.splice(2, 1);
  } else if (url.hostname !== 'raw.githubusercontent.com' || parts.length < 4) {
    throw new Error('Use a github.com file link containing /blob/, or a raw.githubusercontent.com link.');
  }
  if (parts.some(part => !part || /^(\.|\.\.)$/.test(decodeURIComponent(part)))) {
    throw new Error('The link must point to a file inside a public GitHub repository.');
  }
  return 'https://raw.githubusercontent.com/' + parts.join('/');
}

export async function importGithubLesson(value: unknown, fetcher: typeof fetch = fetch) {
  const url = githubRawUrl(value);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    // Never follow a redirect to an untrusted host or fetch with user credentials.
    const response = await fetcher(url, {
      redirect: 'error',
      signal: controller.signal,
      headers: {Accept: 'application/json, text/plain;q=0.9'},
    });
    if (!response.ok) {
      await response.body?.cancel();
      if (response.status === 404) throw new Error('GitHub file not found. Check that the repository and file are public and the link is correct.');
      throw new Error('GitHub could not provide this file (HTTP ' + response.status + '). Try again later.');
    }
    if (Number(response.headers.get('content-length')) > maxBytes) {
      await response.body?.cancel();
      throw new Error('Lesson must be smaller than 256 KB.');
    }
    if (!response.body) throw new Error('GitHub returned an empty file.');
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const {done, value: chunk} = await reader.read();
        if (done) break;
        size += chunk.byteLength;
        if (size > maxBytes) {
          await reader.cancel();
          throw new Error('Lesson must be smaller than 256 KB.');
        }
        chunks.push(chunk);
      }
    } finally {
      reader.releaseLock();
    }
    let input: unknown;
    try {
      input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch {
      throw new Error('The linked file is not valid JSON. Choose a lesson JSON file.');
    }
    return parseLesson(input);
  } catch (error) {
    if (controller.signal.aborted) throw new Error('GitHub took too long to respond. Please try again.');
    if (error instanceof TypeError) throw new Error('Unable to download the GitHub file. Check the link and try again.');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
