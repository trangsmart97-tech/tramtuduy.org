import { createClient } from "@supabase/supabase-js";

// Khóa công khai (publishable): được thiết kế để nằm trong trang web.
// Quyền thật được khoá ở cơ sở dữ liệu bằng luật phân quyền theo hàng.
// Chỉ khi chạy thử trên máy (npm run dev) mới đổi được địa chỉ, để trỏ vào máy chủ thử cong-cu/luyen-de/may_chu.mjs.
// Bản đăng lên tramtuduy.org luôn dùng địa chỉ thật bên dưới.
export const SUPABASE_URL = (import.meta.env.DEV && import.meta.env.VITE_SUPABASE_URL) || "https://pqildzyhzpudfkjinhyx.supabase.co";
const KHOA_CONG_KHAI = "sb_publishable_A_TxFkSIx-evT5vTUEzp3w_vUIOH3l_";

export const sb = createClient(SUPABASE_URL, KHOA_CONG_KHAI, {
  auth: { flowType: "pkce", persistSession: true, detectSessionInUrl: true },
});
