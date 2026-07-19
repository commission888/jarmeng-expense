'use client';

import { useEffect, useState } from 'react';

import {
  categoryLabel,
  currentMonthKey,
  formatBaht,
  monthLabel,
  shiftMonth,
} from '@/lib/format';
import type { TransactionRecord } from '@/lib/repo/transactions';
import type { Summary } from '@/lib/summary';
import styles from './dashboard.module.css';

interface DashboardData {
  month: string;
  monthKey: string;
  summary: Summary;
  transactions: TransactionRecord[];
}

type LoadedBody =
  | { status: 'error'; message: string }
  | { status: 'ready'; data: DashboardData };

export default function LiffDashboard() {
  const [token, setToken] = useState<string | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);
  // The client owns the selected month, so the picker stays responsive without
  // waiting for the server to echo it back.
  const [monthKey, setMonthKey] = useState<string>(() => currentMonthKey());
  // The fetch outcome is tagged with the month it belongs to, so a stale result
  // never paints over a month the user has since switched to.
  const [result, setResult] = useState<{ key: string; body: LoadedBody } | null>(null);

  // Init LIFF once and hold the ID token; month changes reuse it.
  useEffect(() => {
    let cancelled = false;

    initLiff()
      .then((idToken) => {
        if (!cancelled) setToken(idToken);
      })
      .catch((error: unknown) => {
        if (!cancelled) setTokenError(errorMessage(error));
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Refetch whenever the token arrives or the month changes. The cancelled guard
  // makes the latest selection win when a user taps through months quickly.
  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    fetchSummary(token, monthKey)
      .then((data) => {
        if (!cancelled) setResult({ key: monthKey, body: { status: 'ready', data } });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setResult({ key: monthKey, body: { status: 'error', message: errorMessage(error) } });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token, monthKey]);

  // Loading is derived, not stored: we're loading whenever the latest result
  // doesn't yet match the selected month. Avoids a synchronous setState on switch.
  const body: { status: 'loading' } | LoadedBody = tokenError
    ? { status: 'error', message: tokenError }
    : token && result?.key === monthKey
      ? result.body
      : { status: 'loading' };

  return (
    <main className={styles.root}>
      <header className={styles.header}>
        <h1 className={styles.title}>จาเหมง รายรับรายจ่าย</h1>
        {token ? (
          <MonthNav monthKey={monthKey} onChange={setMonthKey} />
        ) : (
          <div className={`${styles.skel} ${styles.skelMonth}`} />
        )}
      </header>

      {body.status === 'loading' && <LoadingSkeleton />}
      {body.status === 'error' && <p className={styles.muted}>{body.message}</p>}
      {body.status === 'ready' && <Dashboard data={body.data} />}
    </main>
  );
}

/**
 * Month picker: step back and forward a month at a time. "Next" is disabled at
 * the current month — there's nothing to see in the future. Rendered in every
 * body state so a loading or errored month never traps the user.
 */
function MonthNav({
  monthKey,
  onChange,
}: {
  monthKey: string;
  onChange: (key: string) => void;
}) {
  // Zero-padded YYYY-MM compares correctly as plain strings.
  const atCurrent = monthKey >= currentMonthKey();

  return (
    <div className={styles.monthNav}>
      <button
        type="button"
        className={styles.navBtn}
        onClick={() => onChange(shiftMonth(monthKey, -1))}
        aria-label="เดือนก่อนหน้า"
      >
        ‹
      </button>
      <span className={styles.monthLabel} aria-live="polite">
        เดือน{monthLabel(monthKey)}
      </span>
      <button
        type="button"
        className={styles.navBtn}
        onClick={() => onChange(shiftMonth(monthKey, 1))}
        disabled={atCurrent}
        aria-label="เดือนถัดไป"
      >
        ›
      </button>
    </div>
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'เกิดข้อผิดพลาด';
}

async function initLiff(): Promise<string> {
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
  if (!liffId) throw new Error('ยังไม่ได้ตั้งค่า NEXT_PUBLIC_LIFF_ID');

  // Imported here rather than at module scope: the SDK touches `window` on
  // import, which breaks the server render of this route.
  const liff = (await import('@line/liff')).default;

  await liff.init({ liffId });

  if (!liff.isLoggedIn()) {
    liff.login();
    // login() navigates away; nothing after this runs.
    return new Promise<string>(() => {});
  }

  const idToken = liff.getIDToken();
  if (!idToken) throw new Error('ไม่พบ ID token กรุณาเข้าสู่ระบบใหม่');

  return idToken;
}

async function fetchSummary(token: string, monthKey: string): Promise<DashboardData> {
  const response = await fetch(`/api/dashboard/summary?month=${monthKey}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) throw new Error('โหลดข้อมูลไม่สำเร็จ');

  return (await response.json()) as DashboardData;
}

/**
 * Placeholder shown while liff.init, the login round-trip, and the summary
 * fetch resolve. It mirrors the real dashboard's structure so the layout is
 * settled before data lands — nothing jumps when it does.
 */
function LoadingSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className={styles.srOnly}>กำลังโหลดข้อมูล…</span>

      <section className={styles.tiles}>
        {[0, 1, 2].map((i) => (
          <div key={i} className={styles.tile}>
            <div className={`${styles.skel} ${styles.skelTileLabel}`} />
            <div className={`${styles.skel} ${styles.skelTileValue}`} />
          </div>
        ))}
      </section>

      <section className={styles.card}>
        <div className={`${styles.skel} ${styles.skelTitle}`} />
        <div className={styles.bars}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={styles.barRow}>
              <div className={`${styles.skel} ${styles.skelBarLabel}`} />
              <div className={`${styles.skel} ${styles.skelBarTrack}`} />
            </div>
          ))}
        </div>
      </section>

      <section className={styles.card}>
        <div className={`${styles.skel} ${styles.skelTitle}`} />
        <div className={styles.skelRows}>
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className={`${styles.skel} ${styles.skelRow}`} />
          ))}
        </div>
      </section>
    </div>
  );
}

function Dashboard({ data }: { data: DashboardData }) {
  const { summary, transactions } = data;
  const netPositive = summary.net >= 0;

  return (
    <>
      <section className={styles.tiles}>
        <div className={styles.tile}>
          <div className={styles.tileLabel}>📥 รายรับ</div>
          <div className={styles.tileValue}>{formatBaht(summary.income)}</div>
        </div>
        <div className={styles.tile}>
          <div className={styles.tileLabel}>📤 รายจ่าย</div>
          <div className={styles.tileValue}>{formatBaht(summary.expense)}</div>
        </div>
        <div className={styles.tile}>
          {/* The icon and the word carry the state; the color only reinforces it. */}
          <div className={styles.tileLabel}>{netPositive ? '💰 คงเหลือ' : '⚠️ ติดลบ'}</div>
          <div
            className={`${styles.tileValue} ${netPositive ? styles.good : styles.critical}`}
          >
            {formatBaht(Math.abs(summary.net))}
          </div>
        </div>
      </section>

      {summary.expenseByCategory.length > 0 && (
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>รายจ่ายตามหมวด</h2>
          <div className={styles.bars}>
            {summary.expenseByCategory.map((c) => (
              <div key={c.category} className={styles.barRow}>
                <div className={styles.barLabels}>
                  <span>{categoryLabel(c.category)}</span>
                  <span className={styles.barValue}>
                    {formatBaht(c.amount)} · {Math.round(c.share * 100)}%
                  </span>
                </div>
                <div className={styles.barTrack}>
                  <div
                    className={styles.barFill}
                    style={{ width: `${Math.max(c.share * 100, 1)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>รายการล่าสุด</h2>
        {transactions.length === 0 ? (
          <p className={styles.muted}>ยังไม่มีรายการในเดือนนี้</p>
        ) : (
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>วันที่</th>
                  <th>รายการ</th>
                  <th>หมวด</th>
                  <th className={styles.amountCell}>จำนวน</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <tr key={t.id}>
                    <td>{formatDay(t.occurred_at)}</td>
                    <td>{t.description ?? '—'}</td>
                    <td>{categoryLabel(t.category)}</td>
                    <td className={styles.amountCell}>
                      {t.direction === 'income' ? '+' : '−'}
                      {formatBaht(t.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

function formatDay(iso: string): string {
  return new Intl.DateTimeFormat('th-TH', {
    day: 'numeric',
    month: 'short',
    timeZone: 'Asia/Bangkok',
  }).format(new Date(iso));
}
