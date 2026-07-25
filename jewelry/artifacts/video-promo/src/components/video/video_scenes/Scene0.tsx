import React from 'react';
import { motion } from 'framer-motion';
import { SceneContainer, easePremium } from './Shared';

export const Scene0 = () => {
  return (
    <SceneContainer>
      {/* Glamorous reveal element */}
      <motion.div
        className="absolute inset-0 z-0 bg-white"
        initial={{ opacity: 1 }}
        animate={{ opacity: 0 }}
        transition={{ duration: 1.5, ease: easePremium, delay: 0.5 }}
      />

      <div className="relative z-10 flex flex-col items-center justify-center text-center px-[2vw] w-full">
        {/* Sparkle icon / decorative element */}
        <motion.div
          initial={{ scale: 0, opacity: 0, rotate: -45 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          exit={{ scale: 1.5, opacity: 0, filter: 'blur(1vw)' }}
          transition={{ duration: 1.2, ease: easePremium, delay: 0.8 }}
          className="mb-[2vw]"
        >
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-[4vw] h-[4vw]">
            <path d="M12 0L13.5 8.5L22 10L13.5 11.5L12 20L10.5 11.5L2 10L10.5 8.5L12 0Z" fill="var(--color-brand-pink-dark)" />
            <path d="M19 18L19.5 20.5L22 21L19.5 21.5L19 24L18.5 21.5L16 21L18.5 20.5L19 18Z" fill="white" />
            <path d="M5 4L5.5 6.5L8 7L5.5 7.5L5 10L4.5 7.5L2 7L4.5 6.5L5 4Z" fill="white" />
          </svg>
        </motion.div>

        <motion.div className="overflow-hidden">
          <motion.h2
            className="font-body text-[3vw] tracking-[0.3em] uppercase text-white mb-[0.5vw] font-light"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '-100%', opacity: 0 }}
            transition={{ duration: 1, ease: easePremium, delay: 1 }}
          >
            Step into
          </motion.h2>
        </motion.div>

        <div className="flex flex-col items-center justify-center mt-[0.5vw] leading-[1.1]">
          <motion.div className="overflow-hidden">
            <motion.h1
              className="font-display text-[12vw] font-bold text-white drop-shadow-xl"
              initial={{ y: '100%', rotate: 2 }}
              animate={{ y: 0, rotate: 0 }}
              exit={{ scale: 1.1, opacity: 0, filter: 'blur(1vw)' }}
              transition={{ duration: 1.2, ease: easePremium, delay: 1.2 }}
            >
              MY DIGITAL
            </motion.h1>
          </motion.div>
          
          <motion.div className="overflow-hidden">
            <motion.h1
              className="font-display text-[12vw] font-bold text-white drop-shadow-xl italic"
              initial={{ y: '100%', rotate: -2 }}
              animate={{ y: 0, rotate: 0 }}
              exit={{ scale: 1.1, opacity: 0, filter: 'blur(1vw)' }}
              transition={{ duration: 1.2, ease: easePremium, delay: 1.4 }}
            >
              VANITY
            </motion.h1>
          </motion.div>
        </div>

        {/* Subtle macro bulb image in foreground/corner for depth */}
        <motion.img
          src={`${import.meta.env.BASE_URL}assets/vanity_bulb.png`}
          alt=""
          className="absolute -bottom-[10%] -right-[10%] w-[40vw] mix-blend-screen opacity-60 pointer-events-none object-contain"
          initial={{ opacity: 0, scale: 0.8, x: '5vw' }}
          animate={{ opacity: 0.6, scale: 1, x: 0 }}
          exit={{ opacity: 0, x: '10vw' }}
          transition={{ duration: 2, ease: easePremium, delay: 1.5 }}
        />
      </div>
    </SceneContainer>
  );
};
