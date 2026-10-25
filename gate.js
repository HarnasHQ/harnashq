// Holding page: language by browser, one form to the HARNAS mailbox.
const T = {
  h: ['Launching soon.', 'Binnenkort live.'],
  sub: ['Want to know when?', 'Wil je weten wanneer?'],
  email: ['Your email', 'Je e-mail'],
  cta: ['Join the waitlist', 'Zet me op de lijst'],
  privacy: ['Privacy statement', 'Privacyverklaring'],
  legal: ['No cookies, no trackers', 'Geen cookies, geen trackers'],
  sent: ['On the list. We will let you know.', 'Je staat op de lijst. We laten het je weten.'],
  fail: ['That did not work. Try again in a moment.', 'Dat lukte niet. Probeer het zo nog eens.'],
};
const q = new URLSearchParams(location.search).get('lang');
const prefs = navigator.languages?.length ? navigator.languages : [navigator.language || 'en'];
const lang = q === 'nl' || q === 'en' ? q : prefs.some((l) => /^nl\b/i.test(l)) ? 'nl' : 'en';
const i = lang === 'nl' ? 1 : 0;
document.documentElement.lang = lang;
document.querySelectorAll('[data-t]').forEach((el) => { el.textContent = T[el.dataset.t][i]; });
document.querySelectorAll('a[data-privacy]').forEach((a) => { a.href = lang === 'nl' ? 'privacy.html' : 'privacy-en.html'; });
document.getElementById('w-lang').value = lang;

const form = document.getElementById('wait-form');
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = document.getElementById('msg');
  const btn = form.querySelector('[type=submit]'); btn.disabled = true;
  try {
    const res = await fetch(form.action, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } });
    if (res.ok) { msg.textContent = T.sent[i]; form.email.value = ''; btn.disabled = false; return; }
    // The form service refused the script (spam check on, rate limit, outage): hand it to the
    // browser instead, which posts the form normally and lets the service show its own check.
    if (res.status === 403 || res.status === 429 || res.status >= 500) { form.submit(); return; }
    msg.textContent = T.fail[i];
  } catch { form.submit(); return; }
  btn.disabled = false;
});

// The mark in steel behind the page, once the page itself has painted. Without WebGL: the night ground.
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
const webgl = (() => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; } })();
if (webgl) {
  document.documentElement.classList.add('gl');
  const begin = () => import('./js/teaser.js')
    .then(({ teaser }) => teaser(document.getElementById('ground'), document.getElementById('stage'), { still }))
    .catch(() => document.documentElement.classList.remove('gl'));
  const later = () => (window.requestIdleCallback ? requestIdleCallback(begin, { timeout: 1500 }) : setTimeout(begin, 200));
  // well after the first paint, so the 700 KB of three.js never sits on the path to the first words
  const after = () => setTimeout(later, 700);
  if (document.readyState === 'complete') after(); else addEventListener('load', after, { once: true });
}
