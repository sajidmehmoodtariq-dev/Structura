import React from 'react';
import { motion } from 'framer-motion';

const Features = () => {
  const features = [
    {
      icon: '🖥️',
      title: 'Client-Side Execution',
      description: 'Runs C++ logic entirely in the browser using a custom JavaScript interpreter. No server-side compilation required.',
      color: 'from-cyan-500 to-blue-500'
    },
    {
      icon: '🧩',
      title: 'Memory Visualization',
      description: 'See the Stack, Heap, and Pointer connections in real-time. Watch memory allocate and deallocate as your code runs.',
      color: 'from-purple-500 to-pink-500'
    },
    {
      icon: '⚡',
      title: 'Step-Through Debugging',
      description: 'Pause, play, and step through code line-by-line. Watch memory change state with every instruction.',
      color: 'from-orange-500 to-red-500'
    },
    {
      icon: '🔄',
      title: 'Dynamic Visualization',
      description: 'Draggable heap nodes with real-time Bezier curves connecting pointers to their memory targets.',
      color: 'from-green-500 to-emerald-500'
    }
  ];

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 40 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <section className="relative py-32 px-6">
      {/* Background decoration */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-20 left-10 w-72 h-72 bg-indigo-500 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-purple-500 rounded-full blur-3xl" />
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
            The Simulation Engine
          </h2>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Experience C++ execution like never before with our powerful visualization tools
          </p>
        </motion.div>

        {/* Feature cards grid */}
        <motion.div
          className="grid md:grid-cols-2 gap-8"
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
        >
          {features.map((feature, index) => (
            <motion.div
              key={index}
              variants={item}
              whileHover={{ 
                y: -10,
                transition: { duration: 0.3 }
              }}
              className="group"
            >
              <div className="relative bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10 hover:border-white/20 transition-all duration-300 h-full overflow-hidden">
                {/* Gradient overlay on hover */}
                <div className={`absolute inset-0 bg-gradient-to-br ${feature.color} opacity-0 group-hover:opacity-10 transition-opacity duration-300`} />
                
                {/* Content */}
                <div className="relative z-10">
                  <motion.div 
                    className="text-6xl mb-6"
                    whileHover={{ 
                      scale: 1.2,
                      rotate: 5
                    }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    {feature.icon}
                  </motion.div>
                  
                  <h3 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                    {feature.title}
                    <motion.span
                      className="text-indigo-400"
                      initial={{ x: -5, opacity: 0 }}
                      whileHover={{ x: 0, opacity: 1 }}
                    >
                      →
                    </motion.span>
                  </h3>
                  
                  <p className="text-gray-400 leading-relaxed">
                    {feature.description}
                  </p>
                </div>

                {/* Decorative corner element */}
                <div className={`absolute -bottom-20 -right-20 w-40 h-40 bg-gradient-to-br ${feature.color} rounded-full blur-3xl opacity-0 group-hover:opacity-20 transition-opacity duration-500`} />
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default Features;
