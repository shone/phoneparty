import {acceptAllPlayers} from '/host/players.mjs';
import {waitForNSeconds, waitForKeypress} from '/shared/utils.mjs';

import * as audienceMode from '/host/audienceMode.mjs';
import * as messaging from '/host/messaging.mjs';

import routes, {waitForRouteToEnd} from '/host/routes.mjs';

routes['#games/all-the-things'] = async function titleScreen() {
  document.body.style.backgroundColor = '#98947f';
  document.body.insertAdjacentHTML('beforeend', `
    <div class="all-the-things title-screen">
      <h1>
        Tunnel Vision
        <div class="closeup-trickery">
          Closeup trickery
          <div class="magnifying-glass-container">
            <div class="zoomed-text">
              <div>Closeup trickery</div>
            </div>
            <div class="magnifying-glass"></div>
          </div>
        </div>
      </h1>
      <canvas width="${window.innerWidth}" height="${window.innerHeight}"></canvas>
    </div>
  `);
  const titleScreen = document.body.lastElementChild;

  audienceMode.start();
  messaging.start();

  const tunnelJourneyDurationMs = 5000;
  const fieldOfViewYrad = 45 * Math.PI / 180;

  const canvas = titleScreen.querySelector('canvas');

  const gl = canvas.getContext('webgl');
  if (!gl) {
    alert('Could not get WebGL context');
    return;
  }

  gl.getExtension('OES_standard_derivatives');

  const fullscreenQuadVertexShader = loadShader(gl, gl.VERTEX_SHADER, `
    attribute vec4 vertex_position;
    void main() { gl_Position = vertex_position; }
  `);

  const lensFlareFragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, `
    precision lowp float;
    uniform vec2 resolution;
    uniform float timeMs;

    void main() {
      vec2 uv = (gl_FragCoord.xy / resolution) - vec2(.5,.5);
      float PI = 3.14159;
      float angle = 1.0 + (atan(uv.x, uv.y) / PI);
      float warble1 = sin(angle * 16.0);
      float warble2 = cos(angle * 20.0);
      float warble3 = sin((angle + (timeMs / 3000.0)) * 35.0);
      float warbles = (warble1 + (warble2*.5) + (warble3*.2)) / 12.0;
      float dist = 1.0 - length(uv);
      float fadein = min(timeMs / 1000.0, 1.0);
      float fadeout = 1.0 - (timeMs / 5000.0);
      float intensity = (pow(dist, 10.0) + warbles) * (fadeout * fadein);
      gl_FragColor = vec4(intensity,intensity,intensity,intensity);
    }
  `);

  const lensFlareShaderProgram = gl.createProgram();
  gl.attachShader(lensFlareShaderProgram, fullscreenQuadVertexShader);
  gl.attachShader(lensFlareShaderProgram, lensFlareFragmentShader);
  gl.linkProgram(lensFlareShaderProgram);
  gl.useProgram(lensFlareShaderProgram);
  const aFullscreenQuadVertexPosition = gl.getAttribLocation(lensFlareShaderProgram, 'vertex_position');
  const uResolution = gl.getUniformLocation(lensFlareShaderProgram, 'resolution');
  gl.uniform2f(uResolution, canvas.clientWidth, canvas.clientHeight);
  const uTimeMs = gl.getUniformLocation(lensFlareShaderProgram, 'timeMs');

  const fullscreenQuadVertexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, fullscreenQuadVertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1, -1, 0,
     1, -1, 0,
    -1,  1, 0,
     1,  1, 0,
  ]), gl.STATIC_DRAW);

  const tunnelVertexShader = loadShader(gl, gl.VERTEX_SHADER, `
    attribute vec4 aVertexPosition;

    uniform mat4 uModelViewMatrix;
    uniform mat4 uProjectionMatrix;

    varying vec3 vertex_view_space;

    void main() {
      vertex_view_space = aVertexPosition.xyz;
      gl_Position = uProjectionMatrix * uModelViewMatrix * aVertexPosition;
    }
  `);
  const tunnelFragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, `
    #extension GL_OES_standard_derivatives : enable

    varying lowp vec3 vertex_view_space;

    const lowp float tunnelDepth = 20.0;
    const lowp vec3 diffuse = vec3(.3, .2, .03);
    const lowp vec3 lightDirection = vec3(0, 0, -1);

    void main() {
      lowp vec3 normal = normalize(cross(dFdx(vertex_view_space), dFdy(vertex_view_space)));
      lowp float incidence = max(dot(normal, lightDirection), 0.0);
      lowp float tunnelEndCloseness = 1.0 - (vertex_view_space.z / tunnelDepth);
      gl_FragColor.a = 1.0;
      gl_FragColor.rgb = diffuse * tunnelEndCloseness * (0.5 + incidence);
    }
  `);

  const tunnelShaderProgram = gl.createProgram();
  gl.attachShader(tunnelShaderProgram, tunnelVertexShader);
  gl.attachShader(tunnelShaderProgram, tunnelFragmentShader);
  gl.linkProgram(tunnelShaderProgram);
  gl.useProgram(tunnelShaderProgram);

  if (!gl.getProgramParameter(tunnelShaderProgram, gl.LINK_STATUS)) {
    alert('Unable to initialize the shader program: ' + gl.getProgramInfoLog(tunnelShaderProgram));
    return;
  }

  const aVertexPosition   = gl.getAttribLocation(tunnelShaderProgram, 'aVertexPosition'),
        uProjectionMatrix = gl.getUniformLocation(tunnelShaderProgram, 'uProjectionMatrix'),
        uModelViewMatrix  = gl.getUniformLocation(tunnelShaderProgram, 'uModelViewMatrix');

  const tunnelDepth = 20;

  const {positions, indices} = createTunnel({depth: tunnelDepth, depthSubdivs: 200, radialSubdivs: 40});

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

  const modelViewMatrix = createModelViewMatrix(0, 0, -tunnelDepth);

  gl.blendFunc(gl.ONE, gl.ONE);

  let routeEnded = false;

  const startTimestamp = performance.now();
  let previousTimestamp = startTimestamp;
  requestAnimationFrame(function callback(timestamp) {
    const journeyCompletionRatio = (timestamp - startTimestamp) / tunnelJourneyDurationMs;

    gl.clearColor(0, 0, 0, Math.max(1 - (journeyCompletionRatio / 0.1), 0));
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(tunnelShaderProgram);
    gl.disable(gl.BLEND);

    const translation = -tunnelDepth * (1 - journeyCompletionRatio);
    setModelViewMatrixTranslation(modelViewMatrix, [0, 0, translation]);
    gl.uniformMatrix4fv(uModelViewMatrix, false, modelViewMatrix);

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
    gl.vertexAttribPointer(aFullscreenQuadVertexPosition, 3 /*components*/, gl.FLOAT, false, 0 /*normalize*/, 0 /*offset*/);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    if (journeyCompletionRatio < 1 && !routeEnded) {
      requestAnimationFrame(callback);
    }
  });

  let skew = 1;
  let translation = -20;
  window.addEventListener('mousedown', event => {
     let lastY = event.pageY;
     const button = event.button;
     function handleMousemove(event) {
      const deltaY = event.pageY - lastY;
      lastY = event.pageY;
      if (button === 0) {
        translation += deltaY * 0.2;
        setModelViewMatrixTranslation(modelViewMatrix, [0, 0, translation]);
        gl.uniformMatrix4fv(uModelViewMatrix,  false, modelViewMatrix);
      } else if (button === 1) {
        skew += deltaY * 0.1;
        console.log(skew);
        const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
        setProjectionMatrixSkew(projectionMatrix, fieldOfViewYrad, aspect, skew);
      }
     }
     window.addEventListener('mousemove', handleMousemove);
     window.addEventListener('mouseup', () => {
       window.removeEventListener('mousemove', handleMousemove);
     }, {once: true});
  });

  await waitForRouteToEnd();
  routeEnded = true;

  window.removeEventListener('resize', onWindowResize);

  titleScreen.classList.add('finished');
  setTimeout(() => { titleScreen.remove() }, 2000);
  await Promise.race([waitForNSeconds(2), waitForKeypress(' ')]);

  messaging.stop();

  if (!location.hash.startsWith('#games/all-the-things')) {
    audienceMode.stop();
  }
  return '#games/all-the-things/thing-choosing';
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

