'use client';

import { useEffect, useState } from 'react';

import { categoryLabel, formatBaht } from '@/lib/format';
import type { TransactionRecord } from '@/lib/repo/transactions';
import type { Summary } from '@/lib/summary';
import styles from './dashboard.module.css';

interface DashboardData {
  month: string;
  summary: Summary;
  transactions: TransactionRecord[];
}

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: DashboardData };

export default function LiffDashboard() {
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;

    load()
      .then((data) => {
        if (!cancelled) setState({ status: 'ready', data });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({
            status: 'error',
            message: error instanceof Error ? error.message : 'เกิดข้อผิดพลาด',
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className={styles.root}>
      <header className={styles.header}>
        <h1 className={styles.title}>จาเหมง รายรับรายจ่าย</h1>
        {state.status === 'ready' && (
          <p className={styles.month}>เดือน{state.data.month}</p>
        )}
        {state.status === 'loading' && (
          <div className={`${styles.skel} ${styles.skelMonth}`} />
        )}
      </header>

      {state.status === 'loading' && <LoadingSkeleton />}
      {state.status === 'error' && <p className={styles.muted}>{state.message}</p>}
      {state.status === 'ready' && <Dashboard data={state.data} />}
    </main>
  );
}

async function load(): Promise<DashboardData> {
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
  if (!liffId) throw new Error('ยังไม่ได้ตั้งค่า NEXT_PUBLIC_LIFF_ID');

  // Imported here rather than at module scope: the SDK touches `window` on
  // import, which breaks the server render of this route.
  const liff = (await import('@line/liff')).default;

  await liff.init({ liffId });

  if (!liff.isLoggedIn()) {
    liff.login();
    // login() navigates away; nothing after this runs.
    return new Promise<DashboardData>(() => {});
  }

  const idToken = liff.getIDToken();
  if (!idToken) throw new Error('ไม่พบ ID token กรุณาเข้าสู่ระบบใหม่');

  const response = await fetch('/api/dashboard/summary', {
    headers: { Authorization: `Bearer ${idToken}` },
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
