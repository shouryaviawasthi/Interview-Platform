import { useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import CandidateEndScreen from '../components/interview/CandidateEndScreen';

/**
 * CandidateDashboard
 *
 * Dedicated route for candidates to return to their interview reports later.
 * Uses the token from URL params and displays the same CandidateEndScreen 
 * component but with different context (bookmarked access vs immediate post-interview).
 */
const CandidateDashboard = () => {
  const { token } = useParams();
  
  if (!token) {
    return (
      <div className="min-h-screen bg-ink-900 flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-2">Invalid Dashboard Link</h1>
          <p className="text-white/60">This dashboard link is not valid or has expired.</p>
        </div>
      </div>
    );
  }

  return (
    <CandidateEndScreen 
      token={token}
      candidateName={null} // Will be loaded from the report data
      durationSeconds={null} // Will be loaded from the report data
    />
  );
};

export default CandidateDashboard;