import React from 'react';
import Hero from '../components/Hero';
import Features from '../components/Features';
import VisualizationShowcase from '../components/VisualizationShowcase';
import AITutor from '../components/AITutor';
import TechStack from '../components/TechStack';
import Roadmap from '../components/Roadmap';
import CTA from '../components/CTA';
import Footer from '../components/Footer';

const Home = () => {
  return (
    <div className="min-h-screen bg-primary-dark overflow-x-hidden">
      <Hero />
      <Features />
      <VisualizationShowcase />
      <AITutor />
      <TechStack />
      <Roadmap />
      <CTA />
      <Footer />
    </div>
  );
};

export default Home;
