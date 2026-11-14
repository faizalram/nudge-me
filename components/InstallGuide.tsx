export default function InstallGuide() {
  return (
    <main className="shell">
      <h1 className="wordmark wordmark-lg">Nudge Me</h1>
      <p className="intro muted">
        iPhone only delivers nudges to apps on your Home Screen. Add it once, then open it from there.
      </p>
      <ol className="steps">
        <li>Tap the Share button in the browser toolbar.</li>
        <li>Tap Add to Home Screen, then Add.</li>
        <li>Open Nudge Me from your Home Screen.</li>
      </ol>
      <p className="small muted">Needs iOS 16.4 or later.</p>
    </main>
  );
}
