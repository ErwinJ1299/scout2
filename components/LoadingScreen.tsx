"use client";

import { motion } from "framer-motion";
import { Heart } from "lucide-react";

export default function LoadingScreen() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-purple-900 via-violet-900 to-purple-950"
    >
      {/* Animated background glow effect */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-teal-500/20 rounded-full blur-3xl"
        />
        <motion.div
          animate={{
            scale: [1.2, 1, 1.2],
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 1.5,
          }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-cyan-500/20 rounded-full blur-3xl"
        />
      </div>

      {/* Main content */}
      <div className="relative flex flex-col items-center justify-center gap-8">
        {/* Heartbeat pulse loader */}
        <div className="relative">
          {/* Outer pulsing ring */}
          <motion.div
            animate={{
              scale: [1, 1.5, 1],
              opacity: [0.5, 0, 0.5],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeOut",
            }}
            className="absolute inset-0 rounded-full bg-gradient-to-r from-teal-500 to-cyan-500 blur-md"
            style={{ width: "120px", height: "120px", margin: "-10px" }}
          />

          {/* Middle pulsing ring */}
          <motion.div
            animate={{
              scale: [1, 1.3, 1],
              opacity: [0.7, 0, 0.7],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeOut",
              delay: 0.3,
            }}
            className="absolute inset-0 rounded-full bg-gradient-to-r from-purple-500 to-violet-500 blur-sm"
            style={{ width: "110px", height: "110px", margin: "-5px" }}
          />

          {/* Heart icon container with glow */}
          <motion.div
            animate={{
              scale: [1, 1.1, 1],
            }}
            transition={{
              duration: 1,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="relative flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-purple-600 via-violet-600 to-purple-700 shadow-2xl"
          >
            <motion.div
              animate={{
                scale: [1, 1.2, 1],
                rotate: [0, 5, -5, 0],
              }}
              transition={{
                duration: 1,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="relative"
            >
              <Heart className="w-12 h-12 text-teal-300 fill-teal-400" />
              
              {/* Glow effect on heart */}
              <motion.div
                animate={{
                  opacity: [0.5, 1, 0.5],
                }}
                transition={{
                  duration: 1,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="absolute inset-0 blur-lg"
              >
                <Heart className="w-12 h-12 text-cyan-300 fill-cyan-400" />
              </motion.div>
            </motion.div>
          </motion.div>
        </div>

        {/* Loading text with typing effect */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="flex flex-col items-center gap-3"
        >
          <motion.p
            animate={{
              opacity: [0.5, 1, 0.5],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="text-sm font-medium text-cyan-300 tracking-wider"
          >
            Analyzing your health data...
          </motion.p>

          {/* Animated dots */}
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                animate={{
                  scale: [1, 1.3, 1],
                  opacity: [0.3, 1, 0.3],
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: i * 0.2,
                }}
                className="w-2 h-2 rounded-full bg-gradient-to-r from-teal-400 to-cyan-400"
              />
            ))}
          </div>
        </motion.div>

        {/* ECG-style line animation (optional decorative element) */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.3 }}
          transition={{ delay: 1 }}
          className="absolute bottom-20 left-1/2 -translate-x-1/2 w-64 h-16"
        >
          <svg
            viewBox="0 0 200 40"
            className="w-full h-full"
            xmlns="http://www.w3.org/2000/svg"
          >
            <motion.path
              d="M0,20 L50,20 L55,10 L60,30 L65,20 L200,20"
              stroke="url(#gradient)"
              strokeWidth="2"
              fill="none"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.5 }}
              transition={{
                pathLength: { duration: 2, repeat: Infinity, ease: "linear" },
                opacity: { duration: 0.5 },
              }}
            />
            <defs>
              <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#14B8A6" />
                <stop offset="100%" stopColor="#06B6D4" />
              </linearGradient>
            </defs>
          </svg>
        </motion.div>
      </div>
    </motion.div>
  );
}
