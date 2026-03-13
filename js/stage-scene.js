window.addEventListener("DOMContentLoaded", function () {
  const canvas = document.getElementById("renderCanvas");
  const engine = new BABYLON.Engine(canvas, true);

  function createScene() {
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

    // Enable VR / WebXR experience helper (base setup; I'll build on this later)
    const xr = scene.createDefaultXRExperienceAsync({
      floorMeshes: [],
    });

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

    return scene;
  }

  const scene = createScene();

  engine.runRenderLoop(function () {
    scene.render();
  });

  window.addEventListener("resize", function () {
    engine.resize();
  });
});

