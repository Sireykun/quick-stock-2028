const $ = id => document.getElementById(id);
const text = $('text');
const voice = $('voice');
const rate = $('rate');
const generate = $('generate');
const audio = $('audio');
const samples = {
  greeting: 'សួស្តី! សូមស្វាគមន៍មកកាន់សំឡេងខ្មែរ។ សរសេរអត្ថបទរបស់អ្នក ហើយចុចប៊ូតុងបង្កើតសំឡេង។',
  story: 'ព្រឹកនេះ អាកាសធាតុល្អណាស់។ ក្មេងៗកំពុងលេងនៅក្រោមដើមឈើ ខណៈដែលជីដូនកំពុងអានសៀវភៅនៅលើរានហាល។ សំឡេងបក្សីធ្វើឱ្យបរិយាកាសស្ងប់ស្ងាត់ និងស្រស់ស្រាយ។',
  numbers: 'កិច្ចប្រជុំនឹងចាប់ផ្តើមនៅម៉ោងប្រាំបួនព្រឹក។ យើងមានអ្នកចូលរួមចំនួន ១៥ នាក់។ សូមយកសៀវភៅចំនួនពីរក្បាល និងប៊ិចមួយដើមមកជាមួយផង។',
};
const errors = {
  model_missing: 'សូមបើក Download-Model.bat ដើម្បីទាញយកម៉ូដែលម្តង។ អ្នកអាចចាប់ផ្តើមថតសំឡេងបង្រៀនបានឥឡូវនេះ។',
  model_load_failed: 'មិនអាចបើកម៉ូដែលបាន។ សូមពិនិត្យការទាញយក ឬជ្រើសរើសម៉ូដែលត្រឹមត្រូវ។',
  setup_required: 'សេវាសំឡេងមិនទាន់បានភ្ជាប់ទេ។ ម្ចាស់កម្មវិធីត្រូវកំណត់សេវា ម៉ូដែលក្នុងកុំព្យូទ័រ ជាមុនសិន។',
  provider_credentials: 'ការភ្ជាប់សេវាសំឡេងមានបញ្ហា។ សូមឱ្យម្ចាស់កម្មវិធីពិនិត្យការកំណត់សេវា។',
  provider_busy: 'សេវាកំពុងមមាញឹក ឬបានដល់កម្រិតប្រើប្រាស់។ សូមរង់ចាំបន្តិច រួចព្យាយាមម្តងទៀត។',
  provider_unavailable: 'មិនអាចភ្ជាប់សេវាសំឡេងបាន។ សូមពិនិត្យអ៊ីនធឺណិត រួចព្យាយាមម្តងទៀត។',
  provider_timeout: 'ការបង្កើតសំឡេងចំណាយពេលយូរពេក។ សូមព្យាយាមម្តងទៀតដោយប្រើអត្ថបទខ្លីជាងមុន។',
  voices_unavailable: 'រកមិនឃើញសំឡេងខ្មែរនៅក្នុងសេវានេះទេ។ សូមឱ្យម្ចាស់កម្មវិធីពិនិត្យការកំណត់សេវា។',
  text_length: 'សូមបញ្ចូលអត្ថបទពី ១ ដល់ ១៥០០ តួអក្សរ។',
  khmer_required: 'សូមបញ្ចូលអត្ថបទជាភាសាខ្មែរ។',
  invalid_voice: 'សូមជ្រើសរើសសំឡេងខ្មែរមួយ។',
  invalid_text: 'អត្ថបទមានតួអក្សរដែលមិនអាចអានបាន។ សូមសម្អាតអត្ថបទ រួចព្យាយាមម្តងទៀត។',
  invalid_rate: 'សូមកំណត់ល្បឿនពី 0.7× ដល់ 1.3×។',
  invalid_audio: 'សេវាមិនបានផ្តល់ឯកសារសំឡេងត្រឹមត្រូវទេ។ សូមព្យាយាមម្តងទៀត។',
};
let ready = false;
let busy = false;
let requestController;
let generationId = 0;
let objectUrl;
let maxCharacters = 1500;

