import { Users, Eye, RefreshCw, ChevronRight, Coffee } from 'lucide-react';

const reasons = [
  { icon: <Users size={22} />, title: 'Team Consensus', body: 'Independent voting prevents anchoring bias and encourages diverse perspectives.' },
  { icon: <Eye size={22} />, title: 'Reveals Unknowns', body: 'Estimate discrepancies surface misunderstandings and missing requirements early.' },
  { icon: <RefreshCw size={22} />, title: 'Iterative Rounds', body: 'Discuss outliers and re-vote until the team converges on an estimate.' },
  { icon: <ChevronRight size={22} />, title: 'Reduces Bias', body: 'Simultaneous reveal prevents senior members from influencing others.' },
  { icon: <Coffee size={22} />, title: 'Relative Sizing', body: 'Estimate complexity, not time — leading to more accurate sprint planning.' },
  { icon: <ChevronRight size={22} />, title: 'Better Planning', body: 'Accurate estimates lead to predictable sprints and reliable delivery.' },
];

export function WhySection() {
  return (
      <section className="py-20 bg-white">
      <div className="max-w-5xl mx-auto px-6">
        <h2 className="text-3xl font-bold text-center text-slate-800 mb-3">Why teams use Scrum Poker</h2>
        <p className="text-center text-slate-500 mb-12">Better estimates, fewer surprises, happier sprints.</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {reasons.map((r) => (
            <div key={r.title} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
              <div className="w-10 h-10 rounded-xl bg-[#fff6bf] text-[#367C2B] flex items-center justify-center mb-4">
                {r.icon}
              </div>
              <h3 className="font-semibold text-slate-800 mb-1">{r.title}</h3>
              <p className="text-sm text-slate-500 leading-relaxed">{r.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
