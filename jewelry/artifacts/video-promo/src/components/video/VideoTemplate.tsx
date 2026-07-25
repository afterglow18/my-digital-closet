import { useVideoPlayer } from '@/lib/video';
import { useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';

import { Scene0 } from './video_scenes/Scene0';
import { Scene1 } from './video_scenes/Scene1';
import { Scene2 } from './video_scenes/Scene2';
import { Scene3 } from './video_scenes/Scene3';
import { Scene4 } from './video_scenes/Scene4';
import { PersistentBackground } from './video_scenes/Shared';

const SCENE_DURATIONS = {
  scene0: 4500, // Opening
  scene1: 5000, // Categories
  scene2: 4500, // AI Generate
  scene3: 4000, // Lookbook
  scene4: 4500, // Closing
};

export default function VideoTemplate() {
  const { currentScene, currentSceneKey } = useVideoPlayer({
    durations: SCENE_DURATIONS,
  });

  return (
    <div
      className="w-full h-screen flex items-center justify-center overflow-hidden"
      style={{ backgroundColor: 'var(--color-brand-dusty-rose)' }}
    >
      <div
        className="relative overflow-hidden w-full h-full"
        style={{
          aspectRatio: '16 / 9',
          backgroundColor: 'var(--color-brand-dusty-rose)',
        }}
      >
        <PersistentBackground currentScene={currentScene} />

        <AnimatePresence mode="sync">
          {currentScene === 0 && <Scene0 key="scene0" />}
          {currentScene === 1 && <Scene1 key="scene1" />}
          {currentScene === 2 && <Scene2 key="scene2" />}
          {currentScene === 3 && <Scene3 key="scene3" />}
          {currentScene === 4 && <Scene4 key="scene4" />}
        </AnimatePresence>
      </div>
    </div>
  );
}
