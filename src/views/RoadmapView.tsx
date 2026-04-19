import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../store/useAppStore';
import { Lightbulb, Send, X, Triangle, CheckCircle, Clock } from 'lucide-react';

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
  const { user } = useAppStore();
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
      const { data: featureData, error } = await supabase
        .from('feature_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Simplistic approach for small dataset: fetch all votes
      const { data: allVotes } = await supabase.from('feature_votes').select('*');

      const combined = (featureData || []).map((f: any) => {
        const votesForThis = allVotes?.filter(v => v.feature_id === f.id) || [];
        const isVoted = user ? votesForThis.some(v => v.user_id === user.id) : false;
        return {
          ...f,
          votes: votesForThis.length,
          is_voted_by_me: isVoted
        };
      });

      // Sort by votes (desc), then date (desc)
      combined.sort((a: any, b: any) => {
        if (b.votes !== a.votes) return b.votes - a.votes;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

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
        await supabase
          .from('feature_votes')
          .delete()
          .match({ feature_id: featureId, user_id: user.id });
      } else {
        // Add vote
        await supabase
          .from('feature_votes')
          .insert({ feature_id: featureId, user_id: user.id });
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
      const { error } = await supabase
        .from('feature_requests')
        .insert([{
          title,
          description,
          status: 'pending',
          user_id: user.id,
          created_at: new Date().toISOString()
        }]);

      if (error) throw error;

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
    <div className="w-full flex flex-col items-center p-4 pb-20 space-y-6 animate-in slide-in-from-right-8">
      
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
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider px-1">Community Requests</h3>
          <span className="text-xs bg-gray-100 text-gray-500 px-3 py-1 rounded-full font-bold">Sorted by Votes</span>
        </div>

        {loading ? (
          <div className="p-8 flex justify-center">
             <div className="w-10 h-10 border-4 border-[#E67E22] border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : features.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
            <Lightbulb size={48} className="mx-auto text-amber-300 mb-3" />
            <p className="text-lg font-black text-gray-600">No feature requests yet!</p>
            <p className="text-gray-400 font-bold mt-1">Be the first to submit an idea.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {features.map(feature => (
              <div key={feature.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex gap-5 transition-all hover:border-[#F5A623]/30">
                
                {/* Upvote Button */}
                <button
                  onClick={() => handleVote(feature.id, feature.is_voted_by_me)}
                  className={`flex flex-col items-center justify-center min-w-[64px] h-[72px] rounded-xl border-2 transition-transform active:scale-90 ${
                    feature.is_voted_by_me
                      ? 'bg-amber-50 border-amber-400 text-amber-600 shadow-sm'
                      : 'bg-gray-50 border-gray-200 text-gray-400 hover:border-amber-400 hover:text-amber-500'
                  }`}
                >
                  <Triangle className={`fill-current ${feature.is_voted_by_me ? 'text-amber-500' : 'text-gray-300'}`} size={20} />
                  <span className="font-black text-lg mt-1">{feature.votes}</span>
                </button>

                <div className="flex-1">
                  <div className="flex justify-between items-start gap-4">
                    <h3 className="font-black text-[var(--color-card-text)] text-lg leading-tight mb-2">{feature.title}</h3>
                    
                    {/* Status Badge */}
                    <span className={`flex-shrink-0 flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full uppercase font-black tracking-wider ${
                      feature.status === 'completed' ? 'bg-green-100 text-green-700' :
                      feature.status === 'planned' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-500'
                    }`}>
                      {feature.status === 'completed' && <CheckCircle size={10} />}
                      {feature.status === 'pending' && <Clock size={10} />}
                      {feature.status}
                    </span>
                  </div>
                  <p className="text-gray-500 text-sm font-medium whitespace-pre-line leading-relaxed">
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
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col">
            
            <div className="bg-[#F5A623] p-4 flex justify-between items-center text-white">
              <h3 className="font-black text-lg flex items-center gap-2">
                <Lightbulb size={20} /> Submit Feature Idea
              </h3>
              <button
                onClick={() => setSubmitModalOpen(false)}
                className="hover:bg-white/20 rounded-full p-1 transition-colors active:scale-95"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmitIdea} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Title</label>
                <input
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Add offline mode"
                  className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-800 placeholder-gray-400 focus:border-[#F5A623] focus:ring-2 focus:ring-[#F5A623]/20 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Description</label>
                <textarea
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Tell us why this would be helpful..."
                  className="w-full min-h-[120px] p-4 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-800 placeholder-gray-400 focus:border-[#F5A623] focus:ring-2 focus:ring-[#F5A623]/20 outline-none resize-none transition-all"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setSubmitModalOpen(false)}
                  className="flex-1 py-4 text-gray-500 font-black hover:bg-gray-100 rounded-xl transition-colors active:scale-95"
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
  );
};
