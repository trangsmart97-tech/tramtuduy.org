import { createClient } from "@supabase/supabase-js";

// Khóa công khai (publishable): được thiết kế để nằm trong trang web.
// Quyền thật được khoá ở cơ sở dữ liệu bằng luật phân quyền theo hàng.
export const SUPABASE_URL = "https://pqildzyhzpudfkjinhyx.supabase.co";
const KHOA_CONG_KHAI = "sb_publishable_A_TxFkSIx-evT5vTUEzp3w_vUIOH3l_";

export const sb = createClient(SUPABASE_URL, KHOA_CONG_KHAI, {
  auth: { flowType: "pkce", persistSession: true, detectSessionInUrl: true },
});
