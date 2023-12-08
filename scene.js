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
    Group,
    Vector3,
    SphereGeometry,
    MeshBasicMaterial,
    BoxGeometry,
    CubeTextureLoader,
    AudioLoader,
    AudioListener,
    Audio
} from 'three';

let firingCanons = false;

const forestSize = 100;

const frenchArmySize = 100;

const enemyArmySize = 500;

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

const audioListener = new AudioListener();

const canonSound = new Audio(audioListener);

const audioLoader = new AudioLoader();

let enemiesKilled = false;

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

window.addEventListener(
    'keydown',
    event => {
        switch (event.key) {
            case 'q':
                toggleDayNight();
                return;
            case ' ':
                fireCanons().catch(console.error);
                return;
        }
    },
    false
);

/**
 * @type {Group[]}
 */
const trees = [];

/**
 * @type {Group[]}
 */
const enemies = [];

/**
 * @type {{day; night}}
 */
let skyboxTextures;

/**
 * @type {AmbientLight}
 */
let ambientLight;

let _day = true;

function toDay() {
    _day = true;
    scene.background = skyboxTextures.day;
    ambientLight.intensity = 0.8;
}

function toNight() {
    _day = false;
    scene.background = skyboxTextures.night;
    ambientLight.intensity = 0.1;
}

function toggleDayNight() {
    if (isDay()) {
        toNight();
        return;
    }

    toDay();
}

function isDay() {
    return _day;
}

// eslint-disable-next-line no-unused-vars
function isNight() {
    return !_day;
}

async function fireCanons() {
    try {
        if (firingCanons) {
            return;
        }

        firingCanons = true;

        canonSound.play();

        await sleep(canonSound);

        enemiesKilled = true;
    } catch (e) {
        console.error(e);
    } finally {
        firingCanons = false;
    }
}

async function sleep(milliseconds) {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
}

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
    const result = await Promise.allSettled([
        loadTextures(
            'assets/texture/snow',
            RepeatWrapping,
            RepeatWrapping,
            10,
            10
        ),
        loadTextures(
            'assets/texture/wood',
            RepeatWrapping,
            RepeatWrapping,
            1,
            5
        ),
        loadTextures(
            'assets/texture/leaves',
            RepeatWrapping,
            RepeatWrapping,
            1,
            5
        ),
        loadTextures(
            'assets/texture/iron',
            RepeatWrapping,
            RepeatWrapping,
            10,
            10
        )
    ]);
    const [snowTextures, woodTextures, leavesTextures, ironTextures] =
        result.map(res => (res.status === 'fulfilled' ? res.value : undefined));
    return { snowTextures, woodTextures, leavesTextures, ironTextures };
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

/**
 *
 * @param {Vector3} center
 * @param {number} radius
 * @param {number} amount
 * @param {(position: Vector3) => void} plant
 */
// eslint-disable-next-line no-unused-vars
function randomizeSphereArea(center, radius, amount, plant) {
    for (let i = 0; i < amount; i++) {
        // get coord from unit circle
        const theta = Math.random();

        const ux = Math.cos(theta * 2 * Math.PI);
        const uy = Math.sin(theta * 2 * Math.PI);

        // get radius
        const r = Math.random() * radius;

        // multiply unit circle position with radius, creating the offset
        const ox = ux * r;
        const oy = uy * r;

        // get x and z
        const x = ox + center.x;
        const z = oy + center.z;

        // apply function to the random coordinate
        plant(new Vector3(x, center.y, z));
    }
}

/**
 *
 * @param {Vector3} min
 * @param {Vector3} max
 * @param {number} amount
 * @param {(position: Vector3) => void} plant
 */
function randomizeBoxArea(min, max, amount, plant) {
    const minX = Math.min(min.x, max.x);
    const minY = Math.min(min.y, max.y);
    const minZ = Math.min(min.z, max.z);

    const maxX = Math.max(min.x, max.x);
    const maxY = Math.max(min.y, max.y);
    const maxZ = Math.max(min.z, max.z);

    for (let i = 0; i < amount; i++) {
        const x = randomInRange(minX, maxX);
        const y = randomInRange(minY, maxY);
        const z = randomInRange(minZ, maxZ);

        plant(new Vector3(x, y, z));
    }
}

function randomInRange(min, max) {
    return lerp(Math.random(), min, max);
}

function plantTree(position, textures) {
    const minHeight = 5;
    const maxHeight = 20;

    const minRadius = 0.1;
    const maxRadius = 0.5;

    const minLeafRadius = 3;
    const maxLeafRadius = 5;

    const minLeafSegments = 2;
    const maxLeafSegments = 3;

    const minLeafHeight = 2;
    const maxLeafHeight = 5;

    const height = randomInRange(minHeight, maxHeight);
    const radius = randomInRange(minRadius, maxRadius);

    const leafRadius = randomInRange(minLeafRadius, maxLeafRadius);
    const leafHeight = randomInRange(minLeafHeight, maxLeafHeight);
    const numberOfLeafComponents =
        (height / 5) * randomInRange(minLeafSegments, maxLeafSegments);

    const tree = createTree({
        textures,
        height,
        radius,
        leafRadius,
        numberOfLeafComponents,
        leafHeight
    });
    tree.position.set(position.x, 0, position.z);
    scene.add(tree);
}

