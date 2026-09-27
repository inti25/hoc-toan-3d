/**
 * ============================================================================
 * IMAGE RESOLVER PIPELINE
 * ============================================================================
 * Xử lý và chuẩn hóa các nguồn hình ảnh:
 * 1. Google Drive Share Links -> lh3.googleusercontent.com Direct View
 * 2. Base64 Data URI & Raw Base64 string -> data:image/png;base64,...
 * 3. Markdown Image syntax (![alt](url)) -> bóc tách clean text & image URL
 * 4. Direct Public URLs (.png, .jpg, .webp, .svg, CDN)
 */

const GOOGLE_DRIVE_PATTERN = /drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:[^&]+&)*id=)([a-zA-Z0-9_-]+)/i;
const DATA_URI_PATTERN = /^data:image\/(?:png|jpeg|jpg|webp|gif|svg\+xml)[;,]/i;
const RAW_BASE64_PATTERN = /^[A-Za-z0-9+/=]{20,}$/;

/**
 * Chuẩn hóa URL hình ảnh từ nhiều nguồn khác nhau
 */
export function resolveImageUrl(rawSource?: string | null): string | undefined {
  if (!rawSource) return undefined;
  const trimmed = String(rawSource).trim();
  if (!trimmed) return undefined;

  // Chặn các scheme nguy hiểm (XSS prevention)
  if (/^(javascript|vbscript):/i.test(trimmed)) {
    return undefined;
  }

  // 1. Kiểm tra nếu là Base64 Data URI hợp lệ
  if (DATA_URI_PATTERN.test(trimmed)) {
    return trimmed;
  }

  // 2. Kiểm tra nếu là chuỗi Base64 thô (chưa có prefix data:image/png;base64,)
  // Loại bỏ khoảng trắng hoặc xuống dòng nếu có
  const cleanBase64 = trimmed.replace(/\s+/g, '');
  if (RAW_BASE64_PATTERN.test(cleanBase64)) {
    return `data:image/png;base64,${cleanBase64}`;
  }

  // 3. Kiểm tra nếu là Google Drive share link
  const driveMatch = trimmed.match(GOOGLE_DRIVE_PATTERN);
  if (driveMatch && driveMatch[1]) {
    const fileId = driveMatch[1];
    return `https://lh3.googleusercontent.com/d/${fileId}`;
  }

  // 4. Nếu là HTTP / HTTPS URL thông thường
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return undefined;
}

/**
 * Bóc tách cú pháp Markdown Image: ![mô tả](link_ảnh)
 * Trả về chuỗi văn bản sạch (đã bỏ markdown image) và URL ảnh nếu có
 */
export function extractMarkdownImage(rawText: string): { cleanText: string; imageUrl?: string } {
  if (!rawText) return { cleanText: '' };

  const markdownImgRegex = /!\[(.*?)\]\((.*?)\)/;
  const match = rawText.match(markdownImgRegex);

  if (match) {
    const rawUrl = match[2]?.trim();
    const cleanText = rawText.replace(markdownImgRegex, '').replace(/\s{2,}/g, ' ').trim();
    const resolvedUrl = resolveImageUrl(rawUrl);
    return {
      cleanText,
      imageUrl: resolvedUrl
    };
  }

  return { cleanText: rawText };
}
