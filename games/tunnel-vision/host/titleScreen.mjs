import {acceptAllPlayers} from '/host/players.mjs';
import {waitForNSeconds, waitForKeypress} from '/shared/utils.mjs';

import * as audienceMode from '/host/audienceMode.mjs';
import * as messaging from '/host/messaging.mjs';

import routes, {waitForRouteToEnd} from '/host/routes.mjs';

routes['#games/tunnel-vision'] = async function titleScreen() {
  document.body.style.backgroundColor = '#98947f';
  document.body.insertAdjacentHTML('beforeend', `
    <div class="tunnel-vision title-screen">
      <h1>
        <div>Tunnel Vision</div>
        <span class="closeup-trickery">
          <div class="text">Closeup trickery</div>
          <div class="magnifying-glass-container">
            <div class="zoomed-text">
              <div>Closeup trickery</div>
            </div>
            <div class="magnifying-glass"></div>
          </div>
        </span>
      </h1>
      <canvas width="${window.innerWidth}" height="${window.innerHeight}"></canvas>
    </div>
  `);
  const titleScreen = document.body.lastElementChild;

  audienceMode.start();
  messaging.start();

  const tunnelEffect = createTunnelEffect(titleScreen.querySelector('canvas'));

  await waitForRouteToEnd();

  tunnelEffect.stop();

  titleScreen.classList.add('finished');
  setTimeout(() => { titleScreen.remove() }, 2000);
  await Promise.race([waitForNSeconds(2), waitForKeypress(' ')]);

  messaging.stop();

  if (!location.hash.startsWith('#games/tunnel-vision')) {
    audienceMode.stop();
  }
  return '#games/tunnel-vision/thing-choosing';
}

function createTunnelEffect(canvas) {
  const tunnelJourneyDurationMs = 5000;
  const fieldOfViewYrad = 45 * Math.PI / 180;

  const gl = canvas.getContext('webgl');
  if (!gl) {
    alert('Could not get WebGL context');
    return;
  }

  gl.getExtension('OES_standard_derivatives');

  const lensFlareShaderProgram = createGlProgram(gl, {
    vertexShaderSource: `
      attribute vec4 vertex_position;
      void main() { gl_Position = vertex_position; }
    `,
    fragmentShaderSource: `
      precision mediump float;

      uniform vec2 resolution;
      uniform float timeMs;

      void main() {
        vec2 uv = (gl_FragCoord.xy / resolution) - vec2(.5,.5);
        const float PI = 3.14159;
        float angle = 1.0 + (atan(uv.x, uv.y) / PI);
        float warble1 = sin(angle * 16.0);
        float warble2 = cos(angle * 20.0);
        float warble3 = sin((angle + (timeMs / 3000.0)) * 35.0);
        float warbles = (warble1 + (warble2*.5) + (warble3*.2)) / 12.0;
        float dist = 1.0 - length(uv);
        float fadein = min(timeMs / 1000.0, 1.0);
        float fadeout = 1.0 - (timeMs / 5000.0);
        float intensity = (pow(dist, 10.0) + warbles) * (fadeout * fadein);
        gl_FragColor = vec4(intensity);
      }
    `
  });

  const aFullscreenQuadVertexPosition = gl.getAttribLocation(lensFlareShaderProgram, 'vertex_position');
  const uResolution = gl.getUniformLocation(lensFlareShaderProgram, 'resolution');
  gl.useProgram(lensFlareShaderProgram);
  gl.uniform2f(uResolution, canvas.clientWidth, canvas.clientHeight);
  const uTimeMs = gl.getUniformLocation(lensFlareShaderProgram, 'timeMs');

  const fullscreenQuadVertexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, fullscreenQuadVertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Int8Array([
    -1, -1, // Top-left corner
     1, -1, // Top-right corner
    -1,  1, // Bottom-left corner
     1,  1, // Bottom right corner
  ]), gl.STATIC_DRAW);

  const tunnelShaderProgram = createGlProgram(gl, {
    vertexShaderSource: `
      attribute vec4 aVertexPosition;

      uniform float uCameraZ;
      uniform mat4 uProjectionMatrix;

      varying vec3 vertex_view_space;

      void main() {
        vertex_view_space = aVertexPosition.xyz;
        vec4 vertexPosition = aVertexPosition;
        vertexPosition.z += uCameraZ;
        gl_Position = uProjectionMatrix * vertexPosition;
      }
    `,
    fragmentShaderSource: `
      #extension GL_OES_standard_derivatives : enable
      precision mediump float;

      varying vec3 vertex_view_space;

      const float tunnelDepth = 20.0;
      const vec3 diffuse = vec3(.3, .2, .03);
      const vec3 lightDirection = vec3(0, 0, -1);

      void main() {
        vec3 normal = normalize(cross(dFdx(vertex_view_space), dFdy(vertex_view_space)));
        float incidence = max(dot(normal, lightDirection), 0.0);
        float tunnelEndCloseness = 1.0 - (vertex_view_space.z / tunnelDepth);
        gl_FragColor.a = 1.0;
        gl_FragColor.rgb = diffuse * tunnelEndCloseness * (0.5 + incidence);
      }
    `
  });

  const aVertexPosition   = gl.getAttribLocation(tunnelShaderProgram, 'aVertexPosition'),
        uProjectionMatrix = gl.getUniformLocation(tunnelShaderProgram, 'uProjectionMatrix'),
        uCameraZ          = gl.getUniformLocation(tunnelShaderProgram, 'uCameraZ');

  const tunnelDepth = 20;

  const {positions, indices} = createTunnelMesh({depth: tunnelDepth, depthSubdivs: 200, radialSubdivs: 40});

  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

  const indexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

  let perspectiveSkew = 1;
  let aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
  let projectionMatrix = createProjectionMatrix(fieldOfViewYrad, aspect, 0.001 /*near*/, 100.0 /*far*/, perspectiveSkew);

  function onWindowResize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
    projectionMatrix = createProjectionMatrix(fieldOfViewYrad, aspect, 0.1 /*near*/, 100.0 /*far*/, perspectiveSkew);
    gl.uniform2f(uResolution, canvas.clientWidth, canvas.clientHeight);
  }
  window.addEventListener('resize', onWindowResize);

  gl.blendFunc(gl.ONE, gl.ONE);

  const startTimestamp = performance.now();
  let animationFrameId = requestAnimationFrame(function callback(timestamp) {
    const journeyCompletionRatio = (timestamp - startTimestamp) / tunnelJourneyDurationMs;

    const fadeIn = Math.max(1 - (journeyCompletionRatio / 0.1), 0);
    gl.clearColor(0, 0, 0, fadeIn);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(tunnelShaderProgram);
    gl.disable(gl.BLEND);

    const translation = -tunnelDepth * (1 - journeyCompletionRatio);
    gl.uniform1f(uCameraZ, translation);

    perspectiveSkew = 0.01 + journeyCompletionRatio;
    setProjectionMatrixSkew(projectionMatrix, fieldOfViewYrad, aspect, perspectiveSkew);
    gl.uniformMatrix4fv(uProjectionMatrix, false, projectionMatrix);

    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.enableVertexAttribArray(aVertexPosition);
    gl.vertexAttribPointer(aVertexPosition, 3 /*components*/, gl.FLOAT, false /*normalize*/, 0 /*stride*/, 0 /*offset*/);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0 /*offset*/);

    gl.useProgram(lensFlareShaderProgram);
    gl.uniform1f(uTimeMs, timestamp - startTimestamp);
    gl.enable(gl.BLEND);
    gl.bindBuffer(gl.ARRAY_BUFFER, fullscreenQuadVertexBuffer);
    gl.enableVertexAttribArray(aFullscreenQuadVertexPosition);
    gl.vertexAttribPointer(aFullscreenQuadVertexPosition, 2 /*components*/, gl.BYTE, false, 0 /*normalize*/, 0 /*offset*/);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    if (journeyCompletionRatio < 1) {
      animationFrameId = requestAnimationFrame(callback);
    } else {
      animationFrameId = null;
    }
  });

  return {
    stop() {
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }
      window.removeEventListener('resize', onWindowResize);
    }
  }
}