function createModelViewMatrix(x, y, z) {
  const mat4 = new Float32Array(16);
  mat4[0]  = 1;
  mat4[5]  = 1;
  mat4[10] = 1;
  mat4[15] = 1;
  mat4[12] = x * y * z;
  mat4[13] = y;
  mat4[14] = z;
  return mat4;
}

function setModelViewMatrixTranslation(mat4, [x, y, z]) {
  mat4[12] = x * y * z;
  mat4[13] = y;
  mat4[14] = z;
}

// function translateMatrix(mat4, [x, y, z]) {
//   mat4[12] = mat4[0] * x + mat4[4] * y + mat4[8]  * z + mat4[12];
//   mat4[13] = mat4[1] * x + mat4[5] * y + mat4[9]  * z + mat4[13];
//   mat4[14] = mat4[2] * x + mat4[6] * y + mat4[10] * z + mat4[14];
//   mat4[15] = mat4[3] * x + mat4[7] * y + mat4[11] * z + mat4[15];
// }

// function rotateMatrix(mat4, rad, [x, y, z]) {
//   const len = 1 / Math.sqrt(x * x + y * y + z * z);
//   x *= len;
//   y *= len;
//   z *= len;
// 
//   const s = Math.sin(rad),
//         c = Math.cos(rad),
//         t = 1 - c;
// 
//   const a00 = mat4[0], a01 = mat4[1], a02 = mat4[2],  a03 = mat4[3],
//         a10 = mat4[4], a11 = mat4[5], a12 = mat4[6],  a13 = mat4[7],
//         a20 = mat4[8], a21 = mat4[9], a22 = mat4[10], a23 = mat4[11];
// 
//   // Construct the elements of the rotation matrix
//   const b00 = x * x * t + c,     b01 = y * x * t + z * s, b02 = z * x * t - y * s,
//         b10 = x * y * t - z * s, b11 = y * y * t + c,     b12 = z * y * t + x * s,
//         b20 = x * z * t + y * s, b21 = y * z * t - x * s, b22 = z * z * t + c;
// 
//   // Perform rotation-specific matrix multiplication
//   mat4[0]  = a00 * b00 + a10 * b01 + a20 * b02;
//   mat4[1]  = a01 * b00 + a11 * b01 + a21 * b02;
//   mat4[2]  = a02 * b00 + a12 * b01 + a22 * b02;
//   mat4[3]  = a03 * b00 + a13 * b01 + a23 * b02;
//   mat4[4]  = a00 * b10 + a10 * b11 + a20 * b12;
//   mat4[5]  = a01 * b10 + a11 * b11 + a21 * b12;
//   mat4[6]  = a02 * b10 + a12 * b11 + a22 * b12;
//   mat4[7]  = a03 * b10 + a13 * b11 + a23 * b12;
//   mat4[8]  = a00 * b20 + a10 * b21 + a20 * b22;
//   mat4[9]  = a01 * b20 + a11 * b21 + a21 * b22;
//   mat4[10] = a02 * b20 + a12 * b21 + a22 * b22;
//   mat4[11] = a03 * b20 + a13 * b21 + a23 * b22;
// }

function createTunnel({depth, depthSubdivs, radialSubdivs}) {
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