function status(message, type = '') {
  $('status').textContent = message;
  $('status').className = 'status ' + type;
}
function inputError() {
  if (!text.value.trim() || [...text.value].length > maxCharacters) return 'text_length';
  if (!/[\u1780-\u17b3]/u.test(text.value)) return 'khmer_required';
  return null;
}
function updateControls() {
  const count = [...text.value].length;
  $('count').textContent = `${count.toLocaleString()} / ${maxCharacters.toLocaleString()} តួអក្សរ`;
  $('count').classList.toggle('over-limit', count > maxCharacters);
  text.setAttribute('aria-invalid', String(count > maxCharacters));
  generate.disabled = !ready || busy || !!inputError();
  $('generate-label').textContent = busy ? 'កំពុងបង្កើតសំឡេង…' : 'បង្កើតសំឡេង';
  generate.setAttribute('aria-busy', String(busy));
  voice.disabled = busy || !ready;
  rate.disabled = busy;
  text.readOnly = busy;
  $('clear').disabled = busy;
  document.querySelectorAll('[data-sample]').forEach(button => button.disabled = busy);
  $('cancel').hidden = !busy;
}
function discardAudio() {
  audio.pause();
  audio.removeAttribute('src');
  audio.load();
  audio.hidden = true;
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = undefined;
  $('audio-empty').hidden = false;
  $('audio-meta').textContent = 'MP3 · Local model';
  $('download').removeAttribute('href');
  $('download').setAttribute('aria-disabled', 'true');
  $('download').tabIndex = -1;
}
function changed() {
  discardAudio();
  const error = inputError();
  status(text.value.trim() && error ? errors[error] : '', error ? 'error' : '');
  updateControls();
}
async function responseError(response) {
  try { return (await response.json()).error || 'provider_unavailable'; } catch { return 'provider_unavailable'; }
}
async function loadVoices() {
  ready = false;
  updateControls();
  $('retry').hidden = true;
  $('connection').classList.remove('problem');
  $('connection-title').textContent = 'កំពុងភ្ជាប់សេវាសំឡេង…';
  $('connection-detail').textContent = 'សូមរង់ចាំបន្តិច។';
  try {
    const response = await fetch('/api/voices', { signal: AbortSignal.timeout(40000), credentials: 'same-origin' });
    if (!response.ok) throw new Error(await responseError(response));
    const data = await response.json();
    if (!Array.isArray(data.voices) || !data.voices.length) throw new Error('voices_unavailable');
    voice.replaceChildren();
    for (const item of data.voices) {
      const option = document.createElement('option');
      option.value = item.id; option.textContent = item.label; voice.append(option);
    }
    maxCharacters = data.maxCharacters || 1500;
    ready = true;
    $('connection-title').textContent = 'សេវាសំឡេងបានភ្ជាប់';
    $('connection-detail').textContent = 'ម៉ូដែលនៅលើកុំព្យូទ័ររបស់អ្នករួចរាល់។';
  } catch (error) {
    $('connection').classList.add('problem');
    $('connection-title').textContent = ['setup_required', 'model_missing'].includes(error.message) ? 'សេវាសំឡេងមិនទាន់រួចរាល់' : 'មិនអាចភ្ជាប់សេវាសំឡេងបាន';
    $('connection-detail').textContent = errors[error.message] || errors.provider_unavailable;
    $('retry').hidden = false;
    voice.replaceChildren(new Option('សូមភ្ជាប់សេវាសំឡេងជាមុន', ''));
  }
  updateControls();
}

generate.addEventListener('click', async () => {
  if (busy || !ready || inputError()) return;
  busy = true;
  const id = ++generationId;
  requestController = new AbortController();
  discardAudio();
  updateControls();
  status('កំពុងបង្កើតសំឡេង។ សូមរង់ចាំបន្តិច…');
  try {
    const response = await fetch('/api/speech', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
      body: JSON.stringify({ text: text.value.trim(), voice: voice.value, rate: Number(rate.value) }),
      signal: AbortSignal.any([requestController.signal, AbortSignal.timeout(300000)]),
    });
    if (!response.ok) throw new Error(await responseError(response));
    if (!response.headers.get('Content-Type')?.startsWith('audio/mpeg')) throw new Error('invalid_audio');
    const blob = await response.blob();
    if (!blob.size) throw new Error('invalid_audio');
    if (id !== generationId) return;
    objectUrl = URL.createObjectURL(blob);
    audio.src = objectUrl;
    audio.hidden = false;
    $('audio-empty').hidden = true;
    $('audio-meta').textContent = `MP3 · ${Number(response.headers.get('X-Audio-Sample-Rate') || 16000) / 1000} kHz · ${Math.round(blob.size / 1024)} KB`;
    $('download').href = objectUrl;
    $('download').setAttribute('aria-disabled', 'false');
    $('download').tabIndex = 0;
    status('បង្កើតរួចរាល់។ ចុចស្តាប់ ឬទាញយក MP3។', 'success');
    // Explicit playback avoids mobile browsers rejecting autoplay after an API request.
    audio.focus();
  } catch (error) {
    if (id !== generationId) return;
    status(error.name === 'TimeoutError' ? errors.provider_timeout : errors[error.message] || errors.provider_unavailable, 'error');
  } finally {
    if (id === generationId) { busy = false; requestController = undefined; updateControls(); }
  }
});
$('cancel').addEventListener('click', () => {
  ++generationId;
  requestController?.abort();
  requestController = undefined;
  busy = false;
  status('បានបោះបង់ការរង់ចាំ។ កុំព្យូទ័រអាចកំពុងបញ្ចប់ការបង្កើតសំឡេង។');
  updateControls();
});
text.addEventListener('input', changed);
voice.addEventListener('change', changed);
rate.addEventListener('input', () => {
  $('rate-value').textContent = `${Number(rate.value).toFixed(1)}×`;
  rate.setAttribute('aria-valuetext', $('rate-value').textContent);
  changed();
});
$('clear').addEventListener('click', () => { text.value = ''; changed(); text.focus(); });
document.querySelectorAll('[data-sample]').forEach(button => button.addEventListener('click', () => { text.value = samples[button.dataset.sample]; changed(); text.focus(); }));
$('retry').addEventListener('click', loadVoices);
audio.addEventListener('error', () => {
  if (audio.getAttribute('src')) status('កម្មវិធីរុករកមិនអាចចាក់សំឡេងបាន។ សូមទាញយក MP3 ដើម្បីស្តាប់។', 'error');
});
window.addEventListener('pagehide', () => { requestController?.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); });
updateControls();
loadVoices();
