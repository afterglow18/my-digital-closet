import React from 'react';
import { motion } from 'framer-motion';
import { SceneContainer, easePremium } from './Shared';

export const Scene3 = () => {
  return (
    <SceneContainer>
      <div className="w-full h-full flex flex-col items-center justify-center relative">
        
        {/* Lookbook Cards Metaphor */}
        <div className="relative w-full h-[45vw] flex items-center justify-center perspective-[1000px] z-10">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="absolute w-[35vw] aspect-[3/4] bg-white rounded-[1.5vw] shadow-2xl p-[1vw] flex flex-col border border-gray-100"
              style={{ originY: 1 }}
              initial={{ 
                opacity: 0, 
                y: '20vw', 
                rotateZ: i === 0 ? -15 : i === 1 ? 0 : 15,
                rotateX: 20,
                x: i === 0 ? '-10vw' : i === 1 ? 0 : '10vw',
                scale: 0.8
              }}
              animate={{ 
                opacity: 1, 
                y: 0,
                rotateZ: i === 0 ? -8 : i === 1 ? 0 : 8,
                rotateX: 0,
                x: i === 0 ? '-15vw' : i === 1 ? 0 : '15vw',
                scale: i === 1 ? 1 : 0.9,
                zIndex: i === 1 ? 20 : 10
              }}
              exit={{ 
                y: '-10vw', 
                opacity: 0,
                scale: 1.1,
                rotateZ: 0
              }}
              transition={{ 
                duration: 1.2, 
                delay: 0.2 + (i === 1 ? 0.3 : i * 0.2), 
                ease: easePremium 
              }}
            >
              <div className="w-full flex-1 bg-gradient-to-br from-[#f8ecee] to-[#e8b8b0] rounded-[1vw] mb-[1vw] overflow-hidden relative">
                 {/* Fake look imagery */}
                 <div className="absolute inset-0 bg-white/20 backdrop-blur-sm mix-blend-overlay"></div>
                 {i === 1 && (
                   <motion.div 
                     className="absolute inset-0 flex items-center justify-center"
                     initial={{ scale: 0, opacity: 0 }}
                     animate={{ scale: 1, opacity: 1 }}
                     transition={{ duration: 0.8, delay: 1.5, type: 'spring', bounce: 0.5 }}
                   >
                     <svg viewBox="0 0 24 24" fill="var(--color-brand-pink-dark)" stroke="white" strokeWidth="1" xmlns="http://www.w3.org/2000/svg" className="w-[5vw] h-[5vw]">
                       <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                     </svg>
                   </motion.div>
                 )}
              </div>
              <div className="h-[1.5vw] w-3/4 bg-gray-100 rounded mb-[0.5vw]"></div>
              <div className="h-[1vw] w-1/2 bg-gray-100 rounded"></div>
            </motion.div>
          ))}
        </div>

        <motion.div className="absolute bottom-[15%] z-20 overflow-hidden">
          <motion.h2
            className="font-display text-[6vw] text-white font-bold drop-shadow-lg text-center"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ duration: 1, delay: 1.2, ease: easePremium }}
          >
            Save to Lookbook
          </motion.h2>
        </motion.div>

      </div>
    </SceneContainer>
  );
};
