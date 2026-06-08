/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ClerkProvider, useAuth, useUser } from '@clerk/clerk-react';
import { Page } from './types';

// Importing all pages
import LandingPage from './pages/LandingPage';
import { LoginPage, SignupPage, ForgotPasswordPage } from './pages/AuthPages';
import Dashboard from './pages/Dashboard';
import UploadPage from './pages/UploadPage';
import ProcessingPage from './pages/ProcessingPage';
import PreviewPage from './pages/PreviewPage';
import AdminPanel from './pages/AdminPanel';
import SettingsPage from './pages/SettingsPage';
import { PricingPage, AboutPage, ContactPage } from './pages/MarketingPages';

function AppContent() {
  const [currentPage, setCurrentPage] = useState<Page>('landing');
  const { isSignedIn } = useAuth();
  const { user } = useUser();

  const navigate = (page: Page) => {
    if (!isSignedIn && ['dashboard', 'upload', 'processing', 'preview', 'admin', 'settings'].includes(page)) {
      setCurrentPage('login');
      return;
    }
    setCurrentPage(page);
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'landing': return <LandingPage onNavigate={navigate} />;
      case 'login': return <LoginPage onNavigate={navigate} />;
      case 'signup': return <SignupPage onNavigate={navigate} />;
      case 'forgot-password': return <ForgotPasswordPage onNavigate={navigate} />;
      case 'dashboard': return <Dashboard onNavigate={navigate} />;
      case 'upload': return <UploadPage onNavigate={navigate} />;
      case 'processing': return <ProcessingPage onNavigate={navigate} />;
      case 'preview': return <PreviewPage onNavigate={navigate} />;
      case 'admin': return <AdminPanel onNavigate={navigate} />;
      case 'settings': return <SettingsPage onNavigate={navigate} />;
      case 'pricing': return <PricingPage onNavigate={navigate} />;
      case 'about': return <AboutPage onNavigate={navigate} />;
      case 'contact': return <ContactPage onNavigate={navigate} />;
      default: return <LandingPage onNavigate={navigate} />;
    }
  };

  return (
    <div className="min-h-screen bg-background text-text-bright selection:bg-primary/30 selection:text-primary">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentPage}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          className="min-h-screen"
        >
          {renderPage()}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || 'pk_test_Z3JhbmQtbGlvbj04Ny5jbGVyay5hY2NvdW50cy5kZXYk';

export default function App() {
  return (
    <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
      <AppContent />
    </ClerkProvider>
  );
}

