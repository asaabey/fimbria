import {describe,it,expect,vi} from 'vitest';
import {githubRawUrl,importGithubLesson} from '../src/server/github-import.js';
import fixture from '../examples/intro.json' with {type:'json'};

const link='https://github.com/teacher/lessons/blob/main/week1.json';
function downloader(response:Response) {
  return vi.fn<typeof fetch>().mockResolvedValue(response);
}
describe('public GitHub lesson import',()=>{
  it('accepts file and raw links, including pinned commits, without query parameters',()=>{
    expect(githubRawUrl(link+'?raw=true#L1')).toBe('https://raw.githubusercontent.com/teacher/lessons/main/week1.json');
    expect(githubRawUrl('https://github.com/teacher/lessons/blob/abc123/unit/lesson.json')).toBe('https://raw.githubusercontent.com/teacher/lessons/abc123/unit/lesson.json');
    const raw='https://raw.githubusercontent.com/teacher/lessons/refs/heads/main/lesson.json';
    expect(githubRawUrl(raw)).toBe(raw);
  });
  it.each([
    'http://github.com/a/b/blob/main/test.json',
    'https://github.com.evil.example/a/b/blob/main/test.json',
    'https://raw.githubusercontent.com.evil.example/a/b/main/test.json',
    'https://user:secret@github.com/a/b/blob/main/test.json',
    'https://github.com:8443/a/b/blob/main/test.json',
    'https://github.com/a/b',
    'https://127.0.0.1/file.json',
    'file:///etc/passwd',
  ])('rejects unsupported URLs before fetching: %s',async url=>{
    const fetcher=vi.fn<typeof fetch>();
    await expect(importGithubLesson(url,fetcher)).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('downloads and validates with redirects disabled',async()=>{
    const fetcher=downloader(Response.json(fixture));
    expect(await importGithubLesson(link,fetcher)).toEqual(fixture);
    expect(fetcher).toHaveBeenCalledWith(githubRawUrl(link),expect.objectContaining({redirect:'error',signal:expect.any(AbortSignal)}));
  });
  it('reports missing files, invalid JSON, and schema errors',async()=>{
    await expect(importGithubLesson(link,downloader(new Response('',{status:404})))).rejects.toThrow('public');
    await expect(importGithubLesson(link,downloader(new Response('<html>')))).rejects.toThrow('not valid JSON');
    await expect(importGithubLesson(link,downloader(Response.json({...fixture,schemaVersion:2})))).rejects.toThrow('schemaVersion');
  });
  it('enforces size limits even without a content-length',async()=>{
    await expect(importGithubLesson(link,downloader(new Response('x'.repeat(256*1024+1))))).rejects.toThrow('256 KB');
    await expect(importGithubLesson(link,downloader(new Response('',{headers:{'content-length':'999999'}})))).rejects.toThrow('256 KB');
  });
  it('times out stalled downloads',async()=>{
    vi.useFakeTimers();
    try {
      const fetcher=vi.fn<typeof fetch>().mockImplementation((_url,options)=>new Promise((_resolve,reject)=>{
        options?.signal?.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')));
      }));
      const result=expect(importGithubLesson(link,fetcher)).rejects.toThrow('too long');
      await vi.advanceTimersByTimeAsync(10000);
      await result;
    } finally {
      vi.useRealTimers();
    }
  });
  it('reports network or redirect failures',async()=>{
    const fetcher=vi.fn<typeof fetch>().mockRejectedValue(new TypeError('fetch failed'));
    await expect(importGithubLesson(link,fetcher)).rejects.toThrow('Unable to download');
  });
});
