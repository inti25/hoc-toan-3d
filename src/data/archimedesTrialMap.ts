export interface ArchimedesStep {
  stepId: string;
  prompt: string;
  imageUrl?: string;
  diagramSvg?: string;
  options: { label: string; value: string }[];
  answer: string;
  hints: string[];
  explanation: string;
  explanationImageUrl?: string;
}

export interface ArchimedesMonolith {
  id: number;
  zoneId: 1 | 2 | 3 | 4 | 5;
  zoneName: string;
  page: number;
  title: string;
  subtitle: string;
  position: { x: number; z: number };
  color: number;
  badge: string;
  steps: ArchimedesStep[];
}

export interface ArchimedesZone {
  id: 1 | 2 | 3 | 4 | 5;
  name: string;
  title: string;
  description: string;
  center: { x: number; z: number };
  color: number;
  badge: string;
}

export const ARCHIMEDES_ZONES: ArchimedesZone[] = [
  {
    "id": 1,
    "name": "Thung Lũng Tính Toán & Đại Lượng",
    "title": "Khu 1: Phép Tính & Đo Lường",
    "description": "Rèn luyện đặt tính cộng trừ 3 chữ số, đại lượng kg, cm, lít và tìm thành phần chưa biết.",
    "center": {
      "x": 110,
      "z": -60
    },
    "color": 4367861,
    "badge": "🏆 Huy Chương Thung Lũng Tính Toán"
  },
  {
    "id": 2,
    "name": "Suối Nguồn Tính Nhanh & Dãy Số",
    "title": "Khu 2: Tính Nhanh & Quy Luật Số",
    "description": "Chinh phục nghệ thuật nhóm số tròn chục tròn trăm và giải mã các dãy số bí ẩn.",
    "center": {
      "x": 150,
      "z": -60
    },
    "color": 2533018,
    "badge": "⚡ Huy Chương Dãy Số Ma Thuật"
  },
  {
    "id": 3,
    "name": "Đồi Thời Gian & Đo Lường Cân Đĩa",
    "title": "Khu 3: Đồng Hồ, Lịch & Cân Đĩa",
    "description": "Khám phá thế giới thời gian 24h, lịch ngày trong tuần và bài toán cân đĩa thăng bằng.",
    "center": {
      "x": 110,
      "z": 60
    },
    "color": 16754470,
    "badge": "⏳ Huy Chương Người Quản Thời Gian"
  },
  {
    "id": 4,
    "name": "Rừng Hình Học & Đường Gấp Khúc",
    "title": "Khu 4: Hình Học & Đường Gấp Khúc",
    "description": "Quan sát các hình tam giác, tứ giác, trung điểm đoạn thẳng và tính độ dài đường gấp khúc.",
    "center": {
      "x": 150,
      "z": 60
    },
    "color": 6732650,
    "badge": "📐 Huy Chương Bậc Thầy Hình Học"
  },
  {
    "id": 5,
    "name": "Đỉnh Núi Tư Duy Sao (*, **)",
    "title": "Khu 5: Thử Thách Tư Duy Đỉnh Cao",
    "description": "Thử thách trí tuệ với các bài toán sao nâng cao: ma trận ô số, số ma thuật và logic tối ưu.",
    "center": {
      "x": 190,
      "z": 0
    },
    "color": 11225020,
    "badge": "👑 Đại Vương Miện Archimedes"
  }
];

