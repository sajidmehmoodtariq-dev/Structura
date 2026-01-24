import React from 'react';
import { motion } from 'framer-motion';

const Roadmap = () => {
  const phases = [
    {
      phase: 'Phase 1',
      title: 'The Core',
      subtitle: 'Syntax & Logic',
      status: 'In Progress',
      statusColor: 'bg-yellow-500',
      items: [
        'Monaco Editor & Tree-sitter Parser',
        'Virtual Memory Store (Stack/Heap)',
        'Stepper logic for AST execution'
      ],
      color: 'from-blue-500 to-cyan-500'
    },
    {
      phase: 'Phase 2',
      title: 'Visualization Layer',
      subtitle: 'Bringing Code to Life',
      status: 'Planned',
      statusColor: 'bg-indigo-500',
      items: [
        'Connect Memory Store to React Flow',
        'Pointer "Arrow" rendering logic',
        'Visualize Recursion (Stack Frames)'
      ],
      color: 'from-purple-500 to-pink-500'
    },
    {
      phase: 'Phase 3',
      title: 'Advanced Concepts',
      subtitle: 'OOP & Data Structures',
      status: 'Planned',
      statusColor: 'bg-indigo-500',
      items: [
        'Classes, Objects, Member Access (->)',
        '"Fake" STL Implementation',
        'Google Gemini API Integration'
      ],
      color: 'from-green-500 to-emerald-500'
    },
    {
      phase: 'Phase 4',
      title: 'Platform & Polish',
      subtitle: 'Production Ready',
      status: 'Planned',
      statusColor: 'bg-indigo-500',
      items: [
        'MongoDB Backend & User Accounts',
        'Cloud Save & Share Features',
        'Electron.js Desktop Build'
      ],
      color: 'from-orange-500 to-red-500'
    }
  ];

  return (
    <section className="relative py-32 px-6">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-0 w-px h-1/2 bg-gradient-to-b from-transparent via-indigo-500/50 to-transparent" />
        <div className="absolute top-1/4 right-0 w-px h-1/2 bg-gradient-to-b from-transparent via-purple-500/50 to-transparent" />
      </div>

      <div className="relative max-w-7xl mx-auto">
        {/* Section header */}
        <motion.div
          className="text-center mb-20"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-5xl md:text-6xl font-bold text-white mb-6">
            Development Roadmap
          </h2>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Our journey from concept to production-ready platform
          </p>
        </motion.div>

        {/* Timeline */}
        <div className="relative">
          {/* Central line */}
          <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-indigo-500 via-purple-500 to-pink-500 hidden lg:block" />

          {/* Phase cards */}
          <div className="space-y-16">
            {phases.map((phase, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.15, duration: 0.6 }}
                className={`lg:flex lg:gap-8 ${index % 2 === 0 ? 'lg:flex-row' : 'lg:flex-row-reverse'}`}
              >
                {/* Content */}
                <div className={`lg:w-1/2 ${index % 2 === 0 ? 'lg:text-right' : 'lg:text-left'}`}>
                  <motion.div
                    whileHover={{ scale: 1.02, y: -5 }}
                    className="bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10 hover:border-white/20 transition-all"
                  >
                    {/* Phase badge */}
                    <div className={`inline-flex items-center gap-2 mb-4 px-4 py-2 bg-gradient-to-r ${phase.color} rounded-full`}>
                      <span className="text-white font-bold text-sm">{phase.phase}</span>
                      <div className={`w-2 h-2 ${phase.statusColor} rounded-full animate-pulse`} />
                    </div>

                    {/* Title */}
                    <h3 className="text-3xl font-bold text-white mb-2">
                      {phase.title}
                    </h3>
                    <p className="text-lg text-indigo-300 mb-6">
                      {phase.subtitle}
                    </p>

                    {/* Status */}
                    <div className={`inline-block mb-6 px-3 py-1 ${phase.statusColor} rounded-full`}>
                      <span className="text-white text-sm font-semibold">{phase.status}</span>
                    </div>

                    {/* Items */}
                    <ul className="space-y-3">
                      {phase.items.map((item, itemIndex) => (
                        <motion.li
                          key={itemIndex}
                          initial={{ opacity: 0, x: index % 2 === 0 ? -20 : 20 }}
                          whileInView={{ opacity: 1, x: 0 }}
                          viewport={{ once: true }}
                          transition={{ delay: index * 0.15 + itemIndex * 0.1 }}
                          className={`flex items-center gap-3 text-gray-300 ${index % 2 === 0 ? 'lg:flex-row-reverse' : ''}`}
                        >
                          <motion.div
                            className={`w-1.5 h-1.5 rounded-full bg-gradient-to-r ${phase.color} flex-shrink-0`}
                            animate={{
                              scale: [1, 1.5, 1],
                              opacity: [0.5, 1, 0.5]
                            }}
                            transition={{
                              duration: 2,
                              repeat: Infinity,
                              delay: itemIndex * 0.3
                            }}
                          />
                          <span className="text-sm">{item}</span>
                        </motion.li>
                      ))}
                    </ul>
                  </motion.div>
                </div>

                {/* Spacer for timeline */}
                <div className="hidden lg:block lg:w-1/2" />

                {/* Timeline dot */}
                <motion.div
                  className="absolute left-1/2 transform -translate-x-1/2 hidden lg:block"
                  initial={{ scale: 0 }}
                  whileInView={{ scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.15 }}
                >
                  <div className={`w-6 h-6 rounded-full bg-gradient-to-r ${phase.color} border-4 border-[#0a0e27]`} />
                </motion.div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Roadmap;
