import React from 'react';
import { motion } from 'framer-motion';

const Footer = () => {
  const links = {
    product: [
      { name: 'Features', href: '#' },
      { name: 'Roadmap', href: '#' },
      { name: 'Documentation', href: '#' },
      { name: 'Download', href: '#' }
    ],
    resources: [
      { name: 'GitHub', href: '#' },
      { name: 'Contributing', href: '#' },
      { name: 'Examples', href: '#' },
      { name: 'Support', href: '#' }
    ],
    connect: [
      { name: 'LinkedIn', href: '#' },
      { name: 'Portfolio', href: '#' },
      { name: 'Email', href: '#' },
      { name: 'Twitter', href: '#' }
    ]
  };

  return (
    <footer className="relative bg-gradient-to-b from-[#0a0e27] to-black border-t border-white/5">
      <div className="max-w-7xl mx-auto px-6 py-16">
        {/* Main footer content */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
          {/* Brand section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="lg:col-span-1"
          >
            <div className="flex items-center gap-2 mb-4">
              <span className="text-4xl">🧠</span>
              <h3 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">
                Structura
              </h3>
            </div>
            <p className="text-gray-400 mb-6 leading-relaxed">
              Making the invisible visible. A cross-platform visualization engine for C++ education.
            </p>
            <div className="flex gap-4">
              {['GitHub', 'LinkedIn', 'Twitter'].map((social, index) => (
                <motion.a
                  key={social}
                  href="#"
                  className="w-10 h-10 bg-white/5 rounded-lg flex items-center justify-center hover:bg-white/10 transition-all border border-white/10"
                  whileHover={{ scale: 1.1, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <span className="text-gray-400 text-sm font-semibold">
                    {social.slice(0, 2)}
                  </span>
                </motion.a>
              ))}
            </div>
          </motion.div>

          {/* Links sections */}
          {Object.entries(links).map(([category, items], categoryIndex) => (
            <motion.div
              key={category}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: categoryIndex * 0.1 }}
            >
              <h4 className="text-white font-bold mb-4 capitalize">
                {category}
              </h4>
              <ul className="space-y-3">
                {items.map((link, index) => (
                  <li key={index}>
                    <motion.a
                      href={link.href}
                      className="text-gray-400 hover:text-white transition-colors flex items-center gap-2 group"
                      whileHover={{ x: 5 }}
                    >
                      <motion.span
                        className="w-1.5 h-1.5 bg-indigo-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        initial={{ scale: 0 }}
                        whileHover={{ scale: 1 }}
                      />
                      {link.name}
                    </motion.a>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>

        {/* Bottom bar */}
        <motion.div
          className="pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
        >
          <div className="text-gray-500 text-sm">
            © 2025 Structura. Open source under MIT License.
          </div>
          
          <div className="flex gap-6 text-sm">
            <motion.a
              href="#"
              className="text-gray-500 hover:text-white transition-colors"
              whileHover={{ y: -2 }}
            >
              Privacy Policy
            </motion.a>
            <motion.a
              href="#"
              className="text-gray-500 hover:text-white transition-colors"
              whileHover={{ y: -2 }}
            >
              Terms of Service
            </motion.a>
            <motion.a
              href="#"
              className="text-gray-500 hover:text-white transition-colors"
              whileHover={{ y: -2 }}
            >
              License
            </motion.a>
          </div>
        </motion.div>

        {/* Made with love */}
        <motion.div
          className="mt-8 text-center"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.6 }}
        >
          <p className="text-gray-600 text-sm flex items-center justify-center gap-2">
            Made with
            <motion.span
              className="text-red-500"
              animate={{
                scale: [1, 1.2, 1]
              }}
              transition={{
                duration: 1,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            >
              ❤️
            </motion.span>
            for CS Students
          </p>
        </motion.div>
      </div>
    </footer>
  );
};

export default Footer;
