export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-10">
      <div className="w-full rounded-3xl border border-neutral-200 bg-white p-8 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-3xl dark:bg-emerald-500/10">
            📒
          </div>
          <h1 className="mt-4 text-xl font-bold tracking-tight">
            จาเหมง รายรับรายจ่าย
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-neutral-500">
            บันทึกรายรับ-รายจ่ายผ่าน LINE ด้วยภาษาธรรมชาติ
          </p>
        </div>

        <div className="mt-7">
          <p className="text-xs font-medium tracking-wide text-neutral-400">
            ตัวอย่างการใช้งาน
          </p>
          <div className="mt-2.5 space-y-2">
            <Example cmd="กาแฟ 50" label="รายจ่าย" />
            <Example cmd="เงินเดือน 45000" label="รายรับ" />
            <Example cmd="สรุป" label="ดูยอดเดือนนี้" />
          </div>
        </div>

        <a
          href="/liff"
          className="mt-7 flex w-full items-center justify-center rounded-xl bg-neutral-900 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          เปิด Dashboard
        </a>
        <p className="mt-3 text-center text-xs text-neutral-400">
          เพิ่มเพื่อนใน LINE เพื่อเริ่มใช้งาน · เปิด Dashboard ภายในแอป LINE
        </p>
      </div>
    </main>
  );
}

function Example({ cmd, label }: { cmd: string; label: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-neutral-50 px-3 py-2.5 dark:bg-neutral-800/50">
      <code className="font-mono text-sm text-neutral-800 dark:text-neutral-100">
        {cmd}
      </code>
      <span className="text-xs text-neutral-500">{label}</span>
    </div>
  );
}
