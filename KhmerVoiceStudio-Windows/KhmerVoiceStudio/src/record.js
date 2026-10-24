const $ = id => document.getElementById(id);
let prompts = [], index = 0, recorder, stream, chunks = [], blob, objectUrl, started = 0, timer, limit, saving = false, transcriptAtStart;
const messages = {
  recording_duration: 'សូមថតឱ្យបានពី ២ ដល់ ២០ វិនាទី។',
  recording_quiet: 'សំឡេងស្ងាត់ពេក។ សូមពិនិត្យមីក្រូហ្វូន រួចថតម្តងទៀត។',
  recording_invalid: 'ឯកសារសំឡេងមិនត្រឹមត្រូវ។ សូមថតម្តងទៀត។',
  text_length: 'សូមបញ្ចូលអត្ថបទពី ១ ដល់ ៥០០ តួអក្សរ។',
  khmer_required: 'សូមបញ្ចូលអត្ថបទខ្មែរ។',
};
function status(text, error = false) { $('record-status').textContent = text; $('record-status').className = 'status ' + (error ? 'error' : ''); }
function controls(active = false) {
  $('record').disabled = active || saving;
  $('stop-record').disabled = !active;
  $('transcript').readOnly = active || saving;
  $('previous').disabled = active || saving;
  $('next').disabled = active || saving;
  $('save').disabled = active || saving || !blob;
}
function discard() {
  $('take').pause(); $('take').removeAttribute('src'); $('take').load(); $('take').hidden = true;
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  blob = objectUrl = undefined; controls();
}
function showPrompt() { discard(); $('transcript').value = prompts[index]; $('prompt-number').textContent = `${index + 1} / ${prompts.length}`; status(''); }
function stop() {
  if (recorder?.state === 'recording') recorder.stop();
  clearInterval(timer); clearTimeout(limit);
}
async function summary() {
  try {
    const response = await fetch('/api/recordings'); if (!response.ok) throw Error();
    const data = await response.json(); $('clip-count').textContent = data.count; $('minutes').textContent = `${data.minutes} នាទី`;
    $('export').setAttribute('aria-disabled', String(!data.count)); $('export').tabIndex = data.count ? 0 : -1;
  } catch { status('មិនអាចអានបញ្ជីឯកសារបាន។ សូមពិនិត្យថាកម្មវិធីនៅកំពុងដំណើរការ។', true); }
}
$('record').addEventListener('click', async () => {
  const text = $('transcript').value.trim();
  if (!/[\u1780-\u17b3]/u.test(text)) return status(messages.khmer_required, true);
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) return status('សូមប្រើ Chrome ឬ Edge លើ localhost ដើម្បីថតសំឡេង។', true);
  discard(); controls(true); status('សូមអនុញ្ញាតឱ្យប្រើមីក្រូហ្វូន។');
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    const mimeType = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4'].find(type => MediaRecorder.isTypeSupported(type));
    recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
    chunks = []; transcriptAtStart = text;
    recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
    recorder.onstop = () => {
      clearInterval(timer); clearTimeout(limit); stream.getTracks().forEach(track => track.stop());
      blob = new Blob(chunks, { type: recorder.mimeType });
      objectUrl = URL.createObjectURL(blob); $('take').src = objectUrl; $('take').hidden = false;
      controls(); status('សូមស្តាប់ពិនិត្យ។ បើអានត្រឹមត្រូវ និងសំឡេងស្អាត សូមចុចរក្សាទុក។');
    };
    recorder.onerror = () => { stop(); stream.getTracks().forEach(track => track.stop()); controls(); status('ការថតមានបញ្ហា។ សូមថតម្តងទៀត។', true); };
    recorder.start(250); started = Date.now(); $('timer').textContent = '00:00';
    timer = setInterval(() => { $('timer').textContent = `00:${String(Math.floor((Date.now() - started) / 1000)).padStart(2, '0')}`; }, 200);
    limit = setTimeout(stop, 18000);
    status('កំពុងថត… សូមអានអត្ថបទ។');
  } catch (error) {
    stream?.getTracks().forEach(track => track.stop()); controls();
    status(error.name === 'NotAllowedError' ? 'សូមអនុញ្ញាតមីក្រូហ្វូននៅក្នុងកម្មវិធីរុករក រួចសាកល្បងម្តងទៀត។' : 'មិនអាចប្រើមីក្រូហ្វូនបាន។ សូមពិនិត្យការភ្ជាប់។', true);
  }
});
$('stop-record').addEventListener('click', stop);
$('save').addEventListener('click', async () => {
  if (!blob || saving) return;
  saving = true; controls(); status('កំពុងរក្សាទុក…');
  try {
    const response = await fetch('/api/recordings?text=' + encodeURIComponent(transcriptAtStart), { method: 'POST', headers: { 'Content-Type': blob.type }, body: blob });
    const data = await response.json(); if (!response.ok) throw Error(data.error);
    discard(); status(data.clipped_fraction > .001 ? 'បានរក្សាទុក។ សំឡេងខ្លាំងពេកនៅកន្លែងខ្លះ។ សូមបន្ថយកម្រិតមីក្រូហ្វូនសម្រាប់ការថតបន្ទាប់។' : 'បានរក្សាទុក។ អ្នកអាចបន្តទៅអត្ថបទបន្ទាប់។');
    await summary();
  } catch (error) { status(messages[error.message] || 'មិនអាចរក្សាទុកបាន។ សូមសាកល្បងម្តងទៀត។', true); }
  finally { saving = false; controls(); }
});
$('next').addEventListener('click', () => { index = (index + 1) % prompts.length; showPrompt(); });
$('previous').addEventListener('click', () => { index = (index + prompts.length - 1) % prompts.length; showPrompt(); });
$('transcript').addEventListener('input', () => { if (blob) { discard(); status('អត្ថបទបានផ្លាស់ប្តូរ។ សូមថតម្តងទៀត ដើម្បីឱ្យសំឡេងត្រូវនឹងអត្ថបទ។'); } });
window.addEventListener('pagehide', () => { stop(); stream?.getTracks().forEach(track => track.stop()); if (objectUrl) URL.revokeObjectURL(objectUrl); });
async function init() {
  try { const response = await fetch('/prompts.json'); if (!response.ok) throw Error(); prompts = await response.json(); showPrompt(); }
  catch { prompts = ['សួស្តី! ខ្ញុំកំពុងថតសំឡេងខ្មែរ សម្រាប់បង្រៀនម៉ូដែល។']; showPrompt(); }
  await summary();
}
init();
