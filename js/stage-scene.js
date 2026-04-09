// Get the canvas element as a const
const canvas = document.getElementById("renderCanvas");
// Create the Babylon 3D engine, and attach it to the canvas
const engine = new BABYLON.Engine(canvas, true);

// URL options from index.html form - for testing different configurations without needing a UI
const urlParams = new URLSearchParams(window.location.search);
const sessionStarted = urlParams.get("started") === "1";
const rowsParsed = parseInt(urlParams.get("rows") || "2", 10);
const audienceRows = Math.min(3, Math.max(1, Number.isFinite(rowsParsed) ? rowsParsed : 2));
let difficultyKey = urlParams.get("difficulty") || "moderate";
if (["calm", "moderate", "challenging"].indexOf(difficultyKey) === -1) {
    difficultyKey = "moderate";
}

// Volume and spotlight range by difficulty 
let crowdVol = 0.25;
let ambVol = 0.4;
let spotMin = 2.3;
let spotMax = 2.7;
if (difficultyKey === "calm") {
    crowdVol = 0.12;
    ambVol = 0.28;
    spotMin = 2.0;
    spotMax = 2.35;
} else if (difficultyKey === "challenging") {
    crowdVol = 0.42;
    ambVol = 0.55;
    spotMin = 2.65;
    spotMax = 3.15;
}

