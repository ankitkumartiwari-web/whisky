// Connect to running Electron via CDP and dump iframe state.
const wsUrl = process.argv[2];
const WebSocket = require('ws');
const ws = new WebSocket(wsUrl);
let id = 1;

const expression = `(() => {
  const iframes = Array.from(document.querySelectorAll('iframe')).map(i => ({
    src: i.src,
    parent: i.parentElement?.tagName + (i.parentElement?.shadowRoot ? '/shadow' : ''),
  }));
  const ytEls = Array.from(document.querySelectorAll('youtube-video')).map(y => ({
    src: y.getAttribute('src'),
    hasShadow: !!y.shadowRoot,
    shadowIframeSrc: y.shadowRoot?.querySelector('iframe')?.src,
    config: JSON.stringify(y.config),
  }));
  return JSON.stringify({ location: location.origin, iframes, ytEls }, null, 2);
})()`;

ws.on('open', () => {
  ws.send(JSON.stringify({
    id: id++,
    method: 'Runtime.evaluate',
    params: { expression, returnByValue: true },
  }));
});
ws.on('message', (m) => {
  try {
    const r = JSON.parse(m.toString());
    if (r.result?.result?.value) {
      console.log(r.result.result.value);
    } else {
      console.log(JSON.stringify(r, null, 2));
    }
  } catch (e) { console.log(m.toString()); }
  ws.close();
});
ws.on('error', (e) => console.log('WS err', e.message));
