import WebGL from 'three/addons/capabilities/WebGL.js';
import * as THREE from 'three/webgpu';
import { uniform, color, varying, vec4, add, sub, max, dot, sin, mat3, uint, negate, attributeArray, cameraProjectionMatrix, cameraViewMatrix, positionLocal, modelWorldMatrix, sqrt, attribute, property, float, Fn, If, cos, Loop, Continue, normalize, instanceIndex, length } from 'three/tsl';


let container;
let camera, scene, renderer;
let last = performance.now();
let raycaster, computeVelocity, computePosition, effectController;
let pointer;

const BIRDS = 2000;
const SPEED_LIMIT = 9.0;

// detect if browser is firefox

const isFirefox = navigator.userAgent.toLowerCase().indexOf('firefox') > -1;



// Custom Geometry - using 3 triangles each. No normals currently.
class BirdGeometry extends THREE.BufferGeometry {

    constructor() {

        super();

        const trianglesPerBird = 3;
        const triangles = BIRDS * trianglesPerBird;
        const points = triangles * 3;

        const vertices = new THREE.BufferAttribute(new Float32Array(points * 3), 3);
        const references = new THREE.BufferAttribute(new Uint32Array(points), 1);
        const birdVertex = new THREE.BufferAttribute(new Uint32Array(points), 1);

        this.setAttribute('position', vertices);
        this.setAttribute('reference', references);
        this.setAttribute('birdVertex', birdVertex);

        let v = 0;

        function verts_push() {

            for (let i = 0; i < arguments.length; i++) {

                vertices.array[v++] = arguments[i];

            }

        }

        const wingsSpan = 20;

        for (let f = 0; f < BIRDS; f++) {

            // Body
            verts_push(
                0, 0, - 20,
                0, - 8, 10,
                0, 0, 30
            );

            // Wings
            verts_push(
                0, 0, - 15,
                - wingsSpan, 0, 5,
                0, 0, 15
            );

            verts_push(
                0, 0, 15,
                wingsSpan, 0, 5,
                0, 0, - 15
            );

        }

        for (let v = 0; v < triangles * 3; v++) {

            const triangleIndex = ~ ~(v / 3);
            const birdIndex = ~ ~(triangleIndex / trianglesPerBird);

            references.array[v] = birdIndex;

            birdVertex.array[v] = v % 9;

        }

        this.scale(0.2, 0.2, 0.2);

    }

}