// The createScene function
const createScene = async function () {
    const scene = new BABYLON.Scene(engine);
    scene.clearColor = new BABYLON.Color4(0.01, 0.02, 0.05, 1);

    /* Camera */
    const camera = new BABYLON.UniversalCamera(
        "userCamera",
        new BABYLON.Vector3(0, 1.6, 0.5),
        scene
    );
    camera.setTarget(new BABYLON.Vector3(0, 1.6, -2));
    camera.attachControl(canvas, true);

    /* Stage & Room */
    const stage = BABYLON.MeshBuilder.CreateBox(
        "stage",
        { width: 6, depth: 4, height: 0.2 },
        scene
    );
    stage.position = new BABYLON.Vector3(0, -0.1, -1.5);
    const stageMat = new BABYLON.StandardMaterial("stageMat", scene);
    stageMat.diffuseColor = new BABYLON.Color3(0.15, 0.16, 0.22);
    stage.material = stageMat;

    const backWall = BABYLON.MeshBuilder.CreatePlane(
        "backWall",
        { width: 10, height: 4 },
        scene
    );
    backWall.position = new BABYLON.Vector3(0, 1.5, -4);
    backWall.rotation = new BABYLON.Vector3(0, Math.PI, 0);
    const wallMat = new BABYLON.StandardMaterial("wallMat", scene);
    wallMat.diffuseColor = new BABYLON.Color3(0.07, 0.08, 0.13);
    backWall.material = wallMat;

    const audienceFloor = BABYLON.MeshBuilder.CreateGround(
        "audienceFloor",
        { width: 12, height: 10 },
        scene
    );
    audienceFloor.position = new BABYLON.Vector3(0, -0.11, -6);
    const audienceMat = new BABYLON.StandardMaterial("audienceMat", scene);
    audienceMat.diffuseColor = new BABYLON.Color3(0.02, 0.02, 0.07);
    audienceFloor.material = audienceMat;

    /* Lighting */
    const spotLight = new BABYLON.SpotLight(
        "spotLight",
        new BABYLON.Vector3(0, 5, 1),
        new BABYLON.Vector3(0, -1.5, -2.5),
        Math.PI / 6,
        20,
        scene
    );
    spotLight.diffuse = new BABYLON.Color3(1, 0.95, 0.82);
    spotLight.intensity = (spotMin + spotMax) / 2;

    const hemiLight = new BABYLON.HemisphericLight(
        "hemiLight",
        new BABYLON.Vector3(0, 1, 0),
        scene
    );
    hemiLight.intensity = 0.3;
    hemiLight.groundColor = new BABYLON.Color3(0, 0, 0.1);

    /* Shadows (directional light + shadow map) */
    const shadowLight = new BABYLON.DirectionalLight(
        "shadowLight",
        new BABYLON.Vector3(-0.25, -1, 0.2),
        scene
    );
    shadowLight.position = new BABYLON.Vector3(2, 14, 5);
    shadowLight.intensity = 0.42;

    const shadowGenerator = new BABYLON.ShadowGenerator(1024, shadowLight);
    shadowGenerator.usePoissonSampling = true;

    const boundaryRing = BABYLON.MeshBuilder.CreateTorus(
        "boundaryRing",
        { diameter: 0.8, thickness: 0.02, tessellation: 64 },
        scene
    );
    boundaryRing.position = new BABYLON.Vector3(0, 0.01, 0);
    boundaryRing.rotation = new BABYLON.Vector3(Math.PI / 2, 0, 0);
    const ringMat = new BABYLON.StandardMaterial("ringMat", scene);
    ringMat.emissiveColor = new BABYLON.Color3(0.49, 0.83, 0.99);
    ringMat.alpha = 0.8;
    boundaryRing.material = ringMat;

    /* Audience (simple shapes for now) */
    const audienceMembers = [];

    function createAudienceRow(count, zOffset) {
        const spacing = 0.9;
        const totalWidth = (count - 1) * spacing;

        for (let i = 0; i < count; i++) {
            const x = -totalWidth / 2 + i * spacing;

            const body = BABYLON.MeshBuilder.CreateBox(
                "audienceBody_" + zOffset + "_" + i,
                { width: 0.35, depth: 0.25, height: 0.6 },
                scene
            );
            body.position = new BABYLON.Vector3(x, 0.3, zOffset);

            const bodyMat = new BABYLON.StandardMaterial(
                "audienceBodyMat_" + zOffset + "_" + i,
                scene
            );
            const base = 0.15 + (i % 3) * 0.05;
            bodyMat.diffuseColor = new BABYLON.Color3(base, base + 0.05, base + 0.1);
            body.material = bodyMat;

            const head = BABYLON.MeshBuilder.CreateSphere(
                "audienceHead_" + zOffset + "_" + i,
                { diameter: 0.28, segments: 12 },
                scene
            );
            head.position = new BABYLON.Vector3(x, 0.7, zOffset);

            const headMat = new BABYLON.StandardMaterial(
                "audienceHeadMat_" + zOffset + "_" + i,
                scene
            );
            headMat.diffuseColor = new BABYLON.Color3(0.9, 0.8, 0.7);
            head.material = headMat;

            const root = BABYLON.Mesh.MergeMeshes(
                [body, head],
                true,
                true,
                undefined,
                false,
                true
            );

            root.metadata = {
                basePosition: root.position.clone(),
                offsetPhase: Math.random() * Math.PI * 2,
            };

            audienceMembers.push(root);
            shadowGenerator.addShadowCaster(root, true);
        }
    }

    for (let r = 0; r < audienceRows; r++) {
        const count = 6 + r * 2;
        const z = -3.2 - r * 0.95;
        createAudienceRow(count, z);
    }

    stage.receiveShadows = true;
    shadowGenerator.addShadowCaster(stage, true);
    audienceFloor.receiveShadows = true;
    backWall.receiveShadows = true;

    scene.registerBeforeRender(function () {
        const t = performance.now() * 0.001;
        const swayAmount = 0.02;

        audienceMembers.forEach(function (mesh) {
            const meta = mesh.metadata;
            if (!meta || !meta.basePosition) return;

            const base = meta.basePosition;
            const phase = meta.offsetPhase || 0;
            mesh.position.x = base.x + Math.sin(t * 0.4 + phase) * swayAmount;
            mesh.position.y = base.y + Math.cos(t * 0.3 + phase) * swayAmount * 0.5;
        });
    });

    /* Sounds */
    // Add files under ./media
    const ambientSound = new BABYLON.Sound(
        "roomTone",
        "./media/room-tone.mp3",
        scene,
        null,
        {
            loop: true,
            autoplay: true,
            volume: ambVol,
        }
    );

    const crowdSound = new BABYLON.Sound(
        "crowdMurmur",
        "./media/crowd-murmur.mp3",
        scene,
        null,
        {
            loop: true,
            autoplay: true,
            volume: crowdVol,
        }
    );


    /* Animation */
    const animSpotlight = new BABYLON.Animation(
        "spotlightPulse",
        "intensity",
        30,
        BABYLON.Animation.ANIMATIONTYPE_FLOAT,
        BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE
    );

    const intensityKeys = [];
    intensityKeys.push({ frame: 0, value: spotMin });
    intensityKeys.push({ frame: 45, value: spotMax });
    intensityKeys.push({ frame: 90, value: spotMin });
    animSpotlight.setKeys(intensityKeys);

    spotLight.animations = [];
    spotLight.animations.push(animSpotlight);

    scene.beginAnimation(spotLight, 0, 90, true);

    /* Session HUD: timer + simple head-movement feedback (forward direction change, radians) */
    let sessionElapsedLast = -1;
    let headFeedbackLastDir = null;
    let headTurnSum = 0;
    if (sessionStarted) {
        const sessionStartMs = performance.now();
        headFeedbackLastDir = camera.getForwardRay().direction.clone();

        scene.registerBeforeRender(function () {
            const elapsedSec = Math.floor((performance.now() - sessionStartMs) / 1000);
            if (elapsedSec !== sessionElapsedLast) {
                sessionElapsedLast = elapsedSec;
                const label = document.getElementById("sessionTimerLabel");
                if (label) {
                    const m = Math.floor(elapsedSec / 60);
                    const s = elapsedSec % 60;
                    label.textContent =
                        "Session: " + m + ":" + (s < 10 ? "0" : "") + s;
                }
            }

            const dir = camera.getForwardRay().direction;
            const dot = BABYLON.Vector3.Dot(headFeedbackLastDir, dir);
            const clamped = Math.min(1, Math.max(-1, dot));
            const angle = Math.acos(clamped);
            headTurnSum += angle;
            headFeedbackLastDir.copyFrom(dir);

            const headEl = document.getElementById("headMovementLabel");
            if (headEl) {
                const deg = Math.round((headTurnSum * 180) / Math.PI);
                headEl.textContent = "Head movement: ~" + deg + "° total turn";
            }
        });
    }

    /* Enable Immersive VR */
    if (await BABYLON.WebXRSessionManager.IsSessionSupportedAsync("immersive-vr")) {
        await scene.createDefaultXRExperienceAsync({
            floorMeshes: [stage, audienceFloor],
            optionalFeatures: true,
        });
    } else {
        console.log("WebXR is not supported on this device.");
    }

    return scene;
};

// Continually render the scene in an endless loop
createScene().then(function (sceneToRender) {
    engine.runRenderLoop(function () {
        sceneToRender.render();
    });
});

// Add an event listener that adapts to the user resizing the screen
window.addEventListener("resize", function () {
    engine.resize();
});
