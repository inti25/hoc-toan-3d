export interface FlowerQuestion {
  id: number;
  title: string;
  question: string;
  imageUrl?: string;
  options: { label: string; value: string }[];
  answer: string;
  hints: string[];
  explanation: string;
  explanationImageUrl?: string;
  color: number;
  badge: string;
}

export const FLOWER_QUESTIONS: FlowerQuestion[] = [
  {
    id: 1,
    title: 'Bài 1: Phép cộng có nhớ',
    question: 'Tính: 64 + 36',
    options: [
      { label: '90', value: '90' },
      { label: '100', value: '100' },
      { label: '99', value: '99' }
    ],
    answer: '100',
    hints: [
      'Cộng từ phải sang trái: cộng hàng đơn vị trước: 4 + 6 = 10 (viết 0, nhớ 1).',
      'Cộng tiếp hàng chục: 6 + 3 = 9, thêm 1 đã nhớ là 10.',
      'Ghép lại kết quả: 64 + 36 = 100.'
    ],
    explanation: '64 + 36 = 100. Khi cộng 4 + 6 = 10 viết 0 nhớ 1 sang hàng chục.',
    color: 0xf06292, // Hồng sen
    badge: '🌸 Hoa Sen Hồng'
  },
  {
    id: 2,
    title: 'Bài 2: Phép tính khối lượng',
    question: 'Tính: 67kg – 25kg – 20kg',
    options: [
      { label: '22kg', value: '22kg' },
      { label: '32kg', value: '32kg' },
      { label: '42kg', value: '42kg' }
    ],
    answer: '22kg',
    hints: [
      'Thực hiện lần lượt từ trái sang phải: lấy 67kg – 25kg trước.',
      'Ta có: 67kg – 25kg = 42kg. Sau đó lấy 42kg – 20kg = ?',
      '42kg – 20kg = 22kg.'
    ],
    explanation: '67kg – 25kg – 20kg = 42kg – 20kg = 22kg.',
    color: 0xffb300, // Vàng hướng dương
    badge: '🌻 Hoa Hướng Dương'
  },
  {
    id: 3,
    title: 'Bài 3: So sánh và điền chữ số',
    question: 'Điền chữ số thích hợp vào chỗ trống: 9__ < 89 + 2',
    options: [
      { label: '0', value: '0' },
      { label: '1', value: '1' },
      { label: '2', value: '2' }
    ],
    answer: '0',
    hints: [
      'Tính kết quả vế phải trước: 89 + 2 = 91.',
      'Ta có: 9__ < 91. Các số có hai chữ số bắt đầu bằng chữ số 9 là 90, 91, 92...',
      'Vì 90 < 91 nên chữ số thích hợp duy nhất điền vào là 0.'
    ],
    explanation: '89 + 2 = 91. Số 90 < 91, vậy chữ số cần điền vào chỗ trống là 0.',
    color: 0x42a5f5, // Xanh thanh tú
    badge: '💠 Hoa Thanh Tú'
  },
  {
    id: 4,
    title: 'Bài 4: Bài toán thùng sách',
    question: 'Từ một thùng sách lấy ra 12 quyển thì còn lại 38 quyển. Hỏi lúc đầu trong thùng có bao nhiêu quyển sách?',
    options: [
      { label: '50 quyển', value: '50 quyển' },
      { label: '26 quyển', value: '26 quyển' },
      { label: '48 quyển', value: '48 quyển' }
    ],
    answer: '50 quyển',
    hints: [
      'Muốn tìm số sách lúc đầu (số bị trừ), ta lấy số sách còn lại (hiệu) cộng với số sách đã lấy ra (số trừ).',
      'Phép tính cần thực hiện: 38 + 12 = ?',
      '38 + 12 = 50 (quyển sách).'
    ],
    explanation: 'Lúc đầu trong thùng có số quyển sách là: 38 + 12 = 50 (quyển).',
    color: 0xe91e63, // Hoa hồng nhung
    badge: '🌹 Hoa Hồng Nhung'
  },
  {
    id: 5,
    title: 'Bài 5: Bài toán tuổi mẹ con',
    question: 'Hiện nay, tổng số tuổi hai mẹ con Khánh là 52 tuổi, biết Khánh 12 tuổi. Hỏi hiện nay, mẹ Khánh bao nhiêu tuổi?',
    options: [
      { label: '40 tuổi', value: '40 tuổi' },
      { label: '38 tuổi', value: '38 tuổi' },
      { label: '42 tuổi', value: '42 tuổi' }
    ],
    answer: '40 tuổi',
    hints: [
      'Tuổi của mẹ bằng tổng số tuổi của hai mẹ con trừ đi số tuổi của Khánh.',
      'Phép tính: 52 – 12 = ?',
      '52 – 12 = 40 (tuổi).'
    ],
    explanation: 'Tuổi của mẹ Khánh hiện nay là: 52 – 12 = 40 (tuổi).',
    color: 0xab47bc, // Tím dạ yến thảo
    badge: '💜 Hoa Dạ Yến Thảo'
  },
  {
    id: 6,
    title: 'Bài 6: Số lớn nhất và số liền sau',
    question: 'Tổng của số lớn nhất có hai chữ số với số liền sau của 0 là:',
    options: [
      { label: '100', value: '100' },
      { label: '99', value: '99' },
      { label: '101', value: '101' }
    ],
    answer: '100',
    hints: [
      'Số lớn nhất có hai chữ số là 99.',
      'Số liền sau của 0 là 1 (vì 0 + 1 = 1).',
      'Tính tổng của hai số đó: 99 + 1 = 100.'
    ],
    explanation: 'Số lớn nhất có 2 chữ số là 99; số liền sau của 0 là 1. Tổng của chúng là: 99 + 1 = 100.',
    color: 0xff7043, // Cam lưu ly
    badge: '🌺 Hoa Lưu Ly Cam'
  },
  {
    id: 7,
    title: 'Bài 7: Xem lịch ngày trong tuần',
    question: 'Nếu Chủ nhật tuần này là ngày 22 tháng 5 thì thứ Bảy tuần sau là ngày bao nhiêu tháng 5?',
    imageUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 140" width="280" height="140"><rect width="280" height="140" fill="%23ffffff" rx="10" stroke="%23cbd5e1" stroke-width="1.5"/><path d="M0 10A10 10 0 0 1 10 0h260a10 10 0 0 1 10 10v22H0z" fill="%232563eb"/><text x="140" y="22" fill="%23ffffff" font-family="sans-serif" font-weight="bold" font-size="14" text-anchor="middle">LỊCH THÁNG 5</text><g font-family="sans-serif" font-size="11" font-weight="bold" fill="%2364748b" text-anchor="middle"><text x="30" y="50">T2</text><text x="70" y="50">T3</text><text x="110" y="50">T4</text><text x="150" y="50">T5</text><text x="190" y="50">T6</text><text x="230" y="50">T7</text><text x="260" y="50" fill="%23ef4444">CN</text></g><g font-family="sans-serif" font-size="12" fill="%23334155" text-anchor="middle"><text x="30" y="75">16</text><text x="70" y="75">17</text><text x="110" y="75">18</text><text x="150" y="75">19</text><text x="190" y="75">20</text><text x="230" y="75">21</text><rect x="246" y="60" width="28" height="22" rx="4" fill="%23fee2e2" stroke="%23ef4444"/><text x="260" y="75" font-weight="bold" fill="%23dc2626">22</text><text x="30" y="105">23</text><text x="70" y="105">24</text><text x="110" y="105">25</text><text x="150" y="105">26</text><text x="190" y="105">27</text><rect x="216" y="90" width="28" height="22" rx="4" fill="%23fef08a" stroke="%23ca8a04"/><text x="230" y="105" font-weight="bold" fill="%23854d0e">?</text><text x="260" y="105">29</text></g></svg>',
    options: [
      { label: 'Ngày 28 tháng 5', value: 'Ngày 28 tháng 5' },
      { label: 'Ngày 29 tháng 5', value: 'Ngày 29 tháng 5' },
      { label: 'Ngày 27 tháng 5', value: 'Ngày 27 tháng 5' }
    ],
    answer: 'Ngày 28 tháng 5',
    hints: [
      'Một tuần có 7 ngày. Chủ nhật tuần sau sẽ là ngày: 22 + 7 = 29 tháng 5.',
      'Thứ Bảy tuần sau là ngày liền trước của Chủ nhật tuần sau: 29 – 1 = 28.',
      'Vậy thứ Bảy tuần sau là ngày 28 tháng 5.'
    ],
    explanation: 'Chủ nhật tuần sau là ngày 22 + 7 = 29 tháng 5. Thứ Bảy tuần sau là ngày liền trước nên là ngày 28 tháng 5.',
    color: 0x26a69a, // Ngọc lục bảo
    badge: '🌿 Hoa Thủy Tiên Ngọc'
  },
  {
    id: 8,
    title: 'Bài 8: Dãy số tăng quy luật',
    question: 'Điền số thích hợp tiếp theo vào chỗ trống để được dãy số theo quy luật: 1; 4; 7; 10; ...',
    options: [
      { label: '13', value: '13' },
      { label: '12', value: '12' },
      { label: '14', value: '14' }
    ],
    answer: '13',
    hints: [
      'Tìm khoảng cách giữa các số liên tiếp: 4 – 1 = 3; 7 – 4 = 3; 10 – 7 = 3.',
      'Mỗi số đứng sau bằng số đứng trước cộng thêm 3 đơn vị.',
      'Số tiếp theo là: 10 + 3 = 13.'
    ],
    explanation: 'Dãy số tăng đều 3 đơn vị: 1 (+3) -> 4 (+3) -> 7 (+3) -> 10 (+3) -> 13.',
    color: 0xffa726, // Cúc vạn thọ hổ phách
    badge: '🌼 Hoa Cúc Vạn Thọ'
  },
  {
    id: 9,
    title: 'Bài 9: Dãy số giảm quy luật',
    question: 'Điền số thích hợp tiếp theo vào chỗ trống để được dãy số theo quy luật: 97; 86; 75; 64; ....',
    options: [
      { label: '53', value: '53' },
      { label: '54', value: '54' },
      { label: '52', value: '52' }
    ],
    answer: '53',
    hints: [
      'Tìm quy luật giảm: 97 – 86 = 11; 86 – 75 = 11; 75 – 64 = 11.',
      'Mỗi số đứng sau bằng số đứng trước trừ đi 11 đơn vị.',
      'Số tiếp theo là: 64 – 11 = 53.'
    ],
    explanation: 'Dãy số giảm đều 11 đơn vị: 97 (-11) -> 86 (-11) -> 75 (-11) -> 64 (-11) -> 53.',
    color: 0x5c6bc0, // Chuông xanh tím
    badge: '🔔 Hoa Chuông Xanh'
  },
  {
    id: 10,
    title: 'Bài 10: Đếm số có 2 chữ số có tổng bằng 10',
    question: 'Có bao nhiêu số có hai chữ số mà tổng hai chữ số của số đó bằng 10?',
    options: [
      { label: '9 số', value: '9 số' },
      { label: '8 số', value: '8 số' },
      { label: '10 số', value: '10 số' }
    ],
    answer: '9 số',
    hints: [
      'Liệt kê các số có hai chữ số mà tổng 2 chữ số bằng 10 bắt đầu từ hàng chục là 1: số 19 (1 + 9 = 10).',
      'Các số tiếp theo: 28, 37, 46, 55, 64, 73, 82, 91.',
      'Đếm tất cả các số trên: có đúng 9 số thỏa mãn.'
    ],
    explanation: 'Các số có 2 chữ số có tổng bằng 10 gồm: 19, 28, 37, 46, 55, 64, 73, 82, 91 -> tổng cộng có 9 số.',
    color: 0xffd54f, // Hoa Mặt Trời Hoàng Kim
    badge: '👑 Hoa Mặt Trời Hoàng Kim'
  }
];
