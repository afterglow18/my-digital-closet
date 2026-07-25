import React from 'react';
import { motion } from 'framer-motion';
import { SceneContainer, easePremium } from './Shared';

export const Scene4 = () => {
  return (
    <SceneContainer>
      <div className="w-full h-full flex flex-col items-center justify-center relative bg-black/20">
        
        {/* App Icon Reveal */}
        <motion.div
          className="relative z-10 flex flex-col items-center justify-center"
          initial={{ opacity: 0, scale: 0.8, y: '5vw' }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 1.5, ease: easePremium, delay: 0.2 }}
        >
          <motion.div
            className="w-[25vw] aspect-square rounded-[22%] shadow-2xl overflow-hidden border-[0.2vw] border-white/50 mb-[2vw]"
            initial={{ rotateY: 90 }}
            animate={{ rotateY: 0 }}
            transition={{ duration: 1.8, ease: easePremium, delay: 0.5 }}
          >
            <img 
              src={`${import.meta.env.BASE_URL}assets/app_icon.png`} 
              alt="My Digital Vanity App Icon" 
              className="w-full h-full object-cover"
            />
          </motion.div>

          <motion.div className="overflow-hidden mb-[0.5vw]">
            <motion.h1
              className="font-display text-[7vw] font-bold text-white drop-shadow-xl"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              transition={{ duration: 1, ease: easePremium, delay: 1 }}
            >
              MY DIGITAL VANITY
            </motion.h1>
          </motion.div>

          <motion.div className="overflow-hidden">
            <motion.p
              className="font-body text-[2.5vw] tracking-[0.2em] uppercase text-white/90 font-light"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              transition={{ duration: 1, ease: easePremium, delay: 1.2 }}
            >
              Your beauty world, organised.
            </motion.p>
          </motion.div>
        </motion.div>

        {/* Closing ambient light sweep */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-transparent z-20 pointer-events-none"
          initial={{ x: '-100%', y: '-100%' }}
          animate={{ x: '100%', y: '100%' }}
          transition={{ duration: 2.5, ease: 'easeInOut', delay: 1.5 }}
        />
      </div>
    </SceneContainer>
  );
};
