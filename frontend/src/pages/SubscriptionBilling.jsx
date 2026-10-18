import React, { useState, useEffect } from 'react';
import { subscriptionAPI } from '../services/api';

export default function SubscriptionBilling() {
  const [user, setUser] = useState(null);
  const [plans, setPlans] = useState([]);
  const [subStatus, setSubStatus] = useState(null);
  const [history, setHistory] = useState([]);
  const [billingCycle, setBillingCycle] = useState('yearly'); // 'monthly' or 'yearly'
  const [loading, setLoading] = useState(true);
  const [processingPlanId, setProcessingPlanId] = useState(null);
  const [checkoutModal, setCheckoutModal] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    try {
      const stored = localStorage.getItem('chronorx_user');
      if (stored) {
        setUser(JSON.parse(stored));
      }
    } catch (e) {
      // Ignored
    }
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const [plansData, statusData, historyData] = await Promise.all([
        subscriptionAPI.getPlans(),
        subscriptionAPI.getStatus(),
        subscriptionAPI.getHistory().catch(() => []),
      ]);
      setPlans(plansData || []);
      setSubStatus(statusData || null);
      setHistory(historyData || []);
    } catch (err) {
      setErrorMsg(err.response?.data?.detail || 'Failed to load subscription details.');
    } finally {
      setLoading(false);
    }
  };

  const handleInitiateCheckout = async (plan) => {
    if (user?.role === 'patient' || plan.role === 'patient' || plan.price_inr === 0) {
      alert('Patients have 100% Free Forever access! No payment is required.');
      return;
    }

    setProcessingPlanId(plan.plan_id);
    setErrorMsg('');
    try {
      const order = await subscriptionAPI.checkout(plan.plan_id, billingCycle);
      setCheckoutModal({
        order,
        plan,
      });
    } catch (err) {
      setErrorMsg(err.response?.data?.detail || 'Could not initiate checkout order.');
    } finally {
      setProcessingPlanId(null);
    }
  };

  const handleConfirmMockPayment = async () => {
    if (!checkoutModal) return;
    const { order, plan } = checkoutModal;
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const mockPaymentId = `pay_mock_${Date.now()}`;
      // In sandbox/mock mode, signature prefix sig_mock_ verifies deterministically on backend
      const mockSignature = `sig_mock_${order.order_id}_${mockPaymentId}`;

      const res = await subscriptionAPI.verifyPayment({
        order_id: order.order_id,
        payment_id: mockPaymentId,
        signature: mockSignature,
        plan_id: plan.plan_id,
      });

      setSuccessMsg(`Success! ${plan.name} has been activated. ${res.message || ''}`);
      setCheckoutModal(null);
      await loadData();
    } catch (err) {
      setErrorMsg(err.response?.data?.detail || 'Payment verification failed.');
    } finally {
      setLoading(false);
    }
  };

  const isPatient = user?.role === 'patient';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-slate-200 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <span>💳</span> Role-Based Subscription & Billing
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Enterprise clinical suites for medical staff. Patients enjoy lifetime free access.
          </p>
        </div>

        {/* Current status pill */}
        {subStatus && (
          <div className="flex items-center gap-3">
            <span
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold tracking-wide uppercase shadow-sm ${
                subStatus.is_free_tier
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : subStatus.status === 'ACTIVE'
                  ? 'bg-teal-100 text-teal-800 border border-teal-300'
                  : 'bg-amber-100 text-amber-800 border border-amber-300'
              }`}
            >
              {subStatus.is_free_tier ? '100% Free Forever' : `Status: ${subStatus.status}`}
            </span>
            {subStatus.days_remaining !== null && (
              <span className="text-xs text-slate-500 font-medium">
                {subStatus.days_remaining} days remaining
              </span>
            )}
          </div>
        )}
      </div>

      {/* Messages */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-800 text-sm flex items-center gap-3">
          <span className="text-lg">✅</span>
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-300 rounded-xl text-rose-800 text-sm flex items-center gap-3">
          <span className="text-lg">⚠️</span>
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Patient Free Forever Banner */}
      {isPatient && (
        <div className="bg-gradient-to-r from-emerald-500 via-teal-600 to-cyan-600 rounded-2xl p-6 text-white shadow-lg">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <span className="inline-block px-3 py-1 bg-white/20 rounded-full text-xs font-semibold tracking-wider uppercase mb-2">
                Patient Protection Guarantee
              </span>
              <h2 className="text-xl font-bold">Your Account is 100% Free Forever</h2>
              <p className="text-emerald-50 text-sm mt-1 max-w-2xl">
                As a patient, you are never charged for accessing your clinical prescriptions,
                chronopharmacology timetables, 22-language translations, appointment bookings, or
                3-day doctor follow-ups.
              </p>
            </div>
            <div className="text-4xl sm:text-5xl font-black tracking-tight text-white/95">
              ₹0 <span className="text-base font-normal opacity-90">/ Lifetime</span>
            </div>
          </div>
        </div>
      )}

      {/* Monthly vs Annual Toggle */}
      {!isPatient && (
        <div className="flex justify-center items-center gap-3 pt-2">
          <span
            className={`text-sm font-semibold cursor-pointer ${
              billingCycle === 'monthly' ? 'text-teal-700 font-bold' : 'text-slate-500'
            }`}
            onClick={() => setBillingCycle('monthly')}
          >
            Monthly Billing
          </span>
          <button
            type="button"
            onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'yearly' : 'monthly')}
            className="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out bg-teal-600 focus:outline-none"
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                billingCycle === 'yearly' ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
          <span
            className={`text-sm font-semibold cursor-pointer flex items-center gap-1.5 ${
              billingCycle === 'yearly' ? 'text-teal-700 font-bold' : 'text-slate-500'
            }`}
            onClick={() => setBillingCycle('yearly')}
          >
            Annual Billing
            <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
              Save 2 Months Free
            </span>
          </span>
        </div>
      )}

      {/* Plan Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {plans
          .filter((p) => {
            if (isPatient) return p.role === 'patient';
            if (user?.role === 'admin') return true;
            return p.role === user?.role && p.billing_cycle === (billingCycle === 'yearly' ? 'yearly' : 'monthly');
          })
          .map((plan) => {
            const isCurrentPlan = subStatus?.plan_id === plan.plan_id && subStatus?.is_subscribed;
            return (
              <div
                key={plan.plan_id}
                className={`relative flex flex-col justify-between p-6 bg-white rounded-2xl border transition-all duration-200 hover:shadow-xl ${
                  isCurrentPlan
                    ? 'border-teal-500 ring-2 ring-teal-500/20 shadow-md'
                    : 'border-slate-200 shadow-sm'
                }`}
              >
                {isCurrentPlan && (
                  <span className="absolute -top-3 left-1/2 transform -translate-x-1/2 px-3 py-1 bg-teal-600 text-white text-[11px] font-bold uppercase rounded-full tracking-wider shadow">
                    Active Current Plan
                  </span>
                )}

                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-teal-700 bg-teal-50 px-2.5 py-1 rounded-md">
                      {plan.role}
                    </span>
                    <span className="text-xs text-slate-400 capitalize">
                      {plan.billing_cycle}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-slate-900 mt-3">{plan.name}</h3>
                  <p className="text-xs text-slate-500 mt-1 min-h-[32px]">{plan.description}</p>

                  <div className="my-5 flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold text-slate-900">
                      ₹{plan.price_inr.toLocaleString('en-IN')}
                    </span>
                    <span className="text-xs text-slate-500 font-medium">
                      /{plan.billing_cycle === 'yearly' ? 'year' : plan.billing_cycle === 'monthly' ? 'month' : 'lifetime'}
                    </span>
                  </div>

                  <div className="space-y-2.5 border-t border-slate-100 pt-4">
                    <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      Included Capabilities:
                    </p>
                    <ul className="space-y-2">
                      {plan.features.map((feat, idx) => (
                        <li key={idx} className="text-xs text-slate-600 flex items-start gap-2">
                          <span className="text-teal-600 font-bold mt-0.5">✓</span>
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="pt-6">
                  {isPatient ? (
                    <button
                      type="button"
                      disabled
                      className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-emerald-800 bg-emerald-100 cursor-default"
                    >
                      ✓ Included Free Forever
                    </button>
                  ) : isCurrentPlan ? (
                    <button
                      type="button"
                      disabled
                      className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-teal-800 bg-teal-50 border border-teal-200 cursor-default"
                    >
                      Active & Entitled
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={processingPlanId === plan.plan_id || loading}
                      onClick={() => handleInitiateCheckout(plan)}
                      className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 active:bg-teal-800 transition-colors shadow-sm disabled:opacity-50"
                    >
                      {processingPlanId === plan.plan_id ? 'Initiating...' : `Upgrade to ${plan.name}`}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
      </div>

      {/* Transaction History */}
      {!isPatient && history.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <h2 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
            <span>🧾</span> Payment & Invoice History
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Transaction ID</th>
                  <th className="py-2.5 px-3">Plan</th>
                  <th className="py-2.5 px-3">Amount</th>
                  <th className="py-2.5 px-3">Gateway</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {history.map((tx) => (
                  <tr key={tx.transaction_id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-mono text-slate-800">{tx.transaction_id}</td>
                    <td className="py-2.5 px-3 text-slate-700 font-medium">{tx.plan_id}</td>
                    <td className="py-2.5 px-3 font-semibold text-slate-900">
                      ₹{tx.amount_inr.toLocaleString('en-IN')}
                    </td>
                    <td className="py-2.5 px-3 uppercase text-slate-500">{tx.gateway}</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          tx.status === 'SUCCESS'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {tx.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-500">
                      {new Date(tx.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Checkout Modal */}
      {checkoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">Complete Payment</h3>
              <button
                type="button"
                onClick={() => setCheckoutModal(null)}
                className="text-slate-400 hover:text-slate-600 text-lg"
              >
                ✕
              </button>
            </div>

            <div className="py-4 space-y-3">
              <div className="p-3.5 bg-slate-50 rounded-xl space-y-1.5 border border-slate-200">
                <div className="flex justify-between text-xs text-slate-500">
                  <span>Selected Plan:</span>
                  <span className="font-bold text-slate-800">{checkoutModal.plan.name}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-500">
                  <span>Billing Cycle:</span>
                  <span className="capitalize font-semibold text-slate-700">
                    {checkoutModal.plan.billing_cycle}
                  </span>
                </div>
                <div className="flex justify-between text-xs text-slate-500">
                  <span>Order Ref:</span>
                  <span className="font-mono text-slate-600">{checkoutModal.order.order_id}</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-slate-900 pt-2 border-t border-slate-200">
                  <span>Total Payable:</span>
                  <span className="text-teal-700">
                    ₹{checkoutModal.order.amount_inr.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl text-teal-900 text-xs flex items-center gap-2">
                <span>🔒</span>
                <span>
                  Secure 256-bit encrypted transaction powered by ChronoRx Payments & Razorpay.
                </span>
              </div>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setCheckoutModal(null)}
                className="flex-1 py-2.5 px-4 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={handleConfirmMockPayment}
                className="flex-1 py-2.5 px-4 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 active:bg-teal-800 rounded-xl shadow-md transition-colors disabled:opacity-50"
              >
                {loading ? 'Verifying...' : `Pay ₹${checkoutModal.order.amount_inr}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
