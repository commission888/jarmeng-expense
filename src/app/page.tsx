export default function Home() {
  return (
    <main className="mx-auto flex max-w-md flex-1 flex-col justify-center gap-6 p-8">
      <div>
        <h1 className="text-2xl font-bold">จาเหมง รายรับรายจ่าย</h1>
        <p className="mt-1 text-sm text-neutral-500">
          บันทึกรายรับ-รายจ่ายผ่าน LINE ด้วยภาษาธรรมชาติ
        </p>
      </div>

      <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
        <p className="text-sm font-medium">ตัวอย่างการใช้งาน</p>
        <ul className="mt-2 space-y-1 text-sm text-neutral-500">
          <li>
            พิมพ์ <code className="font-mono">กาแฟ 50</code> — บันทึกรายจ่าย
          </li>
          <li>
            พิมพ์ <code className="font-mono">เงินเดือน 45000</code> — บันทึกรายรับ
          </li>
          <li>
            พิมพ์ <code className="font-mono">สรุป</code> — ดูยอดเดือนนี้
          </li>
        </ul>
      </div>

      <p className="text-sm text-neutral-500">
        เพิ่มเพื่อนใน LINE เพื่อเริ่มใช้งาน — สรุปยอดแบบละเอียดดูได้ที่หน้า{' '}
        <a className="underline underline-offset-4" href="/liff">
          Dashboard
        </a>{' '}
        ภายในแอป LINE
      </p>
    </main>
  );
}
