// URL options from index.html form
const urlParams = new URLSearchParams(window.location.search);
const skipScene = urlParams.get("debrief") === "1";

// Summary object for end-of-session handoff (updated while a run is active)
window.psSessionMetrics = {
    elapsedSec: 0,
    headTurnDegApprox: 0,
    rows: 0,
    difficulty: "",
};

if (!skipScene) {
    // Get the canvas element as a const
    const canvas = document.getElementById("renderCanvas");
    // Create the Babylon 3D engine, and attach it to the canvas
    const engine = new BABYLON.Engine(canvas, true);

    const sessionStarted = urlParams.get("started") === "1";
    let difficultyKey = urlParams.get("difficulty") || "moderate";
    if (["calm", "moderate", "challenging"].indexOf(difficultyKey) === -1) {
        difficultyKey = "moderate";
    }

    window.psSessionMetrics.difficulty = difficultyKey;

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

        const sceneParams = new URLSearchParams(window.location.search);
        const rowsParsed = parseInt(sceneParams.get("rows") || "2", 10);
        const audienceRows = Math.min(
            3,
            Math.max(1, Number.isFinite(rowsParsed) ? rowsParsed : 2)
        );
        window.psSessionMetrics.rows = audienceRows;

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
            { width: 14, height: 4 },
            scene
        );
        // Behind every audience row (rows extend to about z -5); a wall at -4 hid extra rows.
        backWall.position = new BABYLON.Vector3(0, 1.5, -8.5);
        backWall.rotation = new BABYLON.Vector3(0, Math.PI, 0);
        const wallMat = new BABYLON.StandardMaterial("wallMat", scene);
        wallMat.diffuseColor = new BABYLON.Color3(0.07, 0.08, 0.13);
        backWall.material = wallMat;

        const ceiling = BABYLON.MeshBuilder.CreatePlane(
            "ceiling",
            { width: 12, height: 10 },
            scene
        );
        ceiling.position = new BABYLON.Vector3(0, 3.4, -2.5);
        ceiling.rotation = new BABYLON.Vector3(Math.PI / 2, 0, 0);
        const ceilingMat = new BABYLON.StandardMaterial("ceilingMat", scene);
        ceilingMat.diffuseColor = new BABYLON.Color3(0.06, 0.07, 0.1);
        ceiling.material = ceilingMat;

        const audienceFloor = BABYLON.MeshBuilder.CreateGround(
            "audienceFloor",
            { width: 12, height: 10 },
            scene
        );
        audienceFloor.position = new BABYLON.Vector3(0, -0.11, -6);
        const audienceMat = new BABYLON.StandardMaterial("audienceMat", scene);
        audienceMat.diffuseColor = new BABYLON.Color3(0.02, 0.02, 0.07);
        audienceFloor.material = audienceMat;

        /* Lighting  */
        const spotRigPosition = new BABYLON.Vector3(0, 11.5, 3.4);
        const spotOnSpeaker = new BABYLON.Vector3(0, 1.45, -0.2);
        const spotDirection = spotOnSpeaker.subtract(spotRigPosition).normalize();
        const spotLight = new BABYLON.SpotLight(
            "spotLight",
            spotRigPosition,
            spotDirection,
            Math.PI / 7,
            22,
            scene
        );
        spotLight.diffuse = new BABYLON.Color3(1, 0.95, 0.82);
        spotLight.intensity = (spotMin + spotMax) / 2;
        spotLight.range = 28;

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
                bodyMat.diffuseColor = new BABYLON.Color3(
                    base,
                    base + 0.05,
                    base + 0.1
                );
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
            // First row sits behind the stage lip (stage back ~ z -3.5); was -3.2 and read as on the deck.
            const z = -4.35 - r * 0.95;
            createAudienceRow(count, z);
        }

        stage.receiveShadows = true;
        shadowGenerator.addShadowCaster(stage, true);
        audienceFloor.receiveShadows = true;
        backWall.receiveShadows = true;
        ceiling.receiveShadows = true;

        scene.registerBeforeRender(function () {
            const t = performance.now() * 0.001;
            const swayAmount = 0.02;

            audienceMembers.forEach(function (mesh) {
                const meta = mesh.metadata;
                if (!meta || !meta.basePosition) return;

                const base = meta.basePosition;
                const phase = meta.offsetPhase || 0;
                mesh.position.x = base.x + Math.sin(t * 0.4 + phase) * swayAmount;
                mesh.position.y =
                    base.y + Math.cos(t * 0.3 + phase) * swayAmount * 0.5;
            });
        });

        /* Sounds */
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

        /* GUI prompt board (world-space plane, like floating UI on a mesh) */
        const audiencePrompts = [
            "Do you have stage fright? If so, how do you manage it?",
            "In one sentence, why does this topic matter to you?",
            "What were the difficulties and successes of creating your project?",
            "Name one sign of nerves you will watch for in yourself.",
            "What will you do if you lose your place for a moment?",
        ];
        const promptPlane = BABYLON.MeshBuilder.CreatePlane(
            "promptPlane",
            { width: 3.4, height: 0.85 },
            scene
        );
        promptPlane.position = new BABYLON.Vector3(0, 2.12, -2.48);
        const promptTexture = BABYLON.GUI.AdvancedDynamicTexture.CreateForMesh(
            promptPlane,
            1536,
            384
        );
        
        promptPlane.scaling.x = -1;
        if (promptPlane.material) {
            promptPlane.material.backFaceCulling = false;
        }
        const promptPanel = new BABYLON.GUI.Rectangle("promptPanel");
        promptPanel.width = 1;
        promptPanel.height = 1;
        promptPanel.thickness = 2;
        promptPanel.color = "#7dd3fc";
        promptPanel.background = "rgba(5, 8, 18, 0.88)";
        promptTexture.addControl(promptPanel);

        const promptBody = new BABYLON.GUI.TextBlock("promptBody");
        promptBody.text = "Audience prompt\n\n" + audiencePrompts[0];
        promptBody.color = "white";
        promptBody.fontSize = 32;
        promptBody.textWrapping = true;
        promptBody.paddingLeft = "20px";
        promptBody.paddingRight = "20px";
        promptBody.paddingTop = "16px";
        promptBody.paddingBottom = "16px";
        promptPanel.addControl(promptBody);

        let promptIndex = 0;
        let lastPromptSwitchMs = performance.now();

        scene.registerBeforeRender(function () {
            if (performance.now() - lastPromptSwitchMs > 22000) {
                lastPromptSwitchMs = performance.now();
                promptIndex = (promptIndex + 1) % audiencePrompts.length;
                promptBody.text =
                    "Audience prompt\n\n" + audiencePrompts[promptIndex];
            }
        });

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

        /* Session HUD: timer + head movement + metrics for debrief */
        let sessionElapsedLast = -1;
        let headFeedbackLastDir = null;
        let headTurnSum = 0;
        if (sessionStarted) {
            const sessionStartMs = performance.now();
            headFeedbackLastDir = camera.getForwardRay().direction.clone();

            scene.registerBeforeRender(function () {
                const elapsedSec = Math.floor(
                    (performance.now() - sessionStartMs) / 1000
                );
                if (elapsedSec !== sessionElapsedLast) {
                    sessionElapsedLast = elapsedSec;
                    const label = document.getElementById("sessionTimerLabel");
                    if (label) {
                        const m = Math.floor(elapsedSec / 60);
                        const s = elapsedSec % 60;
                        label.textContent =
                            "Session: " +
                            m +
                            ":" +
                            (s < 10 ? "0" : "") +
                            s;
                    }
                }

                const dir = camera.getForwardRay().direction;
                const dot = BABYLON.Vector3.Dot(headFeedbackLastDir, dir);
                const clamped = Math.min(1, Math.max(-1, dot));
                const angle = Math.acos(clamped);
                headTurnSum += angle;
                headFeedbackLastDir.copyFrom(dir);

                const headDeg = Math.round((headTurnSum * 180) / Math.PI);
                window.psSessionMetrics.elapsedSec = elapsedSec;
                window.psSessionMetrics.headTurnDegApprox = headDeg;

                const headEl = document.getElementById("headMovementLabel");
                if (headEl) {
                    headEl.textContent =
                        "Head movement: ~" + headDeg + "° total turn";
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

    window.addEventListener("public-speaking-end-session", function () {
        try {
            sessionStorage.setItem(
                "psDebrief",
                JSON.stringify(window.psSessionMetrics)
            );
        } catch (err) {
            console.log("Could not save session summary.");
        }
        window.location.href = "index.html?debrief=1";
    });

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
}
