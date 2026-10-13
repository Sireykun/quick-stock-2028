export function fitBotReply(text: string, limit = 3900): string {
  if (text.length <= limit) return text;
  const note = '\n\n…More results. Try a narrower question.';
  const boundary = limit - note.length;
  const lineEnd = text.lastIndexOf('\n', boundary);
  return `${text.slice(0, lineEnd > boundary / 2 ? lineEnd : boundary).trimEnd()}${note}`;
}

export function formatBotReply(text: string): string {
  const escapeHtml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return fitBotReply(text, 3400).split('\n')
    .map((line, index) => index === 0 ? `<b>${escapeHtml(line)}</b>` : escapeHtml(line))
    .join('\n');
}
