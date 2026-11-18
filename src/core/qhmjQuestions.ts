import type { RemoteProblem } from '../data/remoteTypes';

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Sinh bộ câu hỏi mẫu/fallback theo chuẩn `RemoteProblem` cho vùng `QHMJ_SANCTUARY`
 * khi Google Sheets chưa có dữ liệu hoặc tab sheet rỗng.
 */
export function generateQhmjProblems(zoneId: number, count = 12): RemoteProblem[] {
  const safeCount = Math.max(1, count);
  const problems: RemoteProblem[] = [];

  for (let i = 0; i < safeCount; i++) {
    const rng = mulberry32(zoneId * 997 + (i + 1) * 131);
    const numId = i + 1;
    const isLast = i === safeCount - 1 && safeCount >= 3;

    if (isLast) {
      const hour = 7 + Math.floor(rng() * 4);
      const dur = 2 + Math.floor(rng() * 3);
      const endHour = hour + dur;
      const stepsPerMin = 2 + Math.floor(rng() * 4);
      const totalMinutes = dur * stepsPerMin;

      problems.push({
        id: numId,
        zoneId,
        title: `Bài ${numId}: Đỉnh Tháp Đồng Hồ`,
        subtitle: 'Thử thách 2 bước trên đỉnh cao nhất',
        badge: '🕰️ Đỉnh Tháp Đồng Hồ',
        color: 0xa855f7,
        position: null,
        steps: [
          {
            stepId: `qhmj_${zoneId}_${numId}_1`,
            prompt: `Đồng hồ tháp cổ khởi động lúc ${hour} giờ và chạy liên tục ${dur} giờ. Hỏi đồng hồ dừng lại lúc mấy giờ?`,
            options: [
              { label: `${endHour} giờ`, value: String(endHour) },
              { label: `${endHour - 1} giờ`, value: String(endHour - 1) },
              { label: `${endHour + 1} giờ`, value: String(endHour + 1) }
            ],
            answer: String(endHour),
            hints: [
              `Lấy giờ bắt đầu (${hour}) cộng thêm số giờ chạy (${dur}).`,
              `${hour} + ${dur} = ${endHour}.`
            ],
            explanation: `Đồng hồ dừng lúc ${hour} + ${dur} = ${endHour} giờ.`
          },
          {
            stepId: `qhmj_${zoneId}_${numId}_2`,
            prompt: `Mỗi giờ bánh răng quay được ${stepsPerMin} vòng. Trong ${dur} giờ đó, bánh răng quay được tất cả bao nhiêu vòng?`,
            options: [
              { label: `${totalMinutes} vòng`, value: String(totalMinutes) },
              { label: `${totalMinutes + stepsPerMin} vòng`, value: String(totalMinutes + stepsPerMin) },
              { label: `${Math.max(1, totalMinutes - dur)} vòng`, value: String(Math.max(1, totalMinutes - dur)) }
            ],
            answer: String(totalMinutes),
            hints: [
              `Lấy số vòng mỗi giờ nhân với ${dur} giờ.`,
              `${stepsPerMin} × ${dur} = ${totalMinutes}.`
            ],
            explanation: `Trong ${dur} giờ bánh răng quay ${stepsPerMin} × ${dur} = ${totalMinutes} vòng.`
          }
        ]
      });
      continue;
    }

    const mode = i % 3;
    if (mode === 0) {
      const a = 2 + Math.floor(rng() * 8);
      const b = 2 + Math.floor(rng() * 8);
      const ans = a * b;
      const d1 = ans + a;
      const d2 = Math.max(1, ans - b);
      const opts = [ans, d1, d2].sort(() => rng() - 0.5);
      problems.push({
        id: numId,
        zoneId,
        title: `Bài ${numId}: Nhẩm nhanh tích số`,
        subtitle: `Phép nhân ${a} × ${b}`,
        badge: `🔮 Trạm #${numId}`,
        color: 0x38bdf8,
        position: null,
        steps: [
          {
            stepId: `qhmj_${zoneId}_${numId}_1`,
            prompt: `Tính giá trị của phép nhân: ${a} × ${b} = ?`,
            options: opts.map((v) => ({ label: String(v), value: String(v) })),
            answer: String(ans),
            hints: [
              `Nhẩm theo bảng nhân ${a}.`,
              `${a} × ${b} = ${ans}.`
            ],
            explanation: `${a} × ${b} = ${ans}.`
          }
        ]
      });
    } else if (mode === 1) {
      const divisor = 2 + Math.floor(rng() * 8);
      const quotient = 2 + Math.floor(rng() * 8);
      const dividend = divisor * quotient;
      problems.push({
        id: numId,
        zoneId,
        title: `Bài ${numId}: Giải mã thương số`,
        subtitle: `Phép chia ${dividend} : ${divisor}`,
        badge: `🔮 Trạm #${numId}`,
        color: 0xf59e0b,
        position: null,
        steps: [
          {
            stepId: `qhmj_${zoneId}_${numId}_1`,
            prompt: `Tìm kết quả phép chia: ${dividend} : ${divisor} = ?`,
            options: [
              { label: String(quotient), value: String(quotient) },
              { label: String(quotient + 1), value: String(quotient + 1) },
              { label: String(Math.max(1, quotient - 1)), value: String(Math.max(1, quotient - 1)) }
            ].sort(() => rng() - 0.5),
            answer: String(quotient),
            hints: [
              `Nghĩ xem ${divisor} nhân với số nào thì bằng ${dividend}.`,
              `${divisor} × ${quotient} = ${dividend}.`
            ],
            explanation: `${dividend} : ${divisor} = ${quotient}.`
          }
        ]
      });
    } else {
      const a = 3 + Math.floor(rng() * 6);
      const b = 4 + Math.floor(rng() * 6);
      const left = a * b;
      const delta = Math.floor(rng() * 3) - 1; // -1, 0, +1
      const right = left + delta * 3;
      const ans = left < right ? '<' : left > right ? '>' : '=';
      problems.push({
        id: numId,
        zoneId,
        title: `Bài ${numId}: So sánh giá trị`,
        subtitle: `So sánh ${a} × ${b} và ${right}`,
        badge: `🔮 Trạm #${numId}`,
        color: 0x10b981,
        position: null,
        steps: [
          {
            stepId: `qhmj_${zoneId}_${numId}_1`,
            prompt: `Điền dấu thích hợp (<, =, >): ${a} × ${b} ... ${right}`,
            options: [
              { label: '<', value: '<' },
              { label: '=', value: '=' },
              { label: '>', value: '>' }
            ],
            answer: ans,
            hints: [
              `Tính giá trị vế trái ${a} × ${b} trước.`,
              `${a} × ${b} = ${left}, đem so sánh với ${right}.`
            ],
            explanation: `Vì ${a} × ${b} = ${left} nên ${left} ${ans} ${right}.`
          }
        ]
      });
    }
  }

  return problems;
}