export const ARCHIMEDES_MONOLITHS: ArchimedesMonolith[] = [
  {
    "id": 306,
    "zoneId": 1,
    "zoneName": "Thung Lũng Tính Toán & Đại Lượng",
    "page": 128,
    "title": "Bài 306: Đặt tính rồi tính",
    "subtitle": "Cộng trừ các số có 3 chữ số",
    "position": {
      "x": 104,
      "z": -65
    },
    "color": 4367861,
    "badge": "Bia Đá 306: Đặt Tính Chuẩn",
    "steps": [
      {
        "stepId": "306_1",
        "prompt": "Thực hiện phép cộng: 247 + 646 = ?",
        "options": [
          {
            "label": "893",
            "value": "893"
          },
          {
            "label": "883",
            "value": "883"
          },
          {
            "label": "891",
            "value": "891"
          }
        ],
        "answer": "893",
        "hints": [
          "Cộng hàng đơn vị trước: 7 + 6 = 13 (viết 3, nhớ 1).",
          "Cộng hàng chục: 4 + 4 = 8, thêm 1 nhớ là 9. Hàng trăm: 2 + 6 = 8."
        ],
        "explanation": "247 + 646 = 893. Cộng có nhớ 1 ở hàng đơn vị sang hàng chục."
      },
      {
        "stepId": "306_2",
        "prompt": "Thực hiện phép trừ: 505 – 124 = ?",
        "options": [
          {
            "label": "381",
            "value": "381"
          },
          {
            "label": "371",
            "value": "371"
          },
          {
            "label": "481",
            "value": "481"
          }
        ],
        "answer": "381",
        "hints": [
          "Hàng đơn vị: 5 – 4 = 1.",
          "Hàng chục: 0 không trừ được 2, mượn 1 trăm thành 10 – 2 = 8. Hàng trăm: 5 bớt 1 còn 4, 4 – 1 = 3."
        ],
        "explanation": "505 – 124 = 381. Phép trừ có nhớ ở hàng chục."
      }
    ]
  },
  {
    "id": 307,
    "zoneId": 1,
    "zoneName": "Thung Lũng Tính Toán & Đại Lượng",
    "page": 128,
    "title": "Bài 307: Tính kèm đơn vị đo",
    "subtitle": "Thực hiện phép tính với kg, cm, lít",
    "position": {
      "x": 107,
      "z": -65
    },
    "color": 4367861,
    "badge": "Bia Đá 307: Cân Đo Đong Đếm",
    "steps": [
      {
        "stepId": "307_1",
        "prompt": "Tính: 225 kg + 354 kg + 128 kg = ?",
        "options": [
          {
            "label": "707 kg",
            "value": "707 kg"
          },
          {
            "label": "697 kg",
            "value": "697 kg"
          },
          {
            "label": "717 kg",
            "value": "717 kg"
          }
        ],
        "answer": "707 kg",
        "hints": [
          "Tính lần lượt từ trái sang phải: 225 + 354 = 579 kg.",
          "Cộng tiếp 579 + 128: 9 + 8 = 17 (nhớ 1), 7 + 2 + 1 = 10 (nhớ 1), 5 + 1 + 1 = 7."
        ],
        "explanation": "225 kg + 354 kg + 128 kg = 579 kg + 128 kg = 707 kg."
      },
      {
        "stepId": "307_2",
        "prompt": "Tính: 1000 ℓ – 511 ℓ – 19 ℓ = ?",
        "options": [
          {
            "label": "470 ℓ",
            "value": "470 ℓ"
          },
          {
            "label": "480 ℓ",
            "value": "480 ℓ"
          },
          {
            "label": "460 ℓ",
            "value": "460 ℓ"
          }
        ],
        "answer": "470 ℓ",
        "hints": [
          "1000 ℓ – 511 ℓ = 489 ℓ.",
          "Lấy 489 ℓ – 19 ℓ = 470 ℓ."
        ],
        "explanation": "1000 ℓ – 511 ℓ – 19 ℓ = 489 ℓ – 19 ℓ = 470 ℓ."
      }
    ]
  },
  {
    "id": 308,
    "zoneId": 1,
    "zoneName": "Thung Lũng Tính Toán & Đại Lượng",
    "page": 128,
    "title": "Bài 308: Điền dấu so sánh thích hợp",
    "subtitle": "So sánh số và giá trị biểu thức",
    "position": {
      "x": 110,
      "z": -65
    },
    "color": 4367861,
    "badge": "Bia Đá 308: Cán Cân So Sánh",
    "steps": [
      {
        "stepId": "308_1",
        "prompt": "Điền dấu thích hợp: 890 + 3 [ ? ] 800 + 90 + 3",
        "options": [
          {
            "label": "=",
            "value": "="
          },
          {
            "label": ">",
            "value": ">"
          },
          {
            "label": "<",
            "value": "<"
          }
        ],
        "answer": "=",
        "hints": [
          "Tính vế trái: 890 + 3 = 893.",
          "Tính vế phải: 800 + 90 + 3 = 890 + 3 = 893."
        ],
        "explanation": "Cả hai vế đều có giá trị bằng 893 nên điền dấu =."
      },
      {
        "stepId": "308_2",
        "prompt": "Điền dấu thích hợp: 556 + 29 [ ? ] 550 + 26",
        "options": [
          {
            "label": ">",
            "value": ">"
          },
          {
            "label": "<",
            "value": "<"
          },
          {
            "label": "=",
            "value": "="
          }
        ],
        "answer": ">",
        "hints": [
          "So sánh từng số hạng: 556 > 550 và 29 > 26.",
          "Hoặc tính ra: 556 + 29 = 585; 550 + 26 = 576."
        ],
        "explanation": "556 + 29 = 585 > 576 = 550 + 26, nên điền dấu >."
      }
    ]
  },
  {
    "id": 309,
    "zoneId": 1,
    "zoneName": "Thung Lũng Tính Toán & Đại Lượng",
    "page": 129,
    "title": "Bài 309: So sánh biểu thức tổng",
    "subtitle": "So sánh cấu tạo số và phép cộng",
    "position": {
      "x": 113,
      "z": -65
    },
    "color": 4367861,
    "badge": "Bia Đá 309: Cấu Tạo Số Học",
    "steps": [
      {
        "stepId": "309_1",
        "prompt": "Điền dấu thích hợp: 640 + 1 [ ? ] 600 + 80 + 5",
        "options": [
          {
            "label": "<",
            "value": "<"
          },
          {
            "label": ">",
            "value": ">"
          },
          {
            "label": "=",
            "value": "="
          }
        ],
        "answer": "<",
        "hints": [
          "Vế trái: 640 + 1 = 641.",
          "Vế phải: 600 + 80 + 5 = 685. So sánh hàng chục: 4 chục < 8 chục."
        ],
        "explanation": "641 < 685 nên ta điền dấu <."
      },
      {
        "stepId": "309_2",
        "prompt": "Điền dấu thích hợp: 910 + 78 [ ? ] 900 + 70 + 8",
        "options": [
          {
            "label": ">",
            "value": ">"
          },
          {
            "label": "<",
            "value": "<"
          },
          {
            "label": "=",
            "value": "="
          }
        ],
        "answer": ">",
        "hints": [
          "Vế trái: 910 + 78 = 988.",
          "Vế phải: 900 + 70 + 8 = 978."
        ],
        "explanation": "988 > 978 nên ta điền dấu >."
      }
    ]
  },
  {
    "id": 310,
    "zoneId": 1,
    "zoneName": "Thung Lũng Tính Toán & Đại Lượng",
    "page": 129,
    "title": "Bài 310: Sơ đồ chuỗi phép tính",
    "subtitle": "Điền số theo sơ đồ hình học liên hoàn",
    "position": {
      "x": 116,
      "z": -65
    },
    "color": 4367861,
    "badge": "Bia Đá 310: Chuỗi Ngọc Phép Tính",
    "steps": [
      {
        "stepId": "310_1",
        "prompt": "Theo sơ đồ: 80 ➔ (+8) ➔ [ Lục giác ] ➔ (+12) ➔ [ Tam giác ]. Giá trị ở Tam giác là bao nhiêu?",
        "options": [
          {
            "label": "100",
            "value": "100"
          },
          {
            "label": "98",
            "value": "98"
          },
          {
            "label": "108",
            "value": "108"
          }
        ],
        "answer": "100",
        "hints": [
          "Lục giác = 80 + 8 = 88.",
          "Tam giác = Lục giác + 12 = 88 + 12 = ?"
        ],
        "explanation": "80 + 8 = 88; 88 + 12 = 100. Số cần điền vào tam giác cuối cùng là 100."
      },
      {
        "stepId": "310_2",
        "prompt": "Theo sơ đồ ngược: [ Thoi ] ➔ (–276) ➔ [ 600 ] ➔ (–38) ➔ [ Tam giác ]. Giá trị ở hình Thoi là bao nhiêu?",
        "options": [
          {
            "label": "876",
            "value": "876"
          },
          {
            "label": "324",
            "value": "324"
          },
          {
            "label": "866",
            "value": "866"
          }
        ],
        "answer": "876",
        "hints": [
          "Tìm số bị trừ: Thoi – 276 = 600.",
          "Muốn tìm Thoi, ta lấy 600 + 276."
        ],
        "explanation": "Thoi = 600 + 276 = 876."
      }
    ]
  },
  {
    "id": 311,
    "zoneId": 1,
    "zoneName": "Thung Lũng Tính Toán & Đại Lượng",
    "page": 129,
    "title": "Bài 311: Tìm y (thành phần chưa biết)",
    "subtitle": "Giải phương trình đơn giản lớp 2",
    "position": {
      "x": 104,
      "z": -55
    },
    "color": 4367861,
    "badge": "Bia Đá 311: Giải Mã Biến Số y",
    "steps": [
      {
        "stepId": "311_1",
        "prompt": "Tìm y biết: 142 – y = 98 + 14",
        "options": [
          {
            "label": "y = 30",
            "value": "y = 30"
          },
          {
            "label": "y = 20",
            "value": "y = 20"
          },
          {
            "label": "y = 40",
            "value": "y = 40"
          }
        ],
        "answer": "y = 30",
        "hints": [
          "Thu gọn vế phải trước: 98 + 14 = 112.",
          "Ta có 142 – y = 112 ➔ y = 142 – 112 = ?"
        ],
        "explanation": "142 – y = 112 ➔ y = 142 – 112 = 30."
      },
      {
        "stepId": "311_2",
        "prompt": "Tìm y biết: 831 – 300 + y = 647",
        "options": [
          {
            "label": "y = 116",
            "value": "y = 116"
          },
          {
            "label": "y = 126",
            "value": "y = 126"
          },
          {
            "label": "y = 106",
            "value": "y = 106"
          }
        ],
        "answer": "y = 116",
        "hints": [
          "Tính: 831 – 300 = 531.",
          "Biểu thức trở thành: 531 + y = 647 ➔ y = 647 – 531."
        ],
        "explanation": "531 + y = 647 ➔ y = 647 – 531 = 116."
      }
    ]
  },
  {
    "id": 312,
    "zoneId": 2,
    "zoneName": "Suối Nguồn Tính Nhanh & Dãy Số",
    "page": 130,
    "title": "Bài 312: Tính nhanh nhóm tròn trăm",
    "subtitle": "Ghép cặp số có tổng tròn chục tròn trăm",
    "position": {
      "x": 145,
      "z": -65
    },
    "color": 2533018,
    "badge": "Bia Đá 312: Nhóm Cặp Thông Minh",
    "steps": [
      {
        "stepId": "312_1",
        "prompt": "Tính nhanh biểu thức: A = 164 + 179 + 236 + 321",
        "options": [
          {
            "label": "900",
            "value": "900"
          },
          {
            "label": "890",
            "value": "890"
          },
          {
            "label": "910",
            "value": "910"
          }
        ],
        "answer": "900",
        "hints": [
          "Ghép cặp các số có hàng đơn vị bù nhau thành 10: (164 + 236) và (179 + 321).",
          "164 + 236 = 400; 179 + 321 = 500. Tổng là 400 + 500."
        ],
        "explanation": "A = (164 + 236) + (179 + 321) = 400 + 500 = 900."
      }
    ]
  },
  {
    "id": 313,
    "zoneId": 2,
    "zoneName": "Suối Nguồn Tính Nhanh & Dãy Số",
    "page": 130,
    "title": "Bài 313: Tính nhanh cộng trừ kết hợp",
    "subtitle": "Ghép cặp triệt tiêu hàng chục hàng đơn vị",
    "position": {
      "x": 150,
      "z": -65
    },
    "color": 2533018,
    "badge": "Bia Đá 313: Triệt Tiêu Tuyệt Diệu",
    "steps": [
      {
        "stepId": "313_1",
        "prompt": "Tính nhanh: B = 649 + 361 + 439 – 149 – 61 – 239",
        "options": [
          {
            "label": "1000",
            "value": "1000"
          },
          {
            "label": "900",
            "value": "900"
          },
          {
            "label": "1100",
            "value": "1100"
          }
        ],
        "answer": "1000",
        "hints": [
          "Nhóm từng cặp có cùng đuôi trừ đi nhau: (649 – 149) + (361 – 61) + (439 – 239).",
          "500 + 300 + 200 = ?"
        ],
        "explanation": "B = (649 – 149) + (361 – 61) + (439 – 239) = 500 + 300 + 200 = 1000."
      },
      {
        "stepId": "313_2",
        "prompt": "Tính nhanh: C = 185 + 549 + 215 – 449",
        "options": [
          {
            "label": "500",
            "value": "500"
          },
          {
            "label": "600",
            "value": "600"
          },
          {
            "label": "450",
            "value": "450"
          }
        ],
        "answer": "500",
        "hints": [
          "Ghép cặp: (185 + 215) và (549 – 449).",
          "185 + 215 = 400; 549 – 449 = 100."
        ],
        "explanation": "C = (185 + 215) + (549 – 449) = 400 + 100 = 500."
      }
    ]
  },
  {
    "id": 314,
    "zoneId": 2,
    "zoneName": "Suối Nguồn Tính Nhanh & Dãy Số",
    "page": 130,
    "title": "Bài 314: Dãy số cách đều",
    "subtitle": "Tìm số hạng còn thiếu theo bước nhảy",
    "position": {
      "x": 155,
      "z": -65
    },
    "color": 2533018,
    "badge": "Bia Đá 314: Bậc Thang Cách Đều",
    "steps": [
      {
        "stepId": "314_1",
        "prompt": "Điền số thích hợp: 511; 513; 515; [ ? ]; 519; 521; [ ? ]",
        "options": [
          {
            "label": "517 và 523",
            "value": "517 và 523"
          },
          {
            "label": "516 và 522",
            "value": "516 và 522"
          },
          {
            "label": "518 và 524",
            "value": "518 và 524"
          }
        ],
        "answer": "517 và 523",
        "hints": [
          "Quan sát khoảng cách: 513 – 511 = 2; 515 – 513 = 2.",
          "Mỗi số đứng sau hơn số trước 2 đơn vị (dãy số lẻ liên tiếp)."
        ],
        "explanation": "Quy luật tăng dần 2 đơn vị: 515 + 2 = 517 và 521 + 2 = 523."
      },
      {
        "stepId": "314_2",
        "prompt": "Điền số vào dãy: 215; 220; [ ? ]; 230; [ ? ]; [ ? ]; 245; 250",
        "options": [
          {
            "label": "225, 235, 240",
            "value": "225, 235, 240"
          },
          {
            "label": "224, 234, 239",
            "value": "224, 234, 239"
          },
          {
            "label": "226, 236, 241",
            "value": "226, 236, 241"
          }
        ],
        "answer": "225, 235, 240",
        "hints": [
          "Dãy số tăng cách đều 5 đơn vị.",
          "220 + 5 = 225; 230 + 5 = 235; 235 + 5 = 240."
        ],
        "explanation": "Quy luật tăng 5 đơn vị mỗi bước: các số cần điền là 225, 235, 240."
      }
    ]
  },
  {
    "id": 315,
    "zoneId": 2,
    "zoneName": "Suối Nguồn Tính Nhanh & Dãy Số",
    "page": 130,
    "title": "Bài 315: Dãy số tăng tiến & Fibonacci",
    "subtitle": "Quy luật khoảng cách tăng dần và tổng 2 số liền trước",
    "position": {
      "x": 145,
      "z": -55
    },
    "color": 2533018,
    "badge": "Bia Đá 315: Dòng Chảy Fibonacci",
    "steps": [
      {
        "stepId": "315_1",
        "prompt": "Tìm các số còn thiếu: 97; 98; 100; 103; [ ? ]; [ ? ]; 118; [ ? ]",
        "options": [
          {
            "label": "107; 112; 125",
            "value": "107; 112; 125"
          },
          {
            "label": "106; 111; 124",
            "value": "106; 111; 124"
          },
          {
            "label": "108; 113; 126",
            "value": "108; 113; 126"
          }
        ],
        "answer": "107; 112; 125",
        "hints": [
          "Khoảng cách: 98 – 97 = 1; 100 – 98 = 2; 103 – 100 = 3.",
          "Khoảng cách tăng dần +1, +2, +3, +4, +5, +6, +7."
        ],
        "explanation": "103 + 4 = 107; 107 + 5 = 112; 118 + 7 = 125."
      },
      {
        "stepId": "315_2",
        "prompt": "Dãy Fibonacci: 20; [ ? ]; 50; [ ? ]; 130; 210; 340; [ ? ]. Số đầu tiên còn thiếu là bao nhiêu?",
        "options": [
          {
            "label": "30",
            "value": "30"
          },
          {
            "label": "25",
            "value": "25"
          },
          {
            "label": "35",
            "value": "35"
          }
        ],
        "answer": "30",
        "hints": [
          "Trong dãy này, kể từ số thứ ba, mỗi số bằng tổng 2 số liền trước.",
          "20 + [ ? ] = 50 ➔ [ ? ] = 50 – 20 = 30."
        ],
        "explanation": "Quy luật tổng 2 số liền trước: 20 + 30 = 50; 30 + 50 = 80; 50 + 80 = 130... Vậy số còn thiếu đầu tiên là 30."
      }
    ]
  },
  {
    "id": 316,
    "zoneId": 1,
    "zoneName": "Thung Lũng Tính Toán & Đại Lượng",
    "page": 131,
    "title": "Bài 316: Số liền trước và số liền sau",
    "subtitle": "Tính tổng hai số hạng theo quy ước vị trí",
    "position": {
      "x": 107,
      "z": -55
    },
    "color": 4367861,
    "badge": "Bia Đá 316: Nhịp Cầu Liền Kề",
    "steps": [
      {
        "stepId": "316_1",
        "prompt": "Tính tổng của hai số hạng, biết số thứ nhất là số liền trước của 310, số thứ hai là số liền sau của 90.",
        "options": [
          {
            "label": "400",
            "value": "400"
          },
          {
            "label": "399",
            "value": "399"
          },
          {
            "label": "401",
            "value": "401"
          }
        ],
        "answer": "400",
        "hints": [
          "Số liền trước của 310 là 310 – 1 = 309.",
          "Số liền sau của 90 là 90 + 1 = 91. Tổng là 309 + 91."
        ],
        "explanation": "Số thứ nhất là 309, số thứ hai là 91. Tổng là 309 + 91 = 400."
      }
    ]
  },
  {
    "id": 317,
    "zoneId": 1,
    "zoneName": "Thung Lũng Tính Toán & Đại Lượng",
    "page": 131,
    "title": "Bài 317: Tìm Số bị trừ đặc biệt",
    "subtitle": "Mối quan hệ giữa Số bị trừ, Số trừ và Hiệu",
    "position": {
      "x": 110,
      "z": -55
    },
    "color": 4367861,
    "badge": "Bia Đá 317: Ẩn Số Phép Trừ",
    "steps": [
      {
        "stepId": "317_1",
        "prompt": "Một phép trừ có Hiệu là 389 và hơn Số trừ 155 đơn vị. Số bị trừ trong phép trừ đó là bao nhiêu?",
        "options": [
          {
            "label": "623",
            "value": "623"
          },
          {
            "label": "544",
            "value": "544"
          },
          {
            "label": "633",
            "value": "633"
          }
        ],
        "answer": "623",
        "hints": [
          "Hiệu hơn Số trừ 155 đơn vị ➔ Số trừ = 389 – 155 = 234.",
          "Số bị trừ = Hiệu + Số trừ = 389 + 234."
        ],
        "explanation": "Số trừ là: 389 – 155 = 234. Số bị trừ là: 389 + 234 = 623."
      }
    ]
  },
  {
    "id": 318,
    "zoneId": 3,
    "zoneName": "Đồi Thời Gian & Đo Lường Cân Đĩa",
    "page": 131,
    "title": "Bài 318: Đọc và vẽ kim đồng hồ",
    "subtitle": "Xem giờ chính xác theo hệ 12h và 24h",
    "position": {
      "x": 104,
      "z": 56
    },
    "color": 16754470,
    "badge": "Bia Đá 318: Bánh Răng Thời Khắc",
    "steps": [
      {
        "stepId": "318_1",
        "prompt": "Khi đồng hồ chỉ 22 giờ 5 phút, kim phút đang chỉ vào số mấy?",
        "options": [
          {
            "label": "Số 1",
            "value": "Số 1"
          },
          {
            "label": "Số 5",
            "value": "Số 5"
          },
          {
            "label": "Số 10",
            "value": "Số 10"
          }
        ],
        "answer": "Số 1",
        "hints": [
          "22 giờ là 10 giờ đêm (kim giờ chỉ qua số 10 một chút).",
          "Mỗi khoảng cách giữa hai số trên mặt đồng hồ là 5 phút. 5 phút ứng với số 1."
        ],
        "explanation": "5 phút tương ứng với kim phút chỉ thẳng vào vạch số 1."
      },
      {
        "stepId": "318_2",
        "prompt": "Khi đồng hồ chỉ 15 giờ 30 phút, vị trí kim giờ và kim phút như thế nào?",
        "options": [
          {
            "label": "Kim giờ ở giữa số 3 và 4, kim phút chỉ số 6",
            "value": "Kim giờ ở giữa số 3 và 4, kim phút chỉ số 6"
          },
          {
            "label": "Kim giờ chỉ số 3, kim phút chỉ số 6",
            "value": "Kim giờ chỉ số 3, kim phút chỉ số 6"
          },
          {
            "label": "Kim giờ chỉ số 15, kim phút chỉ số 30",
            "value": "Kim giờ chỉ số 15, kim phút chỉ số 30"
          }
        ],
        "answer": "Kim giờ ở giữa số 3 và 4, kim phút chỉ số 6",
        "hints": [
          "15 giờ là 3 giờ chiều.",
          "30 phút là nửa giờ, kim phút chỉ số 6 và kim giờ di chuyển đến chính giữa số 3 và số 4."
        ],
        "explanation": "15 giờ 30 phút (3 rưỡi chiều): kim dài chỉ số 6, kim ngắn ở chính giữa số 3 và 4."
      }
    ]
  },
  {
    "id": 319,
    "zoneId": 3,
    "zoneName": "Đồi Thời Gian & Đo Lường Cân Đĩa",
    "page": 132,
    "title": "Bài 319: Lịch ngày trong tuần",
    "subtitle": "Tính thứ trong tuần bằng chu kỳ 7 ngày",
    "position": {
      "x": 107,
      "z": 54
    },
    "color": 16754470,
    "badge": "Bia Đá 319: Vòng Xoay Năm Tháng",
    "steps": [
      {
        "stepId": "319_1",
        "prompt": "Ngày 25 tháng 9 của một năm là thứ Ba. Hỏi ngày 5 tháng 9 của năm đó là thứ mấy?",
        "options": [
          {
            "label": "Thứ Tư",
            "value": "Thứ Tư"
          },
          {
            "label": "Thứ Ba",
            "value": "Thứ Ba"
          },
          {
            "label": "Thứ Năm",
            "value": "Thứ Năm"
          }
        ],
        "answer": "Thứ Tư",
        "hints": [
          "Lùi từng tuần (7 ngày) từ ngày 25: 25 – 7 = 18 (thứ Ba); 18 – 7 = 11 (thứ Ba); 11 – 7 = 4 (thứ Ba).",
          "Ngày 4 tháng 9 là thứ Ba ➔ Ngày 5 tháng 9 là thứ mấy?"
        ],
        "explanation": "Ngày 4 tháng 9 là thứ Ba, vậy ngày 5 tháng 9 là thứ Tư."
      }
    ]
  },
  {
    "id": 320,
    "zoneId": 3,
    "zoneName": "Đồi Thời Gian & Đo Lường Cân Đĩa",
    "page": 132,
    "title": "Bài 320 (*): Chủ nhật đầu và cuối tháng",
    "subtitle": "Xác định số ngày trong tháng và các ngày Chủ nhật",
    "position": {
      "x": 110,
      "z": 53
    },
    "color": 16754470,
    "badge": "Bia Đá 320: Ngôi Sao Chủ Nhật (*)",
    "steps": [
      {
        "stepId": "320_1",
        "prompt": "Chủ nhật đầu tiên của tháng 9 là ngày 3. Hỏi Chủ nhật cuối cùng của tháng 9 đó là ngày bao nhiêu?",
        "options": [
          {
            "label": "Ngày 24",
            "value": "Ngày 24"
          },
          {
            "label": "Ngày 31",
            "value": "Ngày 31"
          },
          {
            "label": "Ngày 25",
            "value": "Ngày 25"
          }
        ],
        "answer": "Ngày 24",
        "hints": [
          "Tháng 9 có 30 ngày.",
          "Các ngày Chủ nhật trong tháng: ngày 3, ngày 10 (3+7), ngày 17 (10+7), ngày 24 (17+7). Thử tiếp: 24+7 = 31 (vượt quá 30)."
        ],
        "explanation": "Tháng 9 có 30 ngày. Các ngày Chủ nhật là 3, 10, 17, 24. Vậy Chủ nhật cuối cùng là ngày 24."
      }
    ]
  },
  {
    "id": 321,
    "zoneId": 3,
    "zoneName": "Đồi Thời Gian & Đo Lường Cân Đĩa",
    "page": 132,
    "title": "Bài 321: Thời gian tàu hoả lăn bánh",
    "subtitle": "Tính khoảng thời gian trôi qua trong ngày",
    "position": {
      "x": 113,
      "z": 54
    },
    "color": 16754470,
    "badge": "Bia Đá 321: Chuyến Tàu Thời Gian",
    "steps": [
      {
        "stepId": "321_1",
        "prompt": "Tính thời gian đi của một tàu hoả từ Hà Nội lúc 8 giờ sáng và đến Huế lúc 19 giờ cùng ngày.",
        "options": [
          {
            "label": "11 giờ",
            "value": "11 giờ"
          },
          {
            "label": "12 giờ",
            "value": "12 giờ"
          },
          {
            "label": "10 giờ",
            "value": "10 giờ"
          }
        ],
        "answer": "11 giờ",
        "hints": [
          "Thời gian tàu đi = Giờ đến nơi – Giờ khởi hành.",
          "19 giờ – 8 giờ = ?"
        ],
        "explanation": "Thời gian tàu chạy là: 19 – 8 = 11 (giờ)."
      }
    ]
  },
  {
    "id": 322,
    "zoneId": 3,
    "zoneName": "Đồi Thời Gian & Đo Lường Cân Đĩa",
    "page": 132,
    "title": "Bài 322: So sánh tốc độ di chuyển",
    "subtitle": "Đổi đơn vị giờ – phút để so sánh thời gian",
    "position": {
      "x": 116,
      "z": 56
    },
    "color": 16754470,
    "badge": "Bia Đá 322: Đường Đua Tốc Độ",
    "steps": [
      {
        "stepId": "322_1",
        "prompt": "Cùng quãng đường, anh Hiếu đi hết 55 phút, anh Tài đi hết 1 giờ, anh Bình đi hết 65 phút. Hỏi ai đi nhanh nhất?",
        "options": [
          {
            "label": "Anh Hiếu",
            "value": "Anh Hiếu"
          },
          {
            "label": "Anh Tài",
            "value": "Anh Tài"
          },
          {
            "label": "Anh Bình",
            "value": "Anh Bình"
          }
        ],
        "answer": "Anh Hiếu",
        "hints": [
          "Đổi cùng đơn vị phút: 1 giờ = 60 phút.",
          "So sánh: 55 phút < 60 phút < 65 phút. Người đi hết ít thời gian nhất là người đi nhanh nhất."
        ],
        "explanation": "Anh Hiếu mất 55 phút (ít thời gian nhất) nên anh Hiếu đi nhanh nhất."
      }
    ]
  },
  {
    "id": 323,
    "zoneId": 5,
    "zoneName": "Đỉnh Núi Tư Duy Sao (*, **)",
    "page": 132,
    "title": "Bài 323 (*): Dãy 9 ô tổng 4 ô liền nhau bằng 600",
    "subtitle": "Bài toán suy luận chu kỳ số học (*)",
    "position": {
      "x": 186,
      "z": -4
    },
    "color": 11225020,
    "badge": "Bia Đá 323: Ma Trận Bốn Số Tuần Hoàn (*)",
    "steps": [
      {
        "stepId": "323_1",
        "prompt": "Dãy có 9 ô: [199] [ ] [ ] [265] [ ] [ ] [58] [ ] [ ]. Tổng 4 ô liền nhau bất kỳ đều bằng 600. Số ở ô thứ hai là bao nhiêu?",
        "options": [
          {
            "label": "78",
            "value": "78"
          },
          {
            "label": "68",
            "value": "68"
          },
          {
            "label": "88",
            "value": "88"
          }
        ],
        "answer": "78",
        "hints": [
          "Vì tổng 4 ô liên tiếp luôn bằng 600 nên các số cách nhau 4 vị trí sẽ bằng nhau (chu kỳ lặp lại 4 số: a1 = a5 = a9; a2 = a6; a3 = a7 = 58; a4 = a8 = 265).",
          "Ta có: a1 + a2 + a3 + a4 = 600 ➔ 199 + a2 + 58 + 265 = 600 ➔ 522 + a2 = 600."
        ],
        "explanation": "Chu kỳ 4 số là 199, 78, 58, 265. Vậy ô thứ hai bằng 600 – 522 = 78."
      }
    ]
  },
  {
    "id": 324,
    "zoneId": 5,
    "zoneName": "Đỉnh Núi Tư Duy Sao (*, **)",
    "page": 133,
    "title": "Bài 324 (*): Ghép chữ số có tổng bé nhất",
    "subtitle": "Tối ưu hoá giá trị chữ số theo hàng (*)",
    "position": {
      "x": 194,
      "z": -4
    },
    "color": 11225020,
    "badge": "Bia Đá 324: Tinh Hoa Ghép Số (*)",
    "steps": [
      {
        "stepId": "324_1",
        "prompt": "Cho các chữ số 0; 1; 2; 3; 4; 6. Viết mỗi chữ số vào 1 ô trống: [ ][ ][ ] + [ ][ ][ ] để tổng nhận được là số bé nhất có thể. Tổng bé nhất đó là bao nhiêu?",
        "options": [
          {
            "label": "340",
            "value": "340"
          },
          {
            "label": "350",
            "value": "350"
          },
          {
            "label": "330",
            "value": "330"
          }
        ],
        "answer": "340",
        "hints": [
          "Để tổng bé nhất, hàng trăm phải là 2 chữ số bé nhất khác 0: là 1 và 2.",
          "Hàng chục chọn 2 chữ số bé tiếp theo: 0 và 3. Hàng đơn vị chọn 4 và 6. Phép tính ví dụ: 104 + 236 = 340."
        ],
        "explanation": "Chọn chữ số hàng trăm là 1 và 2; hàng chục là 0 và 3; hàng đơn vị là 4 và 6. Tổng bé nhất là 104 + 236 = 340."
      }
    ]
  },
  {
    "id": 325,
    "zoneId": 5,
    "zoneName": "Đỉnh Núi Tư Duy Sao (*, **)",
    "page": 133,
    "title": "Bài 325 (**): Tô màu lưới 24 ô vuông",
    "subtitle": "Bài toán hiệu và tổng số ô tô màu (**)",
    "position": {
      "x": 186,
      "z": 4
    },
    "color": 11225020,
    "badge": "Bia Đá 325: Lưới Màu Kỳ Ảo (**)",
    "steps": [
      {
        "stepId": "325_1",
        "prompt": "Lưới ô vuông gồm 24 ô, hiện tại đã tô màu 5 ô. Cần tô thêm bao nhiêu ô trắng nữa để số ô trắng ít hơn số ô màu là 4 ô?",
        "options": [
          {
            "label": "9 ô",
            "value": "9 ô"
          },
          {
            "label": "8 ô",
            "value": "8 ô"
          },
          {
            "label": "10 ô",
            "value": "10 ô"
          }
        ],
        "answer": "9 ô",
        "hints": [
          "Tổng số ô là 24. Khi số ô trắng ít hơn số ô màu là 4 ô thì số ô màu lúc sau là: (24 + 4) : 2 = 14 ô.",
          "Hiện tại đã tô sẵn 5 ô màu, vậy cần tô thêm: 14 – 5 = ? ô."
        ],
        "explanation": "Số ô màu lúc sau cần đạt là: (24 + 4) : 2 = 14 ô. Hiện có 5 ô đã tô, cần tô thêm: 14 – 5 = 9 ô."
      }
    ]
  },
  {
    "id": 326,
    "zoneId": 4,
    "zoneName": "Rừng Hình Học & Đường Gấp Khúc",
    "page": 133,
    "title": "Bài 326: Điểm thẳng hàng & Đếm đoạn thẳng",
    "subtitle": "Nhận biết điểm nằm giữa và đếm hình tam giác",
    "position": {
      "x": 158,
      "z": 60
    },
    "color": 6732650,
    "badge": "Bia Đá 326: Tọa Độ Thẳng Hàng",
    "steps": [
      {
        "stepId": "326_1",
        "prompt": "Cho hình cánh bướm ABCD có giao điểm 2 đường chéo AC và BD tại E. Khẳng định \"3 điểm B, E, D là 3 điểm thẳng hàng\" là Đúng hay Sai?",
        "imageUrl": "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 300 160\" width=\"300\" height=\"160\"><rect width=\"300\" height=\"160\" fill=\"%23f8fafc\" rx=\"8\" stroke=\"%23cbd5e1\"/><polygon points=\"40,30 260,30 260,130 40,130\" fill=\"none\" stroke=\"%2394a3b8\" stroke-dasharray=\"4\" stroke-width=\"1.5\"/><line x1=\"40\" y1=\"30\" x2=\"260\" y2=\"130\" stroke=\"%233b82f6\" stroke-width=\"2.5\"/><line x1=\"40\" y1=\"130\" x2=\"260\" y2=\"30\" stroke=\"%23ec4899\" stroke-width=\"2.5\"/><line x1=\"40\" y1=\"30\" x2=\"40\" y2=\"130\" stroke=\"%2310b981\" stroke-width=\"2.5\"/><line x1=\"260\" y1=\"30\" x2=\"260\" y2=\"130\" stroke=\"%2310b981\" stroke-width=\"2.5\"/><circle cx=\"40\" cy=\"30\" r=\"4.5\" fill=\"%231e293b\"/><circle cx=\"260\" cy=\"30\" r=\"4.5\" fill=\"%231e293b\"/><circle cx=\"40\" cy=\"130\" r=\"4.5\" fill=\"%231e293b\"/><circle cx=\"260\" cy=\"130\" r=\"4.5\" fill=\"%231e293b\"/><circle cx=\"150\" cy=\"80\" r=\"5\" fill=\"%23ef4444\"/><text x=\"25\" y=\"28\" font-family=\"sans-serif\" font-weight=\"bold\" fill=\"%231e293b\" font-size=\"14\">A</text><text x=\"270\" y=\"28\" font-family=\"sans-serif\" font-weight=\"bold\" fill=\"%231e293b\" font-size=\"14\">B</text><text x=\"25\" y=\"145\" font-family=\"sans-serif\" font-weight=\"bold\" fill=\"%231e293b\" font-size=\"14\">D</text><text x=\"270\" y=\"145\" font-family=\"sans-serif\" font-weight=\"bold\" fill=\"%231e293b\" font-size=\"14\">C</text><text x=\"156\" y=\"75\" font-family=\"sans-serif\" font-weight=\"bold\" fill=\"%23ef4444\" font-size=\"14\">E</text></svg>",
        "options": [
          {
            "label": "Đúng",
            "value": "Đúng"
          },
          {
            "label": "Sai",
            "value": "Sai"
          },
          {
            "label": "Không xác định",
            "value": "Không xác định"
          }
        ],
        "answer": "Đúng",
        "hints": [
          "Đoạn thẳng BD đi qua điểm E.",
          "Ba điểm cùng nằm trên một đoạn thẳng là ba điểm thẳng hàng."
        ],
        "explanation": "E là giao điểm của AC và BD nên B, E, D thẳng hàng là Đúng.",
        "explanationImageUrl": "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 300 160\" width=\"300\" height=\"160\"><rect width=\"300\" height=\"160\" fill=\"%23f8fafc\" rx=\"8\" stroke=\"%23cbd5e1\"/><line x1=\"260\" y1=\"30\" x2=\"40\" y2=\"130\" stroke=\"%23eab308\" stroke-width=\"5\" stroke-linecap=\"round\"/><circle cx=\"260\" cy=\"30\" r=\"6\" fill=\"%23ca8a04\"/><circle cx=\"150\" cy=\"80\" r=\"6\" fill=\"%23ca8a04\"/><circle cx=\"40\" cy=\"130\" r=\"6\" fill=\"%23ca8a04\"/><text x=\"270\" y=\"28\" font-family=\"sans-serif\" font-weight=\"bold\" fill=\"%23854d0e\" font-size=\"14\">B</text><text x=\"156\" y=\"72\" font-family=\"sans-serif\" font-weight=\"bold\" fill=\"%23854d0e\" font-size=\"14\">E</text><text x=\"25\" y=\"145\" font-family=\"sans-serif\" font-weight=\"bold\" fill=\"%23854d0e\" font-size=\"14\">D</text><text x=\"150\" y=\"130\" font-family=\"sans-serif\" font-size=\"12\" fill=\"%2315803d\" text-anchor=\"middle\">Đoạn thẳng BD đi qua điểm E</text></svg>"
      },
      {
        "stepId": "326_2",
        "prompt": "Hình vẽ gồm đoạn AB, CD và hai đoạn chéo AC, BD cắt nhau tại E có tất cả bao nhiêu đoạn thẳng?",
        "imageUrl": "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 300 160\" width=\"300\" height=\"160\"><rect width=\"300\" height=\"160\" fill=\"%23f8fafc\" rx=\"8\" stroke=\"%23cbd5e1\"/><polygon points=\"40,30 260,30 260,130 40,130\" fill=\"none\" stroke=\"%2394a3b8\" stroke-dasharray=\"4\" stroke-width=\"1.5\"/><line x1=\"40\" y1=\"30\" x2=\"260\" y2=\"130\" stroke=\"%233b82f6\" stroke-width=\"2.5\"/><line x1=\"40\" y1=\"130\" x2=\"260\" y2=\"30\" stroke=\"%23ec4899\" stroke-width=\"2.5\"/><line x1=\"40\" y1=\"30\" x2=\"40\" y2=\"130\" stroke=\"%2310b981\" stroke-width=\"2.5\"/><line x1=\"260\" y1=\"30\" x2=\"260\" y2=\"130\" stroke=\"%2310b981\" stroke-width=\"2.5\"/><circle cx=\"40\" cy=\"30\" r=\"4.5\" fill=\"%231e293b\"/><circle cx=\"260\" cy=\"30\" r=\"4.5\" fill=\"%231e293b\"/><circle cx=\"40\" cy=\"130\" r=\"4.5\" fill=\"%231e293b\"/><circle cx=\"260\" cy=\"130\" r=\"4.5\" fill=\"%231e293b\"/><circle cx=\"150\" cy=\"80\" r=\"5\" fill=\"%23ef4444\"/><text x=\"25\" y=\"28\" font-family=\"sans-serif\" font-weight=\"bold\" fill=\"%231e293b\" font-size=\"14\">A</text><text x=\"270\" y=\"28\" font-family=\"sans-serif\" font-weight=\"bold\" fill=\"%231e293b\" font-size=\"14\">B</text><text x=\"25\" y=\"145\" font-family=\"sans-serif\" font-weight=\"bold\" fill=\"%231e293b\" font-size=\"14\">D</text><text x=\"270\" y=\"145\" font-family=\"sans-serif\" font-weight=\"bold\" fill=\"%231e293b\" font-size=\"14\">C</text><text x=\"156\" y=\"75\" font-family=\"sans-serif\" font-weight=\"bold\" fill=\"%23ef4444\" font-size=\"14\">E</text></svg>",
        "options": [
          {
            "label": "8 đoạn thẳng",
            "value": "8 đoạn thẳng"
          },
          {
            "label": "6 đoạn thẳng",
            "value": "6 đoạn thẳng"
          },
          {
            "label": "7 đoạn thẳng",
            "value": "7 đoạn thẳng"
          }
        ],
        "answer": "8 đoạn thẳng",
        "hints": [
          "Đoạn thẳng đứng: AB, CD (2 đoạn).",
          "Đoạn AC có điểm E chia thành: AE, EC, AC (3 đoạn). Đoạn BD có điểm E chia thành: BE, ED, BD (3 đoạn)."
        ],
        "explanation": "Tổng số đoạn thẳng là: 2 + 3 + 3 = 8 đoạn thẳng."
      }
    ]
  },
  {
    "id": 327,
    "zoneId": 4,
    "zoneName": "Rừng Hình Học & Đường Gấp Khúc",
    "page": 134,
    "title": "Bài 327: Vẽ thêm 1 đoạn thẳng",
    "subtitle": "Tạo thêm số hình chữ nhật và hình tam giác yêu cầu",
    "position": {
      "x": 157,
      "z": 64
    },
    "color": 6732650,
    "badge": "Bia Đá 327: Đường Kẻ Diệu Kỳ",
    "steps": [
      {
        "stepId": "327_1",
        "prompt": "Hình gồm 1 hình chữ nhật lớn chia đôi thành 2 hình chữ nhật đứng (đang có 3 hình chữ nhật). Kẻ thêm 1 đoạn thẳng ngang qua một nửa hình sẽ tạo được bao nhiêu hình chữ nhật?",
        "options": [
          {
            "label": "5 hình chữ nhật",
            "value": "5 hình chữ nhật"
          },
          {
            "label": "4 hình chữ nhật",
            "value": "4 hình chữ nhật"
          },
          {
            "label": "6 hình chữ nhật",
            "value": "6 hình chữ nhật"
          }
        ],
        "answer": "5 hình chữ nhật",
        "hints": [
          "Ban đầu có 2 hình nhỏ + 1 hình bao ngoài = 3 hình.",
          "Khi kẻ thêm 1 đoạn ngang chia 1 ô thành 2 ô con, ô đó tăng thêm 2 hình mới (2 hình con), tổng thành 3 + 2 = 5 hình."
        ],
        "explanation": "Kẻ 1 đoạn thẳng ngang chia 1 hình chữ nhật con thành 2 phần sẽ tạo thêm 2 hình chữ nhật mới, tổng cộng thành 5 hình chữ nhật."
      }
    ]
  },
  {
    "id": 328,
    "zoneId": 4,
    "zoneName": "Rừng Hình Học & Đường Gấp Khúc",
    "page": 134,
    "title": "Bài 328: Đếm số hình tam giác phức hợp",
    "subtitle": "Đếm hình đơn và hình ghép chính xác",
    "position": {
      "x": 154,
      "z": 68
    },
    "color": 6732650,
    "badge": "Bia Đá 328: Mắt Thần Đếm Hình",
    "steps": [
      {
        "stepId": "328_1",
        "prompt": "Hình thang có 2 đường chéo giao nhau và một tam giác phụ gắn ở cạnh bên trái có tất cả bao nhiêu hình tam giác?",
        "options": [
          {
            "label": "7 hình tam giác",
            "value": "7 hình tam giác"
          },
          {
            "label": "6 hình tam giác",
            "value": "6 hình tam giác"
          },
          {
            "label": "8 hình tam giác",
            "value": "8 hình tam giác"
          }
        ],
        "answer": "7 hình tam giác",
        "hints": [
          "Đếm các tam giác đơn không bị chia cắt: gồm tam giác trái ngoài cùng và 4 tam giác nhỏ bên trong hình thang.",
          "Đếm các tam giác ghép đôi từ 2 tam giác nhỏ."
        ],
        "explanation": "Gồm 5 tam giác đơn và 2 tam giác ghép lớn, tổng cộng có đúng 7 hình tam giác."
      }
    ]
  },
  {
    "id": 329,
    "zoneId": 4,
    "zoneName": "Rừng Hình Học & Đường Gấp Khúc",
    "page": 134,
    "title": "Bài 329: Trung điểm đoạn thẳng",
    "subtitle": "Tính độ dài đoạn thẳng khi biết một nửa",
    "position": {
      "x": 150,
      "z": 69
    },
    "color": 6732650,
    "badge": "Bia Đá 329: Tâm Điểm Cân Bằng",
    "steps": [
      {
        "stepId": "329_1",
        "prompt": "Cho đoạn thẳng AB, M là trung điểm của AB. Biết AM = 6 cm. Độ dài đoạn thẳng AB là bao nhiêu?",
        "options": [
          {
            "label": "12 cm",
            "value": "12 cm"
          },
          {
            "label": "3 cm",
            "value": "3 cm"
          },
          {
            "label": "18 cm",
            "value": "18 cm"
          }
        ],
        "answer": "12 cm",
        "hints": [
          "M là trung điểm của AB nên AM = MB = 6 cm.",
          "Độ dài đoạn AB = AM + MB = 6 + 6."
        ],
        "explanation": "Đoạn thẳng AB dài gấp đôi đoạn AM: 6 × 2 = 12 cm."
      }
    ]
  },
  {
    "id": 330,
    "zoneId": 4,
    "zoneName": "Rừng Hình Học & Đường Gấp Khúc",
    "page": 134,
    "title": "Bài 330: Tổng độ dài 3 đoạn thẳng",
    "subtitle": "Phép cộng các số đo độ dài",
    "position": {
      "x": 145,
      "z": 68
    },
    "color": 6732650,
    "badge": "Bia Đá 330: Thước Đo Tam Khúc",
    "steps": [
      {
        "stepId": "330_1",
        "prompt": "Đoạn AB dài 145 cm, BC dài 200 cm, CD dài 165 cm. Tổng độ dài 3 đoạn thẳng đó là bao nhiêu xăng-ti-mét?",
        "options": [
          {
            "label": "510 cm",
            "value": "510 cm"
          },
          {
            "label": "500 cm",
            "value": "500 cm"
          },
          {
            "label": "520 cm",
            "value": "520 cm"
          }
        ],
        "answer": "510 cm",
        "hints": [
          "Tính: 145 + 200 + 165.",
          "145 + 165 = 310; 310 + 200 = ?"
        ],
        "explanation": "145 cm + 200 cm + 165 cm = 310 cm + 200 cm = 510 cm."
      }
    ]
  },
  {
    "id": 331,
    "zoneId": 4,
    "zoneName": "Rừng Hình Học & Đường Gấp Khúc",
    "page": 134,
    "title": "Bài 331: Đường gấp khúc 3 đoạn có lời văn",
    "subtitle": "Giải bài toán hai bước tính độ dài đường gấp khúc",
    "position": {
      "x": 142,
      "z": 64
    },
    "color": 6732650,
    "badge": "Bia Đá 331: Chặng Đường Ba Khúc",
    "steps": [
      {
        "stepId": "331_1",
        "prompt": "Một đường gấp khúc gồm 3 đoạn. Đoạn 1 dài 120 cm. Đoạn 2 dài 230 cm và ngắn hơn đoạn 3 là 70 cm. Độ dài đường gấp khúc đó là bao nhiêu?",
        "options": [
          {
            "label": "650 cm",
            "value": "650 cm"
          },
          {
            "label": "580 cm",
            "value": "580 cm"
          },
          {
            "label": "720 cm",
            "value": "720 cm"
          }
        ],
        "answer": "650 cm",
        "hints": [
          "Đoạn 2 ngắn hơn đoạn 3 là 70 cm ➔ Đoạn 3 dài: 230 + 70 = 300 cm.",
          "Độ dài cả đường gấp khúc: 120 + 230 + 300."
        ],
        "explanation": "Đoạn 3 dài: 230 + 70 = 300 cm. Cả đường gấp khúc dài: 120 + 230 + 300 = 650 cm."
      }
    ]
  },
  {
    "id": 332,
    "zoneId": 4,
    "zoneName": "Rừng Hình Học & Đường Gấp Khúc",
    "page": 135,
    "title": "Bài 332: Đường gấp khúc ABCDE 4 đoạn",
    "subtitle": "Tính tổng độ dài theo hình vẽ minh họa",
    "position": {
      "x": 142,
      "z": 56
    },
    "color": 6732650,
    "badge": "Bia Đá 332: Khúc Nhạc Quanh Co",
    "steps": [
      {
        "stepId": "332_1",
        "prompt": "Tính độ dài đường gấp khúc ABCDE biết: AB = 35 cm, BC = 35 cm, CD = 23 cm, DE = 35 cm.",
        "options": [
          {
            "label": "128 cm",
            "value": "128 cm"
          },
          {
            "label": "118 cm",
            "value": "118 cm"
          },
          {
            "label": "138 cm",
            "value": "138 cm"
          }
        ],
        "answer": "128 cm",
        "hints": [
          "Độ dài = AB + BC + CD + DE = 35 + 35 + 23 + 35.",
          "35 × 3 = 105; 105 + 23 = ?"
        ],
        "explanation": "Độ dài đường gấp khúc là: 35 + 35 + 23 + 35 = 128 cm."
      }
    ]
  },
  {
    "id": 333,
    "zoneId": 4,
    "zoneName": "Rừng Hình Học & Đường Gấp Khúc",
    "page": 135,
    "title": "Bài 333: Đếm đoạn thẳng & hình chữ nhật",
    "subtitle": "Phân tích hình chữ nhật chia đôi theo chiều dọc",
    "position": {
      "x": 145,
      "z": 52
    },
    "color": 6732650,
    "badge": "Bia Đá 333: Khung Tranh Đôi Lớp",
    "steps": [
      {
        "stepId": "333_1",
        "prompt": "Hình chữ nhật ABCD có đoạn EG chia thành 2 hình chữ nhật nhỏ. Hình có bao nhiêu hình chữ nhật và bao nhiêu đoạn thẳng?",
        "options": [
          {
            "label": "3 hình chữ nhật và 9 đoạn thẳng",
            "value": "3 hình chữ nhật và 9 đoạn thẳng"
          },
          {
            "label": "2 hình chữ nhật và 7 đoạn thẳng",
            "value": "2 hình chữ nhật và 7 đoạn thẳng"
          },
          {
            "label": "3 hình chữ nhật và 6 đoạn thẳng",
            "value": "3 hình chữ nhật và 6 đoạn thẳng"
          }
        ],
        "answer": "3 hình chữ nhật và 9 đoạn thẳng",
        "hints": [
          "Hình chữ nhật: AEGD, EBCG và ABCD (3 hình).",
          "Đoạn thẳng: Cạnh trên có AE, EB, AB (3); Cạnh dưới có DG, GC, DC (3); Ba đoạn dọc AD, EG, BC (3). Tổng là 3+3+3."
        ],
        "explanation": "Có 3 hình chữ nhật và 9 đoạn thẳng tất cả."
      }
    ]
  },
  {
    "id": 334,
    "zoneId": 4,
    "zoneName": "Rừng Hình Học & Đường Gấp Khúc",
    "page": 135,
    "title": "Bài 334: Đếm tam giác & tứ giác trong HCN",
    "subtitle": "Đếm hình hình học từ các đường chéo và đoạn nối",
    "position": {
      "x": 150,
      "z": 51
    },
    "color": 6732650,
    "badge": "Bia Đá 334: Mạng Lưới Đa Giác",
    "steps": [
      {
        "stepId": "334_1",
        "prompt": "Hình chữ nhật ABCE có điểm D trên cạnh EC nối với B tạo thành các tam giác. Hình có bao nhiêu hình tam giác?",
        "options": [
          {
            "label": "4 hình tam giác",
            "value": "4 hình tam giác"
          },
          {
            "label": "3 hình tam giác",
            "value": "3 hình tam giác"
          },
          {
            "label": "5 hình tam giác",
            "value": "5 hình tam giác"
          }
        ],
        "answer": "4 hình tam giác",
        "hints": [
          "Tam giác góc vuông: ABE, BCD.",
          "Các tam giác chứa cạnh chéo: BDE, BCE."
        ],
        "explanation": "Có 4 hình tam giác gồm: ABE, BCE, BDE và BDC."
      }
    ]
  },
  {
    "id": 335,
    "zoneId": 4,
    "zoneName": "Rừng Hình Học & Đường Gấp Khúc",
    "page": 136,
    "title": "Bài 335: Tam giác có đường cắt song song",
    "subtitle": "Đếm số hình tam giác và tứ giác tạo bởi đường song song",
    "position": {
      "x": 154,
      "z": 52
    },
    "color": 6732650,
    "badge": "Bia Đá 335: Tháp Cắt Tầng",
    "steps": [
      {
        "stepId": "335_1",
        "prompt": "Tam giác ABC có đoạn MN song song đáy BC, nối C với N. Hình có bao nhiêu hình tam giác và bao nhiêu hình tứ giác?",
        "options": [
          {
            "label": "4 hình tam giác và 1 hình tứ giác",
            "value": "4 hình tam giác và 1 hình tứ giác"
          },
          {
            "label": "3 hình tam giác và 2 hình tứ giác",
            "value": "3 hình tam giác và 2 hình tứ giác"
          },
          {
            "label": "5 hình tam giác và 1 hình tứ giác",
            "value": "5 hình tam giác và 1 hình tứ giác"
          }
        ],
        "answer": "4 hình tam giác và 1 hình tứ giác",
        "hints": [
          "Tam giác: AMN, MNC, ANC, ABC (4 tam giác).",
          "Tứ giác: BMNC (1 tứ giác)."
        ],
        "explanation": "Có 4 hình tam giác (AMN, MNC, ANC, ABC) và 1 hình tứ giác (BMNC)."
      }
    ]
  },
  {
    "id": 336,
    "zoneId": 4,
    "zoneName": "Rừng Hình Học & Đường Gấp Khúc",
    "page": 136,
    "title": "Bài 336: Đếm điểm và tứ giác hình thang vuông",
    "subtitle": "Phân tích điểm, đoạn thẳng trong hình thang vuông",
    "position": {
      "x": 157,
      "z": 56
    },
    "color": 6732650,
    "badge": "Bia Đá 336: Điểm Mốc Đồ Hình",
    "steps": [
      {
        "stepId": "336_1",
        "prompt": "Hình thang vuông ABCD có điểm M trên đáy CD và điểm giao N. Hình có bao nhiêu điểm phân biệt?",
        "options": [
          {
            "label": "6 điểm (A, B, C, D, M, N)",
            "value": "6 điểm (A, B, C, D, M, N)"
          },
          {
            "label": "5 điểm (A, B, C, D, M)",
            "value": "5 điểm (A, B, C, D, M)"
          },
          {
            "label": "7 điểm",
            "value": "7 điểm"
          }
        ],
        "answer": "6 điểm (A, B, C, D, M, N)",
        "hints": [
          "Đếm 4 đỉnh của hình thang: A, B, C, D.",
          "Đếm thêm điểm nằm trên cạnh M và điểm giao nhau N."
        ],
        "explanation": "Hình có đúng 6 điểm được đánh dấu: A, B, C, D, M, N."
      }
    ]
  },
  {
    "id": 337,
    "zoneId": 4,
    "zoneName": "Rừng Hình Học & Đường Gấp Khúc",
    "page": 136,
    "title": "Bài 337: Đường gấp khúc MNPQ",
    "subtitle": "Bài toán lời văn so sánh hơn kém đường gấp khúc",
    "position": {
      "x": 148,
      "z": 57
    },
    "color": 6732650,
    "badge": "Bia Đá 337: Nhịp Cầu MNPQ",
    "steps": [
      {
        "stepId": "337_1",
        "prompt": "Đường gấp khúc MNPQ có đoạn MN = 219 cm. Tổng hai đoạn NP và PQ hơn đoạn MN là 180 cm. Độ dài đường gấp khúc MNPQ là bao nhiêu?",
        "options": [
          {
            "label": "618 cm",
            "value": "618 cm"
          },
          {
            "label": "399 cm",
            "value": "399 cm"
          },
          {
            "label": "598 cm",
            "value": "598 cm"
          }
        ],
        "answer": "618 cm",
        "hints": [
          "Tính tổng hai đoạn NP + PQ: 219 + 180 = 399 cm.",
          "Độ dài cả đường MNPQ: MN + (NP + PQ) = 219 + 399."
        ],
        "explanation": "NP + PQ = 219 + 180 = 399 cm. MNPQ = 219 + 399 = 618 cm."
      }
    ]
  },
  {
    "id": 338,
    "zoneId": 4,
    "zoneName": "Rừng Hình Học & Đường Gấp Khúc",
    "page": 137,
    "title": "Bài 338: Đường gấp khúc 3 đoạn dài hơn",
    "subtitle": "Tìm đoạn thứ ba qua quan hệ so sánh dài hơn",
    "position": {
      "x": 152,
      "z": 63
    },
    "color": 6732650,
    "badge": "Bia Đá 338: Thử Thách Uốn Lượn",
    "steps": [
      {
        "stepId": "338_1",
        "prompt": "Đoạn 1 dài 218 cm, đoạn 2 dài 345 cm và dài hơn đoạn 3 là 165 cm. Độ dài đường gấp khúc đó là bao nhiêu?",
        "options": [
          {
            "label": "743 cm",
            "value": "743 cm"
          },
          {
            "label": "728 cm",
            "value": "728 cm"
          },
          {
            "label": "753 cm",
            "value": "753 cm"
          }
        ],
        "answer": "743 cm",
        "hints": [
          "Đoạn 2 dài hơn đoạn 3 là 165 cm ➔ Đoạn 3 dài: 345 – 165 = 180 cm.",
          "Độ dài cả đường: 218 + 345 + 180."
        ],
        "explanation": "Đoạn 3 dài: 345 – 165 = 180 cm. Tổng độ dài: 218 + 345 + 180 = 743 cm."
      }
    ]
  },
  {
    "id": 339,
    "zoneId": 2,
    "zoneName": "Suối Nguồn Tính Nhanh & Dãy Số",
    "page": 137,
    "title": "Bài 339: Tính nhanh nhóm tròn chục tròn trăm",
    "subtitle": "Kết hợp giao hoán và kết hợp thông minh",
    "position": {
      "x": 150,
      "z": -55
    },
    "color": 2533018,
    "badge": "Bia Đá 339: Vòng Ghép Hoàn Hảo",
    "steps": [
      {
        "stepId": "339_1",
        "prompt": "Tính nhanh: A = 125 + 73 + 45 + 75 + 127 + 55",
        "options": [
          {
            "label": "500",
            "value": "500"
          },
          {
            "label": "480",
            "value": "480"
          },
          {
            "label": "520",
            "value": "520"
          }
        ],
        "answer": "500",
        "hints": [
          "Nhóm: (125 + 75) + (45 + 55) + (73 + 127).",
          "200 + 100 + 200 = ?"
        ],
        "explanation": "A = (125 + 75) + (45 + 55) + (73 + 127) = 200 + 100 + 200 = 500."
      },
      {
        "stepId": "339_2",
        "prompt": "Tính nhanh: B = 183 + 72 – 83 + 28 + 80",
        "options": [
          {
            "label": "280",
            "value": "280"
          },
          {
            "label": "300",
            "value": "300"
          },
          {
            "label": "260",
            "value": "260"
          }
        ],
        "answer": "280",
        "hints": [
          "Nhóm: (183 – 83) + (72 + 28) + 80.",
          "100 + 100 + 80 = ?"
        ],
        "explanation": "B = (183 – 83) + (72 + 28) + 80 = 100 + 100 + 80 = 280."
      }
    ]
  },
  {
    "id": 340,
    "zoneId": 2,
    "zoneName": "Suối Nguồn Tính Nhanh & Dãy Số",
    "page": 137,
    "title": "Bài 340: Dãy số giảm dần và số tam giác",
    "subtitle": "Giải mã dãy số có quy luật biến thiên",
    "position": {
      "x": 155,
      "z": -55
    },
    "color": 2533018,
    "badge": "Bia Đá 340: Vũ Điệu Các Con Số",
    "steps": [
      {
        "stepId": "340_1",
        "prompt": "Tìm 3 số tiếp theo: 598; 587; 576; 565; 554; [ ? ]; [ ? ]; [ ? ]",
        "options": [
          {
            "label": "543; 532; 521",
            "value": "543; 532; 521"
          },
          {
            "label": "544; 533; 522",
            "value": "544; 533; 522"
          },
          {
            "label": "542; 531; 520",
            "value": "542; 531; 520"
          }
        ],
        "answer": "543; 532; 521",
        "hints": [
          "Quy luật giảm dần: 598 – 587 = 11; 587 – 576 = 11.",
          "Mỗi số đứng sau kém số trước 11 đơn vị."
        ],
        "explanation": "Dãy giảm đều 11 đơn vị: 554 – 11 = 543; 543 – 11 = 532; 532 – 11 = 521."
      },
      {
        "stepId": "340_2",
        "prompt": "Tìm số tiếp theo: 109; 110; 112; 115; 119; [ ? ]",
        "options": [
          {
            "label": "124",
            "value": "124"
          },
          {
            "label": "123",
            "value": "123"
          },
          {
            "label": "125",
            "value": "125"
          }
        ],
        "answer": "124",
        "hints": [
          "Khoảng cách: +1, +2, +3, +4...",
          "Số tiếp theo hơn 119 là 5 đơn vị: 119 + 5 = ?"
        ],
        "explanation": "Khoảng cách tăng dần 1 đơn vị mỗi bước: 119 + 5 = 124."
      }
    ]
  },
  {
    "id": 341,
    "zoneId": 1,
    "zoneName": "Thung Lũng Tính Toán & Đại Lượng",
    "page": 138,
    "title": "Bài 341: Điền số thích hợp vào ô trống",
    "subtitle": "Xác định thành phần trong biểu thức kết hợp",
    "position": {
      "x": 113,
      "z": -55
    },
    "color": 4367861,
    "badge": "Bia Đá 341: Khung Ô Thần Kỳ",
    "steps": [
      {
        "stepId": "341_1",
        "prompt": "Điền số vào ô trống: [ ? ] – 80 + 200 = 210",
        "options": [
          {
            "label": "90",
            "value": "90"
          },
          {
            "label": "70",
            "value": "70"
          },
          {
            "label": "100",
            "value": "100"
          }
        ],
        "answer": "90",
        "hints": [
          "Coi ([ ? ] – 80) là một số: ([ ? ] – 80) + 200 = 210 ➔ [ ? ] – 80 = 10.",
          "Vậy [ ? ] = 10 + 80 = ?"
        ],
        "explanation": "[ ? ] – 80 = 210 – 200 = 10 ➔ [ ? ] = 10 + 80 = 90."
      },
      {
        "stepId": "341_2",
        "prompt": "Điền số vào ô trống: 502 + 98 – [ ? ] = 200",
        "options": [
          {
            "label": "400",
            "value": "400"
          },
          {
            "label": "300",
            "value": "300"
          },
          {
            "label": "500",
            "value": "500"
          }
        ],
        "answer": "400",
        "hints": [
          "Tính tổng trước: 502 + 98 = 600.",
          "600 – [ ? ] = 200 ➔ [ ? ] = 600 – 200."
        ],
        "explanation": "502 + 98 = 600. Lấy 600 – 200 = 400."
      }
    ]
  },
  {
    "id": 342,
    "zoneId": 1,
    "zoneName": "Thung Lũng Tính Toán & Đại Lượng",
    "page": 138,
    "title": "Bài 342: Tìm x biểu thức nhiều bước",
    "subtitle": "Tìm x với hai vế biểu thức phong phú",
    "position": {
      "x": 116,
      "z": -55
    },
    "color": 4367861,
    "badge": "Bia Đá 342: Vòng Quay Tìm x",
    "steps": [
      {
        "stepId": "342_1",
        "prompt": "Tìm x biết: x + 456 = 510 + 47",
        "options": [
          {
            "label": "x = 101",
            "value": "x = 101"
          },
          {
            "label": "x = 111",
            "value": "x = 111"
          },
          {
            "label": "x = 91",
            "value": "x = 91"
          }
        ],
        "answer": "x = 101",
        "hints": [
          "Tính vế phải: 510 + 47 = 557.",
          "x = 557 – 456."
        ],
        "explanation": "510 + 47 = 557 ➔ x = 557 – 456 = 101."
      },
      {
        "stepId": "342_2",
        "prompt": "Tìm x biết: 500 – x + 123 = 500 – 122",
        "options": [
          {
            "label": "x = 245",
            "value": "x = 245"
          },
          {
            "label": "x = 235",
            "value": "x = 235"
          },
          {
            "label": "x = 255",
            "value": "x = 255"
          }
        ],
        "answer": "x = 245",
        "hints": [
          "Tính vế phải: 500 – 122 = 378.",
          "Ta có: 500 + 123 – x = 378 ➔ 623 – x = 378 ➔ x = 623 – 378."
        ],
        "explanation": "623 – x = 378 ➔ x = 623 – 378 = 245."
      }
    ]
  },
  {
    "id": 343,
    "zoneId": 3,
    "zoneName": "Đồi Thời Gian & Đo Lường Cân Đĩa",
    "page": 138,
    "title": "Bài 343: Cân đĩa thăng bằng",
    "subtitle": "Chọn túi quả cân thích hợp để cân thăng bằng",
    "position": {
      "x": 106,
      "z": 66
    },
    "color": 16754470,
    "badge": "Bia Đá 343: Cân Đĩa Cân Bằng",
    "steps": [
      {
        "stepId": "343_1",
        "prompt": "Đĩa trái có 1 túi 400g. Để đĩa cân thăng bằng, cần chọn những túi nào trong 3 túi: Túi A (250g), Túi B (350g), Túi C (150g)?",
        "options": [
          {
            "label": "Túi A và Túi C",
            "value": "Túi A và Túi C"
          },
          {
            "label": "Túi B và Túi C",
            "value": "Túi B và Túi C"
          },
          {
            "label": "Chỉ Túi B",
            "value": "Chỉ Túi B"
          }
        ],
        "answer": "Túi A và Túi C",
        "hints": [
          "Để cân thăng bằng thì tổng khối lượng các túi bên phải phải bằng 400g.",
          "Thử: 250g + 150g = 400g (Túi A + Túi C)."
        ],
        "explanation": "Ta có 250g + 150g = 400g. Vậy chọn túi A và túi C."
      }
    ]
  },
  {
    "id": 344,
    "zoneId": 3,
    "zoneName": "Đồi Thời Gian & Đo Lường Cân Đĩa",
    "page": 139,
    "title": "Bài 344 (*): Khối lượng khuyên tròn & khối hộp",
    "subtitle": "Bài toán suy luận cân đĩa 2 trạng thái (*)",
    "position": {
      "x": 114,
      "z": 66
    },
    "color": 16754470,
    "badge": "Bia Đá 344: Cân Đĩa Bí Ẩn (*)",
    "steps": [
      {
        "stepId": "344_1",
        "prompt": "Cân 1: 7 khuyên tròn thăng bằng với 2 khuyên tròn + 2 túi 15g. Một khuyên tròn nặng bao nhiêu gam?",
        "options": [
          {
            "label": "6 gam",
            "value": "6 gam"
          },
          {
            "label": "5 gam",
            "value": "5 gam"
          },
          {
            "label": "8 gam",
            "value": "8 gam"
          }
        ],
        "answer": "6 gam",
        "hints": [
          "Bớt 2 khuyên tròn ở cả 2 đĩa: 5 khuyên tròn = 2 túi 15g = 30g.",
          "1 khuyên tròn = 30 : 5 = ?"
        ],
        "explanation": "5 khuyên tròn = 30g ➔ 1 khuyên tròn nặng 30 : 5 = 6g."
      },
      {
        "stepId": "344_2",
        "prompt": "Cân 2: 1 khuyên tròn (6g) + 1 khối hộp thăng bằng với 1 túi 15g. Khối hộp nặng bao nhiêu gam?",
        "options": [
          {
            "label": "9 gam",
            "value": "9 gam"
          },
          {
            "label": "8 gam",
            "value": "8 gam"
          },
          {
            "label": "10 gam",
            "value": "10 gam"
          }
        ],
        "answer": "9 gam",
        "hints": [
          "Khối lượng: 6g + Khối hộp = 15g.",
          "Khối hộp = 15g – 6g."
        ],
        "explanation": "Khối hộp nặng: 15 – 6 = 9 (gam)."
      }
    ]
  },
  {
    "id": 345,
    "zoneId": 5,
    "zoneName": "Đỉnh Núi Tư Duy Sao (*, **)",
    "page": 139,
    "title": "Bài 345 (**): Tam giác số ma thuật",
    "subtitle": "Điền các số 1 đến 6 vào 3 cạnh tam giác (**)",
    "position": {
      "x": 194,
      "z": 4
    },
    "color": 11225020,
    "badge": "Bia Đá 345: Tam Giác Ma Thuật Tối Thượng (**)",
    "steps": [
      {
        "stepId": "345_1",
        "prompt": "Điền các số từ 1 đến 6 vào 6 hình tròn trên 3 cạnh tam giác (mỗi cạnh 3 số) sao cho tổng mỗi cạnh bằng 12. Ba số đặt ở 3 đỉnh của hình tam giác phải là những số nào?",
        "options": [
          {
            "label": "4, 5, 6",
            "value": "4, 5, 6"
          },
          {
            "label": "1, 2, 3",
            "value": "1, 2, 3"
          },
          {
            "label": "3, 4, 5",
            "value": "3, 4, 5"
          }
        ],
        "answer": "4, 5, 6",
        "hints": [
          "Tổng 3 cạnh = 12 × 3 = 36. Tổng từ 1 đến 6 là 1+2+3+4+5+6 = 21.",
          "Các đỉnh được tính 2 lần, nên tổng 3 đỉnh = 36 – 21 = 15. Ba số từ 1..6 có tổng bằng 15 duy nhất là: 4, 5, 6."
        ],
        "explanation": "Tổng 3 đỉnh phải bằng 12 × 3 – 21 = 15. Ba số khác nhau trong khoảng 1–6 có tổng bằng 15 là 4, 5, 6."
      },
      {
        "stepId": "345_2",
        "prompt": "Nếu muốn tổng mỗi cạnh tam giác đều bằng 11 thì tổng 3 số ở 3 đỉnh phải bằng bao nhiêu?",
        "options": [
          {
            "label": "12",
            "value": "12"
          },
          {
            "label": "10",
            "value": "10"
          },
          {
            "label": "14",
            "value": "14"
          }
        ],
        "answer": "12",
        "hints": [
          "Tổng 3 cạnh = 11 × 3 = 33.",
          "Tổng 3 đỉnh = Tổng 3 cạnh – Tổng (1+2+3+4+5+6) = 33 – 21 = ?"
        ],
        "explanation": "Tổng 3 số ở 3 đỉnh là: 11 × 3 – 21 = 12 (ví dụ chọn 3 đỉnh là 2, 4, 6)."
      }
    ]
  }
];

export function getMonolithById(id: number): ArchimedesMonolith | undefined {
  return ARCHIMEDES_MONOLITHS.find(m => m.id === id);
}

export function getMonolithsByZone(zoneId: number): ArchimedesMonolith[] {
  return ARCHIMEDES_MONOLITHS.filter(m => m.zoneId === zoneId);
}
