'use strict';

import { OrbitControls } from 'OrbitControls';
import { OBJLoader } from 'OBJLoader';
import {
    Scene,
    PerspectiveCamera,
    WebGLRenderer,
    Mesh,
    AmbientLight,
    TextureLoader,
    PlaneGeometry,
    MeshPhongMaterial,
    AxesHelper,
    CylinderGeometry,
    RepeatWrapping,
    ConeGeometry,
    Group
} from 'three';

const scene = new Scene();
const renderer = new WebGLRenderer({
    antialias: true
});

const camera = new PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);

const controls = new OrbitControls(camera, renderer.domElement);

const textureLoader = new TextureLoader();

const objLoader = new OBJLoader();

window.addEventListener(
    'resize',
    () => {
        renderer.setSize(window.innerWidth, window.innerHeight);
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();

        render();
    },
    false
);

/**
 * @type {Object3D[]}
 */
const trees = [];

/**
 *
 * @param {string} directory
 * @param {import('three').Wrapping} wrapS
 * @param {import('three').Wrapping} wrapT
 * @param {number} repeatX
 * @param {number} repeatY
 */
async function loadTextures(directory, wrapS, wrapT, repeatX, repeatY) {
    const results = await Promise.allSettled([
        textureLoader.loadAsync(directory + '/ao.png'),
        textureLoader.loadAsync(directory + '/color.png'),
        textureLoader.loadAsync(directory + '/normal.png')
    ]);
    const [ao, color, normal] = results
        .map(result =>
            result.status === 'fulfilled' ? result.value : undefined
        )
        .map(texture => {
            if (texture) {
                if (wrapS) {
                    texture.wrapS = wrapS;
                }
                if (wrapT) {
                    texture.wrapT = wrapT;
                }
                if (repeatX && repeatY) {
                    texture.repeat.set(repeatX, repeatY);
                }
            }
            return texture;
        });
    return { ao, color, normal };
}

async function loadAllTextures() {
    const snowTextures = await loadTextures(
        'assets/texture/snow',
        RepeatWrapping,
        RepeatWrapping,
        10,
        10
    );
    const woodTextures = await loadTextures(
        'assets/texture/wood',
        RepeatWrapping,
        RepeatWrapping,
        1,
        5
    );
    const leavesTextures = await loadTextures(
        'assets/texture/leaves',
        RepeatWrapping,
        RepeatWrapping,
        1,
        5
    );
    return { snowTextures, woodTextures, leavesTextures };
}

/**
 *
 * @param {number} i
 * @param {number} length
 * @returns {number}
 */
function asAlpha(i, length) {
    if (length == 1) {
        return 0.5;
    }
    return i / (length - 1);
}

/**
 *
 * @param {number} alpha
 * @param {number} start
 * @param {number} end
 * @returns {number}
 */
function lerp(alpha, start, end) {
    const delta = (end - start) * alpha;
    return delta + start;
}

/**
 *
 * @param { { textures: {woodTextures: {ao, normal, color}; leavesTextures: {ao, normal, color}}; radius: number; height: number; leafHeight: number; leafRadius: number; numberOfLeafComponents: number } }
 */
function createTree({
    textures,
    radius,
    height,
    leafRadius,
    leafHeight,
    numberOfLeafComponents
}) {
    const treeGroup = new Group();

    const logGeometry = new CylinderGeometry(radius, radius, height);
    const logMaterial = new MeshPhongMaterial({
        map: textures.woodTextures.color,
        normalMap: textures.woodTextures.normal,
        aoMap: textures.woodTextures.ao
    });

    const log = new Mesh(logGeometry, logMaterial);
    log.position.set(0, height / 2, 0);
    treeGroup.add(log);

    const startLeafRadius = leafRadius;
    const endLeafRadius = 0.2 * leafRadius;

    const startHeight = leafHeight;
    const endHeight = 0.5 * leafHeight;

    const startY = height / 2;
    const endY = height;

    // ConeGeometry does not work
    const leafMaterial = new MeshPhongMaterial({
        map: textures.leavesTextures.color,
        aoMap: textures.leavesTextures.ao,
        normalMap: textures.leavesTextures.normal
    });

    for (let i = 0; i < numberOfLeafComponents; i++) {
        const alpha = asAlpha(i, numberOfLeafComponents);
        const r = lerp(alpha, startLeafRadius, endLeafRadius);
        const h = lerp(alpha, startHeight, endHeight);
        const y = lerp(alpha, startY, endY);
        const coneGeometry = new ConeGeometry(r, h);

        const leafMesh = new Mesh(coneGeometry, leafMaterial);
        leafMesh.position.set(0, y, 0);

        treeGroup.add(leafMesh);
    }

    trees.push(treeGroup);

    return treeGroup;
}

async function init() {
    const textures = await loadAllTextures();

    renderer.shadowMap.enabled = true;
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    camera.position.set(4, 4, 4);
    camera.lookAt(scene.position);

    controls.rotateSpeec = 5.0;
    controls.panSpeed = 1.0;

    // const textureLoader = new TextureLoader();

    const floorGeometry = new PlaneGeometry(10, 10);
    const floorMaterial = new MeshPhongMaterial({
        map: textures.snowTextures.color,
        aoMap: textures.snowTextures.ao,
        normalMap: textures.snowTextures.normal,
        wireframe: false
    });

    const floor = new Mesh(floorGeometry, floorMaterial);
    floor.position.set(0, 0, 0);
    floor.scale.set(10, 10, 10);
    floor.rotateX(-Math.PI / 2);
    floor.castShadow = false;
    floor.receiveShadow = true;
    scene.add(floor);

    const tree = createTree({
        textures,
        height: 10,
        radius: 0.2,
        leafRadius: 5,
        numberOfLeafComponents: 3,
        leafHeight: 5
    });
    scene.add(tree);

    const ambientLight = new AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const axesHelper = new AxesHelper(10);
    scene.add(axesHelper);
    animate();
}

function animate() {
    requestAnimationFrame(animate);

    controls.update();

    render();
}

function render() {
    renderer.render(scene, camera);
}

init().catch(console.error);
