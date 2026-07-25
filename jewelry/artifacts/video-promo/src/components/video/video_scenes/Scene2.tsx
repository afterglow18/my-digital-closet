import React from 'react';
import { motion } from 'framer-motion';
import { SceneContainer, easePremium } from './Shared';

export const Scene2 = () => {
  return (
    <SceneContainer>
      <div className="w-full h-full flex flex-col items-center justify-center relative">
        {/* Magical glow background effect */}
        <motion.img
          src={`${import.meta.env.BASE_URL}assets/magic_glow.png`}
          alt=""
          className="absolute inset-0 w-full h-full object-cover mix-blend-screen opacity-70 z-0 pointer-events-none"
          initial={{ opacity: 0, scale: 1.2, rotate: 10 }}
          animate={{ opacity: 0.7, scale: 1, rotate: 0 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 2.5, ease: easePremium }}
        />

        <motion.div 
          className="z-10 bg-white/10 backdrop-blur-md border border-white/20 p-[3vw] rounded-[2vw] shadow-2xl flex flex-col items-center justify-center max-w-[60vw]"
          initial={{ y: '10vw', opacity: 0, scale: 0.9 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: '-5vw', opacity: 0, scale: 1.05 }}
          transition={{ duration: 1.2, delay: 0.3, ease: easePremium }}
        >
          {/* AI Sparkle Icon */}
          <motion.div
            animate={{ rotate: [0, 15, -10, 0], scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="mb-[1.5vw]"
          >
             <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-[5vw] h-[5vw]">
              <path d="M12 2L13.5 8.5L20 10L13.5 11.5L12 18L10.5 11.5L4 10L10.5 8.5L12 2Z" fill="url(#paint0_linear)" />
              <path d="M19 16L19.5 18.5L22 19L19.5 19.5L19 22L18.5 19.5L16 19L18.5 18.5L19 16Z" fill="url(#paint0_linear)" />
              <path d="M5 4L5.5 6.5L8 7L5.5 7.5L5 10L4.5 7.5L2 7L4.5 6.5L5 4Z" fill="url(#paint0_linear)" />
              <defs>
                <linearGradient id="paint0_linear" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
                  <stop stopColor="white" />
                  <stop offset="1" stopColor="var(--color-brand-pink-dark)" />
                </linearGradient>
              </defs>
            </svg>
          </motion.div>

          <motion.h2
            className="font-display text-[6vw] leading-tight text-white mb-[1vw] text-center font-bold drop-shadow-lg"
            initial={{ opacity: 0, y: '2vw' }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.8, ease: easePremium }}
          >
            Generate<br />
            <span className="italic font-light">Your Look</span>
          </motion.h2>

          <motion.div
            className="h-[1px] bg-gradient-to-r from-transparent via-white to-transparent w-full mb-[1.5vw]"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 1, delay: 1.2, ease: easePremium }}
          />

          <motion.p
            className="font-body text-white/90 text-[2vw] text-center max-w-[80%]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 1.5, ease: easePremium }}
          >
            AI curates the perfect combination from your vanity.
          </motion.p>
        </motion.div>
      </div>
    </SceneContainer>
  );
};
