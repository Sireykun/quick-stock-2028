export function fitBotReply(text: string, limit = 3900): string {
  if (text.length <= limit) return text;
  const note = '\n\n…More results. Try a narrower question.';
  const boundary = limit - note.length;
  const lineEnd = text.lastIndexOf('\n', boundary);
  return `${text.slice(0, lineEnd > boundary / 2 ? lineEnd : boundary).trimEnd()}${note}`;
}
