// the canvas and engine setup 
const canvas = document.getElementById("renderCanvas");
const engine = new BABYLON.Engine(canvas, true);

// The createScene function that creates and return the scene
const createScene = async function () {
  const scene = new BABYLON.Scene(engine);
  scene.clearColor = new BABYLON.Color4(0.01, 0.02, 0.05, 1);

    // Camera: user stands on the stage, looking toward the audience area
  const camera = new BABYLON.UniversalCamera(
    "userCamera",
    new BABYLON.Vector3(0, 1.6, 0.5),
    scene
  );
  camera.setTarget(new BABYLON.Vector3(0, 1.6, -2));
  camera.attachControl(canvas, true);

    // Stage platform
  const stage = BABYLON.MeshBuilder.CreateBox(
    "stage",
    { width: 6, depth: 4, height: 0.2 },
    scene
  );
  stage.position = new BABYLON.Vector3(0, -0.1, -1.5);
  const stageMat = new BABYLON.StandardMaterial("stageMat", scene);
  stageMat.diffuseColor = new BABYLON.Color3(0.15, 0.16, 0.22);
  stage.material = stageMat;

    // Back wall to give depth
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

    // Audience floor placeholder
  const audienceFloor = BABYLON.MeshBuilder.CreateGround(
    "audienceFloor",
    { width: 12, height: 10 },
    scene
  );
  audienceFloor.position = new BABYLON.Vector3(0, -0.11, -6);
  const audienceMat = new BABYLON.StandardMaterial("audienceMat", scene);
  audienceMat.diffuseColor = new BABYLON.Color3(0.02, 0.02, 0.07);
  audienceFloor.material = audienceMat;

    // Spotlight to create gentle "pressure" on the stage
  const spotLight = new BABYLON.SpotLight(
    "spotLight",
    new BABYLON.Vector3(0, 5, 1),
    new BABYLON.Vector3(0, -1.5, -2.5),
    Math.PI / 6,
    20,
    scene
  );
  spotLight.diffuse = new BABYLON.Color3(1, 0.95, 0.82);
  spotLight.intensity = 2.5;

    // Soft ambient light
  const hemiLight = new BABYLON.HemisphericLight(
    "hemiLight",
    new BABYLON.Vector3(0, 1, 0),
    scene
  );
  hemiLight.intensity = 0.3;
  hemiLight.groundColor = new BABYLON.Color3(0, 0, 0.1);

    // Simple "safe zone" ring on the stage floor
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

  // --- First audience row (starting with simple low-detail avatars, and adding complexity later) ---
  const audienceMembers = [];

  function createAudienceRow(count, zOffset) {
    const spacing = 0.9;
    const totalWidth = (count - 1) * spacing;

    for (let i = 0; i < count; i++) {
      const x = -totalWidth / 2 + i * spacing;

      // Torso
      const body = BABYLON.MeshBuilder.CreateBox(
        `audienceBody_${zOffset}_${i}`,
        { width: 0.35, depth: 0.25, height: 0.6 },
        scene
      );
      body.position = new BABYLON.Vector3(x, 0.3, zOffset);

      const bodyMat = new BABYLON.StandardMaterial(
        `audienceBodyMat_${zOffset}_${i}`,
        scene
      );
      // Slight color variation between attendees
      const base = 0.15 + (i % 3) * 0.05;
      bodyMat.diffuseColor = new BABYLON.Color3(base, base + 0.05, base + 0.1);
      body.material = bodyMat;

      // Head
      const head = BABYLON.MeshBuilder.CreateSphere(
        `audienceHead_${zOffset}_${i}`,
        { diameter: 0.28, segments: 12 },
        scene
      );
      head.position = new BABYLON.Vector3(x, 0.7, zOffset);

      const headMat = new BABYLON.StandardMaterial(
        `audienceHeadMat_${zOffset}_${i}`,
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

      // Store neutral position so I can animate gently later
      root.metadata = {
        basePosition: root.position.clone(),
        offsetPhase: Math.random() * Math.PI * 2,
      };

      audienceMembers.push(root);
    }
  }

  // One calm, close row of listeners (more rows and density will come later)
  createAudienceRow(6, -3.2);

  // Subtle idle motion so the audience feels alive but not distracting
  scene.registerBeforeRender(() => {
    const t = performance.now() * 0.001;
    const swayAmount = 0.02;

    audienceMembers.forEach((mesh) => {
      const base = mesh.metadata?.basePosition;
      if (!base) return;

      const phase = mesh.metadata.offsetPhase || 0;
      mesh.position.x = base.x + Math.sin(t * 0.4 + phase) * swayAmount;
      mesh.position.y = base.y + Math.cos(t * 0.3 + phase) * swayAmount * 0.5;
    });
  });

  /* SOUNDS */
  // Ambient room tone to make the space feel less empty
  const ambientSound = new BABYLON.Sound(
    "roomTone",
    "./media/room-tone.mp3",
    scene,
    null,
    {
      loop: true,
      autoplay: true,
      volume: 0.4,
    }
  );

  // Very soft crowd murmur for exposure (kept low at this stage)
  const crowdSound = new BABYLON.Sound(
    "crowdMurmur",
    "./media/crowd-murmur.mp3",
    scene,
    null,
    {
      loop: true,
      autoplay: true,
      volume: 0.25,
    }
  );

  /* ANIMATION */
  // Gently pulses the spotlight intensity using a Babylon animation 
  const animSpotlight = new BABYLON.Animation(
    "spotlightPulse",
    "intensity",
    30,
    BABYLON.Animation.ANIMATIONTYPE_FLOAT,
    BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE
  );

  const intensityKeys = [];
  intensityKeys.push({ frame: 0, value: 2.3 });
  intensityKeys.push({ frame: 45, value: 2.7 });
  intensityKeys.push({ frame: 90, value: 2.3 });
  animSpotlight.setKeys(intensityKeys);

  spotLight.animations = [];
  spotLight.animations.push(animSpotlight);

  scene.beginAnimation(spotLight, 0, 90, true);

  /* ENABLE IMMERSIVE VR */
  if (BABYLON.WebXRSessionManager.IsSessionSupportedAsync("immersive-vr")) {
    await scene.createDefaultXRExperienceAsync({
      floorMeshes: [],
      optionalFeatures: true,
    });
  } else {
    console.log("WebXR is not supported on this device.");
  }

  return scene;
};

// Continually render the scene in an endless loop
createScene().then((sceneToRender) => {
  engine.runRenderLoop(() => {
    sceneToRender.render();
  });
});

// Handle browser resize
window.addEventListener("resize", function () {
  engine.resize();
});

