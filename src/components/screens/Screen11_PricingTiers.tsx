import React from 'react';
import { Check, Zap, Layers } from 'lucide-react';
import { useAppData } from '../../context/AppDataContext';

export const Screen11_PricingTiers: React.FC = () => {
  const { pricingPlans, billingPeriod, setBillingPeriod, currentPlan, setCurrentPlan, pushToast } =
    useAppData();
  const isYearly = billingPeriod === 'yearly';

  return (
    <div className="w-full h-full min-h-[420px] bg-[#071120] text-slate-100 rounded-xl overflow-hidden border border-sky-900/40 flex flex-col text-xs">
      <div className="px-3 sm:px-4 py-2.5 bg-[#091629] border-b border-sky-900/40 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Layers size={15} className="text-cyan-400" />
          <h2 className="text-xs sm:text-sm font-bold text-white">Subscription Plans</h2>
        </div>

        <div className="flex items-center gap-1 bg-[#050b14] p-1 rounded-lg border border-sky-900/60 text-[10px]">
          <button
            onClick={() => setBillingPeriod('monthly')}
            className={`px-2.5 py-1 rounded-md transition-all ${
              !isYearly ? 'bg-cyan-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingPeriod('yearly')}
            className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1 ${
              isYearly ? 'bg-cyan-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Yearly</span>
            <span className="text-[9px] text-emerald-400 font-bold">(Save 20%)</span>
          </button>
        </div>
      </div>

      <div className="flex-1 p-3 sm:p-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 overflow-y-auto">
        {pricingPlans.map((plan) => {
          const price = isYearly ? plan.yearlyPrice : plan.monthlyPrice;
          const isHighlighted = plan.highlighted;
          const isCurrent = currentPlan === plan.id;

          return (
            <div
              key={plan.id}
              className={`rounded-xl p-4 flex flex-col justify-between transition-all relative ${
                isHighlighted
                  ? 'bg-gradient-to-b from-[#0e274a] to-[#071526] border-2 border-cyan-400/80 shadow-[0_0_15px_rgba(6,182,212,0.25)]'
                  : isCurrent
                  ? 'bg-[#091629] border-2 border-emerald-500/50'
                  : 'bg-[#091629] border border-sky-900/40 hover:border-sky-700/60'
              }`}
            >
              {isHighlighted && (
                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-cyan-500 text-[#050b14] px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider flex items-center gap-1">
                  <Zap size={9} fill="currentColor" /> Most Popular
                </div>
              )}
              {isCurrent && !isHighlighted && (
                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-emerald-500 text-[#050b14] px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider">
                  Current Plan
                </div>
              )}

              <div>
                <h3 className="text-sm font-bold text-white">{plan.name}</h3>
                <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">{plan.subtitle}</p>
                <div className="mt-3 mb-3">
                  {plan.customPrice ? (
                    <span className="text-base font-bold text-cyan-300 font-mono">{plan.customPrice}</span>
                  ) : (
                    <div className="flex items-baseline gap-1 flex-wrap">
                      <span className="text-lg font-extrabold text-white font-mono">
                        KES {price.toLocaleString()}
                      </span>
                      <span className="text-[10px] text-slate-400">{plan.period}</span>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-sky-900/40 space-y-2 text-[11px]">
                  {plan.features.map((feat, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-slate-300">
                      <Check
                        size={13}
                        className={`shrink-0 mt-0.5 ${isHighlighted ? 'text-cyan-400' : 'text-emerald-400'}`}
                      />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 pt-2">
                <button
                  onClick={() => {
                    if (plan.customPrice) {
                      pushToast({
                        title: 'Sales contacted',
                        description: 'Enterprise team will reach out within 1 business day',
                        type: 'info',
                      });
                      return;
                    }
                    setCurrentPlan(plan.id);
                    pushToast({
                      title: isCurrent ? 'Already on this plan' : 'Plan selected',
                      description: isCurrent ? plan.name : `Switched to ${plan.name}`,
                      type: isCurrent ? 'info' : 'success',
                    });
                  }}
                  className={`w-full py-2 px-3 rounded-lg text-[11px] font-semibold transition-all active:scale-95 ${
                    isCurrent
                      ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
                      : isHighlighted
                      ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-[0_0_10px_rgba(6,182,212,0.4)]'
                      : 'bg-sky-950/80 hover:bg-sky-900 border border-sky-800 text-slate-200'
                  }`}
                >
                  {isCurrent ? 'Current Plan' : plan.ctaText}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
export default Screen11_PricingTiers;
