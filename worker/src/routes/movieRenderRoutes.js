const express = require("express");
const router = express.Router();

router.post("/api/render-movie", async (req, res) => {
  try {
      const fs = require("fs-extra");
    const path = require("path");
    const {
      movieId,
      scenes,
    } = req.body;

    console.log("================================");
    console.log("MOVIE RENDER");
    console.log("Movie:", movieId);
    console.log("Scenes:", scenes.length);
    console.log("================================");
    const outputDir = path.join(
      process.cwd(),
      "tmp",
      movieId
    );

    await fs.ensureDir(outputDir);
    const operations = [];

    for (const scene of scenes) {

      console.log(
        `Rendering Scene ${scene.scene_number}`
      );

      // Temporary operation id
      const operationId =
        `scene-${scene.scene_number}-${Date.now()}`;
         const sceneFile = path.join(
        outputDir,
        `scene-${scene.scene_number}.mp4`
      );
      operations.push({
        scene_number: scene.scene_number,
        operationId,
        status: "completed",
        videoUrl: "",
        output: sceneFile,
      });

    }

    return res.json({
      success: true,
      movieId,
      outputDir,
      operations,
    });

  } catch (err) {

    console.error(err);

    return res.status(500).json({
      success: false,
      error: err.message,
    });

  }
});

module.exports = router;