import React from 'react';
import { motion } from 'framer-motion';

const TechStack = () => {
  const techCategories = [
    {
      category: 'Frontend',
      technologies: ['React.js', 'Tailwind CSS', 'Monaco Editor', 'React Flow', 'Framer Motion'],
      color: 'from-cyan-500 to-blue-500'
    },
    {
      category: 'Core Logic',
      technologies: ['Web Tree-sitter', 'Custom JS Interpreter'],
      color: 'from-purple-500 to-pink-500'
    },
    {
      category: 'Backend',
      technologies: ['Node.js', 'Express.js', 'MongoDB'],
      color: 'from-green-500 to-emerald-500'
    },
    {
      category: 'Desktop',
      technologies: ['Electron.js'],
      color: 'from-orange-500 to-red-500'
    }
  ];

  return (
    <section className="relative py-32 px-6 bg-gradient-to-b from-[#1a1f3a] to-[#0a0e27]">
      <div className="max-w-7xl mx-auto">
        {/* Section header */}
        <motion.div
          className="text-center mb-20"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-5xl md:text-6xl font-bold text-white mb-6">
            Built with Modern Tech
          </h2>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            A powerful stack combining cutting-edge web technologies with native performance
          </p>
        </motion.div>

        {/* Tech categories */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {techCategories.map((category, categoryIndex) => (
            <motion.div
              key={categoryIndex}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: categoryIndex * 0.1, duration: 0.6 }}
              className="group"
            >
              <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10 hover:border-white/20 transition-all h-full">
                {/* Category header */}
                <div className={`inline-block mb-4 px-3 py-1 bg-gradient-to-r ${category.color} rounded-full`}>
                  <span className="text-white font-semibold text-sm">{category.category}</span>
                </div>

                {/* Technologies */}
                <div className="space-y-3">
                  {category.technologies.map((tech, techIndex) => (
                    <motion.div
                      key={techIndex}
                      initial={{ opacity: 0, x: -10 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: categoryIndex * 0.1 + techIndex * 0.05 }}
                      whileHover={{ x: 5 }}
                      className="flex items-center gap-2 text-gray-300 group-hover:text-white transition-colors"
                    >
                      <motion.div
                        className={`w-2 h-2 rounded-full bg-gradient-to-r ${category.color}`}
                        animate={{
                          scale: [1, 1.3, 1],
                        }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          delay: techIndex * 0.3
                        }}
                      />
                      <span className="text-sm font-medium">{tech}</span>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Platform badges */}
        <motion.div
          className="mt-16 text-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.6 }}
        >
          <p className="text-gray-400 mb-6">Available on multiple platforms</p>
          <div className="flex flex-wrap justify-center gap-4">
            {[
              { icon: '🌐', label: 'Web App (SaaS)' },
              { icon: '💻', label: 'Windows Desktop' },
              { icon: '🍎', label: 'macOS Desktop' }
            ].map((platform, index) => (
              <motion.div
                key={index}
                whileHover={{ scale: 1.05, y: -5 }}
                className="px-6 py-3 bg-gradient-to-r from-indigo-600/20 to-purple-600/20 rounded-lg border border-indigo-500/30 backdrop-blur-sm"
              >
                <span className="text-2xl mr-2">{platform.icon}</span>
                <span className="text-white font-medium">{platform.label}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default TechStack;
