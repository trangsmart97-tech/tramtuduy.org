import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { sb } from "./supabase";
import type { NhanSu } from "./hoSo";

type NguoiDung = {
  sanSang: boolean;
  email: string | null;
  vai: NhanSu | null;            // có giá trị nếu là một trong bốn cô
  con: { id: string; ho_ten: string }[]; // các con của phụ huynh
  dangXuat: () => Promise<void>;
};
const Ctx = createContext<NguoiDung>({ sanSang: false, email: null, vai: null, con: [], dangXuat: async () => {} });
export const useNguoiDung = () => useContext(Ctx);

export function NguoiDungProvider({ children }: { children: ReactNode }) {
  const [st, setSt] = useState<Omit<NguoiDung, "dangXuat">>({ sanSang: false, email: null, vai: null, con: [] });
  useEffect(() => {
    const nap = async (email: string | null) => {
      if (!email) { setSt({ sanSang: true, email: null, vai: null, con: [] }); return; }
      const e = email.toLowerCase();
      const [{ data: ns }, { data: gd }] = await Promise.all([
        sb.from("nhan_su").select("*").eq("email", e).maybeSingle(),
        sb.from("gia_dinh").select("hoc_sinh_id, hoc_sinh(id, ho_ten)").eq("email", e),
      ]);
      const con = (gd ?? []).map((r: any) => ({ id: r.hoc_sinh?.id ?? r.hoc_sinh_id, ho_ten: r.hoc_sinh?.ho_ten ?? "Con" }));
      setSt({ sanSang: true, email: e, vai: (ns as NhanSu) ?? null, con });
    };
    sb.auth.getSession().then(({ data }) => nap(data.session?.user.email ?? null));
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => { nap(s?.user.email ?? null); });
    return () => sub.subscription.unsubscribe();
  }, []);
  const dangXuat = async () => { await sb.auth.signOut(); location.hash = "#/"; };
  return <Ctx.Provider value={{ ...st, dangXuat }}>{children}</Ctx.Provider>;
}