function init() {

    container = document.createElement('div');
    container.setAttribute('id', 'murmurations-canvas');
    document.body.appendChild(container);

    camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 1, 5000);
    camera.position.z = 1000;

    scene = new THREE.Scene();

    // Pointer

    pointer = new THREE.Vector2(1000, 1000);
    raycaster = new THREE.Raycaster();

    //

    renderer = new THREE.WebGPURenderer({ antialias: true, forceWebGL: false });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.setAnimationLoop(render);
    container.appendChild(renderer.domElement);



    // Initialize position, velocity, and phase values

    const positionArray = new Float32Array(BIRDS * 3);
    const velocityArray = new Float32Array(BIRDS * 3);
    const phaseArray = new Float32Array(BIRDS);

    const BIRDSQuarter = BIRDS / 4;
    let posX = 0;
    let posY = 0;
    let posZ = 0;
    let velX;
    let velY;
    let velZ;
    const size = 1;

    for (let i = 0; i < BIRDS; i++) {
        if (i < BIRDSQuarter) {
            posX = (-window.innerWidth * 0.3) + (-window.innerWidth * 0.5) * Math.random();
            posY = (Math.sin(posX * 0.5) + Math.sin(posZ * 0.5)) * 500;
            posZ = (Math.sin(posX * 0.5) + Math.sin(posY * 0.5)) * 500;
            velX = (Math.random() + 1);
            velY = (Math.random() - 1);
            velZ = (Math.random() - 1);

        } else if (i < BIRDSQuarter * 2) {

            posX = (-window.innerWidth * 0.3) + (-window.innerWidth * 0.5) * Math.random();
            posY = (Math.sin(posX * 0.5) + Math.sin(posZ * 0.5)) * 500;
            posZ = (Math.sin(posX * 0.5) + Math.sin(posY * 0.5));
            velX = (Math.random() + 1);
            velY = (Math.random() - 1);
            velZ = (Math.random() - 1);

        } else if (i < BIRDSQuarter * 3) {

            posX = (window.innerWidth * 0.3) + (window.innerWidth * 0.5) * Math.random();
            posY = (Math.sin(posX * 0.5) + Math.sin(posZ * 0.5)) * 500;
            posZ = (Math.sin(posX * 0.5) + Math.sin(posY * 0.5)) * 500;
            velX = (Math.random() - 1);
            velY = (Math.random() - 1);
            velZ = (Math.random() - 1);

        } else {

            posX = (window.innerWidth * 0.3) + (window.innerWidth * 0.5) * Math.random();
            posY = (Math.sin(posX * 0.5) + Math.sin(posZ * 0.5)) * 500;
            posZ = (Math.sin(posX * 0.5) + Math.sin(posY * 0.5));
            velX = (Math.random() - 1);
            velY = (Math.random() - 1);
            velZ = (Math.random() - 1);

        }

        positionArray[i * 3 + 0] = posX;
        positionArray[i * 3 + 1] = posY;
        positionArray[i * 3 + 2] = posZ;

        velocityArray[i * 3 + 0] = velX * 10;
        velocityArray[i * 3 + 1] = velY * 10;
        velocityArray[i * 3 + 2] = velZ * 10;

        phaseArray[i] = 1;
    }

    // Labels applied to storage nodes and uniform nodes are reflected within the shader output,
    // and are useful for debugging purposes.

    const positionStorage = attributeArray(positionArray, 'vec3').label('positionStorage');
    const velocityStorage = attributeArray(velocityArray, 'vec3').label('velocityStorage');
    const phaseStorage = attributeArray(phaseArray, 'float').label('phaseStorage');

    // The Pixel Buffer Object (PBO) is required to get the GPU computed data in the WebGL2 fallback.

    positionStorage.setPBO(true);
    velocityStorage.setPBO(true);
    phaseStorage.setPBO(true);

    effectController = {
        separation: uniform(15.0).label('separation'),
        alignment: uniform(20.0).label('alignment'),
        cohesion: uniform(20.0).label('cohesion'),
        freedom: uniform(0.3).label('freedom'),
        now: uniform(0.0),
        deltaTime: uniform(0.0).label('deltaTime'),
        rayOrigin: uniform(new THREE.Vector3()).label('rayOrigin'),
        rayDirection: uniform(new THREE.Vector3()).label('rayDirection'),
    };

    // Define Uniforms. Uniforms only need to be defined once rather than per shader.
    if (!WebGL.isWebGL2Available()) {

        effectController = {
            separation: uniform(35.0).label('separation'),
            alignment: uniform(20.0).label('alignment'),
            cohesion: uniform(10.0).label('cohesion'),
            freedom: uniform(0.5).label('freedom'),
            now: uniform(0.0),
            deltaTime: uniform(0.0).label('deltaTime'),
            rayOrigin: uniform(new THREE.Vector3()).label('rayOrigin'),
            rayDirection: uniform(new THREE.Vector3()).label('rayDirection'),
        };
    }


    // Create geometry

    const birdGeometry = new BirdGeometry();
    const birdMaterial = new THREE.NodeMaterial();
    birdMaterial.colorNode = color(0x72767a);
    birdMaterial.transparent = true;
    birdMaterial.opacity = 0;


    // Animate bird mesh within vertex shader, then apply position offset to vertices.

    const birdVertexTSL = Fn(() => {

        const reference = attribute('reference');
        const birdVertex = attribute('birdVertex');

        const position = positionLocal.toVar();
        const newPhase = phaseStorage.element(reference).toVar();
        const newVelocity = normalize(velocityStorage.element(reference)).toVar();

        If(birdVertex.equal(4).or(birdVertex.equal(7)), () => {

            // flap wings
            position.y = sin(newPhase).mul(3.0);

        });

        const newPosition = modelWorldMatrix.mul(position);

        newVelocity.z.mulAssign(- 1.0);
        const xz = length(newVelocity.xz);
        const xyz = float(1.0);
        const x = sqrt((newVelocity.y.mul(newVelocity.y)).oneMinus());

        const cosry = newVelocity.x.div(xz).toVar();
        const sinry = newVelocity.z.div(xz).toVar();

        const cosrz = x.div(xyz);
        const sinrz = newVelocity.y.div(xyz).toVar();

        // Nodes must be negated with negate(). Using '-', their values will resolve to NaN.
        const maty = mat3(
            cosry, 0, negate(sinry),
            0, 1, 0,
            sinry, 0, cosry
        );

        const matz = mat3(
            cosrz, sinrz, 0,
            negate(sinrz), cosrz, 0,
            0, 0, 1
        );

        const finalVert = maty.mul(matz).mul(newPosition);
        finalVert.addAssign(positionStorage.element(reference));

        return cameraProjectionMatrix.mul(cameraViewMatrix).mul(finalVert);

    });

    birdMaterial.vertexNode = birdVertexTSL();
    birdMaterial.side = THREE.DoubleSide;

    const birdMesh = new THREE.Mesh(birdGeometry, birdMaterial);
    birdMesh.rotation.y = Math.PI / 2;
    birdMesh.matrixAutoUpdate = false;
    birdMesh.frustumCulled = false;
    birdMesh.updateMatrix();

    // Define GPU Compute shaders.
    // Shaders are computationally identical to their GLSL counterparts outside of texture destructuring.

    computeVelocity = Fn(() => {

        // Define consts
        const PI = float(3.141592653589793);
        const PI_2 = PI.mul(2.0);
        const limit = property('float', 'limit').assign(SPEED_LIMIT);

        // Destructure uniforms
        const { alignment, separation, cohesion, deltaTime, rayOrigin, rayDirection } = effectController;

        const zoneRadius = separation.add(alignment).add(cohesion).toConst();
        const separationThresh = separation.div(zoneRadius).toConst();
        const alignmentThresh = (separation.add(alignment)).div(zoneRadius).toConst();
        const zoneRadiusSq = zoneRadius.mul(zoneRadius).toConst();

        // Cache current bird's position and velocity outside the loop
        const birdIndex = instanceIndex.toConst('birdIndex');
        const position = positionStorage.element(birdIndex).toVar();
        const velocity = velocityStorage.element(birdIndex).toVar();

        // Add influence of pointer position to velocity using cached position
        const directionToRay = rayOrigin.sub(position).toConst();
        const projectionLength = dot(directionToRay, rayDirection).toConst();
        const closestPoint = rayOrigin.sub(rayDirection.mul(projectionLength)).toConst();
        const directionToClosestPoint = closestPoint.sub(position).toConst();
        const distanceToClosestPoint = length(directionToClosestPoint).toConst();
        const distanceToClosestPointSq = distanceToClosestPoint.mul(distanceToClosestPoint).toConst();

        const rayRadius = float(150.0).toConst();
        const rayRadiusSq = rayRadius.mul(rayRadius).toConst();

        If(distanceToClosestPointSq.lessThan(rayRadiusSq), () => {

            const velocityAdjust = (distanceToClosestPointSq.div(rayRadiusSq).sub(1.0)).mul(deltaTime).mul(100.0);
            velocity.addAssign(normalize(directionToClosestPoint).mul(velocityAdjust));
            limit.addAssign(5.0);

        });

        const centerPull = isFirefox ? float(3.0) : float(6.0);

        // Attract flocks to center
        const dirToCenter = position.toVar();
        dirToCenter.y.mulAssign(3.5);
        velocity.subAssign(normalize(dirToCenter).mul(deltaTime).mul(centerPull));

        Loop({ start: uint(0), end: uint(BIRDS), type: 'uint', condition: '<' }, ({ i }) => {

            If(i.equal(birdIndex), () => {

                Continue();

            });

            // Cache bird's position and velocity

            const birdPosition = positionStorage.element(i);
            const dirToBird = birdPosition.sub(position);
            const distToBird = length(dirToBird);

            If(distToBird.lessThan(0.0001), () => {

                Continue();

            });

            const distToBirdSq = distToBird.mul(distToBird);

            // Don't apply any changes to velocity if changes if the bird is outsize the zone's radius.
            If(distToBirdSq.greaterThan(zoneRadiusSq), () => {

                Continue();

            });

            // Determine which threshold the bird is flying within and adjust its velocity accordingly

            const percent = distToBirdSq.div(zoneRadiusSq);

            If(percent.lessThan(separationThresh), () => {

                // Separation - Move apart for comfort
                const velocityAdjust = (separationThresh.div(percent).sub(1.0)).mul(deltaTime);
                velocity.subAssign(normalize(dirToBird).mul(velocityAdjust));

            }).ElseIf(percent.lessThan(alignmentThresh), () => {

                // Alignment - fly the same direction
                const threshDelta = alignmentThresh.sub(separationThresh);
                const adjustedPercent = (percent.sub(separationThresh)).div(threshDelta);
                const birdVelocity = velocityStorage.element(i);

                const cosRange = cos(adjustedPercent.mul(PI_2));
                const cosRangeAdjust = float(0.5).sub(cosRange.mul(0.5)).add(0.7);
                const velocityAdjust = cosRangeAdjust.mul(deltaTime);
                velocity.addAssign(normalize(birdVelocity).mul(velocityAdjust));

            }).Else(() => {

                // Attraction / Cohesion - move closer
                const threshDelta = alignmentThresh.oneMinus();
                const adjustedPercent = threshDelta.equal(0.0).select(1.0, (percent.sub(alignmentThresh)).div(threshDelta));

                const cosRange = cos(adjustedPercent.mul(PI_2));
                const adj1 = cosRange.mul(- 0.5);
                const adj2 = adj1.add(0.5);
                const adj3 = float(0.5).sub(adj2);

                const velocityAdjust = adj3.mul(deltaTime);
                velocity.addAssign(normalize(dirToBird).mul(velocityAdjust));

            });

        });

        If(length(velocity).greaterThan(limit), () => {

            velocity.assign(normalize(velocity).mul(limit));

        });

        // Write back the final velocity to storage
        velocityStorage.element(birdIndex).assign(velocity);

    })().compute(BIRDS);

    computePosition = Fn(() => {

        const { deltaTime } = effectController;
        positionStorage.element(instanceIndex).addAssign(velocityStorage.element(instanceIndex).mul(deltaTime).mul(15.0));

        const velocity = velocityStorage.element(instanceIndex);
        const phase = phaseStorage.element(instanceIndex);

        const modValue = phase.add(deltaTime).add(length(velocity.xz).mul(deltaTime).mul(3.0)).add(max(velocity.y, 0.0).mul(deltaTime).mul(6.0));
        phaseStorage.element(instanceIndex).assign(modValue.mod(62.83));

    })().compute(BIRDS);

    scene.add(birdMesh);

    container.style.touchAction = 'none';
    container.addEventListener('pointermove', onPointerMove);


    window.addEventListener('resize', onWindowResize);

    gsap.to(birdMaterial, { opacity: 1, duration: 5 });


}

function onWindowResize() {

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);

}

function onPointerMove(event) {

    if (event.isPrimary === false) return;

    pointer.x = (event.clientX / window.innerWidth) * 2.0 - 1.0;
    pointer.y = 1.0 - (event.clientY / window.innerHeight) * 2.0;

}

function render() {

    const now = performance.now();
    let deltaTime = (now - last) / 1000;

    if (deltaTime > 1) deltaTime = 1; // safety cap on large deltas
    last = now;

    raycaster.setFromCamera(pointer, camera);

    effectController.now.value = now;
    effectController.deltaTime.value = deltaTime;
    effectController.rayOrigin.value.copy(raycaster.ray.origin);
    effectController.rayDirection.value.copy(raycaster.ray.direction);

    renderer.compute(computeVelocity);
    renderer.compute(computePosition);
    renderer.render(scene, camera);

}


if (WebGL.isWebGL2Available()) {

    console.log('WebGL2 Available');
    init();


} else {

    console.log('WebGL2 Not Available');

}
