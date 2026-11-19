async function loadSceneAndRuntime() {
  const url = new URL('./airport.splinecode', import.meta.url);
  const [runtime, response] = await Promise.all([
    import('./spline-runtime.js').catch(error => {
      throw new Error('Could not load the 3D player files.', { cause: error });
    }),
    fetch(url).catch(error => {
      throw new Error('Could not download the scene file.', { cause: error });
    }),
  ]);
  if (!response.ok) {
    throw new Error(`Could not load the scene file (HTTP ${response.status}).`);
  }
  if (response.headers.get('content-type')?.includes('text/html')) {
    throw new Error('The scene URL returned a web page instead of the 3D file.');
  }
  return [runtime, await response.arrayBuffer()];
}
const stage = document.querySelector('#stage');
const canvas = document.querySelector('#canvas3d');
const status = document.querySelector('#status');

function fitStage() {
  const fit = Math.min(window.innerWidth / 730, window.innerHeight / 580);
  stage.style.setProperty('--fit', fit);
}

function showPoster(message) {
  stage.dataset.state = 'fallback';
  status.hidden = false;
  status.textContent = message;
}

function hasRendered() {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('No 3D frame was drawn.')), 20000);
    canvas.addEventListener('rendered', () => {
      clearTimeout(timeout);
      resolve();
    }, { once: true });
  });
}

async function start() {
  fitStage();
  window.addEventListener('resize', fitStage);
  status.textContent = 'Loading 3D scene…';
  const replay = document.querySelector('#replay');
  replay.addEventListener('click', () => window.location.reload());

  let app;
  try {
    const [{ Application }, scene] = await loadSceneAndRuntime();
    app = new Application(canvas, { renderer: 'webgl', renderMode: 'continuous' });
    await Promise.all([hasRendered(), app.start(scene)]);
    if (!app.findObjectByName('Girl 2')) {
      throw new Error('The scene was missing from the rendered frame.');
    }
    stage.dataset.state = 'live';
    status.hidden = true;
    replay.hidden = false;
    canvas.addEventListener('webglcontextlost', () => {
      replay.hidden = true;
      showPoster('The 3D connection was lost. Refresh to try again.');
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'The 3D player could not start.';
    const publicReason = /Could not (load|download)|scene URL/.test(reason)
      ? reason
      : 'Live 3D could not start. See the browser console for details.';
    showPoster(publicReason);
    console.error('Unable to start the interactive scene:', error);
    app?.dispose();
  }
}

void start();
