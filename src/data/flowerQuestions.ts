export interface FlowerOption {
  label: string;
  value: string;
}

export interface FlowerQuestion {
  id: number;
  title: string;
  question: string;
  imageUrl?: string;
  options: FlowerOption[];
  answer: string;
  hints: string[];
  explanation: string;
  explanationImageUrl?: string;
  color: number;
  badge: string;
}

/**
 * Danh sách câu hỏi Vườn Hoa Tri Thức được nạp động 100% từ tab VuonHoa trên Google Sheets.
 * Mảng mặc định để rỗng trên Frontend.
 */
export const FLOWER_QUESTIONS: FlowerQuestion[] = [];
