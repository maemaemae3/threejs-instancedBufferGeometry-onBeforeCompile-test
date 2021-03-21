const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-window.innerWidth / 2, window.innerWidth / 2, window.innerHeight / 2, -window.innerHeight / 2, -100000, 100000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
const controls = new THREE.OrbitControls(camera, renderer.domElement);
const loader = new THREE.GLTFLoader();

class InstancedLambertMaterial extends THREE.MeshLambertMaterial {
  constructor(params) {
    super(params);
    this.spriteGrids = params?.spriteGrids;
    this.userData = {
      uniforms: {
        vUvScale: { value: 1 / Math.sqrt(params?.spriteGrids) }
      }
    };
  }
  onBeforeCompile(shader) {
    Object.assign(shader.uniforms, this.userData.uniforms);

    shader.vertexShader = `#define USE_INSTANCING_CUSTOM\n${shader.vertexShader}`;

    const instancedAttributes = `
attribute vec3 translation;
attribute vec4 orientation;
attribute vec3 scale;
attribute vec2 vUvOffsets;
varying vec2 v_vUvOffsets;
uniform float vUvScale;
`;
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `${instancedAttributes}\n#include <common>`);

    const replacedProjectVertex = `
vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_INSTANCING
  mvPosition = instanceMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING_CUSTOM
  vUv = uv;
  transformed *= scale;
  vec3 vcV = cross(orientation.xyz, transformed);
  transformed = vcV * (2.0 * orientation.w) + (cross(orientation.xyz, vcV) * 2.0 + transformed);
  mvPosition = vec4(translation + transformed, 1.0);
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;

#ifdef USE_INSTANCING_CUSTOM
    v_vUvOffsets = vUvOffsets;
#endif
    `;
    shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', replacedProjectVertex);

    shader.fragmentShader = `#define USE_SPRITESHEET\n${shader.fragmentShader}`;

    const spriteSheetUniforms = `
#include <map_pars_fragment>
#ifdef USE_SPRITESHEET
  uniform float vUvScale;
  varying vec2 v_vUvOffsets;
#endif
    `;
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_pars_fragment>', spriteSheetUniforms);

    const spriteSheetTexelColorBranch = `
#ifdef USE_SPRITESHEET
  vec4 texelColor = texture2D( map, (vUv * vUvScale) + (v_vUvOffsets * vUvScale) );
  texelColor = mapTexelToLinear( texelColor );
  diffuseColor *= texelColor;
#endif
    `;
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', spriteSheetTexelColorBranch);

    // userDataに格納
    this.userData = shader;
  }
}

function loadAndDrawObject() {
  loader.load('./models/tree.glb', (model) => {
    const texture = new THREE.TextureLoader().load('./models/treeSprite.png');

    let geometry;
    model.scene.traverse((node) => {
      if (node.isMesh) {
        geometry = node.geometry;
      }
    });

    const igeo = new THREE.InstancedBufferGeometry().copy(geometry);

    const material = new InstancedLambertMaterial({ spriteGrids: 4, map: texture });

    const instances = 4;
    const basePos = {x: -600, y: 0, z: 0};
    igeo.instanceCount = void 0; // set undefined

    const scales       = new THREE.InstancedBufferAttribute(new Float32Array(instances * 3), 3, false);
    const translations = new THREE.InstancedBufferAttribute(new Float32Array(instances * 3), 3, false);
    const orientations = new THREE.InstancedBufferAttribute(new Float32Array(instances * 4), 4, false);
    const tex_vec      = new THREE.InstancedBufferAttribute(new Float32Array(instances * 2), 2, false);

    const tree_tex_vec = { '0': [0, 0], '1': [0, 1], '2': [1, 0], '3': [1, 1] };
    for (let i = 0; i < 4; i++) {
      // texture
      tex_vec.setXY(i, tree_tex_vec[i][0], tree_tex_vec[i][1]);

      // translations
      const pos_x = basePos.x + (i * 400);
      const pos_y = 0;
      const pos_z = basePos.z;
      translations.setXYZ(i, pos_x, pos_y, pos_z);

      // orientations
      const quaternion = new THREE.Quaternion(0, 0, 0, 1).normalize();
      orientations.setXYZW(i, quaternion.x, quaternion.y, quaternion.z, quaternion.w);

      // scale
      scales.setXYZ(i, 100, 100, 100);
    }

    igeo.setAttribute('vUvOffsets', tex_vec);
    igeo.setAttribute('scale', scales);
    igeo.setAttribute('translation', translations);
    igeo.setAttribute('orientation', orientations);

    const mesh = new THREE.Mesh(igeo, material);
    mesh.frustumCulled = false;
    scene.add(mesh);
  });
}

window.onload = function () {

  camera.lookAt(new THREE.Vector3(0, 0, 1));
  controls.target = new THREE.Vector3(0, 0, 1);

  renderer.setClearColor(0xFFFFFF, 1.0);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  document.body.appendChild(renderer.domElement);

  // ground plane
  const grid = new THREE.GridHelper(50000, 100);
  scene.add(grid);

  const ambientLight = new THREE.AmbientLight(0xFFFFFF);
  scene.add(ambientLight);

  loadAndDrawObject();

  update();
};

function update() {
  // requestAnimationFrame(update);
  setTimeout(function () {
    requestAnimationFrame(update);
  }, 1000 / 40);

  renderer.render(scene, camera);
}