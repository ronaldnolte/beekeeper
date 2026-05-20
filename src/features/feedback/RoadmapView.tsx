import React, { useState, useEffect } from 'react';
import { fetchFeatureRequests, submitFeatureRequest, voteOnFeature } from '../../data/feedbackRepository';
import { useAppStore } from '../../store/useAppStore';
import { Lightbulb, Send, X, Triangle, CheckCircle, Clock, LayoutDashboard } from 'lucide-react';

interface FeatureRequest {
  id: string;
  title: string;
  description: string;
  status: string;
  created_at: string;
  user_id: string;
  votes: number;
  is_voted_by_me: boolean;
}

export const RoadmapView: React.FC = () => {
  const { user, goBack } = useAppStore();
  const [features, setFeatures] = useState<FeatureRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitModalOpen, setSubmitModalOpen] = useState(false);
  
  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchFeatures = async () => {
    setLoading(true);
    try {
      const combined = await fetchFeatureRequests(user?.id);
      setFeatures(combined);
    } catch (err) {
      console.error('Error fetching features:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeatures();
  }, [user]);

  const handleVote = async (featureId: string, currentVoteStatus: boolean) => {
    if (!user) {
      alert('Please log in to vote.');
      return;
    }

    // Optimistic Update
    setFeatures(prev => prev.map(f => {
      if (f.id === featureId) {
        return {
          ...f,
          votes: currentVoteStatus ? f.votes - 1 : f.votes + 1,
          is_voted_by_me: !currentVoteStatus
        };
      }
      return f;
    }));

    try {
      if (currentVoteStatus) {
        // Remove vote
        await voteOnFeature(featureId, user.id, true);
      } else {
        // Add vote
        await voteOnFeature(featureId, user.id, false);
      }
    } catch (error) {
      console.error('Vote failed:', error);
      fetchFeatures(); // Revert on failure
    }
  };

  const handleSubmitIdea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !user) return;
    setSubmitting(true);

    try {
      await submitFeatureRequest({
        title,
        description,
        user_id: user.id
      });

      setSubmitModalOpen(false);
      setTitle('');
      setDescription('');
      fetchFeatures(); // Refresh list

    } catch (err: any) {
      alert('Error submitting idea: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full h-full flex flex-col overflow-hidden">
      
      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto w-full flex flex-col items-center p-4 space-y-6 animate-in slide-in-from-right-8 relative">
      
      {/* Header */}
      <div className="w-full max-w-2xl flex justify-between items-center bg-[#FFFBF0] p-6 rounded-2xl border-2 border-amber-200">
        <div>
          <h2 className="text-2xl font-black text-amber-900 flex items-center gap-2">
            Feedback & Roadmap
          </h2>
          <p className="text-sm font-bold text-amber-700/80 uppercase tracking-wider mt-1">Community Driven</p>
        </div>
        <button 
          onClick={() => setSubmitModalOpen(true)}
          className="bg-[#F5A623] text-white px-5 py-3 rounded-xl font-black flex items-center gap-2 hover:bg-[#D97706] transition-colors active:scale-95 shadow-md"
        >
          <Lightbulb size={18} />
          Submit Idea
        </button>
      </div>

      <div className="w-full max-w-2xl">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-bold text-[var(--color-text-muted)] uppercase tracking-wider px-1">Community Requests</h3>
          <span className="text-xs bg-[var(--color-bg-raised)] text-[var(--color-text-muted)] px-3 py-1 rounded-full font-bold">Sorted by Votes</span>
        </div>

        {loading ? (
          <div className="p-8 flex justify-center">
             <div className="w-10 h-10 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : features.length === 0 ? (
          <div className="text-center py-12 bg-[var(--color-bg-raised)] rounded-2xl border-2 border-dashed border-[var(--color-card-border)]">
            <Lightbulb size={48} className="mx-auto text-amber-300 mb-3" />
            <p className="text-lg font-black text-[var(--color-text-muted)]">No feature requests yet!</p>
            <p className="text-[var(--color-text-muted)] font-bold mt-1">Be the first to submit an idea.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {features.map(feature => (
              <div key={feature.id} className="bg-[var(--color-input-bg)] p-5 rounded-2xl shadow-sm border border-[var(--color-card-border)] flex gap-5 transition-all hover:border-[#F5A623]/30">
                
                {/* Upvote Button */}
                <button
                  onClick={() => handleVote(feature.id, feature.is_voted_by_me)}
                  className={`flex flex-col items-center justify-center min-w-[64px] h-[72px] rounded-xl border-2 transition-transform active:scale-90 ${
                    feature.is_voted_by_me
                      ? 'bg-amber-50 border-amber-400 text-amber-600 shadow-sm'
                      : 'bg-[var(--color-bg-raised)] border-[var(--color-card-border)] text-[var(--color-text-muted)] hover:border-amber-400 hover:text-amber-500'
                  }`}
                >
                  <Triangle className={`fill-current ${feature.is_voted_by_me ? 'text-amber-500' : 'text-[var(--color-text-muted)]'}`} size={20} />
                  <span className="font-black text-lg mt-1">{feature.votes}</span>
                </button>

                <div className="flex-1">
                  <div className="flex justify-between items-start gap-4">
                    <h3 className="font-black text-[var(--color-card-text)] text-lg leading-tight mb-2">{feature.title}</h3>
                    
                    {/* Status Badge */}
                    <span className={`flex-shrink-0 flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full uppercase font-black tracking-wider ${
                      feature.status === 'completed' ? 'bg-green-100 text-green-700' :
                      feature.status === 'planned' ? 'bg-blue-100 text-blue-700' :
                      'bg-[var(--color-bg-raised)] text-[var(--color-text-muted)]'
                    }`}>
                      {feature.status === 'completed' && <CheckCircle size={10} />}
                      {feature.status === 'pending' && <Clock size={10} />}
                      {feature.status}
                    </span>
                  </div>
                  <p className="text-[var(--color-text-muted)] text-sm font-medium whitespace-pre-line leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Submit Idea Modal Overlay */}
      {isSubmitModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[var(--color-input-bg)] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col">
            
            <div className="bg-[#F5A623] p-4 flex justify-between items-center text-white">
              <h3 className="font-black text-lg flex items-center gap-2">
                <Lightbulb size={20} /> Submit Feature Idea
              </h3>
              <button
                onClick={() => setSubmitModalOpen(false)}
                className="hover:bg-[var(--color-input-bg)]/20 rounded-full p-1 transition-colors active:scale-95"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmitIdea} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Title</label>
                <input
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Add offline mode"
                  className="w-full p-4 bg-[var(--color-bg-raised)] border border-[var(--color-card-border)] rounded-xl font-bold text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:border-[#F5A623] focus:ring-2 focus:ring-[#F5A623]/20 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Description</label>
                <textarea
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Tell us why this would be helpful..."
                  className="w-full min-h-[120px] p-4 bg-[var(--color-bg-raised)] border border-[var(--color-card-border)] rounded-xl font-bold text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:border-[#F5A623] focus:ring-2 focus:ring-[#F5A623]/20 outline-none resize-none transition-all"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setSubmitModalOpen(false)}
                  className="flex-1 py-4 text-[var(--color-text-muted)] font-black hover:bg-[var(--color-bg-raised)] rounded-xl transition-colors active:scale-95"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !title.trim() || !description.trim()}
                  className="flex-[2] bg-[#8B4513] text-white py-4 rounded-xl font-black hover:bg-[#723910] transition-colors disabled:opacity-50 active:scale-95 flex items-center justify-center gap-2 shadow-md"
                >
                  {submitting ? (
                    <div className="w-5 h-5 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <>Submit Idea <Send size={18} /></>
                  )}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      </div>

      {/* Segregated Bottom Action Bar — Return to Dashboard */}
      <div className="w-full flex-shrink-0 flex justify-center gap-3 p-4 bg-white/75 backdrop-blur-xl border-t border-white/40 dark:bg-black/55 dark:border-white/10 z-10 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <button 
          onClick={goBack}
          className="flex-1 max-w-md bg-white/60 backdrop-blur-sm border border-white/50 text-[var(--color-text)] py-3.5 rounded-full font-bold text-xs flex flex-col items-center justify-center gap-1 active:scale-95 transition-transform shadow-sm dark:bg-black/30 dark:border-white/10 dark:text-white"
        >
          <LayoutDashboard size={20} />
          Return to Dashboard
        </button>
      </div>

    </div>
  );
};