const cylinderGeometry = new CylinderGeometry();
const sphereGeometry = new SphereGeometry();

function createMan(clothColor) {
    const manGroup = new Group();

    const headMaterial = new MeshBasicMaterial({
        color: 0xffedd4,
        shininess: 0.2
    });
    const clothMaterial = new MeshBasicMaterial({
        color: clothColor,
        shininess: 0.2
    });

    const body = new Mesh(cylinderGeometry, clothMaterial);
    const arm1 = new Mesh(cylinderGeometry, clothMaterial);
    const arm2 = new Mesh(cylinderGeometry, clothMaterial);
    const head = new Mesh(sphereGeometry, headMaterial);

    arm1.position.set(0.2, 0.6, 0);
    arm1.rotation.set(0, 0, Math.PI / 4);
    arm1.scale.set(0.05, 0.3, 0.05);

    arm2.position.set(-0.2, 0.6, 0);
    arm2.rotation.set(0, 0, -Math.PI / 4);
    arm2.scale.set(0.05, 0.3, 0.05);

    body.scale.set(0.1, 1.2, 0.1);
    body.position.set(0, 0.6, 0);

    head.position.set(0, 1, 0);
    head.scale.set(0.2, 0.2, 0.2);

    head.castShadow = true;
    head.receiveShadow = true;

    body.castShadow = true;
    body.receiveShadow = true;

    arm1.castShadow = true;
    arm1.receiveShadow = true;

    arm2.castShadow = true;
    arm2.receiveShadow = true;

    manGroup.add(body);
    manGroup.add(head);
    manGroup.add(arm1);
    manGroup.add(arm2);

    return manGroup;
}

function spawnMan(position, clothColor) {
    const man = createMan(clothColor);
    man.position.set(position.x, position.y, position.z);
    scene.add(man);
    return man;
}

function createTent() {
    const tentGroup = new Group();

    const material = new MeshPhongMaterial({
        color: 0x004a0f,
        shininess: 0.2
    });
    const triangleCylinder = new CylinderGeometry(1, 1, 5, 3);

    const triangleMesh = new Mesh(triangleCylinder, material);
    triangleMesh.position.set(0, 0.5, 0);
    triangleMesh.rotation.set(-Math.PI / 2, 0, 0);

    const boxGeometry = new BoxGeometry();
    const boxMaterial = new MeshPhongMaterial({
        color: 0x402400,
        shininess: 0.2
    });

    const boxMesh1 = new Mesh(boxGeometry, boxMaterial);
    const boxMesh2 = new Mesh(boxGeometry, boxMaterial);
    const boxMesh3 = new Mesh(boxGeometry, boxMaterial);
    const boxMesh4 = new Mesh(boxGeometry, boxMaterial);
    const boxMesh5 = new Mesh(boxGeometry, boxMaterial);
    const boxMesh6 = new Mesh(boxGeometry, boxMaterial);

    boxMesh1.position.set(1, 0.5, 2);
    boxMesh1.rotation.set(0, 0, Math.PI / 3);
    boxMesh1.scale.set(0.1, 2, 0.1);

    boxMesh2.position.set(-1, 0.5, 2);
    boxMesh2.rotation.set(0, 0, -Math.PI / 3);
    boxMesh2.scale.set(0.1, 2, 0.1);

    boxMesh3.position.set(1, 0.5, -2);
    boxMesh3.rotation.set(0, 0, Math.PI / 3);
    boxMesh3.scale.set(0.1, 2, 0.1);

    boxMesh4.position.set(-1, 0.5, -2);
    boxMesh4.rotation.set(0, 0, -Math.PI / 3);
    boxMesh4.scale.set(0.1, 2, 0.1);

    boxMesh5.position.set(0, 0.3, -2.8);
    boxMesh5.rotation.set(Math.PI / 9, 0, 0);
    boxMesh5.scale.set(0.1, 2.2, 0.1);

    boxMesh6.position.set(0, 0.3, 2.8);
    boxMesh6.rotation.set(-Math.PI / 9, 0, 0);
    boxMesh6.scale.set(0.1, 2.2, 0.1);

    [
        triangleMesh,
        boxMesh1,
        boxMesh2,
        boxMesh3,
        boxMesh4,
        boxMesh5,
        boxMesh6
    ].forEach(mesh => {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
    });

    tentGroup.add(triangleMesh);
    tentGroup.add(boxMesh1);
    tentGroup.add(boxMesh2);
    tentGroup.add(boxMesh3);
    tentGroup.add(boxMesh4);
    tentGroup.add(boxMesh5);
    tentGroup.add(boxMesh6);

    return tentGroup;
}

