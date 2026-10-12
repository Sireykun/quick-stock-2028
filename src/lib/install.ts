type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

let pendingPrompt: InstallPrompt | null = null;

window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  pendingPrompt = event as InstallPrompt;
  window.dispatchEvent(new Event('quick-stock-install-ready'));
});

window.addEventListener('appinstalled', () => {
  pendingPrompt = null;
  window.dispatchEvent(new Event('quick-stock-install-ready'));
});

export const canPromptInstall = () => pendingPrompt !== null;

export async function promptInstall(): Promise<boolean> {
  const prompt = pendingPrompt;
  if (!prompt) return false;
  pendingPrompt = null;
  await prompt.prompt();
  const { outcome } = await prompt.userChoice;
  window.dispatchEvent(new Event('quick-stock-install-ready'));
  return outcome === 'accepted';
}
