import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const VisualizationShowcase = () => {
  const [activeTab, setActiveTab] = useState('stack');

  const tabs = [
    { id: 'stack', label: 'Stack', icon: '📚' },
    { id: 'heap', label: 'Heap', icon: '💾' },
    { id: 'pointers', label: 'Pointers', icon: '➡️' }
  ];

  const visualizations = {
    stack: {
      title: 'Stack Visualization',
      description: 'See function calls, stack frames, and local variables layer by layer',
      elements: [
        { name: 'main()', color: 'bg-blue-500/20 border-blue-500' },
        { name: 'calculate(int x)', color: 'bg-purple-500/20 border-purple-500' },
        { name: 'helper()', color: 'bg-pink-500/20 border-pink-500' }
      ]
    },
    heap: {
      title: 'Heap Memory',
      description: 'Track dynamic memory allocation with new/delete operations',
      elements: [
        { name: 'Node* ptr1', color: 'bg-green-500/20 border-green-500' },
        { name: 'int* arr[10]', color: 'bg-emerald-500/20 border-emerald-500' },
        { name: 'Object* obj', color: 'bg-teal-500/20 border-teal-500' }
      ]
    },
    pointers: {
      title: 'Pointer Connections',
      description: 'Real-time Bezier curves showing pointer-to-memory relationships',
      elements: [
        { name: 'ptr → 0x7fff', color: 'bg-orange-500/20 border-orange-500' },
        { name: 'next → Node', color: 'bg-red-500/20 border-red-500' },
        { name: 'head → NULL', color: 'bg-yellow-500/20 border-yellow-500' }
      ]
    }
  };

  return (
    <section className="relative py-32 px-6 bg-gradient-to-b from-[#0a0e27] to-[#1a1f3a]">
      <div className="max-w-7xl mx-auto">
        {/* Section header */}
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-5xl md:text-6xl font-bold text-white mb-6">
            Memory in Motion
          </h2>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Interactive visualizations that make complex C++ concepts crystal clear
          </p>
        </motion.div>

        {/* Tab navigation */}
        <div className="flex justify-center gap-4 mb-12">
          {tabs.map((tab) => (
            <motion.button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                activeTab === tab.id
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/50'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10'
              }`}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </motion.button>
          ))}
        </div>

        {/* Visualization display */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="bg-[#0f1629]/50 backdrop-blur-sm rounded-2xl p-12 border border-white/10"
          >
            <div className="grid md:grid-cols-2 gap-12 items-center">
              {/* Left side - Info */}
              <div>
                <motion.h3 
                  className="text-3xl font-bold text-white mb-4"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  {visualizations[activeTab].title}
                </motion.h3>
                <motion.p 
                  className="text-gray-400 text-lg leading-relaxed mb-8"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  {visualizations[activeTab].description}
                </motion.p>

                {/* Code snippet */}
                <motion.div
                  className="bg-black/40 rounded-lg p-4 font-mono text-sm border border-indigo-500/30"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <div className="text-gray-500">// Real-time execution</div>
                  <div className="text-indigo-400">int* ptr = <span className="text-purple-400">new</span> int(42);</div>
                  <div className="text-green-400">cout &lt;&lt; *ptr;</div>
                  <div className="text-orange-400"><span className="text-purple-400">delete</span> ptr;</div>
                </motion.div>
              </div>

              {/* Right side - Visual elements */}
              <div className="relative h-80">
                {visualizations[activeTab].elements.map((element, index) => (
                  <motion.div
                    key={index}
                    className={`absolute left-0 right-0 ${element.color} border-2 rounded-lg p-4 backdrop-blur-sm`}
                    style={{ top: `${index * 90}px` }}
                    initial={{ opacity: 0, x: 50, scale: 0.8 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    transition={{ delay: 0.1 * index, type: "spring" }}
                    whileHover={{ scale: 1.05, x: 10 }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-white font-mono">{element.name}</span>
                      <motion.div
                        className="w-3 h-3 bg-green-400 rounded-full"
                        animate={{ scale: [1, 1.3, 1] }}
                        transition={{ duration: 2, repeat: Infinity, delay: index * 0.3 }}
                      />
                    </div>
                  </motion.div>
                ))}

                {/* Connection lines for pointers tab */}
                {activeTab === 'pointers' && (
                  <svg className="absolute inset-0 w-full h-full pointer-events-none">
                    {[0, 1, 2].map((i) => (
                      <motion.path
                        key={i}
                        d={`M 300 ${50 + i * 90} Q 400 ${50 + i * 90} 450 ${100 + i * 80}`}
                        stroke="url(#gradient)"
                        strokeWidth="2"
                        fill="none"
                        initial={{ pathLength: 0, opacity: 0 }}
                        animate={{ pathLength: 1, opacity: 0.6 }}
                        transition={{ delay: 0.3 + i * 0.2, duration: 1 }}
                      />
                    ))}
                    <defs>
                      <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#6366f1" />
                        <stop offset="100%" stopColor="#a855f7" />
                      </linearGradient>
                    </defs>
                  </svg>
                )}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
};

export default VisualizationShowcase;
