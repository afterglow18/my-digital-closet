import React from 'react';
import { motion } from 'framer-motion';
import { SceneContainer, easePremium } from './Shared';

const CATEGORIES = ['MAKEUP', 'SKINCARE', 'HAIR', 'FRAGRANCES'];

export const Scene1 = () => {
  return (
    <SceneContainer>
      <div className="w-full h-full flex flex-col items-center justify-center relative">
        
        {/* Floating Flatlay items behind text */}
        <motion.img
          src={`${import.meta.env.BASE_URL}assets/makeup_flatlay.png`}
          alt="Makeup Flatlay"
          className="absolute right-0 top-[20%] w-[50vw] drop-shadow-2xl z-0 object-contain"
          initial={{ x: '100%', y: '10%', rotate: 15, opacity: 0 }}
          animate={{ x: '-10%', y: 0, rotate: -5, opacity: 1 }}
          exit={{ x: '100%', opacity: 0, filter: 'blur(1vw)' }}
          transition={{ duration: 1.8, ease: easePremium, delay: 0.2 }}
        />

        <div className="z-10 flex flex-col items-start justify-center w-full px-[15vw] space-y-[1.5vw]">
          {CATEGORIES.map((cat, i) => (
            <motion.div 
              key={cat}
              className="relative flex items-center"
              initial={{ opacity: 0, x: '-5vw' }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: '-3vw', filter: 'blur(0.5vw)' }}
              transition={{ duration: 1, delay: 0.5 + i * 0.3, ease: easePremium }}
            >
              <motion.div 
                className="w-[3vw] h-[2px] bg-white mr-[1.5vw]"
                initial={{ scaleX: 0, opacity: 0 }}
                animate={{ scaleX: 1, opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.8 + i * 0.3, ease: easePremium }}
                style={{ originX: 0 }}
              />
              <h2 className="font-display italic text-[5vw] text-white drop-shadow-md tracking-wider">
                {cat}
              </h2>
            </motion.div>
          ))}
        </div>

        {/* Shelf line metaphor */}
        <motion.div
          className="absolute bottom-[15%] left-[10%] right-[10%] h-[1px] bg-gradient-to-r from-transparent via-white to-transparent opacity-50"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          exit={{ scaleX: 0, opacity: 0 }}
          transition={{ duration: 1.5, delay: 1, ease: easePremium }}
        />
        
        <motion.p
          className="absolute bottom-[10%] text-white font-body font-light text-[2vw] tracking-[0.2em] uppercase opacity-80"
          initial={{ opacity: 0, y: '2vw' }}
          animate={{ opacity: 0.8, y: 0 }}
          exit={{ opacity: 0, y: '1vw' }}
          transition={{ duration: 1, delay: 1.5, ease: easePremium }}
        >
          Organise your collection
        </motion.p>
      </div>
    </SceneContainer>
  );
};
