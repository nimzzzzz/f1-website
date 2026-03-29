"use client";

import { motion } from "framer-motion";
import { useState, useEffect } from "react";

interface RevealTextProps {
  text?: string;
  textColor?: string;
  overlayColor?: string;
  fontSize?: string;
  letterDelay?: number;
  overlayDelay?: number;
  overlayDuration?: number;
  springDuration?: number;
  letterImages?: string[];
}

// Verified F1 images from Unsplash
const F1_IMAGES = [
  "https://images.unsplash.com/photo-y2xqsXa3ivQ?auto=format&fit=crop&w=2070&q=80",   // Ferrari vs McLaren, Monaco street
  "https://images.unsplash.com/photo-CCYPNpQhnww?auto=format&fit=crop&w=2070&q=80",   // F1 car close-up
  "https://images.unsplash.com/photo-hEIHXXic3yI?auto=format&fit=crop&w=2070&q=80",   // F1 car side view
  "https://images.unsplash.com/photo-Sk7vg5UakPI?auto=format&fit=crop&w=2070&q=80",   // F1 cockpit
  "https://images.unsplash.com/photo-QhiA6DdlgiM?auto=format&fit=crop&w=2070&q=80",   // Racing cars on track
  "https://images.unsplash.com/photo-gUtBDHvG_Pk?auto=format&fit=crop&w=2070&q=80",   // Monaco Grand Prix start
  "https://images.unsplash.com/photo-zMt57d7IHM0?auto=format&fit=crop&w=2070&q=80",   // Red Bull F1 car
  "https://images.unsplash.com/photo-E_H-k9x3GNI?auto=format&fit=crop&w=2070&q=80",   // Racing helmet
]

export function RevealText({
  text = "FORMULA 1",
  textColor = "text-white",
  overlayColor = "text-red-500",
  fontSize = "text-[250px]",
  letterDelay = 0.08,
  overlayDelay = 0.05,
  overlayDuration = 0.4,
  springDuration = 600,
  letterImages = F1_IMAGES,
}: RevealTextProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [showRedText, setShowRedText] = useState(false);

  // Group letters by word so words never break mid-character
  // Each word = its own non-wrapping flex container
  let globalIdx = 0;
  const wordGroups = text.split(" ").map((word) => ({
    chars: word.split("").map((char) => ({ char, idx: globalIdx++ })),
  }));
  const totalLetters = globalIdx;

  useEffect(() => {
    const lastLetterDelay = (totalLetters - 1) * letterDelay;
    const totalDelay = lastLetterDelay * 1000 + springDuration;
    const timer = setTimeout(() => setShowRedText(true), totalDelay);
    return () => clearTimeout(timer);
  }, [totalLetters, letterDelay, springDuration]);

  return (
    <div className="flex items-end justify-start flex-nowrap" style={{ gap: "0 0.18em" }}>
      {wordGroups.map(({ chars }, wordIdx) => (
        // Each word is its own non-wrapping row — prevents mid-word line breaks
        <div key={wordIdx} className="flex flex-nowrap">
          {chars.map(({ char, idx }) => (
            <motion.span
              key={idx}
              onMouseEnter={() => setHoveredIndex(idx)}
              onMouseLeave={() => setHoveredIndex(null)}
              className={`${fontSize} font-black tracking-tight cursor-pointer relative overflow-hidden`}
              style={{ lineHeight: 0.88 }}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{
                delay: idx * letterDelay,
                type: "spring",
                damping: 8,
                stiffness: 200,
                mass: 0.8,
              }}
            >
              {/* Base white text */}
              <motion.span
                className={`absolute inset-0 ${textColor}`}
                animate={{ opacity: hoveredIndex === idx ? 0 : 1 }}
                transition={{ duration: 0.1 }}
              >
                {char}
              </motion.span>

              {/* F1 image fill on hover with slow pan */}
              <motion.span
                className="text-transparent bg-clip-text bg-cover bg-no-repeat"
                animate={{
                  opacity: hoveredIndex === idx ? 1 : 0,
                  backgroundPosition:
                    hoveredIndex === idx ? "10% center" : "0% center",
                }}
                transition={{
                  opacity: { duration: 0.1 },
                  backgroundPosition: { duration: 3, ease: "easeInOut" },
                }}
                style={{
                  backgroundImage: `url('${letterImages[idx % letterImages.length]}')`,
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                {char}
              </motion.span>

              {/* Red sweep flash after entrance */}
              {showRedText && (
                <motion.span
                  className={`absolute inset-0 ${overlayColor} pointer-events-none`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 1, 1, 0] }}
                  transition={{
                    delay: idx * overlayDelay,
                    duration: overlayDuration,
                    times: [0, 0.1, 0.7, 1],
                    ease: "easeInOut",
                  }}
                >
                  {char}
                </motion.span>
              )}
            </motion.span>
          ))}
        </div>
      ))}
    </div>
  );
}
