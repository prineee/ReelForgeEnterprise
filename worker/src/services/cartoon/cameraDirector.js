// FILE: worker/src/services/cartoon/cameraDirector.js
// Assigns a cinematic shot type and matching motion effect to each scene.
// First scene is always an establishing wide shot; last is always the epic finale.
// Middle scenes cycle through all 9 types for visual variety.

'use strict'

const SHOT_SEQUENCE = [
  {
    shotType:     'ESTABLISHING_WIDE',
    motionEffect: 'slow_zoom_in',
    label:        'Establishing Wide',
  },
  {
    shotType:     'LOW_ANGLE_HERO',
    motionEffect: 'pan_up',
    label:        'Low Angle Hero',
  },
  {
    shotType:     'HIGH_ANGLE',
    motionEffect: 'pan_down',
    label:        'High Angle',
  },
  {
    shotType:     'OVER_SHOULDER',
    motionEffect: 'push_drift',
    label:        'Over the Shoulder',
  },
  {
    shotType:     'TRACKING_SHOT',
    motionEffect: 'pan_right',
    label:        'Tracking Shot',
  },
  {
    shotType:     'ACTION_SHOT',
    motionEffect: 'shake_pan',
    label:        'Action Shot',
  },
  {
    shotType:     'EMOTIONAL_SHOT',
    motionEffect: 'cinematic_push',
    label:        'Emotional Shot',
  },
  {
    shotType:     'REVEAL_SHOT',
    motionEffect: 'zoom_out',
    label:        'Reveal Shot',
  },
  {
    shotType:     'FINALE_EPIC',
    motionEffect: 'crane_parallax',
    label:        'Cinematic Finale',
  },
]

/**
 * Assigns a shot type and motion effect for a scene at sceneIndex (0-based)
 * within a storyboard of totalScenes scenes.
 */
function assignShot(sceneIndex, totalScenes) {
  if (sceneIndex === 0) return SHOT_SEQUENCE[0]
  if (totalScenes > 1 && sceneIndex === totalScenes - 1) return SHOT_SEQUENCE[8]
  return SHOT_SEQUENCE[sceneIndex % SHOT_SEQUENCE.length]
}

module.exports = { assignShot, SHOT_SEQUENCE }
