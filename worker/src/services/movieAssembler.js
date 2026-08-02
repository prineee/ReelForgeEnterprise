'use strict';

const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs-extra');
const path = require('path');

async function assembleMovie(sceneFiles, outputFile) {
  return new Promise((resolve, reject) => {

    const listFile = path.join(
      path.dirname(outputFile),
      'concat.txt'
    );

    const content = sceneFiles
      .map(file => `file '${file}'`)
      .join('\n');

    fs.writeFileSync(listFile, content);

    ffmpeg()
      .input(listFile)
      .inputOptions(['-f concat', '-safe 0'])
      .outputOptions([
        '-c copy'
      ])
      .save(outputFile)
      .on('end', () => {
        console.log(
          'Movie assembled successfully.'
        );
        resolve(outputFile);
      })
      .on('error', reject);

  });
}

module.exports = {
  assembleMovie,
};