function createGlProgram(gl, {vertexShaderSource, fragmentShaderSource}) {
  const program = gl.createProgram();

  const vertexShader   = loadShader(gl, gl.VERTEX_SHADER,   vertexShaderSource);
  const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);

  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    alert('Unable to initialize the shader program: ' + gl.getProgramInfoLog(program));
    return null;
  }

  return program;
}

function loadShader(gl, type, source) {
  const shader = gl.createShader(type);

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    alert('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

function createProjectionMatrix(fovy, aspect, near, far, skew = 1) {
  const mat4 = new Float32Array(16);
  const f = (1.0 / Math.tan(fovy / 2)) * skew;
  const nf = 1 / (near - far);
  mat4[0] = f / aspect;
  mat4[5] = f;
  mat4[10] = (far + near) * nf;
  mat4[11] = -1;
  mat4[14] = 2 * far * near * nf;
  return mat4;
}

function setProjectionMatrixSkew(mat4, fovy, aspect, skew) {
  const f = (1.0 / Math.tan(fovy / 2)) * skew;
  mat4[0] = f / aspect;
  mat4[5] = f;
}

function createTunnelMesh({depth, depthSubdivs, radialSubdivs}) {
  const positions = new Float32Array(depthSubdivs * radialSubdivs * 3);
  const indices   = new Uint16Array((depthSubdivs-1)*6*(radialSubdivs+1));

  function noise() {
    return (Math.random() - 0.5) * 0.1;
  }

  const sliceAngle = (2*Math.PI) / radialSubdivs;

  for (let j=0, idx=0; j<depthSubdivs; j++) {
    for (let i=0; i<radialSubdivs; i++) {
      const angle = sliceAngle * i;
      positions[idx++] = Math.cos(angle) + noise();
      positions[idx++] = Math.sin(angle) + noise();
      positions[idx++] = (j*(depth/depthSubdivs)) + noise();
    }
  }

  for (let j=0, idx=0; j<depthSubdivs-1; j++) {
    for (let i=0; i<=radialSubdivs; i++) {
      const mi  =  i    % radialSubdivs,
            mi2 = (i+1) % radialSubdivs;
      indices[idx++] = (j+1) * radialSubdivs + mi;
      indices[idx++] =  j    * radialSubdivs + mi; // mesh[j][mi]
      indices[idx++] = (j)   * radialSubdivs + mi2;
      indices[idx++] = (j+1) * radialSubdivs + mi;
      indices[idx++] =  j    * radialSubdivs + mi2;
      indices[idx++] = (j+1) * radialSubdivs + mi2;
    }
  }

  return {positions, indices};
}
