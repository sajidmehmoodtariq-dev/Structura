import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

const Hero = () => {
  const codeSnippets = [
    'int* ptr', 'new Node()', 'Stack<T>', 'vector.push_back()', 
    'delete[]', 'Class obj', '->data', 'malloc()'
  ];

  // Generate random values once on component mount
  const [particleConfigs] = useState(() => 
    codeSnippets.map(() => ({
      initialX: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1000),
      initialY: Math.random() * (typeof window !== 'undefined' ? window.innerHeight : 800),
      targetY: Math.random() * (typeof window !== 'undefined' ? window.innerHeight : 800),
      duration: 10 + Math.random() * 10
    }))
  );

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-linear-to-br from-primary-dark via-primary-medium to-primary-light" />
      
      {/* Grid overlay */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: `linear-gradient(#4f46e5 1px, transparent 1px), linear-gradient(90deg, #4f46e5 1px, transparent 1px)`,
          backgroundSize: '60px 60px'
        }} />
      </div>

      {/* Floating code particles */}
      {codeSnippets.map((snippet, i) => (
        <motion.div
          key={i}
          className="absolute text-indigo-400/20 font-mono text-sm"
          initial={{ 
            x: particleConfigs[i].initialX, 
            y: particleConfigs[i].initialY,
            opacity: 0 
          }}
          animate={{ 
            y: [null, particleConfigs[i].targetY],
            opacity: [0, 0.3, 0],
          }}
          transition={{ 
            duration: particleConfigs[i].duration,
            repeat: Infinity,
            delay: i * 0.5
          }}
        >
          {snippet}
        </motion.div>
      ))}

      {/* Main content */}
      <div className="relative z-10 max-w-6xl mx-auto px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          {/* Logo/Title */}
          <motion.h1 
            className="text-7xl md:text-9xl font-black mb-6 tracking-tight"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, delay: 0.2 }}
          >
            <span className="bg-clip-text text-transparent bg-linear-to-r from-indigo-400 via-purple-400 to-pink-400">
              Structura
            </span>
          </motion.h1>

          {/* Brain Icon */}
          <motion.div 
            className="text-6xl mb-6"
            animate={{ 
              rotate: [0, 5, -5, 0],
              scale: [1, 1.05, 1]
            }}
            transition={{ 
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          >
            🧠
          </motion.div>

          {/* Tagline */}
          <motion.p
            className="text-2xl md:text-3xl font-light text-indigo-200 mb-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.8 }}
          >
            Making the Invisible, <span className="font-semibold text-white">Visible</span>
          </motion.p>

          {/* Description */}
          <motion.p
            className="text-lg md:text-xl text-gray-400 max-w-3xl mx-auto mb-12 leading-relaxed"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7, duration: 0.8 }}
          >
            A cross-platform visualization engine for C++ memory models, 
            data structures, and algorithms. Watch your code come alive.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            className="flex flex-col sm:flex-row gap-4 justify-center items-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9, duration: 0.6 }}
          >
            <Link to="/editor">
              <motion.button
                className="px-8 py-4 bg-linear-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-semibold text-lg shadow-2xl shadow-indigo-500/50 hover:shadow-indigo-500/70 transition-all"
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.98 }}
              >
                Try Web Version
              </motion.button>
            </Link>
            
            <motion.button
              className="px-8 py-4 bg-white/10 backdrop-blur-sm text-white rounded-lg font-semibold text-lg border border-white/20 hover:bg-white/20 transition-all"
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.98 }}
            >
              Download Desktop App
            </motion.button>
          </motion.div>

          {/* Status badges */}
          <motion.div
            className="flex flex-wrap gap-3 justify-center mt-12"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.1, duration: 0.6 }}
          >
            <span className="px-4 py-2 bg-green-500/20 text-green-300 rounded-full text-sm font-medium border border-green-500/30">
              ✓ Active Development
            </span>
            <span className="px-4 py-2 bg-blue-500/20 text-blue-300 rounded-full text-sm font-medium border border-blue-500/30">
              MERN | Electron | Tree-sitter
            </span>
            <span className="px-4 py-2 bg-orange-500/20 text-orange-300 rounded-full text-sm font-medium border border-orange-500/30">
              MIT License
            </span>
          </motion.div>
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        className="absolute bottom-10 left-1/2 transform -translate-x-1/2"
        animate={{ y: [0, 10, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <div className="w-6 h-10 border-2 border-indigo-400/50 rounded-full flex justify-center pt-2">
          <motion.div 
            className="w-1.5 h-1.5 bg-indigo-400 rounded-full"
            animate={{ y: [0, 16, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        </div>
      </motion.div>
    </section>
  );
};

export default Hero;
