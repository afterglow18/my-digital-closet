import React from 'react';
import { motion } from 'framer-motion';

export const springBouncy = { type: "spring", stiffness: 300, damping: 15 };
export const springSnappy = { type: "spring", stiffness: 400, damping: 25 };
export const springSmooth = { type: "spring", stiffness: 120, damping: 20 };
export const easePremium = [0.22, 1, 0.36, 1];

export const PersistentBackground = ({ currentScene }: { currentScene: number }) => {
  return (
    <div className="absolute inset-0 pointer-events-none z-0">
      {/* Base gradient */}
      <motion.div 
        className="absolute inset-0"
        animate={{
          background: currentScene === 0 
            ? 'linear-gradient(135deg, var(--color-brand-dusty-rose) 0%, var(--color-brand-pink) 100%)'
            : currentScene === 4
            ? 'linear-gradient(135deg, var(--color-brand-pink) 0%, var(--color-brand-dusty-rose) 100%)'
            : 'linear-gradient(135deg, var(--color-brand-dusty-rose) 0%, var(--color-brand-pink-dark) 100%)'
        }}
        transition={{ duration: 2 }}
      />

      {/* Main vanity background - scales and shifts based on scene */}
      <motion.div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${import.meta.env.BASE_URL}assets/vanity_bg.png)` }}
        animate={{
          scale: currentScene === 0 ? 1 : currentScene === 1 ? 1.05 : currentScene === 2 ? 1.15 : currentScene === 3 ? 1.1 : 1.05,
          y: currentScene === 1 ? '2%' : currentScene === 2 ? '-2%' : '0%',
          opacity: currentScene === 0 ? 0.6 : currentScene === 4 ? 0.2 : 0.3,
          filter: currentScene === 0 ? 'blur(0px)' : 'blur(1vw)',
        }}
        transition={{ duration: 1.5, ease: easePremium }}
      />
      
      {/* Floating glowing orbs / bokeh for premium feel */}
      <div className="absolute inset-0 overflow-hidden mix-blend-screen opacity-50">
         {[...Array(6)].map((_, i) => (
           <motion.div
             key={i}
             className="absolute rounded-full bg-white"
             style={{
               width: `${10 + (i * 3)}vw`,
               height: `${10 + (i * 3)}vw`,
               left: `${(i * 18)}%`,
               top: `${10 + (i * 12)}%`,
               opacity: 0.4,
               filter: 'blur(2vw)'
             }}
             animate={{
               y: ['-5%', '5%', '-5%'],
               x: ['-2%', '2%', '-2%'],
               opacity: [0.2, 0.5, 0.2],
               scale: [1, 1.2, 1],
             }}
             transition={{
               duration: 8 + i * 2,
               repeat: Infinity,
               ease: 'easeInOut',
             }}
           />
         ))}
      </div>
    </div>
  );
};

export const SceneContainer = ({ children, className = "", style = {} }: { children: React.ReactNode, className?: string, style?: any }) => (
  <motion.div
    className={`absolute inset-0 w-full h-full flex flex-col items-center justify-center z-10 ${className}`}
    style={style}
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.8, ease: easePremium }}
  >
    {children}
  </motion.div>
);
