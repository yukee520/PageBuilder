export async function listRepoAudioFiles(
  token: string | null,
  owner: string,
  repo: string,
  branch?: string,
): Promise<RepoAudioFile[]> {
  const entries = await listRepoContents(token, owner, repo, '', branch);
  const audioFiles: RepoAudioFile[] = [];

  for (const entry of entries) {
    if (entry.type !== 'file' || !isAudioFile(entry.name)) continue;

    // Use the GitHub contents API URL instead of `entry.download_url`.
    //
    // `download_url` points at raw.githubusercontent.com, which:
    //   (a) returns 404 for private repos without an Authorization header
    //   (b) cannot carry custom headers from <Image> or <Video> on Android
    //
    // The contents API URL below works with a `Bearer` token header and
    // also works unauthenticated for public repos. The runtime sends
    // `Accept: application/vnd.github.raw` on every request, which makes
    // this endpoint return raw bytes instead of a base64 JSON envelope.
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${entry.path
      .split('/')
      .map(encodeURIComponent)
      .join('/')}`;

    audioFiles.push({
      name: entry.name,
      title: entry.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '),
      path: entry.path,
      downloadUrl: apiUrl,
      size: entry.size,
    });
  }

  return audioFiles.sort((a, b) => a.name.localeCompare(b.name));
}