/**
 *
 * @param {string} path
 * @returns {Promise<Group>}
 */
async function loadObj(path) {
    return new Promise((resolve, reject) => {
        try {
            objLoader.load(
                path,
                mesh => resolve(mesh),
                () => {},
                err => reject(err)
            );
        } catch (e) {
            reject(e);
        }
    });
}

/**
 *
 * @param {*} textures
 * @returns
 */
async function loadCanonGeometry(textures) {
    const material = new MeshPhongMaterial({
        map: textures.ironTextures.color,
        aoMap: textures.ironTextures.ao,
        normalMap: textures.ironTextures.normal
    });

    const group = await loadObj('assets/models/canon/canon.obj');
    group.traverse(child => {
        if (child instanceof Mesh) {
            child.material = material;
        }
        child.castShadow = true;
        child.receiveShadow = true;
    });

    group.castShadow = true;
    group.receiveShadow = true;

    return group;
}

/**
 *
 * @param {Group} baseCanon
 * @returns {Group}
 */
function createCanon(baseCanon) {
    const canonMesh = baseCanon.clone();
    canonMesh.scale.set(0.1, 0.1, 0.1);
    canonMesh.rotation.set(0, Math.PI, 0);

    return canonMesh;
}

/**
 *
 * @param {string} mainPath
 */
async function loadSkybox(mainPath) {
    const cubeTextureLoader = new CubeTextureLoader();

    const directions = ['front', 'back', 'up', 'down', 'left', 'right'];

    const paths = directions.map(dir => mainPath + '/' + dir + '.png');

    const textures = await cubeTextureLoader.loadAsync(paths);
    return textures;
}

async function loadSkyboxes() {
    const results = await Promise.allSettled([
        loadSkybox('assets/texture/skybox/day'),
        loadSkybox('assets/texture/skybox/night')
    ]);

    const [day, night] = results.map(res =>
        res.status === 'fulfilled' ? res.value : undefined
    );

    return { day, night };
}

async function loadAudio() {
    const audioBuffer = await audioLoader.loadAsync('assets/sound/canon.mp3');
    canonSound.setBuffer(audioBuffer);
    canonSound.setVolume(0.5);
}

async function init() {
    const textures = await loadAllTextures();
    skyboxTextures = await loadSkyboxes();

    const baseCanon = await loadCanonGeometry(textures);

    await loadAudio();

    renderer.shadowMap.enabled = true;
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    camera.position.set(-10, 10, 0);
    camera.lookAt(scene.position);
    camera.add(audioListener);

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

    randomizeBoxArea(
        new Vector3(-50, 0, -50),
        new Vector3(50, 0, -20),
        forestSize,
        pos => plantTree(pos, textures)
    );

    randomizeBoxArea(
        new Vector3(-20, 0, -15),
        new Vector3(20, 0, -10),
        frenchArmySize,
        pos => spawnMan(pos, 0x00087d)
    );

    randomizeBoxArea(
        new Vector3(30, 0, 10),
        new Vector3(-30, 0, 30),
        enemyArmySize,
        pos => {
            enemies.push(spawnMan(pos, 0x4a4947));
        }
    );

    const tent = createTent();
    tent.position.set(-20, 0, -10);
    tent.rotation.set(0, Math.PI / 3, 0);
    scene.add(tent);

    for (let x = -15; x <= 15; x += 3) {
        const pos = new Vector3(x, 0, -5 + (Math.random() - 0.5));
        const canon = createCanon(baseCanon);
        canon.position.set(pos.x, 0, pos.z);
        scene.add(canon);
    }

    ambientLight = new AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const axesHelper = new AxesHelper(10);
    scene.add(axesHelper);

    toDay();

    animate();
}

/**
 * @type {Record<number, string>}
 */
const enmeyRotationKeys = {};

/**
 *
 * @param {number} i
 */
function getEnemyKeyOf(i) {
    let key = enmeyRotationKeys[i];

    if (key) {
        return key;
    }

    const keys = ['x', 'z'];

    key = keys[Math.round(Math.random())];

    enmeyRotationKeys[i] = key;

    return key;
}

let activeCounter = 0;

function animate() {
    requestAnimationFrame(animate);

    controls.update();

    if (enemiesKilled) {
        for (let i = 0; i < enemies.length; i++) {
            const enemy = enemies[i];
            const key = getEnemyKeyOf(i);

            if (Math.abs(enemy.rotation[key]) <= Math.PI / 2) {
                enemy.rotation[key] += randomInRange(0.001, 0.2);
            }
        }
    }

    activeCounter += Math.random() * 0.05;

    for (const tree of trees) {
        tree.rotation.z = Math.sin(activeCounter) * 0.05 + 0.05;
    }

    render();
}

function render() {
    renderer.render(scene, camera);
}

init().catch(console.error);
