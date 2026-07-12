'use client';

import { useState } from 'react';
import { authApi } from '@/lib/db';
import styles from './Login.module.css';

export default function Login() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  return (
    <div className={styles.login}>
      <div className="brand"><span className="mk" />Timebox</div>
      <p>เข้าสู่ระบบเพื่อจัดการ task ของคุณ</p>
      <button className="btn pri" onClick={() => authApi.signInWithGoogle()}>ล็อกอินด้วย Google</button>
      <div className="muted" style={{ margin: '12px 0', fontSize: 12 }}>หรือ</div>
      {sent ? (
        <p style={{ color: 'var(--accent)' }}>ส่งลิงก์เข้าอีเมลแล้ว เช็กกล่องจดหมาย</p>
      ) : (
        <>
          <input type="email" placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button className="btn" onClick={async () => { if (email) { await authApi.signInWithEmail(email); setSent(true); } }}>ส่งลิงก์เข้าอีเมล</button>
        </>
      )}
    </div>
  );
}
